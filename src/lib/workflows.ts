import { db, nextNumber } from "./data/store";
import { computePricing } from "./calc";
import { OS_STATUS, QUOTE_STATUS, STOCK_MOVES, PAY_METHODS } from "./constants";
import { currentUser } from "./session";
import { SETTINGS_DEFAULTS } from "./settings";
import { DEFAULT_FEES } from "./calc";
import type { PricingLine, Rec } from "./types";
import { addDays, addMonths, dayOf, fmtDate, newId, newToken, nowISO, round2, todayISO, toNum } from "./utils";
import { fireTrigger } from "./automation";

export function getSettings(): Record<string, any> {
  const raw: Record<string, any> = db.get("settings", "company") || {};
  return { ...SETTINGS_DEFAULTS, ...raw, fees: { ...DEFAULT_FEES, ...(raw.fees || {}), parcelado: { ...DEFAULT_FEES.parcelado, ...(raw.fees?.parcelado || {}) } } };
}

export function pushHistory(rec: Rec, entry: Record<string, any>): Rec[] {
  const u = currentUser();
  return [...(rec.history || []), { id: newId(), at: nowISO(), by: u.id, byName: u.name, ...entry }];
}

export function customerAddress(c?: Rec) {
  if (!c) return "";
  const l1 = [c.street, c.number].filter(Boolean).join(", ");
  const l2 = [c.district, [c.city, c.state].filter(Boolean).join("/")].filter(Boolean).join(" - ");
  return [l1, l2, c.zip].filter(Boolean).join(" · ");
}

/* ------------------------------------------------------------------ notificações */
const NOTIFY_GROUP: Record<string, string> = {
  quote_approved: "quotes", quote_rejected: "quotes", quote_change: "quotes", message: "messages", late_order: "lateOrders",
  low_stock: "lowStock", due_bill: "dueBills", payment: "payments", goal: "goals", warranty: "warranties", info: "quotes", evaluation: "messages", additional: "quotes", completion: "messages", upload: "messages",
};

export function notify(n: { type: string; title: string; body?: string; entity?: { col: string; id: string }; key?: string; severity?: "info" | "ok" | "warn" | "bad" }) {
  const s = getSettings();
  const g = NOTIFY_GROUP[n.type];
  if (g && s.notify && s.notify[g] === false) return;
  const id = n.key ? `n_${n.key}`.replace(/[^\w\-:.]/g, "_") : newId();
  if (n.key && db.get("notifications", id)) return;
  db.create("notifications", { type: n.type, title: n.title, body: n.body || "", entity: n.entity || null, read: false, severity: n.severity || "info", at: nowISO() }, id);
}

/* ------------------------------------------------------------------ CRM helpers */
const STAGE_ORDER = ["lead", "contato", "orcamento", "negociacao", "aprovado", "cliente", "pos_venda", "recorrente", "inativo"];
export function syncLeadStage(customerId: string | undefined, stage: string) {
  if (!customerId) return;
  const lead = db.list("crm_leads").find((l) => l.customerId === customerId && !l.deletedAt);
  if (lead && lead.stage !== stage && STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(lead.stage)) {
    db.update("crm_leads", lead.id, { stage }, { silent: true });
  }
}

/* ------------------------------------------------------------------ links públicos */
export function publicUrl(kind: "quote" | "work_order", token: string) {
  return `${typeof location !== "undefined" ? location.origin : ""}/${kind === "quote" ? "o" : "os"}/${token}`;
}

function companySnapshot(s: Record<string, any>) {
  return {
    name: s.tradeName || s.name, document: s.document, phone: s.phone, whatsapp: s.whatsapp, email: s.email, address: s.address,
    instagram: s.instagram, logoUrl: s.logoUrl, primaryColor: s.primaryColor, secondaryColor: s.secondaryColor,
    footer: s.pdfFooter, terms: s.terms, paymentTerms: s.paymentTerms,
  };
}

