"use client";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Archive, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Copy, Pencil, Plus, RotateCcw, Star, Trash2, ArchiveRestore, Eye } from "lucide-react";
import { db, useActive, useCollection } from "@/lib/data/store";
import { norm, cx } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { Rec } from "@/lib/types";
import { confirmDialog, Empty, Menu, SearchInput, Skeleton, StatusBadge, useMediaQuery, type MenuItem, type StatusDef } from "../ui";
import { useUI, type UIApi } from "../shell/ui-context";
import type { Field, Opt } from "./RecordForm";

export type Column = {
  key: string;
  label: string;
  render?: (r: Rec) => ReactNode;
  sort?: (r: Rec) => string | number;
  align?: "right";
  hidden?: boolean;
};

export type ModuleConfig = {
  collection: string;
  singular: string;
  plural: string;
  gender?: "m" | "f";
  icon: ComponentType<{ size?: number | string; className?: string }>;
  fields: Field[];
  columns: Column[];
  title: (r: Rec) => string;
  subtitle?: (r: Rec) => string;
  searchText?: (r: Rec) => string;
  statusKey?: string;
  statusMap?: Record<string, StatusDef>;
  filters?: { key: string; label: string; options?: Opt[]; collection?: string }[];
  defaults?: () => Record<string, any>;
  beforeSave?: (values: Record<string, any>, existing?: Rec) => Record<string, any> | null;
  afterSave?: (rec: Rec, isNew: boolean, prev?: Rec) => void;
  sort?: { key: string; dir: "asc" | "desc" };
  /** true = exclusão vai para a lixeira (padrão). false = exclusão definitiva com confirmação. */
  softDelete?: boolean;
  noArchive?: boolean;
  noDuplicate?: boolean;
  noFavorite?: boolean;
  detail?: boolean;
  rowActions?: (r: Rec, ui: UIApi) => MenuItem[];
  emptyText?: string;
  formSize?: "md" | "lg";
  extraForm?: (values: Record<string, any>, set: (k: string, v: any) => void) => ReactNode;
  pageSize?: number;
  /** Chave de coleção extra para o formulário customizado (quotes/work_orders). */
  customEditor?: boolean;
  readOnly?: boolean;
};

type View = "active" | "archived" | "trash";

