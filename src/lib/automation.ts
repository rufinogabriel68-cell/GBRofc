import { db } from "./data/store";
import { renderTemplate, waLink } from "./whatsapp";
import { addDays, fmtDate, money, newId, nowISO, todayISO, toNum } from "./utils";
import type { Rec } from "./types";

/**
 * Motor de automações: Gatilho → (Espera) → Condição → Ação.
 * O gatilho agenda um registro em `automation_logs`; o executor (client watcher hoje,
 * Cloud Function agendada no futuro — ver firebase/functions) processa os vencidos.
 */
export const TRIGGERS: Record<string, string> = {
  orcamento_enviado: "Orçamento enviado",
  orcamento_aprovado: "Orçamento aprovado",
  os_criada: "OS criada",
  os_concluida: "OS concluída",
  pagamento_recebido: "Pagamento recebido",
};
export const CONDITIONS: Record<string, string> = {
  none: "Sem condição",
  cliente_whatsapp: "Cliente possui WhatsApp",
  orcamento_nao_aprovado: "Orçamento ainda não aprovado",
  os_sem_avaliacao: "OS ainda sem avaliação",
  valor_maior: "Valor maior que (R$)",
};
export const ACTIONS: Record<string, string> = {
  criar_tarefa: "Criar tarefa de follow-up",
  enviar_whatsapp: "Preparar mensagem de WhatsApp",
  notificar: "Criar notificação",
};

export function fireTrigger(trigger: string, ctx: { customerId?: string; orderId?: string; quoteId?: string }) {
  const list = db.list("automations").filter((a) => a.active && a.trigger === trigger && !a.deletedAt);
  for (const a of list) {
    const delay = Math.max(0, toNum(a.delayDays));
    const log = db.create("automation_logs", {
      automationId: a.id,
      name: a.name,
      trigger,
      ctx,
      runDate: addDays(todayISO(), delay),
      status: "agendado",
      message: delay ? `Agendado para ${fmtDate(addDays(todayISO(), delay))}` : "Executando",
    });
    if (delay === 0) execute(log);
  }
}

export function runDueAutomations() {
  const due = db.list("automation_logs").filter((l) => l.status === "agendado" && l.runDate <= todayISO());
  due.forEach(execute);
  return due.length;
}

function vars(ctx: Rec) {
  const cust = db.get("customers", ctx.customerId);
  const os = ctx.orderId ? db.get("work_orders", ctx.orderId) : undefined;
  const q = ctx.quoteId ? db.get("quotes", ctx.quoteId) : undefined;
  const total = os?.total ?? q?.total ?? 0;
  const token = os?.publicToken || q?.publicToken;
  return {
    cust, os, q,
    map: {
      cliente: (cust?.name || "").split(" ")[0] || "cliente",
      data: fmtDate(os?.date || q?.validUntil),
      hora: os?.time || "",
      valor: money(total),
      os: os?.number || "",
      orcamento: q?.number || "",
      link: token && typeof location !== "undefined" ? `${location.origin}/${os ? "os" : "o"}/${token}` : "",
    } as Record<string, string>,
  };
}

function finish(log: Rec, status: string, message: string) {
  db.update("automation_logs", log.id, { status, message, executedAt: nowISO() }, { silent: true });
}

function execute(log: Rec) {
  const a = db.get("automations", log.automationId);
  if (!a || !a.active) return finish(log, "ignorado", "Automação desativada ou removida");
  const { cust, os, q, map } = vars(log.ctx || {});
  // condição
  const c = a.condition || "none";
  if (c === "cliente_whatsapp" && !(cust?.whatsapp || cust?.phone)) return finish(log, "ignorado", "Cliente sem WhatsApp");
  if (c === "orcamento_nao_aprovado" && q && !["enviado", "aguardando", "rascunho"].includes(q.status)) return finish(log, "ignorado", "Orçamento já respondido");
  if (c === "os_sem_avaliacao" && os && db.list("evaluations").some((e) => e.workOrderId === os.id)) return finish(log, "ignorado", "OS já avaliada");
  if (c === "valor_maior" && toNum(os?.total ?? q?.total) <= toNum(a.conditionValue)) return finish(log, "ignorado", "Valor abaixo do mínimo");
  // ação
  const tpl = a.templateKey ? db.list("document_templates").find((t) => (t.id === a.templateKey || t.key === a.templateKey) && !t.deletedAt) : undefined;
  const text = renderTemplate(a.text || tpl?.body || "", map);
  if (a.action === "criar_tarefa") {
    db.create("crm_activities", { title: renderTemplate(a.taskTitle || a.name, map), kind: "followup", dueDate: todayISO(), status: "aberta", customerId: log.ctx?.customerId || "", workOrderId: log.ctx?.orderId || "", notes: text, automationId: a.id });
    return finish(log, "executado", "Tarefa criada");
  }
  if (a.action === "enviar_whatsapp") {
    const phone = cust?.whatsapp || cust?.phone || "";
    db.create("crm_activities", { title: renderTemplate(a.taskTitle || `Enviar WhatsApp — ${cust?.name || ""}`, map), kind: "whatsapp", dueDate: todayISO(), status: "aberta", customerId: log.ctx?.customerId || "", workOrderId: log.ctx?.orderId || "", message: text, waUrl: phone ? waLink(phone, text) : "", automationId: a.id });
    return finish(log, "executado", "Mensagem preparada (envio pela tarefa)");
  }
  if (a.action === "notificar") {
    db.create("notifications", { type: "info", title: renderTemplate(a.taskTitle || a.name, map), body: text, read: false, severity: "info", at: nowISO(), entity: log.ctx?.orderId ? { col: "work_orders", id: log.ctx.orderId } : null }, newId());
    return finish(log, "executado", "Notificação criada");
  }
  finish(log, "ignorado", "Ação desconhecida");
}