function itemsSnapshot(lines: PricingLine[]) {
  return (lines || []).map((l) => {
    const base = toNum(l.qty) * toNum(l.unitPrice);
    return { name: l.name, qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct, material: l.material, note: l.note || "", total: round2(base - base * (toNum(l.discountPct) / 100) + toNum(l.material)) };
  });
}

export function buildSnapshot(kind: "quote" | "work_order", rec: Rec, prev?: Record<string, any>): Record<string, any> {
  const s = getSettings();
  const cust = db.get("customers", rec.customerId);
  const customerName = cust?.name || prev?.customerName || "";
  const pricing = rec.pricing || { lines: [] };
  const totals = rec.totals || computePricing(pricing, s.fees);
  const base = {
    kind,
    number: rec.number,
    title: rec.title,
    customerName,
    company: companySnapshot(s),
    items: itemsSnapshot(pricing.lines),
    totals: { subtotal: totals.subtotal, itemDiscount: totals.itemDiscount, additions: totals.additions, generalDiscount: totals.generalDiscount, feeAmount: totals.feeAmount, total: totals.total },
    paymentMethod: PAY_METHODS[pricing.paymentMethod] || "",
    installments: pricing.paymentMethod === "parcelado" ? pricing.installments : 1,
    extras: { travel: pricing.travel, parking: pricing.parking, toll: pricing.toll, extraMaterial: pricing.extraMaterial, taxes: pricing.taxes },
    notes: rec.notes || "",
    updatedAt: nowISO(),
  };
  if (kind === "quote") {
    return { ...base, status: rec.status, statusLabel: QUOTE_STATUS[rec.status]?.label || rec.status, validUntil: rec.validUntil || "", description: rec.description || "", deliveryDays: rec.deliveryDays || "", terms: rec.terms || s.terms };
  }
  const docs = (db.list("documents") || []).filter((d) => d.workOrderId === rec.id && d.released && !d.deletedAt).map((d) => ({ name: d.title || d.file?.name, url: d.file?.url || "", type: d.type }));
  const atts = (db.list("work_order_attachments") || []).filter((a) => a.workOrderId === rec.id && a.released !== false && !a.deletedAt).map((a) => ({ name: a.name, url: a.url, kind: a.kind }));
  return {
    ...base,
    status: rec.status,
    statusLabel: OS_STATUS[rec.status]?.label || rec.status,
    date: rec.date || "",
    time: rec.time || "",
    address: rec.address || "",
    technician: rec.technician || "",
    description: rec.description || "",
    solution: rec.solution || "",
    timeline: (rec.history || []).filter((h: Rec) => h.type === "status").slice(-12).map((h: Rec) => ({ at: h.at, label: OS_STATUS[h.to]?.label || h.text })),
    additionals: (rec.additionals || []).map((a: Rec) => ({ id: a.id, title: a.title, description: a.description || "", total: a.total, status: a.status, items: itemsSnapshot(a.lines) })),
    documents: docs,
    attachments: atts,
    completion: rec.completion || null,
    evaluated: !!(db.list("evaluations") || []).find((e) => e.workOrderId === rec.id),
  };
}

export async function createPublicLink(kind: "quote" | "work_order", rec: Rec): Promise<string> {
  const col = kind === "quote" ? "quotes" : "work_orders";
  await db.load(["customers", "settings"]);
  const cur = db.get(col, rec.id) || rec;
  if (cur.publicToken) {
    const l = db.get("public_links", cur.publicToken);
    if (l && l.status !== "revoked") return cur.publicToken;
  }
  const token = newToken(32);
  db.create("public_links", { kind, refId: rec.id, status: "active", events: [], appliedEvents: [], snapshot: buildSnapshot(kind, cur), title: `${cur.number} — ${cur.title || ""}` }, token);
  db.update(col, rec.id, { publicToken: token }, { silent: true });
  return token;
}

export function syncPublicLink(kind: "quote" | "work_order", rec: Rec) {
  if (!rec?.publicToken) return;
  const link = db.get("public_links", rec.publicToken);
  if (!link || link.status === "revoked") return;
  db.update("public_links", rec.publicToken, { snapshot: buildSnapshot(kind, rec, link.snapshot) }, { silent: true });
}

