"use client";
import { useRouter } from "next/navigation";
import { Star, Users, ClipboardList, FileText, Wrench, StickyNote } from "lucide-react";
import { Empty, PageHeader, Panel } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { db, useActive } from "@/lib/data/store";
import { money } from "@/lib/utils";
import type { Rec } from "@/lib/types";

export default function FavoritesPage() {
  const ui = useUI();
  const router = useRouter();
  const customers = useActive("customers"), orders = useActive("work_orders"), quotes = useActive("quotes"), services = useActive("services"), notes = useActive("notes");
  const groups: { title: string; icon: typeof Star; col: string; items: Rec[]; label: (r: Rec) => string; hint: (r: Rec) => string; open: (r: Rec) => void }[] = [
    { title: "Clientes", icon: Users, col: "customers", items: customers.items, label: (r) => r.name, hint: (r) => r.phone || "", open: (r) => ui.openDetail("customers", r.id) },
    { title: "Ordens de serviço", icon: ClipboardList, col: "work_orders", items: orders.items, label: (r) => `${r.number} — ${r.title}`, hint: (r) => money(r.total), open: (r) => ui.openDetail("work_orders", r.id) },
    { title: "Orçamentos", icon: FileText, col: "quotes", items: quotes.items, label: (r) => `${r.number} — ${r.title}`, hint: (r) => money(r.total), open: (r) => ui.openDetail("quotes", r.id) },
    { title: "Serviços", icon: Wrench, col: "services", items: services.items, label: (r) => r.name, hint: (r) => money(r.priceMid), open: (r) => ui.openForm("services", r.id) },
    { title: "Anotações", icon: StickyNote, col: "notes", items: notes.items, label: (r) => r.title || "Sem título", hint: (r) => String(r.body || "").slice(0, 40), open: (r) => router.push(`/anotacoes?open=${r.id}`) },
  ];
  const total = groups.reduce((a, g) => a + g.items.filter((r) => r.favorite).length, 0);
  return (
    <>
      <PageHeader title="Favoritos" subtitle="Acesso rápido aos registros que você marcou com estrela." />
      {!total ? <div className="card"><Empty icon={Star} title="Nenhum favorito ainda" text="Use “Favoritar” no menu ⋯ de clientes, OS, orçamentos, serviços e anotações." /></div> : (
        <div className="grid md:grid-cols-2 gap-4">
          {groups.map((g) => { const list = g.items.filter((r) => r.favorite); return list.length ? (
            <Panel key={g.col} title={g.title} icon={g.icon}>
              <div className="space-y-1">{list.map((r) => <div key={r.id} className="flex items-center gap-2 group"><button className="flex-1 min-w-0 text-left px-2 py-2 rounded-xl hover:bg-white/5" onClick={() => g.open(r)}><div className="text-sm font-semibold truncate">{g.label(r)}</div><div className="text-xs text-fg3 truncate">{g.hint(r)}</div></button><button aria-label="Remover dos favoritos" className="text-warn" onClick={() => db.toggleFavorite(g.col, r.id)}><Star size={15} className="fill-warn" /></button></div>)}</div>
            </Panel>) : null; })}
        </div>
      )}
    </>
  );
}
