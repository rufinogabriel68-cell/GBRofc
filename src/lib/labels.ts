import { money } from "./utils";
import type { Rec } from "./types";

export const SINGULAR: Record<string, string> = {
  customers: "cliente",
  services: "serviço",
  products: "produto",
  suppliers: "fornecedor",
  quotes: "orçamento",
  work_orders: "OS",
  financial_transactions: "lançamento",
  financial_accounts: "conta",
  goals: "meta",
  settings: "configuração",
  appointments: "agendamento",
  notes: "anotação",
  documents: "documento",
  crm_leads: "lead",
  warranties: "garantia",
};

export const FIELD_LABELS: Record<string, Record<string, string>> = {
  services: {
    name: "Nome",
    code: "Código",
    priceEco: "Preço Econômico",
    priceMid: "Preço Médio",
    pricePrem: "Preço Premium",
    cost: "Custo estimado",
    avgMinutes: "Tempo médio",
    unit: "Unidade",
    status: "Status",
    categoryId: "Categoria",
    warrantyDays: "Garantia (dias)",
  },
  products: { name: "Nome", price: "Preço", cost: "Custo", qty: "Quantidade", minQty: "Estoque mínimo", supplierId: "Fornecedor", location: "Localização" },
  customers: { name: "Nome", phone: "Telefone", whatsapp: "WhatsApp", email: "E-mail", document: "CPF/CNPJ", stage: "Estágio" },
  quotes: { status: "Status", title: "Título", validUntil: "Validade", customerId: "Cliente" },
  work_orders: { status: "Status", technician: "Técnico", date: "Data", time: "Horário", title: "Serviço" },
  financial_transactions: { amount: "Valor", status: "Status", dueDate: "Vencimento", description: "Descrição", accountId: "Conta" },
  settings: { name: "Nome da empresa", fees: "Taxas de maquininha", primaryColor: "Cor principal", pdfTemplate: "Modelo de PDF", theme: "Tema" },
  goals: { target: "Meta" },
};

const MONEY_KEYS = new Set(["priceEco", "priceMid", "pricePrem", "cost", "price", "amount", "target", "salePrice", "unitCost"]);

export function recordLabel(rec?: Rec | null): string {
  if (!rec) return "";
  return String(rec.name || rec.title || rec.number || rec.description || rec.code || rec.id || "");
}

const fmt = (k: string, v: unknown) => {
  if (v === undefined || v === null || v === "") return "vazio";
  if (MONEY_KEYS.has(k) && typeof v === "number") return money(v);
  if (typeof v === "object") return "(atualizado)";
  return String(v);
};

const SKIP = new Set(["updatedAt", "updatedBy", "history", "messages", "createdAt", "createdBy", "events", "appliedEvents", "lastOpenedAt", "items"]);

export function describeChanges(col: string, prev: Rec, patch: Record<string, any>) {
  const changes: { field: string; label: string; from: unknown; to: unknown }[] = [];
  for (const k of Object.keys(patch)) {
    if (SKIP.has(k)) continue;
    if (JSON.stringify(prev[k] ?? null) === JSON.stringify(patch[k] ?? null)) continue;
    changes.push({ field: k, label: FIELD_LABELS[col]?.[k] || k, from: prev[k] ?? null, to: patch[k] ?? null });
  }
  const name = recordLabel(prev);
  const sing = SINGULAR[col] || col;
  const message = changes
    .slice(0, 4)
    .map((c) => `${c.label} do ${sing} ${name ? `"${name}" ` : ""}alterado de ${fmt(c.field, c.from)} para ${fmt(c.field, c.to)}`)
    .join("; ");
  return { changes, message };
}

export const AUDIT_CREATE = new Set(["customers", "services", "products", "quotes", "work_orders", "financial_transactions", "suppliers", "documents", "goals"]);
export const AUDIT_SKIP = new Set(["audit_logs", "notifications", "automation_logs", "public_links", "stock_movements", "work_order_messages", "crm_activities", "settings_recents"]);
