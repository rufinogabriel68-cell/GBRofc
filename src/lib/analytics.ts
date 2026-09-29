import type { Rec } from "./types";
import { lineTotal } from "./calc";
import { OS_CLOSED, OS_ACTIVE } from "./constants";
import { accountBalance } from "./finance";
import { addDays, dayOf, diffDays, endOfMonth, MONTHS_SHORT, money, parseDay, dateToISO, pct, startOfMonth, sum, toNum, todayISO, addMonths } from "./utils";

export type Period = "hoje" | "7d" | "30d" | "mes" | "trimestre" | "ano" | "custom";
export const PERIODS: { id: Period; label: string }[] = [
  { id: "hoje", label: "Hoje" }, { id: "7d", label: "7 dias" }, { id: "30d", label: "30 dias" }, { id: "mes", label: "Mês" }, { id: "trimestre", label: "Trimestre" }, { id: "ano", label: "Ano" }, { id: "custom", label: "Personalizado" },
];
export type Range = { start: string; end: string };

export function periodRange(p: Period, custom?: Range): Range {
  const t = todayISO();
  switch (p) {
    case "hoje": return { start: t, end: t };
    case "7d": return { start: addDays(t, -6), end: t };
    case "30d": return { start: addDays(t, -29), end: t };
    case "mes": return { start: startOfMonth(t), end: endOfMonth(t) };
    case "trimestre": { const m = parseDay(t).getMonth(); const qs = `${t.slice(0, 4)}-${String(Math.floor(m / 3) * 3 + 1).padStart(2, "0")}-01`; return { start: qs, end: addDays(addMonths(qs, 3), -1) }; }
    case "ano": return { start: `${t.slice(0, 4)}-01-01`, end: `${t.slice(0, 4)}-12-31` };
    default: return custom && custom.start && custom.end ? custom : { start: startOfMonth(t), end: endOfMonth(t) };
  }
}
export function previousRange(r: Range): Range {
  const len = diffDays(r.start, r.end) + 1;
  return { start: addDays(r.start, -len), end: addDays(r.start, -1) };
}

export type Data = {
  quotes: Rec[]; orders: Rec[]; txns: Rec[]; customers: Rec[]; products: Rec[]; appointments: Rec[]; goals: Rec[]; activities: Rec[]; warranties: Rec[]; services: Rec[]; accounts: Rec[]; categories: Rec[]; movements: Rec[]; evaluations: Rec[];
};

const inR = (d: string | undefined, r: Range) => {
  const x = dayOf(d);
  return !!x && x >= r.start && x <= r.end;
};
const isIncome = (t: Rec) => t.type === "entrada" && t.status !== "cancelado";
const isExpense = (t: Rec) => t.type === "saida" && t.status !== "cancelado";

export function buckets(r: Range) {
  const days = diffDays(r.start, r.end) + 1;
  const out: { key: string; label: string; start: string; end: string }[] = [];
  if (days <= 31) {
    for (let i = 0; i < days; i++) { const d = addDays(r.start, i); out.push({ key: d, label: `${d.slice(8)}/${d.slice(5, 7)}`, start: d, end: d }); }
  } else if (days <= 100) {
    for (let s = r.start; s <= r.end; s = addDays(s, 7)) { const e = addDays(s, 6) > r.end ? r.end : addDays(s, 6); out.push({ key: s, label: `${s.slice(8)}/${s.slice(5, 7)}`, start: s, end: e }); }
  } else {
    let s = startOfMonth(r.start);
    while (s <= r.end) { const e = endOfMonth(s); out.push({ key: s, label: `${MONTHS_SHORT[parseDay(s).getMonth()]}/${s.slice(2, 4)}`, start: s < r.start ? r.start : s, end: e > r.end ? r.end : e }); s = addMonths(s, 1); }
  }
  return out;
}

export function costOf(o: Rec) {
  const p = o.pricing || { lines: [] };
  const labor = sum(p.lines || [], (l: Rec) => toNum(l.qty) * toNum(l.unitCost));
  const usedMaterials = sum(o.materials || [], (m: Rec) => toNum(m.qty) * toNum(m.unitCost));
  const material = usedMaterials > 0 ? usedMaterials + toNum(p.extraMaterial) : sum(p.lines || [], (l: Rec) => toNum(l.materialCost)) + toNum(p.extraMaterial);
  const travel = toNum(p.parking) + toNum(p.toll);
  const fees = toNum(o.totals?.feeAmount);
  const taxes = toNum(p.taxes);
  const charged = toNum(o.total);
  const cost = labor + material + travel + fees + taxes;
  return { charged, material, labor, travel, fees, taxes, cost, profit: charged - cost, margin: charged > 0 ? ((charged - cost) / charged) * 100 : 0 };
}

