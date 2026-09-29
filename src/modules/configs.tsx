"use client";
import {
  Boxes, CalendarDays, ClipboardList, Contact, FileText, Flag, Landmark, MapPin, PackagePlus, Receipt, ShieldCheck, Star, Tags, Target, Truck, UserCog, Users, Wallet, Wrench, Zap, MessageSquareText, KeyRound, Cpu, ListTodo, UserPlus,
} from "lucide-react";
import { db } from "@/lib/data/store";
import { confirmDialog, Badge, StatusBadge, type StatusDef } from "@/components/ui";
import type { ModuleConfig } from "@/components/crud/CrudView";
import type { Field } from "@/components/crud/RecordForm";
import { AccountBalanceCell, ActiveOrders, ContactCell, DateCell, Money, RefLabel, StockQty, SupplierStats } from "@/components/cells";
import { ServiceExtras } from "./ServiceExtras";
import {
  ACTIVE_STATUS, APPT_STATUS, APPT_TYPES, EQUIP_TYPES, GOAL_TYPES, OS_STATUS, PAY_METHODS, PIPELINE, QUOTE_STATUS, ROLE_MODULES, SOURCES, TASK_STATUS, TXN_STATUS, UNITS, opts,
} from "@/lib/constants";
import { TRIGGERS, CONDITIONS, ACTIONS } from "@/lib/automation";
import { txnStatus } from "@/lib/finance";
import { registerPayment, createOrderFromQuote, stockMove } from "@/lib/workflows";
import { toast } from "@/lib/toast";
import { addDays, dayOf, endOfMonth, fmtDate, money, pct, startOfMonth, todayISO, toNum, nowISO, addMonths } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { Rec } from "@/lib/types";
import { ExternalLink, CheckCircle2, Undo2, CalendarPlus, Smartphone, MessageCircle, Send } from "lucide-react";

const str = (o: string[]) => o.map((v) => ({ value: v, label: v }));
const stageOpts = PIPELINE.map((p) => ({ value: p.id, label: p.label }));
const custRef = { collection: "customers", label: (r: Rec) => r.name };
const accRef = { collection: "financial_accounts", label: (r: Rec) => r.name };

