"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Landmark, LineChart, Link2, ListOrdered, Tags, TrendingUp, Upload, Wallet, Building2 } from "lucide-react";
import { CrudView } from "@/components/crud/CrudView";
import { Chart, Legend } from "@/components/charts";
import { Empty, Kpi, PageHeader, Panel, Segmented, StatusBadge, Tabs } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { AccountBalanceCell, DateCell, Money, RefLabel } from "@/components/cells";
import { computeDashboard, cashflow, cashflowSeries, PERIODS, periodRange, type Period } from "@/lib/analytics";
import { TXN_STATUS } from "@/lib/constants";
import { txnStatus, accountBalance } from "@/lib/finance";
import { useAnalyticsData, useQueryParam } from "@/lib/hooks";
import { db } from "@/lib/data/store";
import { registerPayment } from "@/lib/workflows";
import { toast } from "@/lib/toast";
import { addDays, dayOf, fmtDate, money, moneyShort, sum, toNum, todayISO, diffDays } from "@/lib/utils";
import type { Rec } from "@/lib/types";
import { getModule } from "../registry";

type Tab = "visao" | "lancamentos" | "receber" | "pagar" | "contas" | "categorias" | "fluxo" | "conciliacao";

export default function FinanceiroPage() {
  const ui = useUI();
  const [tab, setTab] = useState<Tab>("visao");
  const [isNew, clear] = useQueryParam("new");
  useEffect(() => { if (isNew) { ui.openForm("financial_transactions"); clear(); } }, [isNew]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (types: string[], t: string) => (r: Rec) => r.type === t && types.includes(r.status);
  return (
    <>
      <PageHeader title="Financeiro" subtitle="Contas, entradas, saídas, contas a pagar/receber, fluxo projetado e conciliação."
        actions={<><button className="btn" onClick={() => ui.openForm("financial_transactions", null, { type: "transferencia", status: "pago" })}><ArrowLeftRight size={15} /> Transferência</button><button className="btn btn-primary" onClick={() => ui.openForm("financial_transactions")}><Wallet size={16} /> Novo lançamento</button></>} />
      <Tabs<Tab> value={tab} onChange={setTab} className="mb-4" tabs={[
        { id: "visao", label: "Visão geral", icon: TrendingUp }, { id: "lancamentos", label: "Lançamentos", icon: ListOrdered }, { id: "receber", label: "A receber", icon: ArrowDownLeft }, { id: "pagar", label: "A pagar", icon: ArrowUpRight },
        { id: "contas", label: "Contas", icon: Landmark }, { id: "categorias", label: "Categorias", icon: Tags }, { id: "fluxo", label: "Fluxo projetado", icon: LineChart }, { id: "conciliacao", label: "Conciliação", icon: Link2 },
      ]} />
      {tab === "visao" && <Overview />}
      {tab === "lancamentos" && <CrudView config={getModule("financial_transactions")} />}
      {tab === "receber" && <CrudView config={getModule("financial_transactions")} base={open(["pendente", "previsto"], "entrada")} defaults={{ type: "entrada", status: "pendente" }} />}
      {tab === "pagar" && <CrudView config={getModule("financial_transactions")} base={open(["pendente", "previsto"], "saida")} defaults={{ type: "saida", status: "pendente" }} />}
      {tab === "contas" && <CrudView config={getModule("financial_accounts")} />}
      {tab === "categorias" && <CrudView config={getModule("financial_categories")} />}
      {tab === "fluxo" && <Projected />}
      {tab === "conciliacao" && <Reconcile />}
    </>
  );
}

function Overview() {
  const { data } = useAnalyticsData();
  const [period, setPeriod] = useState<Period>("mes");
  const range = useMemo(() => periodRange(period), [period]);
  const d = useMemo(() => computeDashboard(data, range), [data, range]);
  const balance = useMemo(() => sum(data.accounts, (a) => accountBalance(a, data.txns)), [data]);
  return (
    <div className="space-y-4">
      <Segmented<Period> small value={period} onChange={setPeriod} options={PERIODS.filter((p) => p.id !== "custom").map((p) => ({ id: p.id, label: p.label }))} />
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Saldo em contas" value={moneyShort(balance)} icon={Landmark} tone={balance >= 0 ? "accent" : "bad"} />
        <Kpi label="Entradas" value={moneyShort(d.received)} icon={ArrowDownLeft} tone="ok" /><Kpi label="Saídas" value={moneyShort(d.paidOut)} icon={ArrowUpRight} tone="bad" />
        <Kpi label="A receber" value={moneyShort(d.receivable)} icon={Banknote} tone="info" /><Kpi label="A pagar" value={moneyShort(d.payable)} icon={Wallet} tone="warn" />
        <Kpi label="Lucro" value={moneyShort(d.profit)} icon={TrendingUp} tone={d.profit >= 0 ? "ok" : "bad"} sub="faturamento − despesas" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Evolução" icon={TrendingUp} className="lg:col-span-2" action={<Legend series={[{ key: "a", name: "Entradas", color: "var(--ok)" }, { key: "b", name: "Saídas", color: "var(--bad)" }, { key: "c", name: "Lucro", color: "var(--accent)" }]} />}>
          <Chart kind="area" data={d.series} series={[{ key: "entradas", name: "Entradas", color: "var(--ok)" }, { key: "saidas", name: "Saídas", color: "var(--bad)" }, { key: "lucro", name: "Lucro", color: "var(--accent)" }]} format={money} />
        </Panel>
        <Panel title="Contas" icon={Building2}>
          <div className="space-y-2">{data.accounts.map((a) => <div key={a.id} className="flex items-center gap-2 text-sm"><Landmark size={15} className="text-fg3" /><span className="flex-1 truncate">{a.name}</span><AccountBalanceCell acc={a} /></div>)}{!data.accounts.length && <p className="text-xs text-fg3">Cadastre contas na aba Contas.</p>}</div>
        </Panel>
      </div>
    </div>
  );
}

function Projected() {
  const { data } = useAnalyticsData();
  const [days, setDays] = useState(30);
  const cf = useMemo(() => cashflow(data, days), [data, days]);
  const series = useMemo(() => cashflowSeries(data, days), [data, days]);
  const upcoming = useMemo(() => data.txns.filter((t) => t.type !== "transferencia" && ["pendente", "previsto"].includes(t.status) && dayOf(t.dueDate) <= addDays(todayISO(), days)).sort((a, b) => dayOf(a.dueDate).localeCompare(dayOf(b.dueDate))), [data.txns, days]);
  return (
    <div className="space-y-4">
      <Segmented<string> small value={String(days)} onChange={(v) => setDays(Number(v))} options={[{ id: "0", label: "Hoje" }, { id: "7", label: "7 dias" }, { id: "30", label: "30 dias" }, { id: "60", label: "60 dias" }, { id: "90", label: "90 dias" }]} />
      {cf.projected < 0 && <div className="card p-3.5 border-bad/40 bg-bad/8 flex items-center gap-2.5 text-sm"><AlertTriangle className="text-bad shrink-0" size={18} /><span><b>Atenção:</b> o saldo projetado fica negativo em {money(cf.projected)} — antecipe recebimentos ou renegocie pagamentos.</span></div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Saldo atual" value={moneyShort(cf.balance)} icon={Landmark} /><Kpi label="Entradas previstas" value={moneyShort(cf.entradas)} icon={ArrowDownLeft} tone="ok" sub={cf.atrasadoIn ? `${money(cf.atrasadoIn)} já vencidos` : undefined} />
        <Kpi label="Saídas previstas" value={moneyShort(cf.saidas)} icon={ArrowUpRight} tone="bad" sub={cf.atrasadoOut ? `${money(cf.atrasadoOut)} já vencidos` : undefined} /><Kpi label="Saldo projetado" value={moneyShort(cf.projected)} icon={LineChart} tone={cf.projected >= 0 ? "accent" : "bad"} />
      </div>
      <Panel title="Saldo projetado" icon={LineChart}><Chart kind="area" data={series} series={[{ key: "saldo", name: "Saldo projetado", color: "var(--accent)" }]} format={money} /></Panel>
      <div className="card overflow-x-auto"><table className="w-full min-w-[560px]"><thead><tr className="bg-black/10"><th className="th">Vencimento</th><th className="th">Descrição</th><th className="th text-right">Valor</th><th className="th">Status</th></tr></thead>
        <tbody>{upcoming.map((t) => <tr key={t.id}><td className="td"><DateCell v={t.dueDate} warnIfPast /></td><td className="td">{t.description}</td><td className="td text-right"><Money v={t.type === "saida" ? -toNum(t.amount) : t.amount} tone={t.type === "saida" ? "out" : "in"} /></td><td className="td"><StatusBadge def={TXN_STATUS[txnStatus(t)]} /></td></tr>)}
          {!upcoming.length && <tr><td colSpan={4}><Empty icon={LineChart} title="Nada previsto no período" /></td></tr>}</tbody></table></div>
    </div>
  );
}

type Line = { date: string; desc: string; amount: number };
function parseStatement(text: string): Line[] {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: Line[] = [];
  for (const row of rows) {
    const sep = row.includes(";") ? ";" : row.includes("\t") ? "\t" : ",";
    const cells = row.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
    const dateCell = cells.find((c) => /^\d{2}\/\d{2}\/\d{4}$|^\d{4}-\d{2}-\d{2}$/.test(c));
    if (!dateCell) continue;
    const date = dateCell.includes("/") ? dateCell.split("/").reverse().join("-") : dateCell;
    const amountCell = [...cells].reverse().find((c) => /^-?[\d.]+,\d{2}$|^-?\d+(\.\d+)?$/.test(c.replace(/\s|R\$/g, "")));
    if (!amountCell) continue;
    const a = amountCell.replace(/\s|R\$/g, "");
    const amount = a.includes(",") ? parseFloat(a.replace(/\./g, "").replace(",", ".")) : parseFloat(a);
    const desc = cells.filter((c) => c !== dateCell && c !== amountCell).join(" ");
    if (isFinite(amount)) out.push({ date, desc, amount });
  }
  return out;
}

/** Conciliação: importa extrato CSV e sugere vínculo com lançamentos pendentes. Conectores bancários (Open Finance) entram pelo mesmo contrato. */
function Reconcile() {
  const { data } = useAnalyticsData();
  const [lines, setLines] = useState<Line[]>([]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const ref = useRef<HTMLInputElement>(null);
  const suggest = (l: Line) => data.txns.find((t) => ["pendente", "previsto"].includes(t.status) && t.type === (l.amount >= 0 ? "entrada" : "saida") && Math.abs(toNum(t.amount) - Math.abs(l.amount)) < 0.01 && Math.abs(diffDays(dayOf(t.dueDate), l.date)) <= 10);
  const acc = data.accounts[0]?.id || "";
  return (
    <div className="space-y-4">
      <Panel title="Importar extrato (CSV)" icon={Upload}>
        <p className="text-sm text-fg2 mb-3">Envie um CSV exportado do seu banco (colunas de data, descrição e valor). O sistema sugere o vínculo com contas pendentes de mesmo valor e data próxima — você confirma cada conciliação.</p>
        <button className="btn btn-primary" onClick={() => ref.current?.click()}><Upload size={15} /> Selecionar arquivo CSV</button>
        <input ref={ref} type="file" accept=".csv,.txt,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setLines(parseStatement(await f.text())); setDone(new Set()); } e.target.value = ""; }} />
      </Panel>
      {lines.length > 0 && (
        <div className="card overflow-x-auto"><table className="w-full min-w-[640px]"><thead><tr className="bg-black/10"><th className="th">Data</th><th className="th">Descrição</th><th className="th text-right">Valor</th><th className="th">Sugestão</th><th className="th" /></tr></thead>
          <tbody>{lines.map((l, i) => { const m = suggest(l); return (
            <tr key={i}><td className="td">{fmtDate(l.date)}</td><td className="td">{l.desc}</td><td className="td text-right"><Money v={l.amount} tone="auto" /></td>
              <td className="td text-xs">{m ? <span className="text-ok">↔ {m.description} (<RefLabel collection="customers" id={m.customerId} fallback="—" />)</span> : <span className="text-fg3">sem correspondência</span>}</td>
              <td className="td text-right">{done.has(i) ? <span className="text-ok text-xs">✓ conciliado</span> : m ? <button className="btn btn-sm btn-primary" onClick={() => { registerPayment(m, { amount: toNum(m.amount), method: m.method || "pix", accountId: m.accountId || acc, paidAt: l.date }); setDone(new Set(done).add(i)); toast("Conciliado"); }}>Conciliar</button> : <button className="btn btn-sm" onClick={() => { db.create("financial_transactions", { type: l.amount >= 0 ? "entrada" : "saida", description: l.desc || "Lançamento do extrato", amount: Math.abs(l.amount), dueDate: l.date, paidAt: l.date, status: "pago", accountId: acc, method: "pix", imported: true }); setDone(new Set(done).add(i)); toast("Lançamento criado"); }}>Criar lançamento</button>}</td></tr>); })}</tbody></table></div>
      )}
      <Panel title="Integrações bancárias (arquitetura preparada)" icon={Link2}>
        <div className="grid sm:grid-cols-2 gap-2.5 text-sm">
          {[["Open Finance", "Consentimento e leitura de contas/transações via agregador homologado"], ["APIs bancárias / PIX", "Webhooks de recebimento para identificar pagamentos automaticamente"], ["Importação OFX", "Formato padrão de extrato — próxima etapa"], ["Identificação automática", "Regra: valor + data + cliente → baixa do recebível"]].map(([t, d]) => (
            <div key={t} className="rounded-xl bg-solid2/70 border border-line p-3"><div className="font-semibold flex items-center gap-2">{t} <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-fg3">não configurado</span></div><div className="text-xs text-fg3 mt-0.5">{d}</div></div>
          ))}
        </div>
        <p className="text-[11px] text-fg3 mt-3">Nenhuma integração bancária simulada: quando um conector for implementado (Cloud Function + agregador), ele alimentará `financial_transactions` e o mesmo fluxo de conciliação acima.</p>
      </Panel>
    </div>
  );
}
