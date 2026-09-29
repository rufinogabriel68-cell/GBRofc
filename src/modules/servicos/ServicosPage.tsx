"use client";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Tags, Wrench } from "lucide-react";
import { CrudView } from "@/components/crud/CrudView";
import { Empty, PageHeader, SearchInput, Tabs } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { useActive } from "@/lib/data/store";
import { useQueryParam } from "@/lib/hooks";
import { money, norm, pct, toNum } from "@/lib/utils";
import { getModule } from "../registry";

type Tab = "servicos" | "catalogo" | "categorias";

export default function ServicosPage() {
  const ui = useUI();
  const [tab, setTab] = useState<Tab>("servicos");
  const [isNew, clear] = useQueryParam("new");
  useEffect(() => { if (isNew) { ui.openForm("services"); clear(); } }, [isNew]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <PageHeader title="Serviços" subtitle="Catálogo com preços Econômico, Médio e Premium, custos, materiais e checklist." />
      <Tabs<Tab> value={tab} onChange={setTab} className="mb-4" tabs={[{ id: "servicos", label: "Serviços", icon: Wrench }, { id: "catalogo", label: "Catálogo de consulta", icon: BookOpen }, { id: "categorias", label: "Categorias", icon: Tags }]} />
      {tab === "servicos" && <CrudView config={getModule("services")} />}
      {tab === "catalogo" && <Catalog />}
      {tab === "categorias" && <CrudView config={getModule("service_categories")} />}
    </>
  );
}

/** Tabela de consulta rápida durante um atendimento. */
function Catalog() {
  const ui = useUI();
  const svc = useActive("services");
  const cats = useActive("service_categories");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const rows = useMemo(() => svc.items.filter((s) => s.status !== "inativo" && (!cat || s.categoryId === cat) && (!q || norm([s.name, s.code, s.description].join(" ")).includes(norm(q)))).sort((a, b) => a.name.localeCompare(b.name)), [svc.items, q, cat]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof rows>();
    rows.forEach((r) => { const k = cats.items.find((c) => c.id === r.categoryId)?.name || "Sem categoria"; m.set(k, [...(m.get(k) || []), r]); });
    return Array.from(m.entries());
  }, [rows, cats.items]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><SearchInput value={q} onChange={setQ} placeholder="Buscar serviço…" className="w-full sm:w-72" />
        <select className="input input-sm !w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria"><option value="">Todas as categorias</option>{cats.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      {!rows.length ? <div className="card"><Empty icon={BookOpen} title="Nenhum serviço no catálogo" text="Cadastre serviços na aba Serviços." /></div> : groups.map(([name, list]) => (
        <div key={name} className="card overflow-hidden">
          <div className="px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-accent bg-black/10">{name}</div>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]"><thead><tr><th className="th">Serviço</th><th className="th text-right">Econômico</th><th className="th text-right">Médio</th><th className="th text-right">Premium</th><th className="th text-right">Tempo</th><th className="th">Materiais</th></tr></thead>
            <tbody>{list.map((s) => (
              <tr key={s.id} className="hover:bg-white/[.03] cursor-pointer" onClick={() => ui.openForm("services", s.id)}>
                <td className="td"><div className="font-semibold">{s.name}</div><div className="text-[11px] text-fg3">{s.code}{toNum(s.priceMid) > 0 && ` · margem ${pct(((toNum(s.priceMid) - toNum(s.cost)) / toNum(s.priceMid)) * 100, 0)}`}</div></td>
                <td className="td text-right tabular-nums">{money(s.priceEco)}</td><td className="td text-right tabular-nums font-semibold">{money(s.priceMid)}</td><td className="td text-right tabular-nums">{money(s.pricePrem)}</td>
                <td className="td text-right">{s.avgMinutes ? `${s.avgMinutes} min` : "—"}</td><td className="td text-fg2 text-xs">{(s.materials || []).map((m: { qty: number; unit: string; name: string }) => `${m.qty} ${m.unit} ${m.name}`).join(", ") || "—"}</td>
              </tr>))}</tbody></table></div>
        </div>
      ))}
    </div>
  );
}
