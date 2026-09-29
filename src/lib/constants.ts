import {
  AlertCircle, Ban, BadgeCheck, CalendarClock, CalendarCheck, CheckCircle2, Circle, CircleDollarSign, Clock, Hourglass, Loader, Package, Pencil, Receipt, Send, TimerOff, Truck, Wrench, XCircle, FileQuestion, User, Handshake, UserPlus, PhoneCall, Repeat, MoonStar, Sparkles, HeartHandshake,
} from "lucide-react";
import type { StatusDef } from "@/components/ui";

export const QUOTE_STATUS: Record<string, StatusDef> = {
  rascunho: { label: "Rascunho", tone: "neutral", icon: Pencil },
  enviado: { label: "Enviado", tone: "info", icon: Send },
  aguardando: { label: "Aguardando resposta", tone: "warn", icon: Hourglass },
  aprovado: { label: "Aprovado", tone: "ok", icon: CheckCircle2 },
  recusado: { label: "Recusado", tone: "bad", icon: XCircle },
  expirado: { label: "Expirado", tone: "neutral", icon: TimerOff },
  faturado: { label: "Faturado", tone: "violet", icon: Receipt },
  cancelado: { label: "Cancelado", tone: "bad", icon: Ban },
};

export const OS_STATUS: Record<string, StatusDef> = {
  aberta: { label: "Aberta", tone: "info", icon: Circle },
  agendada: { label: "Agendada", tone: "info", icon: CalendarClock },
  deslocamento: { label: "Em deslocamento", tone: "violet", icon: Truck },
  execucao: { label: "Em execução", tone: "warn", icon: Wrench },
  aguardando_material: { label: "Aguardando material", tone: "warn", icon: Package },
  aguardando_cliente: { label: "Aguardando cliente", tone: "warn", icon: User },
  aguardando_aprovacao: { label: "Aguardando aprovação", tone: "warn", icon: FileQuestion },
  concluida: { label: "Concluída", tone: "ok", icon: CheckCircle2 },
  faturada: { label: "Faturada", tone: "violet", icon: Receipt },
  cancelada: { label: "Cancelada", tone: "bad", icon: Ban },
};
export const OS_CLOSED = ["concluida", "faturada", "cancelada"];
export const OS_ACTIVE = ["deslocamento", "execucao"];

export const TXN_STATUS: Record<string, StatusDef> = {
  previsto: { label: "Previsto", tone: "neutral", icon: Clock },
  pendente: { label: "Pendente", tone: "warn", icon: Hourglass },
  pago: { label: "Pago", tone: "ok", icon: BadgeCheck },
  atrasado: { label: "Atrasado", tone: "bad", icon: AlertCircle },
  cancelado: { label: "Cancelado", tone: "neutral", icon: Ban },
};

export const ACTIVE_STATUS: Record<string, StatusDef> = {
  ativo: { label: "Ativo", tone: "ok", icon: CheckCircle2 },
  inativo: { label: "Inativo", tone: "neutral", icon: Ban },
};

export const TASK_STATUS: Record<string, StatusDef> = {
  aberta: { label: "Aberta", tone: "warn", icon: Circle },
  concluida: { label: "Concluída", tone: "ok", icon: CheckCircle2 },
};

export const APPT_STATUS: Record<string, StatusDef> = {
  agendado: { label: "Agendado", tone: "info", icon: CalendarClock },
  confirmado: { label: "Confirmado", tone: "ok", icon: CalendarCheck },
  concluido: { label: "Concluído", tone: "ok", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", tone: "bad", icon: Ban },
};

export const APPT_TYPES: Record<string, { label: string; color: string }> = {
  atendimento: { label: "Atendimento", color: "#38a8ff" },
  visita: { label: "Visita técnica", color: "#a78bfa" },
  instalacao: { label: "Instalação", color: "#21e0c0" },
  manutencao: { label: "Manutenção", color: "#fbbf24" },
  retorno: { label: "Retorno", color: "#fb923c" },
  compromisso: { label: "Compromisso", color: "#94a3b8" },
  bloqueio: { label: "Bloqueio", color: "#fb7185" },
};

export const PIPELINE: { id: string; label: string; icon: typeof User }[] = [
  { id: "lead", label: "Lead", icon: UserPlus },
  { id: "contato", label: "Contato", icon: PhoneCall },
  { id: "orcamento", label: "Orçamento", icon: Receipt },
  { id: "negociacao", label: "Negociação", icon: Handshake },
  { id: "aprovado", label: "Aprovado", icon: CheckCircle2 },
  { id: "cliente", label: "Cliente", icon: User },
  { id: "pos_venda", label: "Pós-venda", icon: HeartHandshake },
  { id: "recorrente", label: "Recorrente", icon: Repeat },
  { id: "inativo", label: "Inativo", icon: MoonStar },
];

export const TIERS: Record<string, string> = { economico: "Econômico", medio: "Médio", premium: "Premium", custom: "Manual" };
export const TIER_FIELD: Record<string, string> = { economico: "priceEco", medio: "priceMid", premium: "pricePrem" };

export const PAY_METHODS: Record<string, string> = { pix: "PIX", dinheiro: "Dinheiro", debito: "Débito", credito: "Crédito à vista", parcelado: "Crédito parcelado" };

export const UNITS = ["un", "serviço", "ponto", "metro", "hora", "m²", "visita", "kit", "diária"];

export const STOCK_MOVES: Record<string, { label: string; sign: 1 | -1 | 0 }> = {
  entrada: { label: "Entrada", sign: 1 },
  saida: { label: "Saída", sign: -1 },
  uso_os: { label: "Uso em OS", sign: -1 },
  perda: { label: "Perda", sign: -1 },
  ajuste: { label: "Ajuste (define saldo)", sign: 0 },
  devolucao: { label: "Devolução", sign: 1 },
};

export const GOAL_TYPES: Record<string, string> = {
  faturamento: "Faturamento",
  lucro: "Lucro",
  servicos: "Serviços concluídos",
  clientes: "Clientes atendidos",
  novos_clientes: "Novos clientes",
};

export const DOC_TYPES: Record<string, string> = {
  orcamento: "Orçamento",
  recibo: "Recibo",
  laudo: "Laudo técnico",
  relatorio: "Relatório",
  termo_entrega: "Termo de entrega",
  termo_garantia: "Termo de garantia",
  declaracao: "Declaração",
  personalizado: "Documento personalizado",
  arquivo: "Arquivo",
  foto: "Foto",
  comprovante: "Comprovante",
};

export const PDF_TEMPLATES: Record<string, string> = { moderno: "Moderno", minimalista: "Minimalista", premium: "Premium", tecnico: "Técnico" };

export const CATEGORIES_DEFAULT = ["Elétrica", "CFTV", "Informática", "Serviços Gerais", "Automação"];

export const EQUIP_TYPES = ["Câmera", "DVR", "NVR", "Computador", "Notebook", "Roteador", "Fechadura", "Motor", "Portão", "Quadro elétrico", "Automação", "Outro"];

export const SOURCES = ["Indicação", "WhatsApp", "Instagram", "Google", "Site", "Cliente antigo", "Outro"];

export const ROLE_MODULES = ["dashboard", "servicos", "calculadora", "orcamentos", "os", "crm", "estoque", "agenda", "financeiro", "metas", "documentos", "anotacoes", "relatorios", "configuracoes"];

export const ic = { Sparkles, Loader, CircleDollarSign };

export function opts(map: Record<string, { label: string } | string>) {
  return Object.entries(map).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));
}