export function revokePublicLink(col: "quotes" | "work_orders", rec: Rec) {
  if (!rec.publicToken) return;
  db.update("public_links", rec.publicToken, { status: "revoked", revokedAt: nowISO() }, { silent: true });
  db.update(col, rec.id, { history: pushHistory(rec, { type: "event", text: "Link público revogado" }) }, { silent: true });
}

/* ------------------------------------------------------------------ orçamentos */
export function saveQuote(id: string, patch: Record<string, any>) {
  const { __silent, ...rest } = patch;
  const r = db.update("quotes", id, rest, { silent: !!__silent });
  if (r) syncPublicLink("quote", r);
  return r as Rec;
}

export function setQuoteStatus(q: Rec, status: string, note?: string, byName?: string): Rec {
  if (q.status === status) return q;
  const patch: Record<string, any> = {
    status,
    history: pushHistory(q, { type: "status", from: q.status, to: status, text: note || `Status: ${QUOTE_STATUS[status]?.label}`, ...(byName ? { byName } : {}) }),
  };
  if (status === "enviado" && !q.sentAt) patch.sentAt = nowISO();
  if (status === "aprovado") patch.approvedAt = nowISO();
  const r = saveQuote(q.id, patch);
  if (status === "enviado" || status === "aguardando") syncLeadStage(q.customerId, "orcamento");
  if (status === "enviado") fireTrigger("orcamento_enviado", { quoteId: q.id, customerId: q.customerId });
  if (status === "aprovado") {
    syncLeadStage(q.customerId, "aprovado");
    fireTrigger("orcamento_aprovado", { quoteId: q.id, customerId: q.customerId });
  }
  return r;
}

export async function createOrderFromQuote(q: Rec): Promise<Rec> {
  await db.load(["customers", "services", "work_orders", "settings"]);
  const s = getSettings();
  const cust = db.get("customers", q.customerId);
  const services = db.list("services");
  const suggested: Rec[] = [];
  const checklist: Rec[] = [];
  for (const l of q.pricing?.lines || []) {
    const svc = services.find((x) => x.id === l.serviceId);
    if (!svc) continue;
    (svc.materials || []).forEach((m: Rec) => suggested.push({ id: newId(), productId: m.productId || "", name: m.name, qty: round2(toNum(m.qty) * toNum(l.qty || 1)), unit: m.unit || "un", service: svc.name }));
    (svc.checklist || []).forEach((t: string) => checklist.push({ id: newId(), text: t, done: false, service: svc.name }));
  }
  const number = nextNumber(s.osPrefix, db.list("work_orders"));
  const os = db.create("work_orders", {
    number,
    customerId: q.customerId,
    quoteId: q.id,
    title: q.title,
    description: q.description || "",
    problem: q.problem || "",
    diagnosis: "",
    solution: "",
    address: q.address || customerAddress(cust),
    technician: s.responsible || "",
    date: "",
    time: "",
    status: "aberta",
    pricing: q.pricing,
    totals: q.totals,
    total: q.totals?.total ?? 0,
    materials: [],
    suggestedMaterials: suggested,
    checklist,
    additionals: [],
    notes: q.notes || "",
    deliveryDays: q.deliveryDays || "",
    warrantyDays: s.warrantyDays,
    nextMaintenanceMonths: s.nextMaintenanceMonths,
    history: [{ id: newId(), at: nowISO(), by: currentUser().id, byName: currentUser().name, type: "event", text: `OS criada a partir do orçamento ${q.number}` }],
  });
  saveQuote(q.id, { workOrderId: os.id, history: pushHistory(q, { type: "event", text: `Ordem de serviço ${number} criada` }) });
  syncLeadStage(q.customerId, "aprovado");
  fireTrigger("os_criada", { orderId: os.id, customerId: q.customerId });
  return os;
}