export function computeDashboard(d: Data, r: Range, custom = false) {
  void custom;
  const today = todayISO();
  const prev = previousRange(r);
  const income = d.txns.filter((t) => isIncome(t) && inR(t.dueDate, r));
  const expenses = d.txns.filter((t) => isExpense(t) && inR(t.dueDate, r));
  const revenue = sum(income, (t) => toNum(t.amount));
  const expensesTotal = sum(expenses, (t) => toNum(t.amount));
  const received = sum(d.txns.filter((t) => isIncome(t) && t.status === "pago" && inR(t.paidAt || t.dueDate, r)), (t) => toNum(t.amount));
  const paidOut = sum(d.txns.filter((t) => isExpense(t) && t.status === "pago" && inR(t.paidAt || t.dueDate, r)), (t) => toNum(t.amount));
  const receivable = sum(d.txns.filter((t) => t.type === "entrada" && ["pendente", "previsto"].includes(t.status)), (t) => toNum(t.amount));
  const payable = sum(d.txns.filter((t) => t.type === "saida" && ["pendente", "previsto"].includes(t.status)), (t) => toNum(t.amount));
  const prevRevenue = sum(d.txns.filter((t) => isIncome(t) && inR(t.dueDate, prev)), (t) => toNum(t.amount));
  const waiting = d.quotes.filter((q) => ["enviado", "aguardando"].includes(q.status));
  const approved = d.quotes.filter((q) => q.approvedAt && inR(q.approvedAt, r));
  const refused = d.quotes.filter((q) => q.status === "recusado" && inR(q.updatedAt, r));
  const osOpen = d.orders.filter((o) => !OS_CLOSED.includes(o.status));
  const osRunning = d.orders.filter((o) => OS_ACTIVE.includes(o.status));
  const osLate = osOpen.filter((o) => o.date && dayOf(o.date) < today);
  const todayAppts = d.appointments.filter((a) => a.date === today && a.status !== "cancelado").sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  const doneOrders = d.orders.filter((o) => ["concluida", "faturada"].includes(o.status) && inR(o.completedAt || o.date, r));
  const ticket = income.length ? revenue / income.length : doneOrders.length ? sum(doneOrders, (o) => toNum(o.total)) / doneOrders.length : 0;
  const newCustomers = d.customers.filter((c) => inR(c.createdAt, r));
  const lowStock = d.products.filter((p) => toNum(p.minQty) > 0 && toNum(p.qty) <= toNum(p.minQty));

  // meta mensal: meta de faturamento vigente
  const goal = d.goals.filter((g) => g.type === "faturamento" && dayOf(g.startDate) <= today && dayOf(g.endDate) >= today).sort((a, b) => toNum(b.target) - toNum(a.target))[0];
  const goalRange: Range | null = goal ? { start: dayOf(goal.startDate), end: dayOf(goal.endDate) } : null;
  const goalRealized = goalRange ? sum(d.txns.filter((t) => isIncome(t) && inR(t.dueDate, goalRange)), (t) => toNum(t.amount)) : 0;
  const goalPct = goal && toNum(goal.target) > 0 ? (goalRealized / toNum(goal.target)) * 100 : 0;

  const b = buckets(r);
  const series = b.map((x) => {
    const rev = sum(d.txns.filter((t) => isIncome(t) && inR(t.dueDate, x)), (t) => toNum(t.amount));
    const exp = sum(d.txns.filter((t) => isExpense(t) && inR(t.dueDate, x)), (t) => toNum(t.amount));
    const inn = sum(d.txns.filter((t) => isIncome(t) && t.status === "pago" && inR(t.paidAt || t.dueDate, x)), (t) => toNum(t.amount));
    const out = sum(d.txns.filter((t) => isExpense(t) && t.status === "pago" && inR(t.paidAt || t.dueDate, x)), (t) => toNum(t.amount));
    return { label: x.label, faturamento: rev, lucro: rev - exp, entradas: inn, saidas: out };
  });

  let goalSeries: { label: string; realizado: number; ideal: number }[] = [];
  if (goal && goalRange) {
    const total = diffDays(goalRange.start, goalRange.end) + 1;
    const upto = Math.min(total, diffDays(goalRange.start, today) + 1);
    let acc = 0;
    for (let i = 0; i < upto; i++) {
      const day = addDays(goalRange.start, i);
      acc += sum(d.txns.filter((t) => isIncome(t) && dayOf(t.dueDate) === day), (t) => toNum(t.amount));
      goalSeries.push({ label: `${day.slice(8)}/${day.slice(5, 7)}`, realizado: acc, ideal: (toNum(goal.target) * (i + 1)) / total });
    }
  }
  goalSeries = goalSeries.length > 60 ? goalSeries.filter((_, i) => i % Math.ceil(goalSeries.length / 60) === 0) : goalSeries;

  // serviços mais vendidos (linhas das OS não canceladas criadas no período; fallback: orçamentos aprovados)
  const src = d.orders.filter((o) => o.status !== "cancelada" && inR(o.createdAt, r));
  const base = src.length ? src : d.quotes.filter((q) => q.status === "aprovado" && inR(q.approvedAt, r));
  const byService: Record<string, { name: string; qty: number; revenue: number }> = {};
  base.forEach((o) => (o.pricing?.lines || []).forEach((l: Rec) => { const k = l.name || "Sem nome"; (byService[k] ||= { name: k, qty: 0, revenue: 0 }).qty += toNum(l.qty); byService[k].revenue += lineTotal(l as never); }));
  const topServices = Object.values(byService).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  return { revenue, expensesTotal, profit: revenue - expensesTotal, received, paidOut, receivable, payable, prevRevenue, waiting, approved, refused, osOpen, osRunning, osLate, todayAppts, ticket, newCustomers, lowStock, goal, goalRealized, goalPct, series, goalSeries, topServices, doneOrders };
}

