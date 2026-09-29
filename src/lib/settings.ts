"use client";
import { useCallback, useEffect, useMemo } from "react";
import type { FeeTable, Rec } from "./types";
import { DEFAULT_FEES } from "./calc";
import { db, useCollection } from "./data/store";
import { setOwnerName } from "./session";

export type Settings = Rec & {
  name: string;
  fees: FeeTable;
};

export const SETTINGS_DEFAULTS = {
  name: "",
  tradeName: "",
  responsible: "",
  document: "",
  phone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  website: "",
  address: "",
  logoUrl: "",
  logoPath: "",
  primaryColor: "#38a8ff",
  secondaryColor: "#21e0c0",
  theme: "dark",
  pdfTemplate: "moderno",
  pdfFooter: "Obrigado pela confiança!",
  terms: "Orçamento sujeito à confirmação de disponibilidade de materiais. Garantia conforme descrito em cada serviço.",
  paymentTerms: "PIX, dinheiro, débito ou crédito (taxas repassadas conforme forma de pagamento).",
  quoteValidityDays: 15,
  quotePrefix: "ORC",
  osPrefix: "OS",
  defaultMargin: 30,
  warrantyDays: 90,
  nextMaintenanceMonths: 6,
  staleStockDays: 90,
  agendaStart: "08:00",
  agendaEnd: "18:00",
  monthlyGoal: 0,
  travel: { mode: "fixed", fixed: 0, perKm: 0, roundTrip: true, regions: [] as Rec[] },
  notify: { quotes: true, messages: true, lateOrders: true, lowStock: true, dueBills: true, payments: true, goals: true, warranties: true },
  paymentMethods: { pix: true, dinheiro: true, debito: true, credito: true, parcelado: true },
  onboarded: false,
};

/** Configurações da empresa (documento settings/company). */
export function useSettings() {
  const { items, loading } = useCollection("settings");
  const raw = useMemo(() => items.find((r) => r.id === "company"), [items]);
  const settings = useMemo(
    () => ({ ...SETTINGS_DEFAULTS, ...(raw || {}), fees: { ...DEFAULT_FEES, ...(raw?.fees || {}), parcelado: { ...DEFAULT_FEES.parcelado, ...(raw?.fees?.parcelado || {}) } } }) as Settings,
    [raw],
  );
  useEffect(() => {
    if (raw?.responsible) setOwnerName(raw.responsible);
  }, [raw?.responsible]);
  const save = useCallback((patch: Record<string, unknown>) => db.upsert("settings", "company", patch), []);
  return { settings, loaded: !loading, exists: !!raw, save };
}

export const WA_TEMPLATES: { key: string; name: string; body: string }[] = [
  { key: "orcamento_enviado", name: "Orçamento enviado", body: "Olá, {{cliente}}! Segue o orçamento {{orcamento}} no valor de {{valor}}. Você pode conferir e aprovar pelo link: {{link}}" },
  { key: "orcamento_aprovado", name: "Orçamento aprovado", body: "Olá, {{cliente}}! Recebi a aprovação do orçamento {{orcamento}}. Vou organizar a agenda e já te confirmo o melhor horário." },
  { key: "lembrete_atendimento", name: "Lembrete de atendimento", body: "Olá, {{cliente}}! Lembrando do nosso atendimento em {{data}} às {{hora}}. Qualquer imprevisto, é só avisar." },
  { key: "os_concluida", name: "OS concluída", body: "Olá, {{cliente}}! Concluímos a {{os}}. Acompanhe os detalhes e confirme a conclusão aqui: {{link}}" },
  { key: "avaliacao", name: "Solicitação de avaliação", body: "Olá, {{cliente}}! Sua opinião é muito importante. Pode avaliar o atendimento da {{os}}? {{link}}" },
  { key: "cobranca", name: "Cobrança", body: "Olá, {{cliente}}! Identificamos o valor de {{valor}} em aberto referente à {{os}}. Podemos ajudar com a forma de pagamento?" },
  { key: "pos_venda_1", name: "Pós-venda (1 dia)", body: "Olá, {{cliente}}. Gostaria de saber se ficou tudo certo com o serviço." },
  { key: "pos_venda_7", name: "Pós-venda (7 dias)", body: "Olá, {{cliente}}! Como está funcionando o serviço?" },
  { key: "pos_venda_30", name: "Pós-venda (30 dias)", body: "Olá, {{cliente}}! Precisa de alguma outra manutenção?" },
  { key: "manutencao_preventiva", name: "Manutenção preventiva", body: "Olá, {{cliente}}! Está chegando o momento da manutenção preventiva do seu serviço. Quer agendar uma visita?" },
];
