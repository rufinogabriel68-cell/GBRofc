"use client";
import { useMemo, useState } from "react";
import { BarChart3, CalendarRange, Download, FileSpreadsheet, FileText, Gauge, LineChart, Medal, TrendingUp } from "lucide-react";
import { Chart, HBars } from "@/components/charts";
import { Empty, Kpi, PageHeader, Panel, Segmented, Tabs } from "@/components/ui";
import { buckets, computeDashboard, costOf, demandByMonth, PERIODS, periodRange, type Data, type Period, type Range } from "@/lib/analytics";
import { lineTotal } from "@/lib/calc";
import { GOAL_TYPES, OS_STATUS, QUOTE_STATUS, TXN_STATUS } from "@/lib/constants";
import { txnStatus } from "@/lib/finance";
import { useAnalyticsData } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import type { Rec } from "@/lib/types";
import { dayOf, download, endOfMonth, fmtDate, money, num, pct, startOfMonth, sum, todayISO, toCSV, toExcelHTML, toNum, MONTHS } from "@/lib/utils";
import { goalProgress } from "../metas/MetasPage";

type Tab = "relatorios" | "lucro" | "ranking" | "demanda" | "mensal";
type Report = { title: string; columns: string[]; rows: (string | number)[][]; align?: ("left" | "right")[] };
const KINDS: [string, string][] = [["faturamento", "Faturamento"], ["lucro", "Lucro"], ["despesas", "Despesas"], ["clientes", "Clientes"], ["servicos", "Serviços"], ["os", "OS"], ["orcamentos", "Orçamentos"], ["estoque", "Estoque"], ["produtos", "Produtos"], ["fornecedores", "Fornecedores"], ["metas", "Metas"], ["conversao", "Conversão"]];
const inR = (d: string | undefined, r: Range) => { const x = dayOf(d); return !!x && x >= r.start && x <= r.end; };