/* ------------------------------------------------------------------ ordens de serviço */
export function saveOrder(id: string, patch: Record<string, any>) {
  const { __silent, ...rest } = patch;
  const r = db.update("work_orders", id, rest, { silent: !!__silent });
  if (r) {
    if ("date" in rest || "time" in rest || "status" in rest || "title" in rest || "address" in rest) syncAppointmentForOrder(r);
    syncPublicLink("work_order", r);
  }
  return r as Rec;
}

export function syncAppointmentForOrder(o: Rec) {
  const id = `apt_${o.id}`;
  if (!o.date) {
    if (db.get("appointments", id)) db.remove("appointments", id);
    return;
  }
  const status = o.status === "cancelada" ? "cancelado" : ["concluida", "faturada"].includes(o.status) ? "concluido" : "agendado";
  const existing = db.get("appointments", id);
  const data = { title: o.title || o.number, type: "atendimento", date: o.date, startTime: o.time || "", endTime: o.endTime || "", customerId: o.customerId, workOrderId: o.id, address: o.address || "", status: existing && existing.status === "confirmado" && status === "agendado" ? "confirmado" : status, auto: true };
  if (existing) db.update("appointments", id, data, { silent: true });
  else db.create("appointments", data, id);
}

export function setOrderStatus(o: Rec, status: string, note?: string): Rec {
  if (o.status === status) return o;
  const patch: Record<string, any> = {
    status,
    history: pushHistory(o, { type: "status", from: o.status, to: status, text: note || `Status: ${OS_STATUS[status]?.label}` }),
  };
  if (status === "execucao" && !o.startedAt) patch.startedAt = nowISO();
  if (status === "concluida") patch.completedAt = nowISO();
  if (status === "aguardando_aprovacao") patch.statusBeforeApproval = o.status;
  const r = saveOrder(o.id, patch);
  if (status === "concluida") onOrderCompleted(r);
  if (status === "faturada" && o.quoteId) {
    const q = db.get("quotes", o.quoteId);
    if (q && q.status !== "faturado") setQuoteStatus(q, "faturado", `Faturado via ${o.number}`);
  }
  if (["agendada", "deslocamento", "execucao"].includes(status)) syncLeadStage(o.customerId, "cliente");
  return r;
}

export function onOrderCompleted(o: Rec) {
  ensureReceivable(o);
  syncLeadStage(o.customerId, "pos_venda");
  const months = toNum(o.nextMaintenanceMonths);
  if (months > 0) {
    db.upsert("crm_activities", `maint_${o.id}`, {
      title: `Manutenção preventiva — ${o.title}`,
      kind: "manutencao",
      dueDate: addMonths(todayISO(), months),
      status: "aberta",
      customerId: o.customerId,
      workOrderId: o.id,
      notes: `Sugerida após a ${o.number}. Ofereça uma visita de revisão.`,
    });
  }
  const days = toNum(o.warrantyDays);
  if (days > 0 && !db.get("warranties", `war_${o.id}`)) {
    db.create("warranties", { title: `Garantia — ${o.title}`, customerId: o.customerId, workOrderId: o.id, startDate: todayISO(), endDate: addDays(todayISO(), days), conditions: "Garantia do serviço executado. Não cobre mau uso, danos elétricos externos ou intervenção de terceiros." }, `war_${o.id}`);
  }
  fireTrigger("os_concluida", { orderId: o.id, customerId: o.customerId });
}

export function ensureReceivable(o: Rec) {
  const id = `rcv_${o.id}`;
  const cur = db.get("financial_transactions", id);
  const total = toNum(o.total ?? o.totals?.total);
  if (cur) {
    if (cur.status !== "pago" && !cur.deletedAt && Math.abs(toNum(cur.amount) - total) > 0.005 && !cur.partial) {
      db.update("financial_transactions", id, { amount: total }, { silent: true });
    }
    return;
  }
  if (total <= 0) return;
  const acc = db.list("financial_accounts").find((a) => !a.deletedAt && !a.archived);
  const cat = db.list("financial_categories").find((c) => c.name === "Serviços" && !c.deletedAt);
  db.create("financial_transactions", {
    type: "entrada", description: `${o.number} — ${o.title}`, amount: total, dueDate: todayISO(), status: "pendente",
    customerId: o.customerId, workOrderId: o.id, accountId: acc?.id || "", categoryId: cat?.id || "", method: o.pricing?.paymentMethod || "pix", auto: true,
  }, id);
}