function warrantyStatus(w: Record<string, any>): StatusDef | undefined {
  const d = Math.round((new Date(dayOf(w.endDate) + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000);
  if (isNaN(d)) return undefined;
  const icons = { ok: ShieldCheck };
  if (d < 0) return { label: "Vencida", tone: "neutral", icon: icons.ok };
  if (d <= 30) return { label: `Vence em ${d}d`, tone: "warn", icon: icons.ok };
  return { label: "Garantia ativa", tone: "ok", icon: icons.ok };
}

/* ---------------------------------------------------------------- clientes */
export const customers: ModuleConfig = {
  collection: "customers", singular: "Cliente", plural: "Clientes", icon: Users, detail: true,
  title: (r) => r.name, subtitle: (r) => [r.phone, r.city].filter(Boolean).join(" · "),
  searchText: (r) => [r.name, r.document, r.phone, r.whatsapp, r.email, r.city, (r.tags || []).join(" ")].join(" "),
  emptyText: "Cadastre seu primeiro cliente — ele aparece em todos os dispositivos.",
  fields: [
    { key: "name", label: "Nome / Razão social", type: "text", required: true, span: 2 },
    { key: "kind", label: "Tipo", type: "select", options: [{ value: "pf", label: "Pessoa física" }, { value: "pj", label: "Pessoa jurídica" }], required: true },
    { key: "document", label: "CPF / CNPJ", type: "text" },
    { key: "phone", label: "Telefone", type: "phone" },
    { key: "whatsapp", label: "WhatsApp", type: "phone" },
    { key: "email", label: "E-mail", type: "email" },
    { key: "source", label: "Origem", type: "select", options: str(SOURCES) },
    { key: "stage", label: "Estágio no CRM", type: "select", options: stageOpts, required: true },
    { key: "zip", label: "CEP", type: "text", section: "Endereço principal" },
    { key: "street", label: "Rua", type: "text" },
    { key: "number", label: "Número", type: "text" },
    { key: "complement", label: "Complemento", type: "text" },
    { key: "district", label: "Bairro", type: "text" },
    { key: "city", label: "Cidade", type: "text" },
    { key: "state", label: "UF", type: "text" },
    { key: "tags", label: "Etiquetas", type: "tags", section: "Organização" },
    { key: "notes", label: "Observações", type: "textarea" },
    { key: "consent", label: "Consentimento (LGPD) para contato e tratamento de dados", type: "checkbox", section: "LGPD", span: 2 },
  ],
  defaults: () => ({ kind: "pf", stage: "cliente", state: "" }),
  beforeSave: (v, ex) => ({ ...v, ...(v.consent && !ex?.consentAt ? { consentAt: nowISO() } : {}) }),
  filters: [{ key: "stage", label: "Estágio", options: stageOpts }, { key: "kind", label: "Tipo", options: [{ value: "pf", label: "PF" }, { value: "pj", label: "PJ" }] }],
  columns: [
    { key: "name", label: "Cliente", sort: (r) => r.name?.toLowerCase() },
    { key: "phone", label: "Contato", render: (r) => <ContactCell phone={r.phone} whatsapp={r.whatsapp} /> },
    { key: "stage", label: "Estágio", render: (r) => <Badge tone="info">{PIPELINE.find((p) => p.id === r.stage)?.label || "—"}</Badge> },
    { key: "city", label: "Cidade" },
    { key: "os", label: "OS", render: (r) => <ActiveOrders customerId={r.id} />, sort: () => 0 },
    { key: "createdAt", label: "Cadastro", render: (r) => fmtDate(r.createdAt) },
  ],
};

/* ---------------------------------------------------------------- categorias de serviço */
export const service_categories: ModuleConfig = {
  collection: "service_categories", singular: "Categoria", plural: "Categorias", gender: "f", icon: Tags, softDelete: false, noDuplicate: true,
  title: (r) => r.name,
  fields: [
    { key: "name", label: "Nome", type: "text", required: true },
    { key: "color", label: "Cor", type: "color" },
    { key: "description", label: "Descrição", type: "textarea" },
  ],
  columns: [
    { key: "name", label: "Categoria", render: (r) => <span className="inline-flex items-center gap-2 font-semibold"><span className="size-3 rounded-full" style={{ background: r.color || "#38a8ff" }} />{r.name}</span> },
    { key: "description", label: "Descrição" },
  ],
};

/* ---------------------------------------------------------------- serviços */
export const services: ModuleConfig = {
  collection: "services", singular: "Serviço", plural: "Serviços", icon: Wrench, formSize: "lg",
  title: (r) => r.name, subtitle: (r) => r.code || "",
  searchText: (r) => [r.name, r.code, r.description, r.details].join(" "),
  statusKey: "status", statusMap: ACTIVE_STATUS,
  emptyText: "Cadastre os serviços que você presta com os 3 níveis de preço.",
  sort: { key: "name", dir: "asc" },
  fields: [
    { key: "name", label: "Nome do serviço", type: "text", required: true, span: 2 },
    { key: "code", label: "Código", type: "text" },
    { key: "categoryId", label: "Categoria", type: "ref", ref: { collection: "service_categories", label: (r) => r.name }, required: true },
    { key: "unit", label: "Unidade", type: "select", options: str(UNITS), required: true },
    { key: "status", label: "Status", type: "select", options: opts(ACTIVE_STATUS), required: true },
    { key: "description", label: "Descrição curta", type: "text", span: 2 },
    { key: "details", label: "Descrição detalhada", type: "textarea" },
    { key: "priceEco", label: "Preço Econômico", type: "money", section: "Níveis de preço" },
    { key: "priceMid", label: "Preço Médio", type: "money" },
    { key: "pricePrem", label: "Preço Premium", type: "money" },
    { key: "cost", label: "Custo estimado", type: "money", hint: "Usado para calcular margem e lucro." },
    { key: "avgMinutes", label: "Tempo médio (minutos)", type: "number" },
    { key: "warrantyDays", label: "Garantia (dias)", type: "number", section: "Garantia e manutenção" },
    { key: "nextMaintenanceMonths", label: "Próxima manutenção recomendada (meses)", type: "number" },
    { key: "notes", label: "Observações", type: "textarea", section: "Outros" },
    { key: "imageUrl", label: "Imagem", type: "image", folder: "services" },
  ],
  defaults: () => ({ status: "ativo", unit: "serviço", priceEco: 0, priceMid: 0, pricePrem: 0, cost: 0, materials: [], checklist: [] }),
  extraForm: (v, set) => <ServiceExtras values={v} set={set} />,
  filters: [{ key: "categoryId", label: "Categoria", collection: "service_categories" }],
  columns: [
    { key: "name", label: "Serviço", sort: (r) => r.name?.toLowerCase() },
    { key: "categoryId", label: "Categoria", render: (r) => <RefLabel collection="service_categories" id={r.categoryId} />, sort: () => 0 },
    { key: "priceEco", label: "Econômico", align: "right", render: (r) => money(r.priceEco), sort: (r) => toNum(r.priceEco) },
    { key: "priceMid", label: "Médio", align: "right", render: (r) => money(r.priceMid), sort: (r) => toNum(r.priceMid) },
    { key: "pricePrem", label: "Premium", align: "right", render: (r) => money(r.pricePrem), sort: (r) => toNum(r.pricePrem) },
    { key: "margin", label: "Margem", align: "right", render: (r) => (toNum(r.priceMid) > 0 ? pct(((toNum(r.priceMid) - toNum(r.cost)) / toNum(r.priceMid)) * 100, 0) : "—"), sort: (r) => (toNum(r.priceMid) > 0 ? (toNum(r.priceMid) - toNum(r.cost)) / toNum(r.priceMid) : 0) },
    { key: "avgMinutes", label: "Tempo", render: (r) => (r.avgMinutes ? `${r.avgMinutes} min` : "—"), sort: (r) => toNum(r.avgMinutes) },
    { key: "status", label: "Status", render: (r) => <StatusBadge def={ACTIVE_STATUS[r.status]} /> },
  ],
};

/* ---------------------------------------------------------------- produtos */
export const products: ModuleConfig = {
  collection: "products", singular: "Produto", plural: "Produtos", icon: Boxes,
  title: (r) => r.name, subtitle: (r) => r.code || "",
  searchText: (r) => [r.name, r.code, r.category, r.location].join(" "),
  emptyText: "Cadastre produtos e materiais para controlar saldo, custo e baixa automática nas OS.",
  sort: { key: "name", dir: "asc" },
  fields: [
    { key: "name", label: "Nome", type: "text", required: true, span: 2 },
    { key: "code", label: "Código", type: "text" },
    { key: "category", label: "Categoria", type: "text", placeholder: "Ex.: Cabos, Câmeras, Disjuntores" },
    { key: "unit", label: "Unidade", type: "select", options: str(UNITS), required: true },
    { key: "qty", label: "Quantidade em estoque", type: "number", hint: "Ao alterar, um ajuste é registrado nas movimentações." },
    { key: "minQty", label: "Estoque mínimo", type: "number" },
    { key: "cost", label: "Custo unitário", type: "money" },
    { key: "price", label: "Preço de venda", type: "money" },
    { key: "supplierId", label: "Fornecedor", type: "ref", ref: { collection: "suppliers", label: (r) => r.name } },
    { key: "location", label: "Localização", type: "text", placeholder: "Ex.: Prateleira B2" },
    { key: "notes", label: "Observações", type: "textarea" },
    { key: "imageUrl", label: "Imagem", type: "image", folder: "products" },
  ],
  defaults: () => ({ unit: "un", qty: 0, minQty: 0, cost: 0, price: 0 }),
  afterSave: (rec, isNew, prev) => {
    if (isNew && toNum(rec.qty) > 0) stockMove({ productId: rec.id, type: "entrada", qty: rec.qty, note: "Saldo inicial", apply: false });
    else if (!isNew && prev && toNum(prev.qty) !== toNum(rec.qty)) {
      db.create("stock_movements", { productId: rec.id, type: "ajuste", qty: toNum(rec.qty), delta: toNum(rec.qty) - toNum(prev.qty), before: toNum(prev.qty), after: toNum(rec.qty), note: "Ajuste manual no cadastro", date: todayISO() });
    }
  },
  filters: [{ key: "supplierId", label: "Fornecedor", collection: "suppliers" }],
  columns: [
    { key: "name", label: "Produto", sort: (r) => r.name?.toLowerCase() },
    { key: "category", label: "Categoria" },
    { key: "qty", label: "Estoque", render: (r) => <StockQty r={r} />, sort: (r) => toNum(r.qty) },
    { key: "minQty", label: "Mínimo", sort: (r) => toNum(r.minQty) },
    { key: "cost", label: "Custo", align: "right", render: (r) => money(r.cost), sort: (r) => toNum(r.cost) },
    { key: "price", label: "Preço", align: "right", render: (r) => money(r.price), sort: (r) => toNum(r.price) },
    { key: "supplierId", label: "Fornecedor", render: (r) => <RefLabel collection="suppliers" id={r.supplierId} />, sort: () => 0 },
    { key: "location", label: "Local", hidden: true },
  ],
  rowActions: (r) => [{ label: "Registrar movimentação", icon: PackagePlus, onClick: () => window.dispatchEvent(new CustomEvent("gbr:stock-move", { detail: r.id })) }],
};

export const stock_movements: ModuleConfig = {
  collection: "stock_movements", singular: "Movimentação", plural: "Movimentações", gender: "f", icon: PackagePlus, readOnly: true, noArchive: true,
  title: (r) => r.type,
  sort: { key: "createdAt", dir: "desc" },
  fields: [
    { key: "productId", label: "Produto", type: "ref", ref: { collection: "products", label: (r) => r.name }, required: true },
    { key: "type", label: "Tipo", type: "select", options: [{ value: "entrada", label: "Entrada" }, { value: "saida", label: "Saída" }, { value: "perda", label: "Perda" }, { value: "ajuste", label: "Ajuste (define saldo)" }, { value: "devolucao", label: "Devolução" }], required: true },
    { key: "qty", label: "Quantidade", type: "number", required: true },
    { key: "unitCost", label: "Custo unitário (entradas)", type: "money" },
    { key: "supplierId", label: "Fornecedor", type: "ref", ref: { collection: "suppliers", label: (r) => r.name } },
    { key: "note", label: "Observação", type: "text", span: 2 },
  ],
  columns: [
    { key: "createdAt", label: "Data", render: (r) => fmtDate(r.date || r.createdAt), sort: (r) => r.createdAt },
    { key: "productId", label: "Produto", render: (r) => <span className="font-semibold"><RefLabel collection="products" id={r.productId} /></span>, sort: () => 0 },
    { key: "type", label: "Tipo", render: (r) => <Badge tone={toNum(r.delta) >= 0 ? "ok" : "warn"}>{({ entrada: "Entrada", saida: "Saída", uso_os: "Uso em OS", perda: "Perda", ajuste: "Ajuste", devolucao: "Devolução" } as Record<string, string>)[r.type] || r.type}</Badge> },
    { key: "delta", label: "Variação", align: "right", render: (r) => <span className={toNum(r.delta) >= 0 ? "text-ok" : "text-bad"}>{toNum(r.delta) > 0 ? "+" : ""}{r.delta}</span>, sort: (r) => toNum(r.delta) },
    { key: "after", label: "Saldo", align: "right" },
    { key: "note", label: "Observação" },
  ],
};

/* ---------------------------------------------------------------- fornecedores */
export const suppliers: ModuleConfig = {
  collection: "suppliers", singular: "Fornecedor", plural: "Fornecedores", icon: Truck,
  title: (r) => r.name, subtitle: (r) => r.contact || "",
  searchText: (r) => [r.name, r.document, r.contact, r.phone, r.email, r.category].join(" "),
  emptyText: "Cadastre fornecedores para relacionar produtos, compras e contas a pagar.",
  sort: { key: "name", dir: "asc" },
  statusKey: "status", statusMap: ACTIVE_STATUS,
  fields: [
    { key: "name", label: "Nome / Razão social", type: "text", required: true, span: 2 },
    { key: "document", label: "CNPJ / CPF", type: "text" },
    { key: "category", label: "Ramo", type: "text", placeholder: "Ex.: Material elétrico" },
    { key: "contact", label: "Contato", type: "text" },
    { key: "phone", label: "Telefone", type: "phone" },
    { key: "whatsapp", label: "WhatsApp", type: "phone" },
    { key: "email", label: "E-mail", type: "email" },
    { key: "address", label: "Endereço", type: "text", span: 2 },
    { key: "status", label: "Status", type: "select", options: opts(ACTIVE_STATUS), required: true },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  defaults: () => ({ status: "ativo" }),
  columns: [
    { key: "name", label: "Fornecedor", sort: (r) => r.name?.toLowerCase() },
    { key: "contact", label: "Contato", render: (r) => <ContactCell phone={r.phone} whatsapp={r.whatsapp} /> },
    { key: "category", label: "Ramo" },
    { key: "products", label: "Produtos", render: (r) => <SupplierStats id={r.id} kind="products" />, sort: () => 0 },
    { key: "payable", label: "A pagar", align: "right", render: (r) => <SupplierStats id={r.id} kind="payable" />, sort: () => 0 },
    { key: "status", label: "Status", render: (r) => <StatusBadge def={ACTIVE_STATUS[r.status]} /> },
  ],
};

/* ---------------------------------------------------------------- financeiro */
export const financial_accounts: ModuleConfig = {
  collection: "financial_accounts", singular: "Conta", plural: "Contas", gender: "f", icon: Landmark,
  title: (r) => r.name,
  fields: [
    { key: "name", label: "Nome da conta", type: "text", required: true },
    { key: "type", label: "Tipo", type: "select", required: true, options: [{ value: "caixa", label: "Caixa" }, { value: "banco", label: "Banco" }, { value: "conta_digital", label: "Conta digital" }, { value: "carteira", label: "Carteira" }] },
    { key: "initialBalance", label: "Saldo inicial", type: "money" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  defaults: () => ({ type: "banco", initialBalance: 0 }),
  columns: [
    { key: "name", label: "Conta", sort: (r) => r.name?.toLowerCase() },
    { key: "type", label: "Tipo", render: (r) => ({ caixa: "Caixa", banco: "Banco", conta_digital: "Conta digital", carteira: "Carteira" } as Record<string, string>)[r.type] || r.type },
    { key: "initialBalance", label: "Saldo inicial", align: "right", render: (r) => money(r.initialBalance) },
    { key: "balance", label: "Saldo atual", align: "right", render: (r) => <AccountBalanceCell acc={r} />, sort: () => 0 },
  ],
};

export const financial_categories: ModuleConfig = {
  collection: "financial_categories", singular: "Categoria", plural: "Categorias financeiras", gender: "f", icon: Tags, softDelete: false, noDuplicate: true,
  title: (r) => r.name,
  fields: [
    { key: "name", label: "Nome", type: "text", required: true },
    { key: "type", label: "Tipo", type: "select", required: true, options: [{ value: "entrada", label: "Entrada (receita)" }, { value: "saida", label: "Saída (despesa)" }] },
    { key: "color", label: "Cor", type: "color" },
  ],
  defaults: () => ({ type: "saida", color: "#38a8ff" }),
  filters: [{ key: "type", label: "Tipo", options: [{ value: "entrada", label: "Entrada" }, { value: "saida", label: "Saída" }] }],
  columns: [
    { key: "name", label: "Categoria", render: (r) => <span className="inline-flex items-center gap-2 font-semibold"><span className="size-3 rounded-full" style={{ background: r.color || "#38a8ff" }} />{r.name}</span> },
    { key: "type", label: "Tipo", render: (r) => <Badge tone={r.type === "entrada" ? "ok" : "bad"}>{r.type === "entrada" ? "▲ Entrada" : "▼ Saída"}</Badge> },
  ],
};

const txnStatusOpts = [{ value: "previsto", label: "Previsto" }, { value: "pendente", label: "Pendente" }, { value: "pago", label: "Pago" }, { value: "cancelado", label: "Cancelado" }];

export const financial_transactions: ModuleConfig = {
  collection: "financial_transactions", singular: "Lançamento", plural: "Lançamentos", icon: Wallet, formSize: "lg",
  title: (r) => r.description, subtitle: (r) => `${money(r.amount)} · ${fmtDate(r.dueDate)}`,
  searchText: (r) => [r.description, r.notes, money(r.amount)].join(" "),
  emptyText: "Registre entradas, saídas e transferências. Contas a receber das OS entram automaticamente.",
  sort: { key: "dueDate", dir: "desc" },
  fields: [
    { key: "type", label: "Tipo", type: "select", required: true, options: [{ value: "entrada", label: "Entrada" }, { value: "saida", label: "Saída" }, { value: "transferencia", label: "Transferência" }] },
    { key: "description", label: "Descrição", type: "text", required: true },
    { key: "amount", label: "Valor", type: "money", required: true },
    { key: "dueDate", label: "Data / vencimento", type: "date", required: true },
    { key: "status", label: "Status", type: "select", required: true, options: txnStatusOpts },
    { key: "paidAt", label: "Data do pagamento", type: "date", showIf: (v) => v.status === "pago" },
    { key: "accountId", label: "Conta", type: "ref", ref: accRef },
    { key: "toAccountId", label: "Conta destino", type: "ref", ref: accRef, showIf: (v) => v.type === "transferencia" },
    { key: "categoryId", label: "Categoria", type: "ref", ref: { collection: "financial_categories", label: (r) => `${r.name} (${r.type === "entrada" ? "entrada" : "saída"})` }, showIf: (v) => v.type !== "transferencia" },
    { key: "method", label: "Forma de pagamento", type: "select", options: opts(Object.fromEntries(Object.entries(PAY_METHODS).map(([k, v]) => [k, { label: v }]))) },
    { key: "customerId", label: "Cliente", type: "ref", ref: custRef, showIf: (v) => v.type === "entrada" },
    { key: "supplierId", label: "Fornecedor", type: "ref", ref: { collection: "suppliers", label: (r) => r.name }, showIf: (v) => v.type === "saida" },
    { key: "workOrderId", label: "OS relacionada", type: "ref", ref: { collection: "work_orders", label: (r) => `${r.number} — ${r.title}` } },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  defaults: () => ({ type: "entrada", status: "pendente", dueDate: todayISO(), amount: "" }),
  beforeSave: (v) => {
    if (toNum(v.amount) <= 0) { toast("Informe um valor maior que zero", "error"); return null; }
    if (v.type === "transferencia") {
      if (!v.accountId || !v.toAccountId || v.accountId === v.toAccountId) { toast("Transferência exige contas de origem e destino diferentes", "error"); return null; }
    }
    return { ...v, paidAt: v.status === "pago" ? v.paidAt || todayISO() : "" };
  },
  filters: [
    { key: "type", label: "Tipo", options: [{ value: "entrada", label: "Entradas" }, { value: "saida", label: "Saídas" }, { value: "transferencia", label: "Transferências" }] },
    { key: "accountId", label: "Conta", collection: "financial_accounts" },
    { key: "categoryId", label: "Categoria", collection: "financial_categories" },
  ],
  columns: [
    { key: "dueDate", label: "Data", render: (r) => <DateCell v={r.dueDate} warnIfPast={txnStatus(r) === "atrasado"} />, sort: (r) => r.dueDate || "" },
    { key: "description", label: "Descrição", sort: (r) => r.description?.toLowerCase() },
    { key: "categoryId", label: "Categoria", render: (r) => <RefLabel collection="financial_categories" id={r.categoryId} fallback={r.type === "transferencia" ? "Transferência" : "—"} />, sort: () => 0 },
    { key: "accountId", label: "Conta", render: (r) => <RefLabel collection="financial_accounts" id={r.accountId} />, sort: () => 0 },
    { key: "amount", label: "Valor", align: "right", render: (r) => <Money v={r.type === "saida" ? -toNum(r.amount) : r.amount} tone={r.type === "entrada" ? "in" : r.type === "saida" ? "out" : undefined} />, sort: (r) => toNum(r.amount) },
    { key: "status", label: "Status", render: (r) => <StatusBadge def={TXN_STATUS[txnStatus(r)]} />, sort: (r) => txnStatus(r) },
  ],
  rowActions: (r) =>
    ["pendente", "previsto"].includes(r.status) && r.type !== "transferencia"
      ? [{ label: r.type === "entrada" ? "Marcar como recebido" : "Marcar como pago", icon: CheckCircle2, onClick: async () => {
          if (await confirmDialog({ title: r.type === "entrada" ? "Registrar recebimento?" : "Registrar pagamento?", message: `${r.description} — ${money(r.amount)}`, confirmText: "Confirmar" })) {
            registerPayment(r, { amount: toNum(r.amount), method: r.method || "pix", accountId: r.accountId || db.list("financial_accounts")[0]?.id || "", paidAt: todayISO() });
            toast("Pagamento registrado");
          }
        } }]
      : r.status === "pago" && r.type !== "transferencia"
        ? [{ label: "Reabrir (voltar a pendente)", icon: Undo2, onClick: () => db.update("financial_transactions", r.id, { status: "pendente", paidAt: "" }) }]
        : [],
};

/* ---------------------------------------------------------------- metas */
export const goals: ModuleConfig = {
  collection: "goals", singular: "Meta", plural: "Metas", gender: "f", icon: Target, softDelete: false,
  title: (r) => r.name || GOAL_TYPES[r.type],
  fields: [
    { key: "name", label: "Nome da meta", type: "text", required: true, span: 2, placeholder: "Ex.: Faturamento de junho" },
    { key: "type", label: "Tipo", type: "select", required: true, options: opts(Object.fromEntries(Object.entries(GOAL_TYPES).map(([k, v]) => [k, { label: v }]))) },
    { key: "target", label: "Valor / quantidade da meta", type: "number", required: true },
    { key: "period", label: "Período", type: "select", required: true, options: [{ value: "mes", label: "Mês" }, { value: "trimestre", label: "Trimestre" }, { value: "ano", label: "Ano" }, { value: "custom", label: "Personalizado" }] },
    { key: "startDate", label: "Início", type: "date", required: true },
    { key: "endDate", label: "Fim", type: "date", showIf: (v) => v.period === "custom" },
  ],
  defaults: () => ({ type: "faturamento", period: "mes", startDate: startOfMonth(), target: "" }),
  beforeSave: (v) => {
    const s = v.startDate || todayISO();
    const end = v.period === "mes" ? endOfMonth(s) : v.period === "trimestre" ? addDays(addMonths(s, 3), -1) : v.period === "ano" ? addDays(addMonths(s, 12), -1) : v.endDate || endOfMonth(s);
    return { ...v, endDate: end };
  },
  columns: [
    { key: "name", label: "Meta" },
    { key: "type", label: "Tipo", render: (r) => GOAL_TYPES[r.type] },
    { key: "target", label: "Alvo", align: "right", render: (r) => (["faturamento", "lucro"].includes(r.type) ? money(r.target) : r.target) },
    { key: "period", label: "Período", render: (r) => `${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}` },
  ],
};

/* ---------------------------------------------------------------- CRM */
export const crm_leads: ModuleConfig = {
  collection: "crm_leads", singular: "Lead", plural: "Leads", icon: UserPlus, softDelete: false,
  title: (r) => r.name,
  fields: [
    { key: "name", label: "Nome", type: "text", required: true, span: 2 },
    { key: "phone", label: "Telefone / WhatsApp", type: "phone" },
    { key: "email", label: "E-mail", type: "email" },
    { key: "source", label: "Origem", type: "select", options: str(SOURCES) },
    { key: "stage", label: "Etapa", type: "select", required: true, options: stageOpts },
    { key: "value", label: "Valor estimado", type: "money" },
    { key: "nextContact", label: "Próximo contato", type: "date" },
    { key: "customerId", label: "Cliente vinculado", type: "ref", ref: custRef },
    { key: "tags", label: "Etiquetas", type: "tags" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  defaults: () => ({ stage: "lead", value: 0 }),
  columns: [{ key: "name", label: "Lead" }, { key: "stage", label: "Etapa", render: (r) => PIPELINE.find((p) => p.id === r.stage)?.label }, { key: "value", label: "Valor", render: (r) => money(r.value) }],
};

const KINDS = [{ value: "tarefa", label: "Tarefa" }, { value: "followup", label: "Follow-up" }, { value: "ligacao", label: "Ligação" }, { value: "whatsapp", label: "WhatsApp" }, { value: "manutencao", label: "Manutenção preventiva" }, { value: "posvenda", label: "Pós-venda" }];
export const crm_activities: ModuleConfig = {
  collection: "crm_activities", singular: "Tarefa", plural: "Tarefas", gender: "f", icon: ListTodo, softDelete: false,
  title: (r) => r.title, subtitle: (r) => fmtDate(r.dueDate),
  statusKey: "status", statusMap: TASK_STATUS, sort: { key: "dueDate", dir: "asc" },
  emptyText: "Follow-ups, manutenções preventivas e pós-venda aparecem aqui automaticamente.",
  fields: [
    { key: "title", label: "Título", type: "text", required: true, span: 2 },
    { key: "kind", label: "Tipo", type: "select", options: KINDS, required: true },
    { key: "dueDate", label: "Prazo", type: "date", required: true },
    { key: "status", label: "Status", type: "select", required: true, options: opts(TASK_STATUS) },
    { key: "customerId", label: "Cliente", type: "ref", ref: custRef },
    { key: "workOrderId", label: "OS relacionada", type: "ref", ref: { collection: "work_orders", label: (r) => `${r.number} — ${r.title}` } },
    { key: "message", label: "Mensagem (WhatsApp)", type: "textarea" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  defaults: () => ({ kind: "tarefa", status: "aberta", dueDate: todayISO() }),
  columns: [
    { key: "title", label: "Tarefa" },
    { key: "kind", label: "Tipo", render: (r) => KINDS.find((k) => k.value === r.kind)?.label || r.kind },
    { key: "dueDate", label: "Prazo", render: (r) => <DateCell v={r.dueDate} warnIfPast={r.status === "aberta"} />, sort: (r) => r.dueDate || "" },
    { key: "customerId", label: "Cliente", render: (r) => <RefLabel collection="customers" id={r.customerId} />, sort: () => 0 },
    { key: "status", label: "Status", render: (r) => <StatusBadge def={TASK_STATUS[r.status]} /> },
  ],
  rowActions: (r) => {
    const cust = r.customerId ? db.get("customers", r.customerId) : undefined;
    const phone = cust?.whatsapp || cust?.phone;
    const url = r.waUrl || (r.message && phone ? waLink(phone, r.message) : "");
    return [
      r.status === "aberta" ? { label: "Concluir", icon: CheckCircle2, onClick: () => db.update("crm_activities", r.id, { status: "concluida", doneAt: nowISO() }, { silent: true }) } : { label: "Reabrir", icon: Undo2, onClick: () => db.update("crm_activities", r.id, { status: "aberta" }, { silent: true }) },
      url && { label: "Enviar WhatsApp", icon: MessageCircle, onClick: () => window.open(url, "_blank") },
    ];
  },
};

/* ---------------------------------------------------------------- equipamentos / garantias / avaliações */
export const customer_equipment: ModuleConfig = {
  collection: "customer_equipment", singular: "Equipamento", plural: "Equipamentos", icon: Cpu, softDelete: false,
  title: (r) => `${r.type} ${r.brand || ""} ${r.model || ""}`.trim(),
  searchText: (r) => [r.type, r.brand, r.model, r.serial, r.location].join(" "),
  emptyText: "Registre câmeras, DVRs, roteadores, fechaduras e outros equipamentos instalados ou atendidos.",
  fields: [
    { key: "customerId", label: "Cliente", type: "ref", ref: custRef, required: true },
    { key: "type", label: "Tipo", type: "select", options: str(EQUIP_TYPES), required: true },
    { key: "brand", label: "Marca", type: "text" },
    { key: "model", label: "Modelo", type: "text" },
    { key: "serial", label: "Número de série", type: "text" },
    { key: "location", label: "Local de instalação", type: "text" },
    { key: "installDate", label: "Data de instalação", type: "date" },
    { key: "warrantyUntil", label: "Garantia até", type: "date" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  defaults: () => ({ type: "Câmera", installDate: todayISO() }),
  extraForm: (v, set) => <MaintenanceLog values={v} set={set} />,
  columns: [
    { key: "type", label: "Equipamento", render: (r) => <span className="font-semibold">{r.type} {r.brand} {r.model}</span> },
    { key: "customerId", label: "Cliente", render: (r) => <RefLabel collection="customers" id={r.customerId} />, sort: () => 0 },
    { key: "serial", label: "Série" },
    { key: "location", label: "Local" },
    { key: "warrantyUntil", label: "Garantia", render: (r) => (r.warrantyUntil ? <StatusBadge def={warrantyStatus({ endDate: r.warrantyUntil })} /> : "—"), sort: (r) => r.warrantyUntil || "" },
    { key: "maint", label: "Manutenções", render: (r) => (r.maintenance || []).length, sort: (r) => (r.maintenance || []).length },
  ],
};

function MaintenanceLog({ values, set }: { values: Record<string, any>; set: (k: string, v: any) => void }) {
  const list: Rec[] = values.maintenance || [];
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-accent">Histórico de manutenção</div>
        <button type="button" className="btn btn-sm" onClick={() => set("maintenance", [...list, { id: Math.random().toString(36).slice(2), date: todayISO(), text: "" }])}>+ Registro</button>
      </div>
      <div className="space-y-2">
        {list.map((m) => (
          <div key={m.id} className="flex gap-2">
            <input type="date" className="input input-sm !w-40" value={m.date} onChange={(e) => set("maintenance", list.map((x) => (x.id === m.id ? { ...x, date: e.target.value } : x)))} />
            <input className="input input-sm" placeholder="O que foi feito" value={m.text} onChange={(e) => set("maintenance", list.map((x) => (x.id === m.id ? { ...x, text: e.target.value } : x)))} />
            <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => set("maintenance", list.filter((x) => x.id !== m.id))}>✕</button>
          </div>
        ))}
        {!list.length && <p className="text-xs text-fg3">Nenhuma manutenção registrada.</p>}
      </div>
    </div>
  );
}

export const warranties: ModuleConfig = {
  collection: "warranties", singular: "Garantia", plural: "Garantias", gender: "f", icon: ShieldCheck, softDelete: false,
  title: (r) => r.title, subtitle: (r) => `até ${fmtDate(r.endDate)}`,
  sort: { key: "endDate", dir: "asc" },
  emptyText: "As garantias são criadas automaticamente ao concluir uma OS com garantia definida.",
  fields: [
    { key: "title", label: "Título", type: "text", required: true, span: 2 },
    { key: "customerId", label: "Cliente", type: "ref", ref: custRef, required: true },
    { key: "workOrderId", label: "OS", type: "ref", ref: { collection: "work_orders", label: (r) => `${r.number} — ${r.title}` } },
    { key: "startDate", label: "Início", type: "date", required: true },
    { key: "endDate", label: "Fim", type: "date", required: true },
    { key: "conditions", label: "Condições", type: "textarea" },
  ],
  defaults: () => ({ startDate: todayISO(), endDate: addDays(todayISO(), 90) }),
  columns: [
    { key: "title", label: "Garantia" },
    { key: "customerId", label: "Cliente", render: (r) => <RefLabel collection="customers" id={r.customerId} />, sort: () => 0 },
    { key: "startDate", label: "Início", render: (r) => fmtDate(r.startDate), sort: (r) => r.startDate },
    { key: "endDate", label: "Fim", render: (r) => fmtDate(r.endDate), sort: (r) => r.endDate },
    { key: "state", label: "Situação", render: (r) => <StatusBadge def={warrantyStatus(r)} />, sort: (r) => r.endDate },
  ],
};

const RATE = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} ${"★".repeat(n)}` }));
export const evaluations: ModuleConfig = {
  collection: "evaluations", singular: "Avaliação", plural: "Avaliações", gender: "f", icon: Star, softDelete: false, noDuplicate: true,
  title: (r) => `Avaliação ${r.overall}/5`,
  emptyText: "Após concluir uma OS, o cliente pode avaliar pelo portal. Você também pode registrar avaliações manualmente.",
  fields: [
    { key: "customerId", label: "Cliente", type: "ref", ref: custRef, required: true },
    { key: "workOrderId", label: "OS", type: "ref", ref: { collection: "work_orders", label: (r) => `${r.number} — ${r.title}` } },
    { key: "quality", label: "Qualidade", type: "select", options: RATE, required: true },
    { key: "service", label: "Atendimento", type: "select", options: RATE, required: true },
    { key: "deadline", label: "Prazo", type: "select", options: RATE, required: true },
    { key: "price", label: "Preço", type: "select", options: RATE, required: true },
    { key: "result", label: "Resultado", type: "select", options: RATE, required: true },
    { key: "comment", label: "Comentário", type: "textarea" },
  ],
  defaults: () => ({ quality: "5", service: "5", deadline: "5", price: "5", result: "5", source: "manual", date: todayISO() }),
  beforeSave: (v) => {
    const vals = ["quality", "service", "deadline", "price", "result"].map((k) => toNum(v[k]));
    return { ...v, quality: vals[0], service: vals[1], deadline: vals[2], price: vals[3], result: vals[4], overall: Math.round((vals.reduce((a, b) => a + b, 0) / 5) * 100) / 100 };
  },
  columns: [
    { key: "date", label: "Data", render: (r) => fmtDate(r.date || r.createdAt), sort: (r) => r.date || r.createdAt },
    { key: "customerId", label: "Cliente", render: (r) => <RefLabel collection="customers" id={r.customerId} />, sort: () => 0 },
    { key: "overall", label: "Nota", render: (r) => <span className="text-warn font-bold">★ {r.overall}</span>, sort: (r) => toNum(r.overall) },
    { key: "comment", label: "Comentário", render: (r) => <span className="text-fg2 line-clamp-1">{r.comment || "—"}</span> },
    { key: "source", label: "Origem", render: (r) => (r.source === "portal" ? "Portal" : "Manual") },
  ],
};

/* ---------------------------------------------------------------- agenda */
export const appointments: ModuleConfig = {
  collection: "appointments", singular: "Agendamento", plural: "Agendamentos", icon: CalendarDays, softDelete: false,
  title: (r) => r.title,
  statusKey: "status", statusMap: APPT_STATUS,
  fields: [
    { key: "title", label: "Título", type: "text", required: true, span: 2 },
    { key: "type", label: "Tipo", type: "select", required: true, options: opts(Object.fromEntries(Object.entries(APPT_TYPES).map(([k, v]) => [k, { label: v.label }]))) },
    { key: "status", label: "Status", type: "select", required: true, options: opts(APPT_STATUS) },
    { key: "date", label: "Data", type: "date", required: true },
    { key: "startTime", label: "Início", type: "time" },
    { key: "endTime", label: "Fim", type: "time" },
    { key: "customerId", label: "Cliente", type: "ref", ref: custRef },
    { key: "workOrderId", label: "OS", type: "ref", ref: { collection: "work_orders", label: (r) => `${r.number} — ${r.title}` } },
    { key: "address", label: "Local / endereço", type: "text", span: 2 },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  defaults: () => ({ type: "atendimento", status: "agendado", date: todayISO(), startTime: "09:00" }),
  beforeSave: (v) => {
    if (v.type === "bloqueio") return { ...v, status: v.status || "agendado" };
    return v;
  },
  columns: [{ key: "title", label: "Compromisso" }, { key: "date", label: "Data", render: (r) => fmtDate(r.date) }],
};

/* ---------------------------------------------------------------- orçamentos / OS (listas) */
export const quotes: ModuleConfig = {
  collection: "quotes", singular: "Orçamento", plural: "Orçamentos", icon: FileText, detail: true, customEditor: true,
  title: (r) => `${r.number} — ${r.title || "Sem título"}`,
  subtitle: (r) => money(r.total),
  statusKey: "status", statusMap: QUOTE_STATUS,
  searchText: (r) => [r.number, r.title, r.description, db.get("customers", r.customerId)?.name].join(" "),
  emptyText: "Crie orçamentos com preço por nível, taxa de maquininha repassada e envie o link ao cliente.",
  fields: [],
  columns: [
    { key: "number", label: "Nº", sort: (r) => r.number },
    { key: "customerId", label: "Cliente", render: (r) => <span className="font-medium"><RefLabel collection="customers" id={r.customerId} /></span>, sort: () => 0 },
    { key: "title", label: "Título", render: (r) => <span className="text-fg2">{r.title}</span> },
    { key: "total", label: "Total", align: "right", render: (r) => <span className="font-semibold">{money(r.total)}</span>, sort: (r) => toNum(r.total) },
    { key: "validUntil", label: "Validade", render: (r) => <DateCell v={r.validUntil} warnIfPast={["enviado", "aguardando"].includes(r.status)} />, sort: (r) => r.validUntil || "" },
    { key: "status", label: "Status", render: (r) => <StatusBadge def={QUOTE_STATUS[r.status]} /> },
  ],
  rowActions: (r, ui) => [
    r.status === "aprovado" && !r.workOrderId && { label: "Criar ordem de serviço", icon: CalendarPlus, onClick: async () => { const os = await createOrderFromQuote(r); toast(`${os.number} criada`); ui.openDetail("work_orders", os.id); } },
    r.workOrderId && { label: "Abrir OS gerada", icon: ExternalLink, onClick: () => ui.openDetail("work_orders", r.workOrderId) },
  ],
};

export const work_orders: ModuleConfig = {
  collection: "work_orders", singular: "Ordem de serviço", plural: "Ordens de serviço", gender: "f", icon: ClipboardList, detail: true, customEditor: true,
  title: (r) => `${r.number} — ${r.title || "Sem título"}`,
  subtitle: (r) => money(r.total),
  statusKey: "status", statusMap: OS_STATUS,
  searchText: (r) => [r.number, r.title, r.description, r.technician, r.address, db.get("customers", r.customerId)?.name].join(" "),
  emptyText: "Crie uma OS do zero ou a partir de um orçamento aprovado.",
  fields: [],
  columns: [
    { key: "number", label: "Nº", sort: (r) => r.number },
    { key: "customerId", label: "Cliente", render: (r) => <span className="font-medium"><RefLabel collection="customers" id={r.customerId} /></span>, sort: () => 0 },
    { key: "title", label: "Serviço", render: (r) => <span className="text-fg2">{r.title}</span> },
    { key: "date", label: "Agenda", render: (r) => (r.date ? <DateCell v={r.date} warnIfPast={!["concluida", "faturada", "cancelada"].includes(r.status)} /> : <span className="text-fg3">—</span>), sort: (r) => r.date || "9999" },
    { key: "technician", label: "Técnico", hidden: true },
    { key: "total", label: "Valor", align: "right", render: (r) => <span className="font-semibold">{money(r.total)}</span>, sort: (r) => toNum(r.total) },
    { key: "status", label: "Status", render: (r) => <StatusBadge def={OS_STATUS[r.status]} /> },
  ],
  rowActions: (r) => [{ label: "Modo técnico", icon: Smartphone, onClick: () => (window.location.href = `/ordens-de-servico/${r.id}/tecnico`) }],
};

/* ---------------------------------------------------------------- automações / templates / usuários */
export const automations: ModuleConfig = {
  collection: "automations", singular: "Automação", plural: "Automações", gender: "f", icon: Zap, softDelete: false,
  title: (r) => r.name,
  emptyText: "Automações executam ações após eventos (ex.: OS concluída → pós-venda em 1, 7 e 30 dias).",
  fields: [
    { key: "name", label: "Nome", type: "text", required: true, span: 2 },
    { key: "active", label: "Ativa", type: "checkbox" },
    { key: "trigger", label: "Gatilho (quando)", type: "select", required: true, options: opts(Object.fromEntries(Object.entries(TRIGGERS).map(([k, v]) => [k, { label: v }]))), section: "Quando" },
    { key: "delayDays", label: "Esperar (dias)", type: "number", hint: "0 = executar na hora" },
    { key: "condition", label: "Condição (se)", type: "select", required: true, options: opts(Object.fromEntries(Object.entries(CONDITIONS).map(([k, v]) => [k, { label: v }]))), section: "Se" },
    { key: "conditionValue", label: "Valor mínimo (R$)", type: "money", showIf: (v) => v.condition === "valor_maior" },
    { key: "action", label: "Ação (então)", type: "select", required: true, options: opts(Object.fromEntries(Object.entries(ACTIONS).map(([k, v]) => [k, { label: v }]))), section: "Então" },
    { key: "templateKey", label: "Modelo de mensagem", type: "ref", ref: { collection: "document_templates", label: (r) => r.name } },
    { key: "taskTitle", label: "Título da tarefa/notificação", type: "text", span: 2 },
    { key: "text", label: "Texto personalizado (opcional)", type: "textarea", hint: "Variáveis: {{cliente}} {{data}} {{hora}} {{valor}} {{os}} {{orcamento}} {{link}}" },
  ],
  defaults: () => ({ active: true, delayDays: 0, condition: "none", action: "criar_tarefa", trigger: "os_concluida" }),
  columns: [
    { key: "name", label: "Automação" },
    { key: "flow", label: "Fluxo", render: (r) => <span className="text-fg2">{TRIGGERS[r.trigger]}{toNum(r.delayDays) ? ` → +${r.delayDays}d` : ""} → {ACTIONS[r.action]}</span>, sort: () => 0 },
    { key: "active", label: "Estado", render: (r) => <Badge tone={r.active ? "ok" : "neutral"}>{r.active ? "● Ativa" : "○ Pausada"}</Badge> },
  ],
  rowActions: (r) => [{ label: r.active ? "Pausar" : "Ativar", icon: Zap, onClick: () => db.update("automations", r.id, { active: !r.active }, { silent: true }) }],
};

export const document_templates: ModuleConfig = {
  collection: "document_templates", singular: "Modelo de mensagem", plural: "Modelos de mensagem", icon: MessageSquareText, softDelete: false,
  title: (r) => r.name,
  fields: [
    { key: "name", label: "Nome", type: "text", required: true },
    { key: "key", label: "Identificador", type: "text", hint: "Ex.: os_concluida" },
    { key: "channel", label: "Canal", type: "select", options: [{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "E-mail" }] },
    { key: "body", label: "Mensagem", type: "textarea", required: true, rows: 5, hint: "Variáveis: {{cliente}} {{data}} {{hora}} {{valor}} {{os}} {{orcamento}} {{link}}" },
  ],
  defaults: () => ({ channel: "whatsapp" }),
  columns: [{ key: "name", label: "Modelo" }, { key: "key", label: "ID" }, { key: "body", label: "Mensagem", render: (r) => <span className="text-fg2 line-clamp-1">{r.body}</span> }],
};

export const roles: ModuleConfig = {
  collection: "roles", singular: "Perfil", plural: "Perfis de acesso", icon: KeyRound, softDelete: false,
  title: (r) => r.name,
  fields: [
    { key: "name", label: "Nome do perfil", type: "text", required: true },
    { key: "description", label: "Descrição", type: "text" },
    { key: "permissions", label: "Módulos permitidos", type: "multiselect", options: str(ROLE_MODULES), hint: "Aplicado quando a autenticação for ativada." },
  ],
  columns: [{ key: "name", label: "Perfil" }, { key: "description", label: "Descrição" }, { key: "permissions", label: "Módulos", render: (r) => `${(r.permissions || []).length} módulos` }],
};

export const users: ModuleConfig = {
  collection: "users", singular: "Usuário", plural: "Usuários", icon: UserCog, softDelete: false,
  title: (r) => r.name,
  fields: [
    { key: "name", label: "Nome", type: "text", required: true },
    { key: "email", label: "E-mail", type: "email" },
    { key: "phone", label: "Telefone", type: "phone" },
    { key: "roleId", label: "Perfil", type: "ref", ref: { collection: "roles", label: (r) => r.name } },
    { key: "isTechnician", label: "É técnico (aparece nas OS)", type: "checkbox" },
    { key: "status", label: "Status", type: "select", options: opts(ACTIVE_STATUS) },
  ],
  defaults: () => ({ status: "ativo", isTechnician: true }),
  columns: [{ key: "name", label: "Usuário" }, { key: "email", label: "E-mail" }, { key: "roleId", label: "Perfil", render: (r) => <RefLabel collection="roles" id={r.roleId} /> }, { key: "status", label: "Status", render: (r) => <StatusBadge def={ACTIVE_STATUS[r.status]} /> }],
};

export const audit_logs: ModuleConfig = {
  collection: "audit_logs", singular: "Registro", plural: "Registros de auditoria", icon: Flag, readOnly: true, noArchive: true,
  title: (r) => r.message,
  sort: { key: "at", dir: "desc" }, pageSize: 15,
  searchText: (r) => [r.message, r.userName, r.collection, r.recordLabel, r.action].join(" "),
  fields: [],
  filters: [{ key: "action", label: "Ação", options: [{ value: "create", label: "Criação" }, { value: "update", label: "Alteração" }, { value: "delete", label: "Exclusão" }, { value: "soft_delete", label: "Lixeira" }] }],
  columns: [
    { key: "at", label: "Data/hora", render: (r) => new Date(r.at).toLocaleString("pt-BR"), sort: (r) => r.at },
    { key: "userName", label: "Usuário" },
    { key: "action", label: "Ação", render: (r) => <Badge tone={r.action === "update" ? "info" : r.action === "create" ? "ok" : "warn"}>{({ create: "Criação", update: "Alteração", delete: "Exclusão", soft_delete: "Lixeira" } as Record<string, string>)[r.action] || r.action}</Badge> },
    { key: "message", label: "Descrição", render: (r) => <span className="text-fg2">{r.message}</span> },
  ],
};

export const notesUnused = null;
export const _icons = { Contact, MapPin, Receipt, Send };
export type { Field };
