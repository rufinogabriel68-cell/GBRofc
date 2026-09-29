import { db } from "./data/store";
import { CATEGORIES_DEFAULT, ROLE_MODULES } from "./constants";
import { COMPANY_ID } from "./session";
import { WA_TEMPLATES } from "./settings";
import { startOfMonth } from "./utils";

/**
 * Configuração inicial (idempotente): categorias, contas, categorias financeiras,
 * modelos de mensagem, automações de pós-venda e perfis. São padrões editáveis —
 * não são dados fictícios de negócio.
 */
export async function seedDefaults(o: { categories?: string[]; monthlyGoal?: number; responsible?: string; company?: Record<string, any> }) {
  await db.load(["service_categories", "financial_accounts", "financial_categories", "document_templates", "automations", "roles", "users", "goals"]);
  const ensure = (col: string, id: string, data: Record<string, unknown>) => {
    if (!db.get(col, id)) db.create(col, data, id);
  };

  (o.categories ?? CATEGORIES_DEFAULT).forEach((name) => ensure("service_categories", `cat_${name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_")}`, { name, color: "#38a8ff" }));

  [["acc_caixa", "Caixa", "caixa"], ["acc_banco", "Banco", "banco"], ["acc_digital", "Conta digital", "conta_digital"], ["acc_carteira", "Carteira", "carteira"]].forEach(([id, name, type]) =>
    ensure("financial_accounts", id, { name, type, initialBalance: 0 }),
  );

  const fin: [string, string, string][] = [
    ["fc_servicos", "Serviços", "entrada"], ["fc_produtos", "Venda de produtos", "entrada"], ["fc_outras_r", "Outras receitas", "entrada"],
    ["fc_materiais", "Materiais", "saida"], ["fc_combustivel", "Combustível e deslocamento", "saida"], ["fc_ferramentas", "Ferramentas e equipamentos", "saida"],
    ["fc_impostos", "Impostos e taxas", "saida"], ["fc_marketing", "Marketing", "saida"], ["fc_fornecedores", "Fornecedores", "saida"], ["fc_outras_d", "Outras despesas", "saida"],
  ];
  fin.forEach(([id, name, type]) => ensure("financial_categories", id, { name, type, color: type === "entrada" ? "#34d399" : "#fb7185" }));

  WA_TEMPLATES.forEach((t) => ensure("document_templates", `tpl_${t.key}`, { name: t.name, key: t.key, channel: "whatsapp", body: t.body }));

  ensure("automations", "auto_posvenda_1", { name: "Pós-venda: 1 dia após a OS", active: true, trigger: "os_concluida", delayDays: 1, condition: "cliente_whatsapp", action: "enviar_whatsapp", templateKey: "tpl_pos_venda_1", taskTitle: "Pós-venda (1 dia) — {{cliente}}" });
  ensure("automations", "auto_posvenda_7", { name: "Pós-venda: 7 dias após a OS", active: true, trigger: "os_concluida", delayDays: 7, condition: "cliente_whatsapp", action: "enviar_whatsapp", templateKey: "tpl_pos_venda_7", taskTitle: "Pós-venda (7 dias) — {{cliente}}" });
  ensure("automations", "auto_posvenda_30", { name: "Pós-venda: 30 dias após a OS", active: true, trigger: "os_concluida", delayDays: 30, condition: "cliente_whatsapp", action: "enviar_whatsapp", templateKey: "tpl_pos_venda_30", taskTitle: "Pós-venda (30 dias) — {{cliente}}" });
  ensure("automations", "auto_avaliacao", { name: "Pedir avaliação 2 dias após a OS", active: true, trigger: "os_concluida", delayDays: 2, condition: "os_sem_avaliacao", action: "enviar_whatsapp", templateKey: "tpl_avaliacao", taskTitle: "Pedir avaliação — {{cliente}}" });
  ensure("automations", "auto_followup_orc", { name: "Follow-up: orçamento sem resposta em 3 dias", active: true, trigger: "orcamento_enviado", delayDays: 3, condition: "orcamento_nao_aprovado", action: "criar_tarefa", taskTitle: "Follow-up do orçamento {{orcamento}} — {{cliente}}", text: "Perguntar se o cliente conseguiu ver o orçamento e se tem dúvidas." });

  ensure("roles", "role_admin", { name: "Administrador", description: "Acesso total", permissions: ROLE_MODULES });
  ensure("roles", "role_tecnico", { name: "Técnico", description: "Execução de OS e agenda", permissions: ["dashboard", "os", "agenda", "estoque", "documentos"] });
  ensure("roles", "role_financeiro", { name: "Financeiro", description: "Financeiro e relatórios", permissions: ["dashboard", "financeiro", "relatorios", "metas", "orcamentos"] });
  ensure("users", "owner", { name: o.responsible || "Proprietário", email: o.company?.email || "", roleId: "role_admin", isTechnician: true, status: "ativo" });

  if ((o.monthlyGoal ?? 0) > 0) ensure("goals", "goal_month_default", { name: "Meta mensal de faturamento", type: "faturamento", period: "mes", startDate: startOfMonth(), target: o.monthlyGoal });

  db.upsert("companies", COMPANY_ID, { name: o.company?.name || "", document: o.company?.document || "", email: o.company?.email || "", status: "active" });
}