/** Registra pagamento (total ou parcial), gera recibo e notifica. */
export function registerPayment(txn: Rec, p: { amount: number; method: string; accountId: string; paidAt: string }) {
  const amount = round2(toNum(p.amount));
  if (amount <= 0) return;
  const full = amount >= toNum(txn.amount) - 0.005;
  let paidTxnId = txn.id;
  if (full) {
    db.update("financial_transactions", txn.id, { status: "pago", paidAt: p.paidAt, method: p.method, accountId: p.accountId || txn.accountId }, { silent: true });
  } else {
    const paid = db.create("financial_transactions", { ...pick(txn, ["type", "description", "customerId", "supplierId", "workOrderId", "categoryId", "notes"]), description: `${txn.description} (pagamento parcial)`, amount, dueDate: txn.dueDate, paidAt: p.paidAt, status: "pago", method: p.method, accountId: p.accountId || txn.accountId });
    paidTxnId = paid.id;
    db.update("financial_transactions", txn.id, { amount: round2(toNum(txn.amount) - amount), partial: true }, { silent: true });
  }
  db.create("payments", { transactionId: paidTxnId, sourceTransactionId: txn.id, workOrderId: txn.workOrderId || "", customerId: txn.customerId || "", amount, method: p.method, accountId: p.accountId || txn.accountId || "", paidAt: p.paidAt });
  if (txn.type === "entrada") {
    const os = txn.workOrderId ? db.get("work_orders", txn.workOrderId) : undefined;
    const rc = db.create("documents", { kind: "generated", type: "recibo", title: `Recibo — ${txn.description}`, customerId: txn.customerId || "", workOrderId: txn.workOrderId || "", content: { amount, method: p.method, date: p.paidAt, description: txn.description, os: os?.number || "" }, released: true });
    void rc;
    notify({ type: "payment", title: "Pagamento recebido", body: `${txn.description} — R$ ${amount.toFixed(2).replace(".", ",")}`, entity: txn.workOrderId ? { col: "work_orders", id: txn.workOrderId } : undefined, severity: "ok" });
    if (os && full) saveOrder(os.id, { paymentStatus: "pago", paidAt: p.paidAt, history: pushHistory(os, { type: "event", text: `Pagamento recebido (${PAY_METHODS[p.method] || p.method})` }) });
    fireTrigger("pagamento_recebido", { orderId: txn.workOrderId, customerId: txn.customerId });
  }
}

function pick(o: Rec, keys: string[]) {
  const r: Rec = { id: "" };
  delete (r as Partial<Rec>).id;
  keys.forEach((k) => o[k] !== undefined && (r[k] = o[k]));
  return r as Record<string, any>;
}

/* ------------------------------------------------------------------ estoque */
export function stockMove(p: { productId: string; type: string; qty: number; note?: string; workOrderId?: string; unitCost?: number; supplierId?: string; apply?: boolean }): Rec | undefined {
  const prod = db.get("products", p.productId);
  if (!prod) return;
  const def = STOCK_MOVES[p.type];
  const q = toNum(p.qty);
  const before = toNum(prod.qty);
  let after = before;
  if (p.apply !== false) {
    after = def.sign === 0 ? q : before + def.sign * q;
    const patch: Record<string, any> = { qty: round2(after) };
    if (p.type === "entrada" && toNum(p.unitCost) > 0) patch.cost = toNum(p.unitCost);
    db.update("products", prod.id, patch, { silent: true });
    if (p.type === "entrada") db.update("products", prod.id, { lastPurchaseAt: nowISO() }, { silent: true });
  }
  return db.create("stock_movements", {
    productId: p.productId, type: p.type, qty: q, delta: round2(after - before), before, after: round2(after),
    note: p.note || "", workOrderId: p.workOrderId || "", unitCost: toNum(p.unitCost), supplierId: p.supplierId || prod.supplierId || "", date: todayISO(),
  });
}