/* ------------------------------------------------------------------ fluxo de caixa projetado */
export function cashflow(d: Data, days: number) {
  const today = todayISO();
  const end = addDays(today, days);
  const balance = sum(d.accounts, (a) => accountBalance(a, d.txns));
  const open = d.txns.filter((t) => t.type !== "transferencia" && ["pendente", "previsto"].includes(t.status) && dayOf(t.dueDate) <= end);
  const entradas = sum(open.filter((t) => t.type === "entrada"), (t) => toNum(t.amount));
  const saidas = sum(open.filter((t) => t.type === "saida"), (t) => toNum(t.amount));
  return { balance, entradas, saidas, projected: balance + entradas - saidas, atrasadoIn: sum(open.filter((t) => t.type === "entrada" && dayOf(t.dueDate) < today), (t) => toNum(t.amount)), atrasadoOut: sum(open.filter((t) => t.type === "saida" && dayOf(t.dueDate) < today), (t) => toNum(t.amount)) };
}

export function cashflowSeries(d: Data, days: number) {
  const today = todayISO();
  let bal = sum(d.accounts, (a) => accountBalance(a, d.txns));
  const out: { label: string; saldo: number; entradas: number; saidas: number }[] = [];
  const step = days > 45 ? 7 : 1;
  for (let i = 0; i <= days; i += step) {
    const from = i === 0 ? "0000-00-00" : addDays(today, i - step + 1);
    const to = addDays(today, i);
    const open = d.txns.filter((t) => t.type !== "transferencia" && ["pendente", "previsto"].includes(t.status) && dayOf(t.dueDate) >= from && dayOf(t.dueDate) <= to);
    const e = sum(open.filter((t) => t.type === "entrada"), (t) => toNum(t.amount));
    const s = sum(open.filter((t) => t.type === "saida"), (t) => toNum(t.amount));
    bal += e - s;
    const day = to;
    out.push({ label: `${day.slice(8)}/${day.slice(5, 7)}`, saldo: bal, entradas: e, saidas: s });
  }
  return out;
}