function buildReport(kind: string, d: Data, r: Range): Report {
  const cn = (id: string) => d.customers.find((c) => c.id === id)?.name || "—";
  const cat = (id: string) => d.categories.find((c) => c.id === id)?.name || "";
  switch (kind) {
    case "faturamento": { const l = d.txns.filter((t) => t.type === "entrada" && t.status !== "cancelado" && inR(t.dueDate, r)); return { title: "Faturamento", columns: ["Data", "Descrição", "Cliente", "Status", "Valor"], rows: [...l.map((t) => [fmtDate(t.dueDate), t.description, cn(t.customerId), TXN_STATUS[txnStatus(t)]?.label || t.status, money(t.amount)]), ["", "TOTAL", "", "", money(sum(l, (t) => toNum(t.amount)))]] }; }
    case "despesas": { const l = d.txns.filter((t) => t.type === "saida" && t.status !== "cancelado" && inR(t.dueDate, r)); return { title: "Despesas", columns: ["Data", "Descrição", "Status", "Valor"], rows: [...l.map((t) => [fmtDate(t.dueDate), t.description, TXN_STATUS[txnStatus(t)]?.label || t.status, money(t.amount)]), ["", "TOTAL", "", money(sum(l, (t) => toNum(t.amount)))]] }; }
    case "lucro": return { title: "Lucro por período", columns: ["Período", "Faturamento", "Despesas", "Lucro", "Margem"], rows: buckets(r.end > r.start ? { start: r.start, end: r.end } : r).map((b) => { const f = sum(d.txns.filter((t) => t.type === "entrada" && t.status !== "cancelado" && inR(t.dueDate, b)), (t) => toNum(t.amount)); const e = sum(d.txns.filter((t) => t.type === "saida" && t.status !== "cancelado" && inR(t.dueDate, b)), (t) => toNum(t.amount)); return [b.label, money(f), money(e), money(f - e), f ? pct(((f - e) / f) * 100, 0) : "—"]; }) };
    case "clientes": return { title: "Clientes", columns: ["Cliente", "Telefone", "Cidade", "Cadastro", "Serviços concluídos", "Faturamento"], rows: d.customers.map((c) => [c.name, c.phone || "", c.city || "", fmtDate(c.createdAt), d.orders.filter((o) => o.customerId === c.id && ["concluida", "faturada"].includes(o.status)).length, money(sum(d.txns.filter((t) => t.customerId === c.id && t.type === "entrada" && t.status === "pago"), (t) => toNum(t.amount)))]) };
    case "servicos": { const m: Record<string, { q: number; r: number }> = {}; d.orders.filter((o) => o.status !== "cancelada" && inR(o.createdAt, r)).forEach((o) => (o.pricing?.lines || []).forEach((l: Rec) => { const e = (m[l.name] ||= { q: 0, r: 0 }); e.q += toNum(l.qty); e.r += lineTotal(l as never); })); return { title: "Serviços", columns: ["Serviço", "Quantidade", "Receita"], rows: Object.entries(m).sort((a, b) => b[1].r - a[1].r).map(([n, v]) => [n, v.q, money(v.r)]) }; }
    case "os": { const l = d.orders.filter((o) => inR(o.createdAt, r)); return { title: "Ordens de serviço", columns: ["Nº", "Cliente", "Serviço", "Status", "Data", "Valor"], rows: l.map((o) => [o.number, cn(o.customerId), o.title, OS_STATUS[o.status]?.label || o.status, fmtDate(o.date), money(o.total)]) }; }
    case "orcamentos": { const l = d.quotes.filter((q) => inR(q.createdAt, r)); return { title: "Orçamentos", columns: ["Nº", "Cliente", "Título", "Status", "Criado", "Total"], rows: l.map((q) => [q.number, cn(q.customerId), q.title, QUOTE_STATUS[q.status]?.label || q.status, fmtDate(q.createdAt), money(q.total)]) }; }
    case "estoque": return { title: "Posição de estoque", columns: ["Produto", "Categoria", "Qtd", "Mínimo", "Custo", "Valor em estoque"], rows: [...d.products.map((p) => [p.name, p.category || "", `${p.qty} ${p.unit}`, p.minQty, money(p.cost), money(toNum(p.qty) * toNum(p.cost))]), ["TOTAL", "", "", "", "", money(sum(d.products, (p) => toNum(p.qty) * toNum(p.cost)))]] };
    case "produtos": { const m: Record<string, { in: number; out: number }> = {}; d.movements.filter((x) => inR(x.createdAt, r)).forEach((x) => { const e = (m[x.productId] ||= { in: 0, out: 0 }); if (toNum(x.delta) >= 0) e.in += toNum(x.delta); else e.out += Math.abs(toNum(x.delta)); }); return { title: "Movimentação de produtos", columns: ["Produto", "Entradas", "Saídas", "Saldo atual"], rows: Object.entries(m).map(([id, v]) => { const p = d.products.find((x) => x.id === id); return [p?.name || "—", v.in, v.out, p ? `${p.qty} ${p.unit}` : "—"]; }) }; }
    case "fornecedores": return { title: "Fornecedores", columns: ["Fornecedor", "Produtos", "Compras (R$)", "A pagar (R$)"], rows: [] as never[] };
    case "metas": return { title: "Metas", columns: ["Meta", "Tipo", "Alvo", "Realizado", "%", "Projeção"], rows: d.goals.map((g) => { const p = goalProgress(g, d); const f = (v: number) => (["faturamento", "lucro"].includes(g.type) ? money(v) : num(v)); return [g.name, GOAL_TYPES[g.type], f(p.target), f(p.realized), pct(p.pct, 0), f(p.projection)]; }) };
    case "conversao": { const q = d.quotes.filter((x) => inR(x.createdAt, r)); const ap = q.filter((x) => ["aprovado", "faturado"].includes(x.status)).length; const rf = q.filter((x) => x.status === "recusado").length; const env = q.filter((x) => x.status !== "rascunho").length; return { title: "Conversão de orçamentos", columns: ["Indicador", "Valor"], rows: [["Criados", q.length], ["Enviados", env], ["Aprovados", ap], ["Recusados", rf], ["Taxa de conversão (aprovados ÷ decididos)", ap + rf ? pct((ap / (ap + rf)) * 100, 1) : "—"], ["Valor aprovado", money(sum(q.filter((x) => ["aprovado", "faturado"].includes(x.status)), (x) => toNum(x.total)))]] }; }
  }
  return { title: kind, columns: [], rows: [] };
}