export function addOrderMaterial(o: Rec, m: { productId?: string; name: string; qty: number; unit?: string; unitPrice?: number }) {
  const row: Rec = { id: newId(), productId: m.productId || "", name: m.name, qty: toNum(m.qty), unit: m.unit || "un", unitPrice: toNum(m.unitPrice), at: nowISO() };
  if (m.productId) {
    const mv = stockMove({ productId: m.productId, type: "uso_os", qty: row.qty, workOrderId: o.id, note: `Uso na ${o.number}` });
    row.movementId = mv?.id || "";
    const prod = db.get("products", m.productId);
    row.unitCost = toNum(prod?.cost);
  }
  const cur = db.get("work_orders", o.id) || o;
  return saveOrder(o.id, {
    materials: [...(cur.materials || []), row],
    suggestedMaterials: (cur.suggestedMaterials || []).filter((s: Rec) => !(m.productId && s.productId === m.productId) && s.name !== m.name),
    history: pushHistory(cur, { type: "event", text: `Material utilizado: ${row.qty} ${row.unit} de ${row.name}${m.productId ? " (baixa no estoque)" : ""}` }),
  });
}

export function removeOrderMaterial(o: Rec, rowId: string) {
  const cur = db.get("work_orders", o.id) || o;
  const row = (cur.materials || []).find((r: Rec) => r.id === rowId);
  if (!row) return;
  if (row.productId) stockMove({ productId: row.productId, type: "devolucao", qty: row.qty, workOrderId: o.id, note: `Devolução — ${o.number}` });
  saveOrder(o.id, { materials: (cur.materials || []).filter((r: Rec) => r.id !== rowId), history: pushHistory(cur, { type: "event", text: `Material removido: ${row.name}${row.productId ? " (devolvido ao estoque)" : ""}` }) });
}

/* ------------------------------------------------------------------ serviços adicionais */
export function addAdditional(o: Rec, a: { title: string; description?: string; lines: PricingLine[] }) {
  const total = round2(a.lines.reduce((s, l) => s + toNum(l.qty) * toNum(l.unitPrice) * (1 - toNum(l.discountPct) / 100) + toNum(l.material), 0));
  const cur = db.get("work_orders", o.id) || o;
  const entry = { id: newId(), title: a.title, description: a.description || "", lines: a.lines, total, status: "aguardando", createdAt: nowISO() };
  const patch: Record<string, any> = { additionals: [...(cur.additionals || []), entry], history: pushHistory(cur, { type: "event", text: `Serviço adicional proposto: ${a.title} (R$ ${total.toFixed(2).replace(".", ",")})` }) };
  const r = saveOrder(o.id, patch);
  if (!["aguardando_aprovacao", "concluida", "faturada", "cancelada"].includes(cur.status)) setOrderStatus(r, "aguardando_aprovacao", "Aguardando aprovação de serviço adicional");
  return entry;
}

