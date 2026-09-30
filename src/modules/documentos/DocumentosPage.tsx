"use client";
import { useMemo, useRef, useState } from "react";
import { Archive, ArrowUpFromLine, Download, Eye, File as FileIcon, FileImage, FilePlus2, FileText, LayoutGrid, List, MoreHorizontal, Pencil, RotateCcw, Save, Send, Trash2, Upload } from "lucide-react";
import { Badge, Empty, Field, Menu, Modal, PageHeader, SearchInput, Segmented, confirmDialog } from "@/components/ui";
import { ImageUpload, useUploader } from "@/components/crud/RecordForm";
import { RefLabel } from "@/components/cells";
import { db, nextNumber, useActive, useCollection } from "@/lib/data/store";
import { DOC_TYPES, PAY_METHODS } from "@/lib/constants";
import { useSettings } from "@/lib/settings";
import { savePdfDocument } from "@/lib/share";
import { syncPublicLink } from "@/lib/workflows";
import { toast } from "@/lib/toast";
import type { Rec } from "@/lib/types";
import { cx, fmtDate, norm, toNum, todayISO } from "@/lib/utils";

const GEN_TYPES = ["recibo", "laudo", "relatorio", "termo_entrega", "termo_garantia", "declaracao", "personalizado"];
const fmtSize = (n?: number) => (!n ? "" : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

export default function DocumentosPage() {
  const { items, loading } = useCollection("documents");
  const customers = useActive("customers");
  const { settings } = useSettings();
  const { upload, busy } = useUploader();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [cust, setCust] = useState("");
  const [view, setView] = useState<"lista" | "grid">("lista");
  const [scope, setScope] = useState<"ativos" | "arquivados" | "lixeira">("ativos");
  const [edit, setEdit] = useState<{ id?: string; type: string } | null>(null);

  const rows = useMemo(() => items.filter((d) => (scope === "lixeira" ? d.deletedAt : scope === "arquivados" ? d.archived && !d.deletedAt : !d.archived && !d.deletedAt))
    .filter((d) => (!type || d.type === type) && (!cust || d.customerId === cust) && (!q || norm([d.title, d.file?.name, d.number, customers.items.find((c) => c.id === d.customerId)?.name].join(" ")).includes(norm(q))))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")), [items, scope, type, cust, q, customers.items]);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      const r = await upload(f, `documents/${todayISO().slice(0, 7)}`);
      if (r) db.create("documents", { kind: "file", type: f.type.startsWith("image/") ? "foto" : "arquivo", title: f.name, customerId: cust || "", file: { url: r.url, path: r.path, name: f.name, type: f.type, size: r.size } });
    }
    toast("Arquivo(s) enviado(s) para o Storage");
  };

  const pdf = async (d: Rec, save = false) => {
    const { buildPdf, docSpec, companyOf } = await import("@/lib/pdf");
    const os = d.workOrderId ? db.get("work_orders", d.workOrderId) : undefined;
    const doc = await buildPdf(docSpec(d, db.get("customers", d.customerId), settings, os), companyOf(settings), settings.pdfTemplate);
    if (save) { await savePdfDocument(doc, { folder: `documents/${d.id}`, filename: `${(d.title || d.type).replace(/[^\w\-]+/g, "_")}.pdf`, title: `${d.title} (PDF)`, type: d.type, customerId: d.customerId, workOrderId: d.workOrderId }); toast("Cópia em PDF salva no Storage"); }
    else doc.save(`${(d.title || d.type).replace(/[^\w\-]+/g, "_")}.pdf`);
  };
  const purge = async (d: Rec) => { if (await confirmDialog({ title: "Excluir definitivamente?", message: "O arquivo também será removido do Storage.", confirmText: "Excluir", danger: true })) { if (d.file) db.removeFile({ path: d.file.path, url: d.file.url }); db.remove("documents", d.id); } };

  const menu = (d: Rec) => scope === "lixeira" ? [{ label: "Restaurar", icon: RotateCcw, onClick: () => db.restore("documents", d.id) }, { label: "Excluir definitivamente", icon: Trash2, danger: true, onClick: () => purge(d) }] : [
    d.kind === "file" ? { label: "Visualizar", icon: Eye, onClick: () => window.open(d.file.url, "_blank") } : { label: "Editar", icon: Pencil, onClick: () => setEdit({ id: d.id, type: d.type }) },
    d.kind === "file" ? { label: "Baixar", icon: Download, onClick: () => window.open(d.file.url, "_blank") } : { label: "Gerar PDF", icon: Download, onClick: () => pdf(d) },
    d.kind !== "file" && { label: "Guardar cópia PDF no Storage", icon: Save, onClick: () => pdf(d, true) },
    d.kind === "file" && d.workOrderId && { label: d.released ? "Ocultar do portal do cliente" : "Liberar no portal do cliente", icon: Send, onClick: () => { db.update("documents", d.id, { released: !d.released }, { silent: true }); const os = db.get("work_orders", d.workOrderId); if (os) setTimeout(() => syncPublicLink("work_order", os), 100); } },
    { label: d.favorite ? "Remover favorito" : "Favoritar", icon: FileText, onClick: () => db.toggleFavorite("documents", d.id) },
    { label: d.archived ? "Desarquivar" : "Arquivar", icon: Archive, onClick: () => db.archive("documents", d.id, !d.archived) },
    "sep" as const,
    { label: "Excluir (lixeira)", icon: Trash2, danger: true, onClick: async () => { if (await confirmDialog({ title: "Mover para a lixeira?", confirmText: "Excluir", danger: true })) db.softDelete("documents", d.id); } },
  ];

  const Icon = ({ d, big }: { d: Rec; big?: boolean }) => (d.file?.type?.startsWith("image/") && d.file?.url && big ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={d.file.url} alt={d.title} loading="lazy" className="w-full h-full object-cover" />
  ) : d.type === "foto" ? <FileImage size={big ? 34 : 18} className="text-fg3" /> : d.kind === "file" ? <FileIcon size={big ? 34 : 18} className="text-fg3" /> : <FileText size={big ? 34 : 18} className="text-accent" />);

  return (
    <>
      <PageHeader title="Documentos" subtitle="Central de arquivos e geração de documentos com PDF: recibos, laudos, termos, declarações e relatórios."
        actions={<>
          <Menu label="Novo documento" className="btn btn-primary" trigger={<><FilePlus2 size={16} /> Novo documento</>} items={GEN_TYPES.map((t) => ({ label: DOC_TYPES[t], icon: FileText, onClick: () => setEdit({ type: t }) }))} />
          <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={15} /> {busy ? "Enviando…" : "Enviar arquivo"}</button>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        </>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchInput value={q} onChange={setQ} placeholder="Pesquisar documentos…" className="w-full sm:w-64" />
        <select className="input input-sm !w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option>{Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="input input-sm !w-auto max-w-[180px]" value={cust} onChange={(e) => setCust(e.target.value)} aria-label="Cliente"><option value="">Todos os clientes</option>{customers.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <Segmented<typeof scope> small value={scope} onChange={setScope} options={[{ id: "ativos", label: "Ativos" }, { id: "arquivados", label: "Arquivados" }, { id: "lixeira", label: "Lixeira" }]} />
        <div className="ml-auto"><Segmented<typeof view> small value={view} onChange={setView} options={[{ id: "lista", label: <List size={14} /> }, { id: "grid", label: <LayoutGrid size={14} /> }]} /></div>
      </div>
      {!rows.length && !loading ? <div className="card"><Empty icon={FileText} title="Nenhum documento" text="Gere um recibo/laudo/termo ou envie arquivos. Tudo fica organizado por empresa no Cloud Storage." /></div> : view === "lista" ? (
        <div className="card divide-y divide-line">
          {rows.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 h-[60px] hover:bg-white/[.03]">
              <span className="size-9 rounded-xl bg-solid2 grid place-items-center overflow-hidden shrink-0"><Icon d={d} /></span>
              <button className="min-w-0 flex-1 text-left" onClick={() => (d.kind === "file" ? window.open(d.file.url, "_blank") : setEdit({ id: d.id, type: d.type }))}>
                <div className="text-[13.5px] font-semibold truncate">{d.title || d.file?.name}</div>
                <div className="text-[11px] text-fg3 truncate">{DOC_TYPES[d.type] || d.type} · {fmtDate(d.createdAt)} {d.customerId && <>· <RefLabel collection="customers" id={d.customerId} /></>} {d.file?.size ? `· ${fmtSize(d.file.size)}` : ""}</div>
              </button>
              {d.released && <Badge tone="violet">no portal</Badge>}{d.kind !== "file" && <Badge tone="info">PDF</Badge>}
              <Menu items={menu(d)} trigger={<MoreHorizontal size={16} />} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {rows.map((d) => (
            <div key={d.id} className="card overflow-hidden group">
              <button className={cx("w-full aspect-[4/3] grid place-items-center bg-solid2 overflow-hidden")} onClick={() => (d.kind === "file" ? window.open(d.file.url, "_blank") : setEdit({ id: d.id, type: d.type }))}><Icon d={d} big /></button>
              <div className="p-2.5 flex items-start gap-1"><div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold truncate">{d.title || d.file?.name}</div><div className="text-[10.5px] text-fg3">{DOC_TYPES[d.type] || d.type} · {fmtDate(d.createdAt)}</div></div><Menu items={menu(d)} trigger={<MoreHorizontal size={15} />} /></div>
            </div>
          ))}
        </div>
      )}
      {edit && <DocForm type={edit.type} id={edit.id} onClose={() => setEdit(null)} onPdf={pdf} />}
      <span className="hidden"><ArrowUpFromLine /></span>
    </>
  );
}

function DocForm({ type: t0, id, onClose, onPdf }: { type: string; id?: string; onClose: () => void; onPdf: (d: Rec, save?: boolean) => void }) {
  const existing = id ? db.get("documents", id) : undefined;
  const customers = useActive("customers");
  const orders = useActive("work_orders");
  const all = useCollection("documents");
  const { settings } = useSettings();
  const [type, setType] = useState(existing?.type || t0);
  const [f, setF] = useState<Record<string, any>>({ title: existing?.title || "", customerId: existing?.customerId || "", workOrderId: existing?.workOrderId || "", content: { date: todayISO(), method: "pix", responsible: settings.responsible, ...(existing?.content || {}) }, photos: existing?.photos || [] });
  const c = f.content;
  const setC = (k: string, v: unknown) => setF((s) => ({ ...s, content: { ...s.content, [k]: v } }));
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const { upload, busy } = useUploader();
  const myOrders = orders.items.filter((o) => !f.customerId || o.customerId === f.customerId);
  const ta = (k: string, label: string, rows = 3) => <Field label={label} className="sm:col-span-2"><textarea className="input" rows={rows} value={c[k] || ""} onChange={(e) => setC(k, e.target.value)} /></Field>;

  const save = (gen: boolean) => {
    const title = f.title || `${DOC_TYPES[type]}${customers.items.find((x) => x.id === f.customerId) ? " — " + customers.items.find((x) => x.id === f.customerId)!.name : ""}`;
    const content = type === "recibo" ? { ...c, amount: toNum(c.amount) } : c;
    if (type === "recibo" && toNum(c.amount) <= 0) return toast("Informe o valor do recibo", "error");
    const data = { kind: "generated", type, title, customerId: f.customerId, workOrderId: f.workOrderId, content, photos: f.photos };
    const rec = existing ? db.update("documents", existing.id, data) : db.create("documents", { ...data, number: nextNumber("DOC", all.items) });
    toast("Documento salvo");
    if (gen && rec) onPdf(rec);
    onClose();
  };

  return (
    <Modal open onClose={onClose} size="lg" title={`${existing ? "Editar" : "Novo"} — ${DOC_TYPES[type]}`} subtitle="Preencha e gere o PDF profissional"
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn" onClick={() => save(false)}>Salvar</button><button className="btn btn-primary" onClick={() => save(true)}><Download size={15} /> Salvar e gerar PDF</button></>}>
      <div className="grid sm:grid-cols-2 gap-3.5">
        {!existing && <Field label="Tipo"><select className="input" value={type} onChange={(e) => setType(e.target.value)}>{GEN_TYPES.map((k) => <option key={k} value={k}>{DOC_TYPES[k]}</option>)}</select></Field>}
        <Field label="Título"><input className="input" value={f.title} placeholder={DOC_TYPES[type]} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Cliente"><select className="input" value={f.customerId} onChange={(e) => set("customerId", e.target.value)}><option value="">—</option>{customers.items.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="OS relacionada"><select className="input" value={f.workOrderId} onChange={(e) => set("workOrderId", e.target.value)}><option value="">—</option>{myOrders.map((o) => <option key={o.id} value={o.id}>{o.number} — {o.title}</option>)}</select></Field>
        <Field label="Data"><input className="input" type="date" value={c.date || ""} onChange={(e) => setC("date", e.target.value)} /></Field>
        {type === "recibo" && <>
          <Field label="Valor (R$)"><input className="input" type="number" step="0.01" value={c.amount || ""} onChange={(e) => setC("amount", e.target.value)} /></Field>
          <Field label="Forma de pagamento"><select className="input" value={c.method} onChange={(e) => setC("method", e.target.value)}>{Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Referente a" className="sm:col-span-2"><input className="input" value={c.description || ""} onChange={(e) => setC("description", e.target.value)} /></Field>
        </>}
        {type === "laudo" && <>
          <Field label="Local"><input className="input" value={c.local || ""} onChange={(e) => setC("local", e.target.value)} /></Field>
          <Field label="Equipamento"><input className="input" value={c.equipment || ""} onChange={(e) => setC("equipment", e.target.value)} /></Field>
          {ta("problem", "Problema")}{ta("diagnosis", "Diagnóstico")}{ta("tests", "Testes realizados")}{ta("result", "Resultado")}{ta("recommendation", "Recomendação")}{ta("notes", "Observações", 2)}
          <Field label="Responsável"><input className="input" value={c.responsible || ""} onChange={(e) => setC("responsible", e.target.value)} /></Field>
          <Field label="Fotos do laudo" className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">{f.photos.map((p: Rec, i: number) => (
              <div key={i} className="relative size-16 rounded-xl overflow-hidden border border-line2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="size-full object-cover" />
                <button className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/60 text-white text-xs" aria-label="Remover foto" onClick={() => set("photos", f.photos.filter((_: Rec, j: number) => j !== i))}>×</button>
              </div>
            ))}
              <ImageUpload url="" folder={`documents/laudos`} label="Foto" onChange={(v) => v && set("photos", [...f.photos, { url: v.url, path: v.path }])} /></div>
            {busy && <span className="text-xs text-fg3">Enviando…</span>}
          </Field>
        </>}
        {type === "termo_garantia" && <Field label="Prazo de garantia"><input className="input" placeholder="Ex.: 90 dias" value={c.period || ""} onChange={(e) => setC("period", e.target.value)} /></Field>}
        {["termo_entrega", "termo_garantia", "declaracao", "personalizado", "relatorio"].includes(type) && ta("body", type === "personalizado" ? "Conteúdo" : "Texto (deixe em branco para usar o texto padrão)", 8)}
      </div>
      <span className="hidden">{String(upload)}</span>
    </Modal>
  );
}