function useExport(settingsPdf: () => Promise<{ downloadPdf: typeof import("@/lib/pdf").downloadPdf; tableSpec: typeof import("@/lib/pdf").tableSpec; companyOf: typeof import("@/lib/pdf").companyOf }>) {
  const { settings } = useSettings();
  return {
    csv: (rep: Report) => download(`${rep.title}.csv`.replace(/\s+/g, "-"), toCSV(rep.columns, rep.rows), "text/csv;charset=utf-8"),
    xls: (rep: Report) => download(`${rep.title}.xls`.replace(/\s+/g, "-"), toExcelHTML(rep.title, rep.columns, rep.rows), "application/vnd.ms-excel"),
    pdf: async (rep: Report, sub: string) => { const m = await settingsPdf(); m.downloadPdf(m.tableSpec(rep.title, sub, rep.columns, rep.rows), m.companyOf(settings), settings.pdfTemplate, rep.title); },
  };
}
const loadPdf = () => import("@/lib/pdf");

function ExportBar({ rep, sub, ex }: { rep: Report; sub: string; ex: ReturnType<typeof useExport> }) {
  return <div className="flex gap-2 flex-wrap"><button className="btn btn-sm" onClick={() => ex.pdf(rep, sub)}><FileText size={14} /> PDF</button><button className="btn btn-sm" onClick={() => ex.csv(rep)}><Download size={14} /> CSV</button><button className="btn btn-sm" onClick={() => ex.xls(rep)}><FileSpreadsheet size={14} /> Excel</button></div>;
}