export function decideAdditional(o: Rec, addId: string, approve: boolean, byName = "Cliente") {
  const cur = db.get("work_orders", o.id) || o;
  const add = (cur.additionals || []).find((a: Rec) => a.id === addId);
  if (!add || add.status !== "aguardando") return;
  const additionals = (cur.additionals || []).map((a: Rec) => (a.id === addId ? { ...a, status: approve ? "aprovado" : "recusado", decidedAt: nowISO(), decidedBy: byName } : a));
  const patch: Record<string, any> = { additionals, history: pushHistory(cur, { type: "event", byName, text: `Serviço adicional "${add.title}" ${approve ? "aprovado" : "recusado"} por ${byName}` }) };
  if (approve) {
    const pricing = { ...(cur.pricing || { lines: [] }), lines: [...(cur.pricing?.lines || []), ...add.lines.map((l: PricingLine) => ({ ...l, note: `Adicional: ${add.title}` }))] };
    const totals = computePricing(pricing, getSettings().fees);
    patch.pricing = pricing;
    patch.totals = totals;
    patch.total = totals.total;
  }
  const r = saveOrder(o.id, patch);
  if (approve) ensureReceivable(r);
  const stillPending = additionals.some((a: Rec) => a.status === "aguardando");
  if (!stillPending && r.status === "aguardando_aprovacao") setOrderStatus(r, r.statusBeforeApproval || "execucao", "Adicional decidido — serviço retomado");
  notify({ type: "additional", title: approve ? "Serviço adicional aprovado" : "Serviço adicional recusado", body: `${o.number}: ${add.title}`, entity: { col: "work_orders", id: o.id }, severity: approve ? "ok" : "bad", key: `add_${addId}_${approve}` });
}

/* ------------------------------------------------------------------ chat */
export function sendCompanyMessage(o: Rec, text: string) {
  const t = text.trim();
  if (!t) return;
  const u = currentUser();
  const ev = { id: newId(), at: nowISO(), by: "company", type: "message", text: t.slice(0, 2000), name: u.name };
  db.create("work_order_messages", { workOrderId: o.id, from: "company", name: u.name, text: ev.text, at: ev.at }, `msg_${ev.id}`);
  if (o.publicToken) {
    const link = db.get("public_links", o.publicToken);
    if (link && link.status !== "revoked") db.update("public_links", o.publicToken, { events: [...(link.events || []), ev], appliedEvents: [...(link.appliedEvents || []), ev.id] }, { silent: true });
  }
}

/* ------------------------------------------------------------------ portal do cliente → sistema */
export function processPublicLinks(links: Rec[]) {
  for (const link of links) {
    if (link.deletedAt || link.status === "revoked") continue;
    const applied: string[] = link.appliedEvents || [];
    const fresh = (link.events || []).filter((e: Rec) => e.by === "client" && !applied.includes(e.id));
    if (!fresh.length) continue;
    // marca imediatamente para reduzir aplicação duplicada entre dispositivos
    db.update("public_links", link.id, { appliedEvents: [...applied, ...fresh.map((e: Rec) => e.id)] }, { silent: true });
    for (const ev of fresh) {
      try {
        if (link.kind === "quote") applyQuoteEvent(link, ev);
        else applyOrderEvent(link, ev);
      } catch (e) {
        console.error("[GBR] evento público", e);
      }
    }
  }
}

function applyQuoteEvent(link: Rec, ev: Rec) {
  const q = db.get("quotes", link.refId);
  if (!q) return;
  const who = ev.name || "Cliente";
  const open = ["rascunho", "enviado", "aguardando"].includes(q.status);
  if (ev.type === "approve" && open) {
    const r = setQuoteStatus(q, "aprovado", `Aprovado pelo cliente (${who}) via link${ev.text ? `: ${ev.text}` : ""}`, who);
    saveQuote(r.id, { clientResponse: { action: "approve", at: ev.at, comment: ev.text, name: who }, __silent: true });
    notify({ type: "quote_approved", title: "Orçamento aprovado!", body: `${q.number} aprovado por ${who}`, entity: { col: "quotes", id: q.id }, severity: "ok", key: `ev_${ev.id}` });
  } else if (ev.type === "reject" && open) {
    const r = setQuoteStatus(q, "recusado", `Recusado pelo cliente (${who}) via link${ev.text ? `: ${ev.text}` : ""}`, who);
    saveQuote(r.id, { clientResponse: { action: "reject", at: ev.at, comment: ev.text, name: who }, __silent: true });
    notify({ type: "quote_rejected", title: "Orçamento recusado", body: `${q.number} recusado por ${who}`, entity: { col: "quotes", id: q.id }, severity: "bad", key: `ev_${ev.id}` });
  } else if (ev.type === "change_request") {
    saveQuote(q.id, { history: pushHistory(q, { type: "event", byName: who, text: `Solicitou alteração: ${ev.text || "(sem comentário)"}` }), clientResponse: { action: "change_request", at: ev.at, comment: ev.text, name: who }, __silent: true });
    notify({ type: "quote_change", title: "Cliente pediu alteração no orçamento", body: `${q.number}: ${ev.text || ""}`.slice(0, 140), entity: { col: "quotes", id: q.id }, severity: "warn", key: `ev_${ev.id}` });
  } else if (ev.type === "message") {
    saveQuote(q.id, { history: pushHistory(q, { type: "event", byName: who, text: `Mensagem do cliente: ${ev.text}` }), __silent: true });
    notify({ type: "message", title: "Nova mensagem do cliente", body: ev.text.slice(0, 140), entity: { col: "quotes", id: q.id }, key: `ev_${ev.id}` });
  }
}

