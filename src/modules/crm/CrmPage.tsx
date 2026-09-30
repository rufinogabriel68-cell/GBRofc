"use client";
import { useMemo, useState } from "react";
import { Cpu, ListTodo, Plus, Repeat, ShieldCheck, Star, UserCheck, Users, Workflow, MoveRight, UserPlus, MoreHorizontal } from "lucide-react";
import { CrudView } from "@/components/crud/CrudView";
import { Empty, Menu, PageHeader, Tabs, Badge } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { db, useActive, useCollection } from "@/lib/data/store";
import { PIPELINE } from "@/lib/constants";
import { useQueryParam } from "@/lib/hooks";
import { cx, dayOf, fmtDate, money, sum, toNum, todayISO, addDays } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ContactCell } from "@/components/cells";
import { getModule } from "../registry";
import type { Rec } from "@/lib/types";

type Tab = "pipeline" | "clientes" | "tarefas" | "recorrentes" | "equipamentos" | "garantias" | "avaliacoes";

export default function CrmPage() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [param] = useQueryParam("tab");
  // Aplica ?tab= quando o parâmetro chega (ajuste durante a renderização, sem efeito).
  const [appliedParam, setAppliedParam] = useState<string | null>(null);
  if (param && param !== appliedParam) {
    setAppliedParam(param);
    if (["pipeline", "clientes", "tarefas", "recorrentes", "equipamentos", "garantias", "avaliacoes"].includes(param)) setTab(param as Tab);
  }
  const ui = useUI();
  return (
    <>
      <PageHeader title="CRM" subtitle="Pipeline de vendas, clientes, follow-ups, recorrência, equipamentos e garantias."
        actions={<><button className="btn" onClick={() => ui.openForm("crm_leads")}><Plus size={15} /> Lead</button><button className="btn btn-primary" onClick={() => ui.openForm("customers")}><UserPlus size={15} /> Cliente</button></>} />
      <Tabs<Tab> value={tab} onChange={setTab} className="mb-4" tabs={[
        { id: "pipeline", label: "Pipeline", icon: Workflow }, { id: "clientes", label: "Clientes", icon: Users }, { id: "tarefas", label: "Tarefas e follow-ups", icon: ListTodo },
        { id: "recorrentes", label: "Recorrentes", icon: Repeat }, { id: "equipamentos", label: "Equipamentos", icon: Cpu }, { id: "garantias", label: "Garantias", icon: ShieldCheck }, { id: "avaliacoes", label: "Avaliações", icon: Star },
      ]} />
      {tab === "pipeline" && <Pipeline />}
      {tab === "clientes" && <CrudView config={getModule("customers")} />}
      {tab === "tarefas" && <CrudView config={getModule("crm_activities")} />}
      {tab === "recorrentes" && <Recurrent />}
      {tab === "equipamentos" && <CrudView config={getModule("customer_equipment")} />}
      {tab === "garantias" && <CrudView config={getModule("warranties")} />}
      {tab === "avaliacoes" && <Evaluations />}
    </>
  );
}

