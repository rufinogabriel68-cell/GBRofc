import type { Rec } from "./types";
import { txnStatus } from "./finance";
import { OS_CLOSED } from "./constants";
import { addDays, dayOf, diffDays, fmtDate, money, todayISO, toNum } from "./utils";

export type Alert = {
  key: string;
  type: "late_order" | "low_stock" | "due_bill" | "warranty" | "quotes_waiting" | "task" | "info";
  severity: "info" | "warn" | "bad";
  title: string;
  body?: string;
  href?: string;
  entity?: { col: string; id: string };
  /** true = gera notificação persistente. */
  persist: boolean;
};

const live = (r: Rec) => !r.archived && !r.deletedAt;

/** Pendências calculadas com dados reais (usadas no widget e nas notificações). */
export function computeAlerts(d: { quotes: Rec[]; orders: Rec[]; txns: Rec[]; products: Rec[]; warranties: Rec[]; activities: Rec[]; customers: Rec[] }): Alert[] {
  const today = todayISO();
  const out: Alert[] = [];
  const cust = new Map(d.customers.map((c) => [c.id, c.name]));

  for (const o of d.orders.filter(live)) {
    if (OS_CLOSED.includes(o.status) || !o.date) continue;
    if (dayOf(o.date) < today) {
      out.push({ key: `late_${o.id}_${o.date}`, type: "late_order", severity: "bad", title: `${o.number} atrasada`, body: `${o.title} — ${cust.get(o.customerId) || ""} (previsto ${fmtDate(o.date)})`, entity: { col: "work_orders", id: o.id }, persist: true });
    }
  }
  const waitingMaterial = d.orders.filter((o) => live(o) && o.status === "aguardando_material");
  if (waitingMaterial.length) out.push({ key: `wm_${waitingMaterial.length}`, type: "info", severity: "warn", title: `${waitingMaterial.length} OS aguardando material`, href: "/ordens-de-servico", persist: false });

  const waiting = d.quotes.filter((q) => live(q) && ["enviado", "aguardando"].includes(q.status));
  if (waiting.length) out.push({ key: `qw_${waiting.length}`, type: "quotes_waiting", severity: "warn", title: `${waiting.length} orçamento${waiting.length > 1 ? "s" : ""} aguardando resposta`, body: money(waiting.reduce((a, q) => a + toNum(q.total), 0)) + " em aberto", href: "/orcamentos", persist: false });

  for (const p of d.products.filter(live)) {
    if (toNum(p.minQty) > 0 && toNum(p.qty) <= toNum(p.minQty)) {
      out.push({ key: `low_${p.id}_${today.slice(0, 7)}`, type: "low_stock", severity: "warn", title: `Estoque de ${p.name} abaixo do mínimo`, body: `${p.qty} ${p.unit} (mínimo ${p.minQty})`, entity: { col: "products", id: p.id }, persist: true });
    }
  }

  const due = d.txns.filter((t) => live(t) && ["pendente", "previsto"].includes(t.status) && t.type !== "transferencia" && t.dueDate && diffDays(today, dayOf(t.dueDate)) <= 3);
  const dueCount = due.filter((t) => t.type === "saida").length;
  if (dueCount) out.push({ key: `bills_${dueCount}`, type: "due_bill", severity: "warn", title: `${dueCount} conta${dueCount > 1 ? "s" : ""} a pagar vencendo`, href: "/financeiro", persist: false });
  for (const t of due) {
    const overdue = txnStatus(t) === "atrasado";
    out.push({ key: `due_${t.id}_${t.dueDate}`, type: "due_bill", severity: overdue ? "bad" : "warn", title: `${t.type === "saida" ? "Conta a pagar" : "Recebimento"} ${overdue ? "atrasado(a)" : "vencendo"}: ${t.description}`, body: `${money(t.amount)} · ${fmtDate(t.dueDate)}`, entity: { col: "financial_transactions", id: t.id }, persist: true });
  }

  for (const w of d.warranties.filter(live)) {
    const days = diffDays(today, dayOf(w.endDate));
    if (days >= 0 && days <= 30) out.push({ key: `war_${w.id}`, type: "warranty", severity: "info", title: `Garantia vencendo em ${days} dia(s)`, body: `${w.title} — ${cust.get(w.customerId) || ""}`, entity: { col: "warranties", id: w.id }, persist: true });
  }

  const tasks = d.activities.filter((a) => live(a) && a.status === "aberta" && dayOf(a.dueDate) <= addDays(today, 0));
  if (tasks.length) out.push({ key: `tasks_${tasks.length}`, type: "task", severity: "info", title: `${tasks.length} tarefa${tasks.length > 1 ? "s" : ""}/follow-up${tasks.length > 1 ? "s" : ""} para hoje ou atrasad${tasks.length > 1 ? "os" : "o"}`, href: "/crm?tab=tarefas", persist: false });
  return out;
}