function applyOrderEvent(link: Rec, ev: Rec) {
  const o = db.get("work_orders", link.refId);
  if (!o) return;
  const who = ev.name || "Cliente";
  switch (ev.type) {
    case "message":
      db.create("work_order_messages", { workOrderId: o.id, from: "client", name: who, text: ev.text, at: ev.at }, `msg_${ev.id}`);
      notify({ type: "message", title: `Nova mensagem — ${o.number}`, body: ev.text.slice(0, 140), entity: { col: "work_orders", id: o.id }, key: `ev_${ev.id}` });
      break;
    case "photo":
    case "file":
      db.create("work_order_attachments", { workOrderId: o.id, kind: "cliente", name: ev.data?.name || "arquivo", url: ev.data?.url || "", type: ev.data?.type || "", size: ev.data?.size || 0, uploadedBy: who, released: true }, `att_${ev.id}`);
      notify({ type: "upload", title: `Arquivo do cliente — ${o.number}`, body: ev.data?.name || "", entity: { col: "work_orders", id: o.id }, key: `ev_${ev.id}` });
      break;
    case "approve_additional":
      decideAdditional(o, String(ev.data?.additionalId), true, who);
      break;
    case "reject_additional":
      decideAdditional(o, String(ev.data?.additionalId), false, who);
      break;
    case "confirm_completion":
      saveOrder(o.id, { completion: { at: ev.at, by: who, note: ev.text || "", signature: ev.data?.signature || "" }, history: pushHistory(o, { type: "event", byName: who, text: `Cliente confirmou a conclusão do serviço${ev.text ? `: ${ev.text}` : ""}` }) });
      notify({ type: "completion", title: `Conclusão confirmada — ${o.number}`, body: `${who} confirmou o serviço.`, entity: { col: "work_orders", id: o.id }, severity: "ok", key: `ev_${ev.id}` });
      break;
    case "evaluation": {
      const r = ev.data?.ratings || {};
      const vals = ["quality", "service", "deadline", "price", "result"].map((k) => toNum(r[k])).filter((v) => v > 0);
      const overall = vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : toNum(ev.data?.overall);
      db.create("evaluations", { workOrderId: o.id, customerId: o.customerId, quality: toNum(r.quality), service: toNum(r.service), deadline: toNum(r.deadline), price: toNum(r.price), result: toNum(r.result), overall, comment: ev.text || "", source: "portal", date: todayISO() }, `eval_${ev.id}`);
      notify({ type: "evaluation", title: `Nova avaliação (${overall}/5) — ${o.number}`, body: ev.text.slice(0, 140), entity: { col: "work_orders", id: o.id }, severity: "ok", key: `ev_${ev.id}` });
      saveOrder(o.id, { __silent: true, evaluated: true });
      break;
    }
  }
}

export function fmtMoneyPlain(n: number) {
  return n.toFixed(2).replace(".", ",");
}
export const daysUntil = (d?: string) => {
  const day = dayOf(d);
  if (!day) return null;
  return Math.round((new Date(day + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000);
};
export { fmtDate };