/* ------------------------------------------------------------------ insights */
export type Insight = { tone: "ok" | "warn" | "bad" | "info"; text: string; href?: string };
export function computeInsights(d: Data, staleDays = 90): Insight[] {
  const out: Insight[] = [];
  const t = todayISO();
  const month: Range = { start: startOfMonth(t), end: endOfMonth(t) };
  const prevM: Range = { start: startOfMonth(addMonths(t, -1)), end: endOfMonth(addMonths(t, -1)) };
  const rev = sum(d.txns.filter((x) => isIncome(x) && inR(x.dueDate, month)), (x) => toNum(x.amount));
  const prevRev = sum(d.txns.filter((x) => isIncome(x) && inR(x.dueDate, prevM)), (x) => toNum(x.amount));
  if (d.txns.length) out.push({ tone: "info", text: `Você faturou ${money(rev)} este mês.`, href: "/financeiro" });
  if (prevRev > 0) { const g = ((rev - prevRev) / prevRev) * 100; out.push({ tone: g >= 0 ? "ok" : "warn", text: `Seu faturamento ${g >= 0 ? "cresceu" : "caiu"} ${pct(Math.abs(g), 1)} em relação ao mês anterior (${money(prevRev)}).` }); }
  const waiting = d.quotes.filter((q) => ["enviado", "aguardando"].includes(q.status));
  if (waiting.length) out.push({ tone: "warn", text: `Você possui ${money(sum(waiting, (q) => toNum(q.total)))} em ${waiting.length} orçamento(s) aguardando resposta.`, href: "/orcamentos" });
  const decided = d.quotes.filter((q) => ["aprovado", "faturado", "recusado"].includes(q.status));
  if (decided.length >= 3) { const ok = decided.filter((q) => q.status !== "recusado").length; out.push({ tone: ok / decided.length >= 0.5 ? "ok" : "warn", text: `Taxa de conversão de orçamentos: ${pct((ok / decided.length) * 100, 0)} (${ok} de ${decided.length} decididos).` }); }
  // faturamento por categoria de serviço
  const svcCat = new Map(d.services.map((s) => [s.name, s.categoryId]));
  const catName = new Map(d.categories.map((c) => [c.id, c.name]));
  const byCat: Record<string, number> = {};
  d.orders.filter((o) => ["concluida", "faturada"].includes(o.status)).forEach((o) => (o.pricing?.lines || []).forEach((l: Rec) => { const cid = l.serviceId ? d.services.find((s) => s.id === l.serviceId)?.categoryId : svcCat.get(l.name); const n = catName.get(cid) || "Sem categoria"; byCat[n] = (byCat[n] || 0) + lineTotal(l as never); }));
  const totalCat = sum(Object.values(byCat), (x) => x);
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([n, v]) => totalCat > 0 && out.push({ tone: "info", text: `Os serviços de ${n} representam ${pct((v / totalCat) * 100, 0)} do faturamento das OS concluídas.` }));
  // estoque
  const stockValue = sum(d.products, (p) => toNum(p.qty) * toNum(p.cost));
  const lastMove = new Map<string, string>();
  d.movements.forEach((m) => { const cur = lastMove.get(m.productId); if (!cur || m.createdAt > cur) lastMove.set(m.productId, m.createdAt); });
  const idle = d.products.filter((p) => toNum(p.qty) > 0 && diffDays(dayOf(lastMove.get(p.id) || p.createdAt), t) > staleDays);
  if (stockValue > 0) out.push({ tone: "info", text: `Você tem ${money(stockValue)} em estoque${idle.length ? `, sendo ${money(sum(idle, (p) => toNum(p.qty) * toNum(p.cost)))} parados há mais de ${staleDays} dias` : ""}.`, href: "/estoque" });
  const low = d.products.filter((p) => toNum(p.minQty) > 0 && toNum(p.qty) <= toNum(p.minQty));
  if (low.length) out.push({ tone: "warn", text: `${low.length} produto(s) abaixo do estoque mínimo: ${low.slice(0, 3).map((p) => p.name).join(", ")}${low.length > 3 ? "…" : ""}.`, href: "/estoque" });
  // clientes sem atendimento
  const lastService = new Map<string, string>();
  d.orders.filter((o) => ["concluida", "faturada"].includes(o.status)).forEach((o) => { const dd = dayOf(o.completedAt || o.date); if (dd && (!lastService.get(o.customerId) || dd > lastService.get(o.customerId)!)) lastService.set(o.customerId, dd); });
  const cold = d.customers.filter((c) => lastService.has(c.id) && diffDays(lastService.get(c.id)!, t) > 90);
  if (cold.length) out.push({ tone: "warn", text: `Existem ${cold.length} cliente(s) sem atendimento há mais de 90 dias — ótima oportunidade de contato.`, href: "/crm" });
  const late = d.orders.filter((o) => !OS_CLOSED.includes(o.status) && o.date && dayOf(o.date) < t);
  if (late.length) out.push({ tone: "bad", text: `${late.length} OS atrasada(s) precisam de atenção.`, href: "/ordens-de-servico" });
  const over = d.txns.filter((x) => x.type === "entrada" && ["pendente", "previsto"].includes(x.status) && dayOf(x.dueDate) < t);
  if (over.length) out.push({ tone: "bad", text: `${money(sum(over, (x) => toNum(x.amount)))} em ${over.length} recebimento(s) atrasado(s).`, href: "/financeiro" });
  const ev = d.evaluations;
  if (ev.length) out.push({ tone: "ok", text: `Nota média dos clientes: ${(sum(ev, (e) => toNum(e.overall)) / ev.length).toFixed(1)}/5 em ${ev.length} avaliação(ões).` });
  return out;
}

export function demandByMonth(d: Data) {
  const map: Record<string, { month: string; os: number; revenue: number; services: Record<string, number> }> = {};
  d.orders.filter((o) => o.status !== "cancelada").forEach((o) => {
    const m = dayOf(o.createdAt).slice(0, 7);
    const e = (map[m] ||= { month: m, os: 0, revenue: 0, services: {} });
    e.os++; e.revenue += toNum(o.total);
    (o.pricing?.lines || []).forEach((l: Rec) => (e.services[l.name] = (e.services[l.name] || 0) + toNum(l.qty)));
  });
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
}

export function dateLabel(iso: string) {
  return dateToISO(new Date(iso));
}
