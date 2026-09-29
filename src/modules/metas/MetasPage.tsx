"use client";
import { useEffect, useMemo } from "react";
import { CalendarPlus, Copy, MoreHorizontal, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Empty, Menu, PageHeader, confirmDialog, Badge } from "@/components/ui";
import { ProgressBar, Ring } from "@/components/charts";
import { useUI } from "@/components/shell/ui-context";
import { db } from "@/lib/data/store";
import { GOAL_TYPES } from "@/lib/constants";
import { useAnalyticsData } from "@/lib/hooks";
import { notify } from "@/lib/workflows";
import type { Data } from "@/lib/analytics";
import type { Rec } from "@/lib/types";
import { addDays, addMonths, dayOf, diffDays, fmtDate, money, num, pct, sum, toNum, todayISO } from "@/lib/utils";

export function goalProgress(g: Rec, d: Data) {
  const s = dayOf(g.startDate), e = dayOf(g.endDate);
  const inR = (x?: string) => { const v = dayOf(x); return !!v && v >= s && v <= e; };
  const inc = sum(d.txns.filter((t) => t.type === "entrada" && t.status !== "cancelado" && inR(t.dueDate)), (t) => toNum(t.amount));
  const exp = sum(d.txns.filter((t) => t.type === "saida" && t.status !== "cancelado" && inR(t.dueDate)), (t) => toNum(t.amount));
  const done = d.orders.filter((o) => ["concluida", "faturada"].includes(o.status) && inR(o.completedAt || o.date));
  let realized = 0;
  switch (g.type) {
    case "faturamento": realized = inc; break;
    case "lucro": realized = inc - exp; break;
    case "servicos": realized = done.length; break;
    case "clientes": realized = new Set(done.map((o) => o.customerId)).size; break;
    case "novos_clientes": realized = d.customers.filter((c) => inR(c.createdAt)).length; break;
  }
  const target = toNum(g.target);
  const total = Math.max(1, diffDays(s, e) + 1);
  const elapsed = Math.min(total, Math.max(1, diffDays(s, todayISO()) + 1));
  const projection = todayISO() > e ? realized : (realized / elapsed) * total;
  return { realized, target, pct: target > 0 ? (realized / target) * 100 : 0, missing: Math.max(0, target - realized), projection, elapsed, total, active: s <= todayISO() && todayISO() <= e, expected: (target * elapsed) / total };
}

export default function MetasPage() {
  const ui = useUI();
  const { data, loading } = useAnalyticsData();
  const goals = useMemo(() => [...data.goals].sort((a, b) => dayOf(b.startDate).localeCompare(dayOf(a.startDate))), [data.goals]);
  useEffect(() => {
    if (loading) return;
    goals.forEach((g) => { const p = goalProgress(g, data); if (p.target > 0 && p.pct >= 100) notify({ type: "goal", title: "Meta atingida! 🎉", body: g.name, severity: "ok", key: `goal_${g.id}` }); });
  }, [goals, data, loading]);
  const fmt = (g: Rec, v: number) => (["faturamento", "lucro"].includes(g.type) ? money(v) : num(v));
  return (
    <>
      <PageHeader title="Metas" subtitle="Faturamento, lucro, serviços, clientes e novos clientes — com progresso e projeção." actions={<button className="btn btn-primary" onClick={() => ui.openForm("goals")}><Plus size={16} /> Nova meta</button>} />
      {!goals.length && !loading ? <div className="card"><Empty icon={Target} title="Nenhuma meta definida" text="Crie uma meta mensal de faturamento e acompanhe o realizado em tempo real." action={<button className="btn btn-primary" onClick={() => ui.openForm("goals")}><Plus size={16} /> Criar meta</button>} /></div> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map((g) => {
            const p = goalProgress(g, data);
            const onTrack = p.realized >= p.expected;
            return (
              <div key={g.id} className="card p-4 space-y-3">
                <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="font-bold truncate">{g.name}</div><div className="text-xs text-fg3">{GOAL_TYPES[g.type]} · {fmtDate(g.startDate)} → {fmtDate(g.endDate)}</div></div>
                  <Menu label="Ações da meta" trigger={<MoreHorizontal size={16} />} items={[
                    { label: "Editar", icon: Pencil, onClick: () => ui.openForm("goals", g.id) },
                    { label: "Duplicar para o próximo período", icon: CalendarPlus, onClick: () => { const n = g.period === "ano" ? addMonths(g.startDate, 12) : g.period === "trimestre" ? addMonths(g.startDate, 3) : addDays(dayOf(g.endDate), 1); db.create("goals", { name: g.name, type: g.type, period: g.period === "custom" ? "mes" : g.period, startDate: n, target: g.target, endDate: g.period === "custom" ? "" : addDays(g.period === "ano" ? addMonths(n, 12) : g.period === "trimestre" ? addMonths(n, 3) : addMonths(n, 1), -1) }); } },
                    { label: "Duplicar", icon: Copy, onClick: () => db.duplicate("goals", g.id, { name: `${g.name} (cópia)` }) },
                    "sep", { label: "Excluir", icon: Trash2, danger: true, onClick: async () => { if (await confirmDialog({ title: "Excluir meta?", confirmText: "Excluir", danger: true })) db.remove("goals", g.id); } },
                  ]} /></div>
                <div className="flex items-center gap-4">
                  <Ring value={p.pct} size={104} stroke={10} color={p.pct >= 100 ? "var(--ok)" : "var(--accent)"}><div><div className="text-xl font-extrabold">{Math.round(p.pct)}%</div></div></Ring>
                  <div className="text-sm space-y-0.5 min-w-0"><div className="text-fg2">Meta <b className="text-fg">{fmt(g, p.target)}</b></div><div className="text-fg2">Realizado <b className="text-fg">{fmt(g, p.realized)}</b></div><div className="text-fg2">Falta <b className={p.pct >= 100 ? "text-ok" : "text-warn"}>{p.pct >= 100 ? "atingida 🎉" : fmt(g, p.missing)}</b></div></div>
                </div>
                <ProgressBar value={p.pct} color={p.pct >= 100 ? "var(--ok)" : "var(--accent)"} />
                <div className="flex items-center justify-between text-xs"><span className="text-fg2">Projeção: <b className="text-fg">{fmt(g, p.projection)}</b> ({pct(p.target > 0 ? (p.projection / p.target) * 100 : 0, 0)})</span>
                  {p.active ? <Badge tone={onTrack ? "ok" : "warn"}>{onTrack ? "✓ No ritmo" : "▼ Abaixo do ritmo"}</Badge> : <Badge>{todayISO() > dayOf(g.endDate) ? "Encerrada" : "Futura"}</Badge>}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
