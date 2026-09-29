"use client";
import { useRouter } from "next/navigation";
import { Clock, Trash2 } from "lucide-react";
import { Empty, PageHeader } from "@/components/ui";
import { openEntity, useUI } from "@/components/shell/ui-context";
import { db, useCollection } from "@/lib/data/store";
import { SINGULAR } from "@/lib/labels";
import { fmtDateTime } from "@/lib/utils";

export default function RecentsPage() {
  const ui = useUI();
  const router = useRouter();
  const { items } = useCollection("settings");
  const list: { col: string; id: string; label: string; at: string }[] = items.find((r) => r.id === "recents")?.items || [];
  return (
    <>
      <PageHeader title="Recentes" subtitle="Últimos registros que você abriu." actions={list.length > 0 && <button className="btn" onClick={() => db.upsert("settings", "recents", { items: [] })}><Trash2 size={15} /> Limpar</button>} />
      {!list.length ? <div className="card"><Empty icon={Clock} title="Nada por aqui ainda" text="Clientes, OS e orçamentos que você abrir aparecem aqui." /></div> : (
        <div className="card divide-y divide-line">{list.map((r) => (
          <button key={r.col + r.id} className="w-full flex items-center gap-3 px-4 h-14 text-left hover:bg-white/[.03]" onClick={() => (r.col === "notes" ? router.push(`/anotacoes?open=${r.id}`) : openEntity(ui, r))}>
            <Clock size={16} className="text-fg3" /><div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{r.label || "(sem nome)"}</div><div className="text-xs text-fg3 capitalize">{SINGULAR[r.col] || r.col}</div></div><span className="text-xs text-fg3">{fmtDateTime(r.at)}</span>
          </button>))}</div>
      )}
    </>
  );
}
