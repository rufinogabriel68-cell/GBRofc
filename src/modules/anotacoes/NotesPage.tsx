"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, CheckSquare, Link2, Pin, PinOff, Plus, Star, StickyNote, Trash2, ArchiveRestore, X } from "lucide-react";
import { Drawer, Empty, PageHeader, SearchInput, confirmDialog } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { db, useActive, useCollection } from "@/lib/data/store";
import { useQueryParam } from "@/lib/hooks";
import { useMediaQuery } from "@/components/ui";
import type { Rec } from "@/lib/types";
import { cx, fmtDateTime, newId, norm } from "@/lib/utils";

const LINKS: [string, string, string][] = [["customerId", "Cliente", "customers"], ["workOrderId", "OS", "work_orders"], ["quoteId", "Orçamento", "quotes"], ["serviceId", "Serviço", "services"]];

export default function NotesPage() {
  const { items, loading } = useCollection("notes");
  const wide = useMediaQuery("(min-width: 768px)");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [showArch, setShowArch] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [isNew, clearNew] = useQueryParam("new");
  const [open, clearOpen] = useQueryParam("open");

  const create = () => { const n = db.create("notes", { title: "", body: "", checklist: [], tags: [], pinned: false }); setSel(n.id); };
  useEffect(() => {
    if (!isNew) return;
    // Cria a nota um tick depois de o parâmetro chegar e limpa a URL.
    const t = window.setTimeout(() => { create(); clearNew(); }, 0);
    return () => window.clearTimeout(t);
  }, [isNew]); // eslint-disable-line react-hooks/exhaustive-deps
  // Seleciona a nota de ?open= quando o parâmetro chega (ajuste durante a renderização).
  const [consumedOpen, setConsumedOpen] = useState("");
  if (open && open !== consumedOpen) {
    setConsumedOpen(open);
    setSel(open);
  }
  useEffect(() => { if (open && open === consumedOpen) clearOpen(); }, [open, consumedOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const tags = useMemo(() => [...new Set(items.filter((n) => !n.deletedAt).flatMap((n) => n.tags || []))], [items]);
  const list = useMemo(() => items.filter((n) => !n.deletedAt && !!n.archived === showArch && (!tag || (n.tags || []).includes(tag)) && (!q || norm([n.title, n.body, (n.tags || []).join(" "), (n.checklist || []).map((c: Rec) => c.text).join(" ")].join(" ")).includes(norm(q))))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.updatedAt || "").localeCompare(a.updatedAt || "")), [items, q, tag, showArch]);
  const cur = items.find((n) => n.id === sel && !n.deletedAt);

  const List = (
    <div className="space-y-2">
      {list.map((n) => (
        <button key={n.id} onClick={() => setSel(n.id)} className={cx("w-full text-left card-solid p-3 hover:border-line2 transition", sel === n.id && "!border-accent/60 bg-accent/5")}>
          <div className="flex items-center gap-1.5"><span className="font-semibold text-[13.5px] truncate flex-1">{n.title || "Sem título"}</span>{n.pinned && <Pin size={12} className="text-accent" />}{n.favorite && <Star size={12} className="text-warn fill-warn" />}</div>
          <div className="text-xs text-fg3 line-clamp-2 mt-0.5">{n.body || (n.checklist || []).map((c: Rec) => c.text).join(", ") || "Nota vazia"}</div>
          <div className="text-[10.5px] text-fg3 mt-1.5 flex flex-wrap gap-1 items-center">{fmtDateTime(n.updatedAt)}{(n.tags || []).map((t: string) => <span key={t} className="px-1.5 rounded bg-white/5">#{t}</span>)}</div>
        </button>
      ))}
      {!list.length && !loading && <Empty icon={StickyNote} title={showArch ? "Nada arquivado" : "Nenhuma anotação"} text="Textos, checklists e etiquetas — vinculáveis a clientes, OS, orçamentos e serviços." action={!showArch ? <button className="btn btn-primary btn-sm" onClick={create}><Plus size={14} /> Nova anotação</button> : undefined} />}
    </div>
  );

  return (
    <>
      <PageHeader title="Anotações" subtitle="Notas com texto, checklist, etiquetas e vínculo com registros." actions={<button className="btn btn-primary" onClick={create}><Plus size={16} /> Nova anotação</button>} />
      <div className="grid md:grid-cols-[340px_1fr] gap-4 items-start">
        <div className="space-y-3">
          <SearchInput value={q} onChange={setQ} placeholder="Pesquisar anotações…" />
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setShowArch(!showArch)} className={cx("h-7 px-2.5 rounded-full text-[11px] font-semibold border", showArch ? "bg-accent/15 border-accent/40 text-accent" : "border-line text-fg2")}><Archive size={11} className="inline mr-1" />Arquivadas</button>
            {tags.map((t) => <button key={t} onClick={() => setTag(tag === t ? "" : t)} className={cx("h-7 px-2.5 rounded-full text-[11px] font-semibold border", tag === t ? "bg-accent/15 border-accent/40 text-accent" : "border-line text-fg2")}>#{t}</button>)}
          </div>
          {List}
        </div>
        {wide ? (cur ? <Editor key={cur.id} note={cur} onClose={() => setSel(null)} /> : <div className="card hidden md:block"><Empty icon={StickyNote} title="Selecione ou crie uma anotação" /></div>) : (
          cur && <Drawer open onClose={() => setSel(null)} title="Anotação" size="md"><div className="p-4"><Editor key={cur.id} note={cur} onClose={() => setSel(null)} /></div></Drawer>
        )}
      </div>
    </>
  );
}

function Editor({ note, onClose }: { note: Rec; onClose: () => void }) {
  const ui = useUI();
  const [n, setN] = useState<Rec>(note);
  const [item, setItem] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customers = useActive("customers"), orders = useActive("work_orders"), quotes = useActive("quotes"), services = useActive("services");
  const pools: Record<string, Rec[]> = { customers: customers.items, work_orders: orders.items, quotes: quotes.items, services: services.items };
  const linkKey = LINKS.find(([k]) => n[k])?.[0] || "";
  const [lk, setLk] = useState(linkKey);

  const patch = (p: Partial<Rec>, immediate = false) => {
    setN((s) => ({ ...s, ...p }));
    if (timer.current) clearTimeout(timer.current);
    const go = () => db.update("notes", note.id, p, { silent: true });
    if (immediate) go(); else timer.current = setTimeout(go, 500);
  };
  // salva o que sobrou ao trocar de nota
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const check: Rec[] = n.checklist || [];
  const lkDef = LINKS.find(([k]) => k === lk);
  return (
    <div className="card p-4 sm:p-5 space-y-3.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button className="btn btn-ghost btn-icon btn-sm md:hidden" onClick={onClose} aria-label="Voltar"><ArrowLeft size={16} /></button>
        <input className="bg-transparent outline-none text-xl font-bold flex-1 min-w-0" placeholder="Título" value={n.title || ""} onChange={(e) => patch({ title: e.target.value })} />
        <button className="btn btn-ghost btn-icon btn-sm" aria-label={n.pinned ? "Desafixar" : "Fixar"} title={n.pinned ? "Desafixar" : "Fixar"} onClick={() => patch({ pinned: !n.pinned }, true)}>{n.pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label="Favoritar" onClick={() => patch({ favorite: !n.favorite }, true)}><Star size={16} className={n.favorite ? "text-warn fill-warn" : ""} /></button>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label={n.archived ? "Desarquivar" : "Arquivar"} onClick={() => { patch({ archived: !n.archived }, true); onClose(); }}>{n.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</button>
        <button className="btn btn-ghost btn-icon btn-sm btn-danger" aria-label="Excluir" onClick={async () => { if (await confirmDialog({ title: "Excluir anotação?", message: "Ela vai para a lixeira.", confirmText: "Excluir", danger: true })) { db.softDelete("notes", note.id); onClose(); } }}><Trash2 size={16} /></button>
      </div>
      <textarea className="input !bg-transparent !border-transparent hover:!border-line focus:!border-accent min-h-[160px]" placeholder="Escreva sua anotação…" value={n.body || ""} onChange={(e) => patch({ body: e.target.value })} />
      <div>
        <div className="text-[11px] font-bold uppercase text-fg3 mb-1.5 flex items-center gap-1.5"><CheckSquare size={12} /> Checklist</div>
        <div className="space-y-1">{check.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 group">
            <input type="checkbox" checked={!!c.done} onChange={() => patch({ checklist: check.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) }, true)} aria-label={c.text} />
            <input className={cx("flex-1 bg-transparent outline-none text-sm", c.done && "line-through text-fg3")} value={c.text} onChange={(e) => patch({ checklist: check.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })} />
            <button className="opacity-0 group-hover:opacity-100 text-fg3 hover:text-bad" aria-label="Remover item" onClick={() => patch({ checklist: check.filter((x) => x.id !== c.id) }, true)}><X size={14} /></button>
          </div>))}</div>
        <input className="input input-sm mt-2" placeholder="+ Novo item (Enter)" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && item.trim()) { patch({ checklist: [...check, { id: newId(), text: item.trim(), done: false }] }, true); setItem(""); } }} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block"><span className="label">Etiquetas</span><input className="input input-sm" placeholder="ex.: urgente, compras" defaultValue={(n.tags || []).join(", ")} onBlur={(e) => patch({ tags: e.target.value.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean) }, true)} /></label>
        <div><span className="label flex items-center gap-1"><Link2 size={11} /> Vincular a</span>
          <div className="flex gap-1.5">
            <select className="input input-sm !w-28" value={lk} onChange={(e) => { setLk(e.target.value); patch({ customerId: "", workOrderId: "", quoteId: "", serviceId: "" }, true); }} aria-label="Tipo de vínculo"><option value="">Nenhum</option>{LINKS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            {lkDef && <select className="input input-sm" value={n[lkDef[0]] || ""} onChange={(e) => patch({ [lkDef[0]]: e.target.value }, true)} aria-label="Registro"><option value="">Selecione…</option>{(pools[lkDef[2]] || []).map((r) => <option key={r.id} value={r.id}>{r.name || `${r.number} — ${r.title}`}</option>)}</select>}
            {lkDef && n[lkDef[0]] && <button className="btn btn-sm" onClick={() => (lkDef[2] === "services" ? ui.openForm("services", n[lkDef[0]]) : ui.openDetail(lkDef[2], n[lkDef[0]]))}>Abrir</button>}
          </div></div>
      </div>
      <div className="text-[11px] text-fg3">Salvo automaticamente · atualizado {fmtDateTime(n.updatedAt)}</div>
    </div>
  );
}
