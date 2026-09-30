"use client";
import Link from "next/link";
import { useLayoutEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, CalendarClock, CalendarDays, CheckCircle2, ClipboardList, CreditCard, FileCheck2, FileText, Hourglass, PackageX, Rocket, Sparkles, Target, TrendingUp, UserPlus, Users, Wallet, Wrench, Clock,
} from "lucide-react";
import { Chart, Donut, HBars, Legend, Ring } from "@/components/charts";
import { Empty, Kpi, Panel, Segmented, StatusBadge } from "@/components/ui";
import { openEntity, useUI } from "@/components/shell/ui-context";
import { computeInsights, computeDashboard, PERIODS, periodRange, type Period } from "@/lib/analytics";
import { computeAlerts } from "@/lib/alerts";
import { APPT_STATUS, APPT_TYPES } from "@/lib/constants";
import { useAnalyticsData } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import { cx, dayOf, fmtDate, fmtDateTime, money, moneyShort, pct, todayISO, toNum, WEEKDAYS, MONTHS } from "@/lib/utils";

export default function Dashboard() {
  const ui = useUI();
  const { settings } = useSettings();
  const { data, loading } = useAnalyticsData();
  const [period, setPeriod] = useState<Period>("mes");
  const [custom, setCustom] = useState({ start: todayISO().slice(0, 8) + "01", end: todayISO() });
  const range = useMemo(() => periodRange(period, custom), [period, custom]);
  const d = useMemo(() => computeDashboard(data, range), [data, range]);
  const alerts = useMemo(() => computeAlerts({ quotes: data.quotes, orders: data.orders, txns: data.txns, products: data.products, warranties: data.warranties, activities: data.activities, customers: data.customers }), [data]);
  const insights = useMemo(() => computeInsights(data, settings.staleStockDays).slice(0, 4), [data, settings.staleStockDays]);
  const custName = (id: string) => data.customers.find((c) => c.id === id)?.name || "";
  // Hidratação (React #418): o servidor tem o relógio do build (UTC) e o
  // cliente o relógio real (BRT) — saudação/data só são geradas após a montagem.
  const [now, setNow] = useState<Date | null>(null);
  useLayoutEffect(() => {
    const tick = () => setNow(new Date());
    tick();
  }, []);
  const greet = now ? (now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite") : "";
  const first = (settings.responsible || "").split(" ")[0];
  const empty = !loading && !data.customers.length && !data.services.length && !data.orders.length;
  const growth = d.prevRevenue > 0 ? ((d.revenue - d.prevRevenue) / d.prevRevenue) * 100 : null;

  const todayTasks = data.activities.filter((a) => a.status === "aberta" && dayOf(a.dueDate) <= todayISO());
  const dueToday = data.txns.filter((t) => ["pendente", "previsto"].includes(t.status) && t.type !== "transferencia" && dayOf(t.dueDate) === todayISO());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-fg2">{now ? `${WEEKDAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}` : "\u00a0"}</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{greet}{first ? `, ${first}` : ""} 👋</h1>
          <p className="text-sm text-fg2 mt-0.5">{d.todayAppts.length ? `Você tem ${d.todayAppts.length} atendimento(s) hoje` : "Nenhum atendimento agendado para hoje"}{d.osLate.length ? ` · ${d.osLate.length} OS atrasada(s)` : ""}.</p>
        </div>
        <div className="flex flex-col items-end gap-2 max-w-full">
          <Segmented<Period> options={PERIODS.map((p) => ({ id: p.id, label: p.label }))} value={period} onChange={setPeriod} small />
          {period === "custom" && (
            <div className="flex items-center gap-2"><input type="date" className="input input-sm !w-36" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} aria-label="Início" /><span className="text-fg3 text-xs">até</span><input type="date" className="input input-sm !w-36" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} aria-label="Fim" /></div>
          )}
        </div>
      </div>

      {empty && (
        <div className="card p-5 border-accent/30 bg-gradient-to-r from-accent/8 to-accent2/5">
          <div className="flex items-center gap-2 font-bold text-lg"><Rocket className="text-accent" size={20} /> Primeiros passos</div>
          <p className="text-sm text-fg2 mt-1">Seu sistema está pronto e sincronizando. Siga o fluxo principal:</p>
          <div className="grid sm:grid-cols-4 gap-2.5 mt-3.5">
            {[["1. Cadastre serviços", "services", Wrench], ["2. Cadastre um cliente", "customers", UserPlus], ["3. Crie um orçamento", "quotes", FileText], ["4. Abra uma OS", "work_orders", ClipboardList]].map(([l, c, I]) => {
              const Ic = I as typeof Wrench;
              return <button key={String(c)} onClick={() => ui.openForm(String(c))} className="card-solid p-3.5 text-left hover:border-accent/50 transition flex items-center gap-2.5"><Ic size={18} className="text-accent" /><span className="text-sm font-semibold">{String(l)}</span></button>;
            })}
          </div>
        </div>
      )}

      {/* central de operação */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Hoje" icon={CalendarClock} action={<Link href="/agenda" className="text-xs text-accent font-semibold">Abrir agenda →</Link>} className="lg:col-span-1">
          <div className="space-y-2.5 max-h-[330px] overflow-y-auto pr-1">
            {d.todayAppts.map((a) => (
              <button key={a.id} onClick={() => (a.workOrderId ? ui.openDetail("work_orders", a.workOrderId) : ui.openForm("appointments", a.id))} className="w-full text-left flex gap-3 group">
                <div className="w-12 shrink-0 text-right"><div className="text-sm font-bold tabular-nums">{a.startTime || "—"}</div></div>
                <div className="w-1 rounded-full shrink-0" style={{ background: APPT_TYPES[a.type]?.color || "#38a8ff" }} />
                <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold truncate group-hover:text-accent">{a.title}</div><div className="text-xs text-fg3 truncate">{custName(a.customerId) ? `Cliente: ${custName(a.customerId)}` : a.address || APPT_TYPES[a.type]?.label}</div><div className="mt-1"><StatusBadge def={APPT_STATUS[a.status]} /></div></div>
              </button>
            ))}
            {todayTasks.slice(0, 4).map((t) => <Link href="/crm" key={t.id} className="flex items-center gap-2 text-[13px]"><CheckCircle2 size={15} className="text-warn shrink-0" /><span className="truncate">{t.title}</span></Link>)}
            {dueToday.slice(0, 4).map((t) => <Link href="/financeiro" key={t.id} className="flex items-center gap-2 text-[13px]"><Banknote size={15} className={t.type === "entrada" ? "text-ok shrink-0" : "text-bad shrink-0"} /><span className="truncate">{t.type === "entrada" ? "Receber" : "Pagar"}: {t.description}</span><span className="ml-auto tabular-nums text-fg2">{money(t.amount)}</span></Link>)}
            {!d.todayAppts.length && !todayTasks.length && !dueToday.length && <Empty icon={CalendarDays} title="Dia livre" text="Sem atendimentos, tarefas ou pagamentos para hoje." />}
          </div>
        </Panel>

        <Panel title="Pendências" icon={AlertTriangle} className="lg:col-span-1">
          <div className="space-y-2 max-h-[330px] overflow-y-auto pr-1">
            {alerts.map((a) => {
              const inner = (
                <div className="flex items-start gap-2.5 text-[13px]">
                  <span className={cx("size-2 rounded-full mt-1.5 shrink-0", a.severity === "bad" ? "bg-bad" : a.severity === "warn" ? "bg-warn" : "bg-info")} />
                  <div className="min-w-0"><div className="font-medium leading-snug">{a.title}</div>{a.body && <div className="text-xs text-fg3 truncate">{a.body}</div>}</div>
                </div>
              );
              return a.entity ? <button key={a.key} className="block w-full text-left hover:bg-white/5 rounded-lg p-1.5 -m-1.5" onClick={() => openEntity(ui, a.entity!)}>{inner}</button> : <Link key={a.key} href={a.href || "/"} className="block hover:bg-white/5 rounded-lg p-1.5 -m-1.5">{inner}</Link>;
            })}
            {!alerts.length && <Empty icon={CheckCircle2} title="Tudo em dia" text="Nenhuma pendência no momento." />}
          </div>
        </Panel>

        <Panel title="Meta" icon={Target} action={<Link href="/metas" className="text-xs text-accent font-semibold">Ver metas →</Link>}>
          {d.goal ? (
            <div className="flex items-center gap-5">
              <Ring value={d.goalPct} size={124} color="var(--accent)"><div><div className="text-2xl font-extrabold">{Math.round(d.goalPct)}%</div><div className="text-[10px] text-fg3 uppercase font-bold">da meta</div></div></Ring>
              <div className="text-sm space-y-1 min-w-0"><div className="font-semibold truncate">{d.goal.name}</div><div className="text-fg2">Realizado <b className="text-fg">{money(d.goalRealized)}</b></div><div className="text-fg2">Meta <b className="text-fg">{money(d.goal.target)}</b></div><div className="text-fg2">Falta <b className={d.goalPct >= 100 ? "text-ok" : "text-warn"}>{d.goalPct >= 100 ? "meta batida! 🎉" : money(toNum(d.goal.target) - d.goalRealized)}</b></div></div>
            </div>
          ) : <Empty icon={Target} title="Defina sua meta mensal" text="Acompanhe faturamento, progresso e projeção." action={<button className="btn btn-sm btn-primary" onClick={() => ui.openForm("goals")}>Criar meta</button>} />}
        </Panel>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <Kpi label="Faturamento" value={moneyShort(d.revenue)} icon={TrendingUp} tone="accent" sub={growth !== null ? <span className={growth >= 0 ? "text-ok" : "text-bad"}>{growth >= 0 ? <ArrowUpRight size={12} className="inline" /> : <ArrowDownRight size={12} className="inline" />} {pct(Math.abs(growth), 1)} vs. período anterior</span> : "no período"} href="/financeiro" />
        <Kpi label="Lucro estimado" value={moneyShort(d.profit)} icon={Sparkles} tone={d.profit >= 0 ? "ok" : "bad"} sub="faturamento − despesas" href="/relatorios" />
        <Kpi label="Entradas" value={moneyShort(d.received)} icon={ArrowUpRight} tone="ok" sub="recebido no período" href="/financeiro" />
        <Kpi label="Saídas" value={moneyShort(d.paidOut)} icon={ArrowDownRight} tone="bad" sub="pago no período" href="/financeiro" />
        <Kpi label="A receber" value={moneyShort(d.receivable)} icon={Wallet} tone="info" sub="pendente (total)" href="/financeiro" />
        <Kpi label="A pagar" value={moneyShort(d.payable)} icon={CreditCard} tone="warn" sub="pendente (total)" href="/financeiro" />
        <Kpi label="Orçam. aguardando" value={d.waiting.length} icon={Hourglass} tone="warn" sub={money(d.waiting.reduce((a, q) => a + toNum(q.total), 0))} href="/orcamentos" />
        <Kpi label="Orçam. aprovados" value={d.approved.length} icon={FileCheck2} tone="ok" sub={money(d.approved.reduce((a, q) => a + toNum(q.total), 0))} href="/orcamentos" />
        <Kpi label="OS abertas" value={d.osOpen.length} icon={ClipboardList} tone="info" href="/ordens-de-servico" />
        <Kpi label="OS em andamento" value={d.osRunning.length} icon={Wrench} tone="violet" href="/ordens-de-servico" />
        <Kpi label="OS atrasadas" value={d.osLate.length} icon={AlertTriangle} tone={d.osLate.length ? "bad" : "ok"} href="/ordens-de-servico" />
        <Kpi label="Agenda de hoje" value={d.todayAppts.length} icon={CalendarDays} tone="accent" sub="compromissos" href="/agenda" />
        <Kpi label="Meta mensal" value={d.goal ? moneyShort(d.goal.target) : "—"} icon={Target} sub={d.goal ? `${money(d.goalRealized)} realizados` : "sem meta ativa"} href="/metas" />
        <Kpi label="% da meta" value={d.goal ? pct(d.goalPct, 0) : "—"} icon={Target} tone={d.goalPct >= 100 ? "ok" : "accent"} href="/metas" />
        <Kpi label="Ticket médio" value={moneyShort(d.ticket)} icon={Banknote} tone="violet" sub="por venda" />
        <Kpi label="Novos clientes" value={d.newCustomers.length} icon={Users} tone="info" sub="no período" href="/crm" />
        <Kpi label="Estoque baixo" value={d.lowStock.length} icon={PackageX} tone={d.lowStock.length ? "bad" : "ok"} sub="produtos abaixo do mínimo" href="/estoque" />
      </div>

      {/* gráficos */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Faturamento e lucro" icon={TrendingUp} action={<Legend series={[{ key: "f", name: "Faturamento", color: "var(--accent)" }, { key: "l", name: "Lucro", color: "var(--accent-2)" }]} />}>
          <Chart kind="area" data={d.series} series={[{ key: "faturamento", name: "Faturamento", color: "var(--accent)" }, { key: "lucro", name: "Lucro", color: "var(--accent-2)" }]} format={money} />
        </Panel>
        <Panel title="Entradas × saídas" icon={Wallet} action={<Legend series={[{ key: "e", name: "Entradas", color: "var(--ok)" }, { key: "s", name: "Saídas", color: "var(--bad)" }]} />}>
          <Chart kind="bar" data={d.series} series={[{ key: "entradas", name: "Entradas", color: "var(--ok)" }, { key: "saidas", name: "Saídas", color: "var(--bad)" }]} format={money} />
        </Panel>
        <Panel title="Evolução da meta" icon={Target} action={<Legend series={[{ key: "r", name: "Realizado", color: "var(--accent)" }, { key: "i", name: "Ritmo ideal", color: "var(--fg-3)" }]} />}>
          {d.goal ? <Chart kind="line" data={d.goalSeries} series={[{ key: "realizado", name: "Realizado", color: "var(--accent)" }, { key: "ideal", name: "Ritmo ideal", color: "var(--fg-3)" }]} format={money} /> : <Empty icon={Target} title="Sem meta ativa" text="Crie uma meta de faturamento para acompanhar a evolução." />}
        </Panel>
        <Panel title="Orçamentos: aprovados × recusados" icon={FileText}>
          <Donut data={[{ label: "Aprovados", value: d.approved.length, color: "var(--ok)" }, { label: "Recusados", value: d.refused.length, color: "var(--bad)" }, { label: "Aguardando", value: d.waiting.length, color: "var(--warn)" }]} center={<div><div className="text-xl">{d.approved.length + d.refused.length ? pct((d.approved.length / (d.approved.length + d.refused.length)) * 100, 0) : "—"}</div><div className="text-[10px] text-fg3 font-semibold">conversão</div></div>} />
        </Panel>
        <Panel title="Serviços mais vendidos" icon={Wrench} className="lg:col-span-2">
          <HBars data={d.topServices.map((s) => ({ label: s.name, value: s.revenue, sub: `${s.qty} un vendida(s)` }))} format={money} empty="Ainda não há vendas no período." />
        </Panel>
      </div>

      {insights.length > 0 && (
        <Panel title="Insights" icon={Sparkles} action={<Link href="/insights" className="text-xs text-accent font-semibold">Ver todos →</Link>}>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {insights.map((i, k) => <div key={k} className="rounded-xl bg-solid2/70 border border-line px-3.5 py-2.5 text-[13px] flex gap-2.5"><span className={cx("size-2 rounded-full mt-1.5 shrink-0", i.tone === "ok" ? "bg-ok" : i.tone === "bad" ? "bg-bad" : i.tone === "warn" ? "bg-warn" : "bg-info")} />{i.text}</div>)}
          </div>
        </Panel>
      )}
      {!loading && (
        <p className="text-[11px] text-fg3 text-center pb-2"><Clock size={11} className="inline mr-1" />Período: {fmtDate(range.start)} → {fmtDate(range.end)} · atualizado {fmtDateTime(new Date().toISOString())}</p>
      )}
    </div>
  );
}