export default function ReportsPage() {
  const { data, loading } = useAnalyticsData();
  const { settings } = useSettings();
  const [tab, setTab] = useState<Tab>("relatorios");
  const [period, setPeriod] = useState<Period>("mes");
  const [custom, setCustom] = useState({ start: startOfMonth(), end: todayISO() });
  const [kind, setKind] = useState("faturamento");
  const range = useMemo(() => periodRange(period, custom), [period, custom]);
  const ex = useExport(loadPdf);
  const sub = `Período: ${fmtDate(range.start)} a ${fmtDate(range.end)}`;
  const rep = useMemo(() => {
    if (kind === "fornecedores") return { title: "Fornecedores", columns: ["Fornecedor", "Produtos", "Compras no período (R$)", "A pagar em aberto (R$)"], rows: (data as Data & { }).accounts ? [] : [] } as Report;
    return buildReport(kind, data, range);
  }, [kind, data, range]);
  return (
    <>
      <PageHeader title="Relatórios" subtitle="Dados reais do seu negócio, exportáveis em PDF, CSV e Excel." />
      <Tabs<Tab> value={tab} onChange={setTab} className="mb-4" tabs={[{ id: "relatorios", label: "Relatórios", icon: BarChart3 }, { id: "lucro", label: "Central de lucro", icon: TrendingUp }, { id: "ranking", label: "Ranking de serviços", icon: Medal }, { id: "demanda", label: "Demanda", icon: LineChart }, { id: "mensal", label: "Relatório mensal", icon: CalendarRange }]} />
      {tab !== "mensal" && tab !== "demanda" && (
        <div className="flex flex-wrap items-center gap-2 mb-4"><Segmented<Period> small value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ id: p.id, label: p.label }))} />
          {period === "custom" && <><input type="date" className="input input-sm !w-36" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} aria-label="Início" /><input type="date" className="input input-sm !w-36" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} aria-label="Fim" /></>}
          <span className="text-xs text-fg3 ml-auto">{sub}</span></div>
      )}
      {tab === "relatorios" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">{KINDS.map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={"h-8 px-3 rounded-full text-xs font-semibold border " + (kind === k ? "bg-accent/15 border-accent/40 text-accent" : "border-line text-fg2 hover:text-fg")}>{l}</button>)}</div>
          <Panel title={rep.title} action={<ExportBar rep={rep} sub={sub} ex={ex} />} pad={false}>
            {kind === "fornecedores" ? <SuppliersReport range={range} ex={ex} sub={sub} /> : !rep.rows.length ? <Empty icon={BarChart3} title="Sem dados no período" text={loading ? "Carregando…" : "Ajuste o período ou cadastre mais informações."} /> : (
              <div className="overflow-x-auto max-h-[60vh]"><table className="w-full min-w-[520px]"><thead><tr className="bg-black/10 sticky top-0">{rep.columns.map((c, i) => <th key={c} className={"th " + (i > 0 && /valor|total|receita|lucro|despesa|custo|qtd|quant|%|margem|saldo|mínimo|projeção|realizado|alvo|entradas|saídas/i.test(c) ? "text-right" : "")}>{c}</th>)}</tr></thead>
                <tbody>{rep.rows.slice(0, 300).map((r, i) => <tr key={i} className={String(r[1] ?? r[0]).startsWith("TOTAL") || r[0] === "TOTAL" ? "font-bold bg-white/[.03]" : ""}>{r.map((c, j) => <td key={j} className={"td " + (j > 0 && /^R\$|^\d+([.,]\d+)?%?$/.test(String(c)) ? "text-right tabular-nums" : "")}>{c}</td>)}</tr>)}</tbody></table></div>
            )}
          </Panel>
        </div>
      )}
      {tab === "lucro" && <ProfitCenter data={data} range={range} ex={ex} sub={sub} />}
      {tab === "ranking" && <Ranking data={data} range={range} />}
      {tab === "demanda" && <Demand data={data} />}
      {tab === "mensal" && <Monthly data={data} settingsName={settings.name} />}
    </>
  );
}

function SuppliersReport({ range, ex, sub }: { range: Range; ex: ReturnType<typeof useExport>; sub: string }) {
  const { data } = useAnalyticsData();
  return <SuppliersInner data={data} range={range} ex={ex} sub={sub} />;
}
import { useActive } from "@/lib/data/store";
function SuppliersInner({ range, ex, sub }: { data: Data; range: Range; ex: ReturnType<typeof useExport>; sub: string }) {
  const suppliers = useActive("suppliers");
  const products = useActive("products");
  const moves = useActive("stock_movements");
  const txns = useActive("financial_transactions");
  const rows = suppliers.items.map((s) => [s.name, products.items.filter((p) => p.supplierId === s.id).length, money(sum(moves.items.filter((m) => m.supplierId === s.id && m.type === "entrada" && inR(m.createdAt, range)), (m) => toNum(m.qty) * toNum(m.unitCost))), money(sum(txns.items.filter((t) => t.supplierId === s.id && t.type === "saida" && ["pendente", "previsto"].includes(t.status)), (t) => toNum(t.amount)))]);
  const rep: Report = { title: "Fornecedores", columns: ["Fornecedor", "Produtos", "Compras no período", "A pagar em aberto"], rows: rows as (string | number)[][] };
  if (!rows.length) return <Empty icon={BarChart3} title="Nenhum fornecedor cadastrado" />;
  return <div><div className="px-4 pb-2"><ExportBar rep={rep} sub={sub} ex={ex} /></div><table className="w-full"><thead><tr className="bg-black/10">{rep.columns.map((c) => <th key={c} className="th">{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="td">{c}</td>)}</tr>)}</tbody></table></div>;
}

