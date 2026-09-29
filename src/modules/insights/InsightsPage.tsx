"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Lightbulb, Sparkles } from "lucide-react";
import { Empty, PageHeader, Panel, Spinner } from "@/components/ui";
import { computeInsights } from "@/lib/analytics";
import { useAnalyticsData } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import { cx, fmtDate, money, toNum } from "@/lib/utils";

const TASKS: Record<string, string> = {
  describe_service: "Criar descrição de serviço", quote_from_text: "Criar orçamento a partir de texto", summarize_customer: "Resumir histórico do cliente", report: "Gerar relatório",
  message: "Criar mensagem", followup: "Sugerir follow-up", diagnosis: "Auxiliar diagnóstico", laudo: "Criar laudo", opportunities: "Identificar oportunidades de venda",
};

export default function InsightsPage() {
  const { data, loading } = useAnalyticsData();
  const { settings } = useSettings();
  const insights = useMemo(() => computeInsights(data, settings.staleStockDays), [data, settings.staleStockDays]);
  const [ai, setAi] = useState<boolean | null>(null);
  const [task, setTask] = useState("summarize_customer");
  const [cust, setCust] = useState("");
  const [prompt, setPrompt] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { fetch("/api/ai").then((r) => r.json()).then((j) => setAi(!!j.configured)).catch(() => setAi(false)); }, []);

  const context = () => {
    const c = data.customers.find((x) => x.id === cust);
    if (!c) return "";
    const os = data.orders.filter((o) => o.customerId === c.id);
    const q = data.quotes.filter((x) => x.customerId === c.id);
    return `Cliente: ${c.name}\nCadastro: ${fmtDate(c.createdAt)}\nOS (${os.length}): ${os.map((o) => `${o.number} ${o.title} [${o.status}] ${money(o.total)}`).join("; ")}\nOrçamentos (${q.length}): ${q.map((x) => `${x.number} ${x.title} [${x.status}] ${money(x.total)}`).join("; ")}\nFaturamento pago: ${money(data.txns.filter((t) => t.customerId === c.id && t.type === "entrada" && t.status === "pago").reduce((a, t) => a + toNum(t.amount), 0))}`;
  };
  const run = async () => {
    setBusy(true); setErr(""); setOut("");
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, prompt: [context(), prompt].filter(Boolean).join("\n\n") }) });
      const j = await res.json();
      if (!res.ok) setErr(j.error || "Erro"); else setOut(j.text);
    } catch { setErr("Falha de conexão"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Insights" subtitle="Inteligência calculada com os dados reais da sua operação." />
      {!insights.length && !loading ? <div className="card"><Empty icon={Lightbulb} title="Ainda sem dados suficientes" text="Cadastre clientes, orçamentos, OS e lançamentos — os insights aparecem automaticamente." /></div> : (
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {insights.map((i, k) => {
            const inner = <div className="card p-4 flex gap-3 h-full hover:border-line2 transition"><span className={cx("size-9 rounded-xl grid place-items-center shrink-0", i.tone === "ok" ? "bg-ok/12 text-ok" : i.tone === "bad" ? "bg-bad/12 text-bad" : i.tone === "warn" ? "bg-warn/12 text-warn" : "bg-info/12 text-info")}><Sparkles size={17} /></span><p className="text-sm leading-relaxed">{i.text}</p></div>;
            return i.href ? <Link key={k} href={i.href}>{inner}</Link> : <div key={k}>{inner}</div>;
          })}
        </div>
      )}
      <Panel title="Assistente de IA" icon={Bot}>
        {ai === null ? <Spinner /> : !ai ? (
          <div className="text-sm space-y-2"><p className="text-fg2"><b>IA não configurada.</b> A estrutura está pronta e nada é simulado: defina <code className="kbd">AI_API_KEY</code> (e opcionalmente <code className="kbd">AI_API_URL</code>, <code className="kbd">AI_MODEL</code>) nas variáveis de ambiente do servidor para ativar.</p>
            <div className="flex flex-wrap gap-1.5">{Object.values(TASKS).map((t) => <span key={t} className="text-[11px] px-2 py-1 rounded-lg bg-solid2 border border-line text-fg3">{t}</span>)}</div></div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3"><select className="input" value={task} onChange={(e) => setTask(e.target.value)} aria-label="Tarefa">{Object.entries(TASKS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <select className="input" value={cust} onChange={(e) => setCust(e.target.value)} aria-label="Cliente (contexto)"><option value="">Sem cliente (contexto livre)</option>{data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <textarea className="input" rows={4} placeholder="Descreva o que você precisa…" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <button className="btn btn-primary" disabled={busy || (!prompt.trim() && !cust)} onClick={run}>{busy ? <Spinner /> : <Sparkles size={15} />} Executar</button>
            {err && <p className="text-sm text-bad">{err}</p>}{out && <div className="card-solid p-4 text-sm whitespace-pre-wrap">{out}</div>}
          </div>
        )}
      </Panel>
    </>
  );
}