export function CrudView({
  config,
  base,
  toolbar,
  defaults,
  compact,
  hideCreate,
  title,
}: {
  config: ModuleConfig;
  base?: (r: Rec) => boolean;
  toolbar?: ReactNode;
  defaults?: Record<string, any>;
  compact?: boolean;
  hideCreate?: boolean;
  title?: ReactNode;
}) {
  const ui = useUI();
  const { items, loading } = useCollection(config.collection);
  const wide = useMediaQuery("(min-width: 768px)");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("active");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState(config.sort || { key: "_created", dir: "desc" as "asc" | "desc" });
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set(config.columns.filter((c) => c.hidden).map((c) => c.key)));
  const pageSize = config.pageSize || 12;
  const soft = config.softDelete !== false;

  const scoped = useMemo(() => (base ? items.filter(base) : items), [items, base]);
  const counts = useMemo(() => ({
    active: scoped.filter((r) => !r.archived && !r.deletedAt).length,
    archived: scoped.filter((r) => r.archived && !r.deletedAt).length,
    trash: scoped.filter((r) => r.deletedAt).length,
  }), [scoped]);

  const rows = useMemo(() => {
    const nq = norm(q);
    let list = scoped.filter((r) => (view === "trash" ? !!r.deletedAt : view === "archived" ? r.archived && !r.deletedAt : !r.archived && !r.deletedAt));
    if (nq) {
      list = list.filter((r) => norm(config.searchText ? config.searchText(r) : Object.values(r).filter((v) => typeof v === "string" || typeof v === "number").join(" ")).includes(nq));
    }
    for (const [k, v] of Object.entries(filters)) if (v) list = list.filter((r) => String(r[k] ?? "") === v);
    if (statusFilter && config.statusKey) list = list.filter((r) => r[config.statusKey!] === statusFilter);
    const col = config.columns.find((c) => c.key === sort.key);
    const val = (r: Rec): string | number => {
      if (sort.key === "_created") return r.createdAt || "";
      if (col?.sort) return col.sort(r);
      const v = r[sort.key];
      return typeof v === "number" ? v : norm(v);
    };
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
      return sort.dir === "asc" ? c : -c;
    });
  }, [scoped, q, view, filters, statusFilter, sort, config]);

  useEffect(() => setPage(0), [q, view, filters, statusFilter]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);
  const visibleCols = config.columns.filter((c) => !hidden.has(c.key));

  const open = (r: Rec) => config.readOnly ? undefined : (config.detail ? ui.openDetail(config.collection, r.id) : ui.openForm(config.collection, r.id));
  const create = () => ui.openForm(config.collection, null, { ...(defaults || {}) });

  const remove = async (r: Rec) => {
    const label = config.title(r);
    if (soft) {
      if (await confirmDialog({ title: `Mover para a lixeira?`, message: `"${label}" poderá ser restaurado depois na aba Lixeira.`, confirmText: "Mover para lixeira", danger: true })) {
        db.softDelete(config.collection, r.id);
        toast("Movido para a lixeira");
      }
    } else if (await confirmDialog({ title: "Excluir definitivamente?", message: `"${label}" será removido e não poderá ser recuperado.`, confirmText: "Excluir", danger: true })) {
      db.remove(config.collection, r.id);
      toast("Excluído");
    }
  };
  const purge = async (r: Rec) => {
    if (await confirmDialog({ title: "Excluir definitivamente?", message: `"${config.title(r)}" será removido para sempre.`, confirmText: "Excluir definitivamente", danger: true })) {
      db.remove(config.collection, r.id);
    }
  };
  const bulk = async (kind: "archive" | "delete") => {
    const ids = Array.from(sel);
    if (kind === "archive") {
      ids.forEach((id) => db.archive(config.collection, id, true));
      toast(`${ids.length} arquivado(s)`);
    } else if (await confirmDialog({ title: `Excluir ${ids.length} registro(s)?`, message: soft ? "Serão movidos para a lixeira." : "A exclusão é definitiva.", confirmText: "Excluir", danger: true })) {
      ids.forEach((id) => (soft ? db.softDelete(config.collection, id) : db.remove(config.collection, id)));
      toast(`${ids.length} excluído(s)`);
    }
    setSel(new Set());
  };

  const actions = (r: Rec): MenuItem[] => {
    if (config.readOnly) return [];
    if (view === "trash") return [
      { label: "Restaurar", icon: RotateCcw, onClick: () => db.restore(config.collection, r.id) },
      { label: "Excluir definitivamente", icon: Trash2, danger: true, onClick: () => purge(r) },
    ];
    return [
      { label: config.detail ? "Abrir" : "Editar", icon: config.detail ? Eye : Pencil, onClick: () => open(r) },
      config.detail && { label: "Editar dados", icon: Pencil, onClick: () => ui.openForm(config.collection, r.id) },
      ...(config.rowActions ? config.rowActions(r, ui) : []),
      !config.noFavorite && { label: r.favorite ? "Remover dos favoritos" : "Favoritar", icon: Star, onClick: () => db.toggleFavorite(config.collection, r.id) },
      !config.noDuplicate && { label: "Duplicar", icon: Copy, onClick: () => { db.duplicate(config.collection, r.id, config.fields.find((f) => f.key === "name") ? { name: `${r.name} (cópia)` } : config.fields.find((f) => f.key === "title") ? { title: `${r.title} (cópia)` } : {}); toast("Duplicado"); } },
      !config.noArchive && (view === "archived"
        ? { label: "Desarquivar", icon: ArchiveRestore, onClick: () => db.archive(config.collection, r.id, false) }
        : { label: "Arquivar", icon: Archive, onClick: () => { db.archive(config.collection, r.id, true); toast("Arquivado"); } }),
      "sep",
      { label: soft ? "Excluir (lixeira)" : "Excluir", icon: Trash2, danger: true, onClick: () => remove(r) },
    ];
  };

  const statusCounts = useMemo(() => {
    if (!config.statusKey) return {} as Record<string, number>;
    const c: Record<string, number> = {};
    scoped.filter((r) => !r.archived && !r.deletedAt).forEach((r) => (c[r[config.statusKey!]] = (c[r[config.statusKey!]] || 0) + 1));
    return c;
  }, [scoped, config.statusKey]);

  const allSelected = pageRows.length > 0 && pageRows.every((r) => sel.has(r.id));
  const toggleSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {title}
        <SearchInput value={q} onChange={setQ} placeholder={`Pesquisar ${config.plural.toLowerCase()}...`} className="w-full sm:w-64" />
        {config.filters?.map((f) => (
          <FilterSelect key={f.key} f={f} value={filters[f.key] || ""} onChange={(v) => setFilters((s) => ({ ...s, [f.key]: v }))} />
        ))}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          {wide && (
            <Menu label="Colunas" trigger={<Columns3 size={16} />} className="btn btn-sm btn-icon"
              items={config.columns.map((c) => ({ label: `${hidden.has(c.key) ? "   " : "✓  "}${c.label}`, onClick: () => setHidden((h) => { const n = new Set(h); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; }) }))} />
          )}
          {!hideCreate && <button className="btn btn-primary" onClick={create}><Plus size={16} /> {config.gender === "f" ? "Nova" : "Novo"} {config.singular.toLowerCase()}</button>}
        </div>
      </div>

      {/* views + status chips */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex p-0.5 rounded-xl bg-solid2 border border-line text-xs font-semibold">
          {([["active", "Ativos"], ["archived", "Arquivados"], ["trash", "Lixeira"]] as [View, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className={cx("h-7 px-3 rounded-[10px]", view === v ? "bg-solid3 text-fg border border-line2" : "text-fg2 border border-transparent")}>
              {l} <span className="text-fg3">{counts[v]}</span>
            </button>
          ))}
        </div>
        {config.statusKey && config.statusMap && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full">
            <button onClick={() => setStatusFilter("")} className={cx("h-7 px-2.5 rounded-full text-[11px] font-semibold border whitespace-nowrap", !statusFilter ? "bg-accent/15 text-accent border-accent/40" : "border-line text-fg2")}>Todos</button>
            {Object.entries(config.statusMap).map(([k, d]) => (
              <button key={k} onClick={() => setStatusFilter(statusFilter === k ? "" : k)} className={cx("h-7 px-2.5 rounded-full text-[11px] font-semibold border whitespace-nowrap", statusFilter === k ? "bg-accent/15 text-accent border-accent/40" : "border-line text-fg2")}>
                {d.label} {statusCounts[k] ? <span className="text-fg3">{statusCounts[k]}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {sel.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 border border-accent/30 text-sm anim-in">
          <b>{sel.size}</b> selecionado(s)
          <div className="ml-auto flex gap-2">
            {!config.noArchive && view === "active" && <button className="btn btn-sm" onClick={() => bulk("archive")}><Archive size={14} /> Arquivar</button>}
            {view !== "trash" && <button className="btn btn-sm btn-danger" onClick={() => bulk("delete")}><Trash2 size={14} /> Excluir</button>}
            <button className="btn btn-sm btn-ghost" onClick={() => setSel(new Set())}>Limpar</button>
          </div>
        </div>
      )}

      {/* content */}
      {loading && !items.length ? (
        <div className="card p-4 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty icon={config.icon} title={q || Object.values(filters).some(Boolean) || statusFilter ? "Nenhum resultado" : view === "trash" ? "Lixeira vazia" : view === "archived" ? "Nada arquivado" : `Nenhum${config.gender === "f" ? "a" : ""} ${config.singular.toLowerCase()} ainda`}
            text={!q && view === "active" ? config.emptyText : "Ajuste a pesquisa ou os filtros."}
            action={!hideCreate && view === "active" && !q ? <button className="btn btn-primary" onClick={create}><Plus size={16} /> {config.gender === "f" ? "Cadastrar primeira" : "Cadastrar primeiro"}</button> : undefined} />
        </div>
      ) : wide ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-black/10">
                  <th className="th w-10"><input type="checkbox" aria-label="Selecionar todos" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(pageRows.map((r) => r.id)))} /></th>
                  {visibleCols.map((c) => (
                    <th key={c.key} className={cx("th", c.align === "right" && "!text-right")} aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                      <button className="inline-flex items-center gap-1 uppercase tracking-wider font-bold" onClick={() => toggleSort(c.key)}>
                        {c.label}
                        {sort.key === c.key && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                      </button>
                    </th>
                  ))}
                  <th className="th w-12" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[.03] transition cursor-pointer group" onClick={() => view !== "trash" && open(r)}>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label="Selecionar" checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} />
                    </td>
                    {visibleCols.map((c, i) => (
                      <td key={c.key} className={cx("td", c.align === "right" && "text-right tabular-nums")}>
                        {c.render ? c.render(r) : i === 0 ? <span className="font-semibold">{config.title(r)}</span> : String(r[c.key] ?? "—")}
                        {i === 0 && r.favorite && <Star size={12} className="inline ml-1.5 text-warn fill-warn" aria-label="Favorito" />}
                      </td>
                    ))}
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      {!config.readOnly && <Menu trigger={<span className="text-lg leading-none">⋯</span>} items={actions(r)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pageRows.map((r) => (
            <div key={r.id} className="card p-3.5 active:scale-[.99] transition" onClick={() => view !== "trash" && open(r)}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{config.title(r)} {r.favorite && <Star size={12} className="inline text-warn fill-warn" />}</div>
                  {config.subtitle && <div className="text-xs text-fg3 truncate">{config.subtitle(r)}</div>}
                </div>
                {config.statusKey && config.statusMap && <StatusBadge def={config.statusMap[r[config.statusKey]]} />}
                <div onClick={(e) => e.stopPropagation()}><Menu trigger={<span className="text-lg leading-none">⋯</span>} items={actions(r)} /></div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {config.columns.slice(1, 5).filter((c) => c.key !== config.statusKey).map((c) => (
                  <div key={c.key} className="text-xs min-w-0">
                    <span className="text-fg3">{c.label}: </span>
                    <span className="text-fg2">{c.render ? c.render(r) : String(r[c.key] ?? "—")}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length > pageSize && !compact && (
        <div className="flex items-center justify-between text-xs text-fg2">
          <span>{rows.length} registros · página {page + 1} de {pages}</span>
          <div className="flex gap-1.5">
            <button className="btn btn-sm btn-icon" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft size={15} /></button>
            <button className="btn btn-sm btn-icon" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Próxima página"><ChevronRight size={15} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ f, value, onChange }: { f: NonNullable<ModuleConfig["filters"]>[number]; value: string; onChange: (v: string) => void }) {
  return f.collection ? <CollectionFilter f={f} value={value} onChange={onChange} /> : <FilterBox label={f.label} value={value} onChange={onChange} options={f.options || []} />;
}
function CollectionFilter({ f, value, onChange }: { f: NonNullable<ModuleConfig["filters"]>[number]; value: string; onChange: (v: string) => void }) {
  const { items } = useActive(f.collection!);
  return <FilterBox label={f.label} value={value} onChange={onChange} options={items.map((r) => ({ value: r.id, label: r.name || r.title || r.id }))} />;
}
function FilterBox({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Opt[] }) {
  return (
    <select className="input input-sm !w-auto max-w-[170px]" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}: todos</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