function ProfitCenter({ data, range, ex, sub }: { data: Data; range: Range; ex: ReturnType<typeof useExport>; sub: string }) {
  const done = data.orders.filter((o) => ["concluida", "faturada"].includes(o.status) && inR(o.completedAt || o.date, range));
  const rows = done.map((o) => ({ o, c: costOf(o) }));
  const cn = (id: string) => data.customers.find((c) => c.id === id)?.name || "—";
  const tot = { charged: sum(rows, (r) => r.c.charged), cost: sum(rows, (r) => r.c.cost), profit: sum(rows, (r) => r.c.profit) };
  const rep: Report = { title: "Central de lucro", columns: ["OS", "Cliente", "Cobrado", "Material", "Mão de obra", "Deslocamento", "Taxas", "Custo total", "Lucro", "Margem"], rows: [...rows.map(({ o, c }) => [o.number, cn(o.customerId), money(c.charged), money(c.material), money(c.labor), money(c.travel), money(c.fees + c.taxes), money(c.cost), money(c.profit), pct(c.margin, 0)]), ["TOTAL", "", money(tot.charged), "", "", "", "", money(tot.cost), money(tot.profit), tot.charged ? pct((tot.profit / tot.charged) * 100, 0) : "—"]] };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Kpi label="Serviços concluídos" value={done.length} icon={Gauge} /><Kpi label="Cobrado" value={money(tot.charged)} icon={TrendingUp} tone="info" /><Kpi label="Custo total" value={money(tot.cost)} icon={TrendingUp} tone="warn" /><Kpi label="Lucro" value={money(tot.profit)} icon={TrendingUp} tone={tot.profit >= 0 ? "ok" : "bad"} sub={tot.charged ? `margem ${pct((tot.profit / tot.charged) * 100, 0)}` : ""} /></div>
      <Panel title="Lucro por serviço concluído" action={<ExportBar rep={rep} sub={sub} ex={ex} />} pad={false}>
        {!rows.length ? <Empty icon={TrendingUp} title="Nenhuma OS concluída no período" text="Ao concluir OS, o valor cobrado, materiais, mão de obra, deslocamento e taxas formam o lucro real." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-[13px]"><thead><tr className="bg-black/10">{rep.columns.map((c, i) => <th key={c} className={"th " + (i > 1 ? "text-right" : "")}>{c}</th>)}</tr></thead><tbody>{rep.rows.map((r, i) => <tr key={i} className={r[0] === "TOTAL" ? "font-bold bg-white/[.03]" : ""}>{r.map((c, j) => <td key={j} className={"td " + (j > 1 ? "text-right tabular-nums" : "")}>{c}</td>)}</tr>)}</tbody></table></div>
        )}
      </Panel>
    </div>
  );
}

function Ranking({ data, range }: { data: Data; range: Range }) {
  const done = data.orders.filter((o) => ["concluida", "faturada"].includes(o.status) && inR(o.completedAt || o.date, range));
  const m: Record<string, { name: string; qty: number; rev: number; cost: number; mat: number }> = {};
  done.forEach((o) => (o.pricing?.lines || []).forEach((l: Rec) => { const e = (m[l.name] ||= { name: l.name, qty: 0, rev: 0, cost: 0, mat: 0 }); e.qty += toNum(l.qty); e.rev += lineTotal(l as never); e.cost += toNum(l.qty) * toNum(l.unitCost) + toNum(l.materialCost); e.mat += toNum(l.materialCost); }));
  const list = Object.values(m).map((e) => ({ ...e, profit: e.rev - e.cost, margin: e.rev ? ((e.rev - e.cost) / e.rev) * 100 : 0, minutes: toNum(data.services.find((s) => s.name === e.name)?.avgMinutes) }));
  const top = (f: (e: (typeof list)[number]) => number, asc = false) => [...list].sort((a, b) => (asc ? f(a) - f(b) : f(b) - f(a))).slice(0, 5);
  if (!list.length) return <div className="card"><Empty icon={Medal} title="Sem serviços concluídos no período" text="O ranking analisa apenas os serviços da empresa (nunca pessoas)." /></div>;
  const boards: [string, ReturnType<typeof top>, (e: (typeof list)[number]) => number, (v: number) => string][] = [
    ["Mais vendidos", top((e) => e.qty), (e) => e.qty, (v) => `${num(v, 1)} un`], ["Mais lucrativos", top((e) => e.profit), (e) => e.profit, money], ["Maior margem", top((e) => e.margin), (e) => e.margin, (v) => pct(v, 0)],
    ["Menor margem", top((e) => e.margin, true), (e) => e.margin, (v) => pct(v, 0)], ["Mais consomem material", top((e) => e.mat), (e) => e.mat, money], ["Mais demorados", top((e) => e.minutes).filter((e) => e.minutes > 0), (e) => e.minutes, (v) => `${v} min`],
  ];
  return <div className="grid md:grid-cols-2 gap-4">{boards.map(([t, l, f, fmt]) => <Panel key={t} title={t}><HBars data={l.map((e) => ({ label: e.name, value: Math.max(0, f(e)) }))} format={fmt} empty="Sem dados" /></Panel>)}<p className="md:col-span-2 text-[11px] text-fg3">Análise interna dos serviços da empresa — não compara pessoas.</p></div>;
}

