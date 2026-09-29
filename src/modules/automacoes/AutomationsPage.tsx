"use client";
import { useMemo, useState } from "react";
import { History, MessageSquareText, Play, Zap } from "lucide-react";
import { CrudView } from "@/components/crud/CrudView";
import { Badge, PageHeader, Panel, Tabs } from "@/components/ui";
import { useCollection } from "@/lib/data/store";
import { runDueAutomations } from "@/lib/automation";
import { toast } from "@/lib/toast";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { renderTemplate, TEMPLATE_VARS, whatsappApiConfigured } from "@/lib/whatsapp";
import { getModule } from "../registry";

type Tab = "automacoes" | "modelos" | "execucoes";
const SAMPLE = { cliente: "Maria", data: "25/12/2026", hora: "14:30", valor: "R$ 350,00", os: "OS-0012", orcamento: "ORC-0034", link: "https://…/os/AbC123" };

export default function AutomationsPage() {
  const [tab, setTab] = useState<Tab>("automacoes");
  return (
    <>
      <PageHeader title="Automações e WhatsApp" subtitle="Gatilho → espera → condição → ação, incluindo pós-venda e modelos de mensagem."
        actions={<button className="btn" onClick={() => { const n = runDueAutomations(); toast(n ? `${n} automação(ões) executada(s)` : "Nada para executar agora", "info"); }}><Play size={15} /> Executar pendentes agora</button>} />
      <Tabs<Tab> value={tab} onChange={setTab} className="mb-4" tabs={[{ id: "automacoes", label: "Automações", icon: Zap }, { id: "modelos", label: "Modelos de WhatsApp", icon: MessageSquareText }, { id: "execucoes", label: "Execuções", icon: History }]} />
      {tab === "automacoes" && <div className="space-y-4"><CrudView config={getModule("automations")} /><p className="text-[11px] text-fg3">Exemplos ativos por padrão: OS concluída → pós-venda em 1, 7 e 30 dias; orçamento enviado → follow-up em 3 dias se ainda não aprovado. Automações são processadas enquanto o app está aberto; a execução server-side agendada está preparada em firebase/functions.</p></div>}
      {tab === "modelos" && <Templates />}
      {tab === "execucoes" && <Logs />}
    </>
  );
}

function Templates() {
  const { items } = useCollection("document_templates");
  const [sel, setSel] = useState("");
  const t = items.find((x) => x.id === sel) || items[0];
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
        <CrudView config={getModule("document_templates")} />
        <div className="space-y-4">
          <Panel title="Pré-visualização" icon={MessageSquareText}>
            <select className="input input-sm mb-3" value={t?.id || ""} onChange={(e) => setSel(e.target.value)} aria-label="Modelo">{items.filter((x) => !x.deletedAt).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <div className="rounded-2xl bg-ok/10 border border-ok/20 p-3.5 text-sm whitespace-pre-wrap min-h-[80px]">{t ? renderTemplate(t.body, SAMPLE) : "Selecione um modelo."}</div>
            <p className="text-[11px] text-fg3 mt-2">Variáveis: {TEMPLATE_VARS.map((v) => `{{${v}}}`).join(" ")}</p>
          </Panel>
          <Panel title="WhatsApp Business API"><p className="text-xs text-fg2">Status: <Badge tone={whatsappApiConfigured ? "ok" : "neutral"}>{whatsappApiConfigured ? "Conectado" : "Não configurado"}</Badge></p><p className="text-[11px] text-fg3 mt-2">Hoje as mensagens abrem no WhatsApp (wa.me) com o texto pronto — você confirma o envio. A interface <code className="kbd">WhatsAppProvider</code> (src/lib/whatsapp.ts) está pronta para receber a Cloud API/BSP em uma Cloud Function, sem mudar as telas.</p></Panel>
        </div>
      </div>
    </div>
  );
}

function Logs() {
  const { items } = useCollection("automation_logs");
  const rows = useMemo(() => [...items].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 100), [items]);
  return (
    <div className="card overflow-x-auto"><table className="w-full min-w-[560px]"><thead><tr className="bg-black/10"><th className="th">Criado</th><th className="th">Automação</th><th className="th">Execução prevista</th><th className="th">Resultado</th></tr></thead>
      <tbody>{rows.map((l) => <tr key={l.id}><td className="td">{fmtDateTime(l.createdAt)}</td><td className="td font-medium">{l.name}</td><td className="td">{fmtDate(l.runDate)}</td><td className="td"><Badge tone={l.status === "executado" ? "ok" : l.status === "agendado" ? "info" : "neutral"}>{l.status === "executado" ? "✓ executado" : l.status === "agendado" ? "⏳ agendado" : "○ ignorado"}</Badge> <span className="text-xs text-fg3">{l.message}</span></td></tr>)}
        {!rows.length && <tr><td colSpan={4} className="td text-center text-fg3 py-8">Nenhuma execução registrada ainda.</td></tr>}</tbody></table></div>
  );
}