/* ---------------------------------------------------------------- pipeline */
type Card = { kind: "lead" | "customer"; rec: Rec };
function Pipeline() {
  const ui = useUI();
  const leads = useActive("crm_leads");
  const customers = useActive("customers");
  const [over, setOver] = useState("");
  const cards: Card[] = useMemo(() => [
    ...leads.items.filter((l) => !l.customerId).map((rec) => ({ kind: "lead" as const, rec })),
    ...customers.items.map((rec) => ({ kind: "customer" as const, rec: { ...rec, stage: rec.stage || "cliente" } })),
  ], [leads.items, customers.items]);
  const move = (c: Card, stage: string) => db.update(c.kind === "lead" ? "crm_leads" : "customers", c.rec.id, { stage }, { silent: true });
  const convert = (l: Rec) => {
    const cust = db.create("customers", { name: l.name, kind: "pf", phone: l.phone || "", whatsapp: l.phone || "", email: l.email || "", source: l.source || "", stage: "cliente", tags: l.tags || [], notes: l.notes || "" });
    db.update("crm_leads", l.id, { customerId: cust.id, stage: "cliente" }, { silent: true });
    toast("Lead convertido em cliente");
    ui.openDetail("customers", cust.id);
  };
  if (leads.loading && customers.loading) return <div className="skeleton h-64" />;
  return (
    <div className="overflow-x-auto pb-3 -mx-1 px-1">
      <div className="flex gap-3 min-w-max">
        {PIPELINE.map((st) => {
          const list = cards.filter((c) => (c.rec.stage || "lead") === st.id);
          const total = sum(list.filter((c) => c.kind === "lead"), (c) => toNum(c.rec.value));
          return (
            <div key={st.id} className={cx("w-[268px] shrink-0 rounded-2xl border bg-solid/50 flex flex-col max-h-[68vh]", over === st.id ? "border-accent/60 bg-accent/5" : "border-line")}
              onDragOver={(e) => { e.preventDefault(); setOver(st.id); }} onDragLeave={() => setOver("")}
              onDrop={(e) => { e.preventDefault(); setOver(""); try { const { kind, id } = JSON.parse(e.dataTransfer.getData("text/plain")); const c = cards.find((x) => x.kind === kind && x.rec.id === id); if (c && c.rec.stage !== st.id) move(c, st.id); } catch {} }}>
              <div className="px-3 pt-3 pb-2 flex items-center gap-2"><st.icon size={15} className="text-accent" /><span className="text-[13px] font-bold">{st.label}</span><span className="text-xs text-fg3 ml-auto">{list.length}{total > 0 && ` · ${money(total)}`}</span></div>
              <div className="px-2 pb-2 space-y-2 overflow-y-auto">
                {list.map((c) => (
                  <div key={c.kind + c.rec.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ kind: c.kind, id: c.rec.id }))}
                    className="card-solid p-3 cursor-grab active:cursor-grabbing hover:border-line2 group">
                    <div className="flex items-start gap-1.5">
                      <button className="text-left flex-1 min-w-0" onClick={() => (c.kind === "lead" ? ui.openForm("crm_leads", c.rec.id) : ui.openDetail("customers", c.rec.id))}>
                        <div className="text-[13.5px] font-semibold truncate">{c.rec.name}</div>
                        <div className="text-[11px] text-fg3 truncate">{c.kind === "lead" ? c.rec.source || "Lead" : [c.rec.phone, c.rec.city].filter(Boolean).join(" · ") || "Cliente"}</div>
                      </button>
                      <Menu label="Mover" trigger={<MoreHorizontal size={15} />} className="btn btn-ghost btn-icon btn-sm !size-6 !w-6 !h-6"
                        items={[c.kind === "lead" && { label: "Converter em cliente", icon: UserCheck, onClick: () => convert(c.rec) }, ...PIPELINE.filter((p) => p.id !== st.id).map((p) => ({ label: `Mover para ${p.label}`, icon: MoveRight, onClick: () => move(c, p.id) }))]} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {c.kind === "lead" && toNum(c.rec.value) > 0 && <Badge tone="ok">{money(c.rec.value)}</Badge>}
                      {c.rec.nextContact && <Badge tone={dayOf(c.rec.nextContact) < todayISO() ? "bad" : "info"}>Contato {fmtDate(c.rec.nextContact)}</Badge>}
                      {(c.rec.tags || []).slice(0, 2).map((t: string) => <Badge key={t}>{t}</Badge>)}
                    </div>
                  </div>
                ))}
                {!list.length && <div className="text-[11px] text-fg3 text-center py-5 border border-dashed border-line rounded-xl">Arraste cards para cá</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- recorrentes */
function Recurrent() {
  const ui = useUI();
  const customers = useActive("customers");
  const orders = useActive("work_orders");
  const txns = useActive("financial_transactions");
  const tasks = useActive("crm_activities");
  const rows = useMemo(() => customers.items.map((c) => {
    const done = orders.items.filter((o) => o.customerId === c.id && ["concluida", "faturada"].includes(o.status));
    const revenue = sum(txns.items.filter((t) => t.customerId === c.id && t.type === "entrada" && t.status === "pago"), (t) => toNum(t.amount));
    const last = done.map((o) => dayOf(o.completedAt || o.date)).sort().pop();
    const next = tasks.items.filter((t) => t.customerId === c.id && t.status === "aberta").sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];
    return { c, count: done.length, revenue, last, next };
  }).filter((r) => r.count >= 2).sort((a, b) => b.revenue - a.revenue), [customers.items, orders.items, txns.items, tasks.items]);
  if (!rows.length) return <div className="card"><Empty icon={Repeat} title="Nenhum cliente recorrente ainda" text="Clientes com 2 ou mais serviços concluídos aparecem aqui, com oportunidades de manutenção." /></div>;
  return (
    <div className="card overflow-x-auto"><table className="w-full min-w-[640px]"><thead><tr className="bg-black/10"><th className="th">Cliente</th><th className="th text-right">Serviços</th><th className="th text-right">Faturamento</th><th className="th">Último atendimento</th><th className="th">Próximo contato</th><th className="th" /></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.c.id} className="hover:bg-white/[.03]"><td className="td"><button className="font-semibold hover:text-accent" onClick={() => ui.openDetail("customers", r.c.id)}>{r.c.name}</button><div className="text-xs"><ContactCell phone={r.c.phone} whatsapp={r.c.whatsapp} /></div></td>
          <td className="td text-right">{r.count}</td><td className="td text-right tabular-nums">{money(r.revenue)}</td><td className="td">{fmtDate(r.last)}</td><td className="td">{r.next ? fmtDate(r.next.dueDate) : <span className="text-fg3">—</span>}</td>
          <td className="td text-right"><button className="btn btn-sm" onClick={() => { db.create("crm_activities", { title: `Oferecer manutenção preventiva — ${r.c.name}`, kind: "manutencao", dueDate: addDays(todayISO(), 3), status: "aberta", customerId: r.c.id, notes: "Cliente recorrente: oportunidade de revisão/manutenção." }); toast("Follow-up criado"); }}>Criar follow-up</button></td></tr>
      ))}</tbody></table></div>
  );
}

/* ---------------------------------------------------------------- avaliações */
function Evaluations() {
  const { items } = useActive("evaluations");
  const avg = (k: string) => (items.length ? sum(items, (e) => toNum(e[k])) / items.length : 0);
  const crit: [string, string][] = [["quality", "Qualidade"], ["service", "Atendimento"], ["deadline", "Prazo"], ["price", "Preço"], ["result", "Resultado"]];
  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="card p-3.5 sm:col-span-1 col-span-2"><div className="text-[11px] font-bold uppercase text-fg3">Nota geral</div><div className="text-3xl font-extrabold text-warn">★ {avg("overall").toFixed(1)}</div><div className="text-xs text-fg3">{items.length} avaliação(ões)</div></div>
          {crit.map(([k, l]) => <div key={k} className="card p-3.5"><div className="text-[11px] font-bold uppercase text-fg3">{l}</div><div className="text-xl font-bold">{avg(k).toFixed(1)}</div></div>)}
        </div>
      )}
      <CrudView config={getModule("evaluations")} />
      <p className="text-[11px] text-fg3">Preparado para integração futura com o Google Business Profile (importar/solicitar avaliações públicas).</p>
    </div>
  );
}
export const _x = useCollection;