function Demand({ data }: { data: Data }) {
  const months = demandByMonth(data);
  const need = months.length >= 3;
  const top: Record<string, number> = {};
  months.forEach((mo) => Object.entries(mo.services).forEach(([k, v]) => (top[k] = (top[k] || 0) + v)));
  const usage: Record<string, number> = {};
  data.movements.filter((x) => ["uso_os", "saida"].includes(x.type)).forEach((x) => (usage[x.productId] = (usage[x.productId] || 0) + toNum(x.qty)));
  const recurring = data.customers.filter((c) => data.orders.filter((o) => o.customerId === c.id && ["concluida", "faturada"].includes(o.status)).length >= 2).length;
  return (
    <div className="space-y-4">
      {!need && <div className="card p-4 text-sm text-fg2 border-warn/30">Previsão de demanda exige histórico. Hoje há dados de <b>{months.length}</b> mês(es); a partir de <b>3 meses</b> de OS registradas o sistema apresenta sazonalidade e necessidade de estoque — sem inventar previsões.</div>}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="OS por mês (histórico real)" icon={LineChart}><Chart kind="bar" data={months.map((m) => ({ label: m.month.slice(5) + "/" + m.month.slice(2, 4), os: m.os, receita: m.revenue }))} series={[{ key: "os", name: "OS", color: "var(--accent)" }]} format={(v) => String(v)} /></Panel>
        <Panel title="Serviços mais procurados"><HBars data={Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }))} empty="Sem histórico" /></Panel>
        <Panel title="Clientes recorrentes"><div className="text-3xl font-extrabold">{recurring}</div><div className="text-xs text-fg3">clientes com 2+ serviços concluídos</div></Panel>
        <Panel title={need ? "Consumo médio mensal de materiais" : "Necessidade de estoque"}>{need ? <HBars data={Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => ({ label: data.products.find((p) => p.id === id)?.name || "—", value: Math.round((v / months.length) * 10) / 10 }))} format={(v) => `${v}/mês`} empty="Sem consumo" /> : <p className="text-xs text-fg3">Disponível após 3 meses de histórico.</p>}</Panel>
      </div>
    </div>
  );
}

function Monthly({ data, settingsName }: { data: Data; settingsName: string }) {
  const { settings } = useSettings();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const r: Range = { start: `${month}-01`, end: endOfMonth(`${month}-01`) };
  const d = useMemo(() => computeDashboard(data, r), [data, month]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = data.orders.filter((o) => ["concluida", "faturada"].includes(o.status) && inR(o.completedAt || o.date, r));
  const created = data.quotes.filter((q) => inR(q.createdAt, r));
  const ap = created.filter((q) => ["aprovado", "faturado"].includes(q.status)).length, rf = created.filter((q) => q.status === "recusado").length;
  const byCat: Record<string, number> = {};
  data.txns.filter((t) => t.type === "saida" && t.status !== "cancelado" && inR(t.dueDate, r)).forEach((t) => { const n = data.categories.length ? "" : ""; void n; byCat[t.description] = (byCat[t.description] || 0) + toNum(t.amount); });
  const goals = data.goals.filter((g) => dayOf(g.startDate) <= r.end && dayOf(g.endDate) >= r.start);
  const clients = new Set(done.map((o) => o.customerId)).size;
  const [y, mm] = month.split("-");
  const pdf = async () => {
    const { downloadPdf, companyOf } = await import("@/lib/pdf");
    await downloadPdf({
      title: "Relatório mensal", subtitle: `${MONTHS[Number(mm) - 1]} de ${y}`, meta: [["Empresa", settingsName || ""], ["Gerado em", fmtDate(todayISO())]],
      sections: [
        { type: "kv", title: "Resumo financeiro", rows: [["Faturamento", money(d.revenue)], ["Despesas", money(d.expensesTotal)], ["Lucro estimado", money(d.profit)], ["Entradas (recebido)", money(d.received)], ["Saídas (pago)", money(d.paidOut)]] },
        { type: "kv", title: "Operação e clientes", rows: [["Serviços concluídos", String(done.length)], ["Clientes atendidos", String(clients)], ["Novos clientes", String(d.newCustomers.length)], ["Ticket médio", money(d.ticket)]] },
        { type: "kv", title: "Orçamentos", rows: [["Criados", String(created.length)], ["Aprovados", String(ap)], ["Recusados", String(rf)], ["Conversão", ap + rf ? pct((ap / (ap + rf)) * 100, 0) : "—"]] },
        { type: "table", title: "Principais despesas", head: ["Descrição", "Valor"], rows: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, money(v)]), align: ["left", "right"] },
        { type: "table", title: "Metas", head: ["Meta", "Alvo", "Realizado", "%"], rows: goals.map((g) => { const p = goalProgress(g, data); const f = (v: number) => (["faturamento", "lucro"].includes(g.type) ? money(v) : num(v)); return [g.name, f(p.target), f(p.realized), pct(p.pct, 0)]; }), align: ["left", "right", "right", "right"] },
        { type: "table", title: "Serviços mais vendidos", head: ["Serviço", "Qtd", "Receita"], rows: d.topServices.map((s) => [s.name, s.qty, money(s.revenue)]), align: ["left", "right", "right"] },
      ], terms: "",
    }, companyOf(settings), settings.pdfTemplate, `Relatorio-${month}`);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3"><input type="month" className="input !w-44" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês" /><button className="btn btn-primary" onClick={pdf}><Download size={15} /> Gerar PDF do mês</button></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Kpi label="Faturamento" value={money(d.revenue)} icon={TrendingUp} tone="accent" /><Kpi label="Despesas" value={money(d.expensesTotal)} icon={TrendingUp} tone="bad" /><Kpi label="Lucro" value={money(d.profit)} icon={TrendingUp} tone={d.profit >= 0 ? "ok" : "bad"} /><Kpi label="Serviços concluídos" value={done.length} icon={Gauge} />
        <Kpi label="Clientes atendidos" value={clients} icon={Gauge} tone="info" /><Kpi label="Novos clientes" value={d.newCustomers.length} icon={Gauge} tone="violet" /><Kpi label="Orçamentos criados" value={created.length} icon={Gauge} /><Kpi label="Conversão" value={ap + rf ? pct((ap / (ap + rf)) * 100, 0) : "—"} icon={Gauge} tone="ok" sub={`${ap} aprovados · ${rf} recusados`} /></div>
      <Panel title="Metas do mês">{goals.length ? goals.map((g) => { const p = goalProgress(g, data); return <div key={g.id} className="flex justify-between text-sm py-1"><span>{g.name}</span><b>{pct(p.pct, 0)}</b></div>; }) : <p className="text-xs text-fg3">Sem metas neste mês.</p>}</Panel>
      <span className="hidden">{settings.name}</span>
    </div>
  );
}
