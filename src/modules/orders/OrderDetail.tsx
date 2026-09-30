"use client";
import { useMemo, useRef, useState } from "react";
import {
  Archive, Camera, CheckCircle2, Copy, ExternalLink, FileDown, FileImage, ImagePlus, Link2, Link2Off, ListChecks, MapPin, MessageCircle, MoreHorizontal, Navigation, Package, Pencil, Plus, Receipt, Send, Smartphone, Trash2, Truck, Wallet, Wrench, ClipboardList, PlusCircle, Clock, Paperclip,
} from "lucide-react";
import { Drawer, Menu, Modal, Spinner, StatusBadge, Tabs, confirmDialog, Badge } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { useUploader } from "@/components/crud/RecordForm";
import { db, useActive, useCollection, useRecord } from "@/lib/data/store";
import { OS_CLOSED, OS_STATUS, PAY_METHODS, TXN_STATUS, PDF_TEMPLATES, opts } from "@/lib/constants";
import { useSettings } from "@/lib/settings";
import { txnStatus } from "@/lib/finance";
import { addAdditional, addOrderMaterial, createPublicLink, decideAdditional, ensureReceivable, publicUrl, registerPayment, removeOrderMaterial, revokePublicLink, saveOrder, sendCompanyMessage, setOrderStatus } from "@/lib/workflows";
import { prepareShare, savePdfDocument } from "@/lib/share";
import { travelFee, emptyLine, computePricing } from "@/lib/calc";
import { toast } from "@/lib/toast";
import { COMPANY_ID } from "@/lib/session";
import type { PricingLine, Rec } from "@/lib/types";
import { cx, fmtDate, fmtDateTime, money, newId, toNum, todayISO } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { PricingSummary } from "../PricingBuilder";

type Tab = "resumo" | "execucao" | "materiais" | "fotos" | "adicionais" | "chat" | "financeiro" | "rota" | "historico";
const FLOW: Record<string, { to: string; label: string }[]> = {
  aberta: [{ to: "agendada", label: "Marcar como agendada" }, { to: "deslocamento", label: "Iniciar deslocamento" }, { to: "execucao", label: "Iniciar execução" }],
  agendada: [{ to: "deslocamento", label: "Iniciar deslocamento" }, { to: "execucao", label: "Iniciar execução" }],
  deslocamento: [{ to: "execucao", label: "Iniciar execução" }],
  execucao: [{ to: "aguardando_material", label: "Aguardando material" }, { to: "aguardando_cliente", label: "Aguardando cliente" }],
  aguardando_material: [{ to: "execucao", label: "Retomar execução" }],
  aguardando_cliente: [{ to: "execucao", label: "Retomar execução" }],
  aguardando_aprovacao: [{ to: "execucao", label: "Retomar execução" }],
  concluida: [{ to: "faturada", label: "Marcar como faturada" }],
};

export default function OrderDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const ui = useUI();
  const { settings } = useSettings();
  const { rec: o, loading } = useRecord("work_orders", id);
  const { rec: cust } = useRecord("customers", o?.customerId);
  const { rec: link } = useRecord("public_links", o?.publicToken);
  const [tab, setTab] = useState<Tab>("resumo");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tpl, setTpl] = useState("");

  if (!o) return <Drawer open onClose={onClose} title="Ordem de serviço">{loading ? <div className="grid place-items-center h-64"><Spinner size={26} /></div> : <p className="p-6 text-sm text-fg3">OS não encontrada.</p>}</Drawer>;

  const closed = OS_CLOSED.includes(o.status);
  const pdf = async (save = false) => {
    setBusy(true);
    try {
      const { buildPdf, orderSpec, companyOf } = await import("@/lib/pdf");
      const doc = await buildPdf(orderSpec(o, cust, settings), companyOf(settings), tpl || settings.pdfTemplate);
      if (save) { await savePdfDocument(doc, { folder: `work-orders/${o.id}`, filename: `${o.number}.pdf`, title: `OS ${o.number}`, type: "relatorio", customerId: o.customerId, workOrderId: o.id }); toast("PDF salvo na Central de Documentos"); }
      else doc.save(`${o.number}.pdf`);
    } catch (e) { toast(e instanceof Error ? e.message : "Erro ao gerar PDF", "error"); } finally { setBusy(false); }
  };
  const share = async (via: "whatsapp" | "copy", key?: string) => {
    setBusy(true);
    try {
      const p = await prepareShare("work_order", o, key);
      if (via === "copy") { await navigator.clipboard.writeText(p.url); toast("Link do cliente copiado"); } else window.open(waLink(p.phone, p.text), "_blank");
    } finally { setBusy(false); }
  };
  const linkActive = link && link.status !== "revoked";

  return (
    <Drawer open onClose={onClose} size="xl" title={<span className="flex items-center gap-2 flex-wrap">{o.number} <StatusBadge def={OS_STATUS[o.status]} /></span>} subtitle={`${cust?.name || "—"} · ${o.title || ""}`}
      actions={
        <>
          <a className="btn btn-sm hidden sm:inline-flex" href={`/ordens-de-servico/${o.id}/tecnico`}><Smartphone size={14} /> Modo técnico</a>
          <Menu label="Mais ações" trigger={<MoreHorizontal size={17} />} items={[
            { label: "Editar OS", icon: Pencil, onClick: () => ui.openForm("work_orders", o.id) },
            { label: "Modo técnico", icon: Smartphone, onClick: () => (window.location.href = `/ordens-de-servico/${o.id}/tecnico`) },
            { label: "Gerar PDF", icon: FileDown, onClick: () => pdf(false) },
            { label: "Salvar PDF na Central", icon: FileDown, onClick: () => pdf(true) },
            { label: "Duplicar", icon: Copy, onClick: () => { const d = db.duplicate("work_orders", o.id, { number: `${o.number}-cópia`, status: "aberta", materials: [], additionals: [], history: [], date: "", quoteId: null, publicToken: null }); if (d) { toast("Duplicada"); ui.openDetail("work_orders", d.id); } } },
            { label: o.archived ? "Desarquivar" : "Arquivar", icon: Archive, onClick: () => db.archive("work_orders", o.id, !o.archived) },
            linkActive && { label: "Revogar link do cliente", icon: Link2Off, onClick: async () => { if (await confirmDialog({ title: "Revogar link?", message: "O cliente perderá o acesso ao portal desta OS.", confirmText: "Revogar", danger: true })) revokePublicLink("work_orders", o); } },
            "sep",
            { label: "Mover para a lixeira", icon: Trash2, danger: true, onClick: async () => { if (await confirmDialog({ title: "Mover para a lixeira?", message: `${o.number} poderá ser restaurada depois.`, confirmText: "Excluir", danger: true })) { db.softDelete("work_orders", o.id); onClose(); } } },
          ]} />
        </>
      }>
      <div className="px-4 sm:px-5 pt-4"><Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "resumo", label: "Resumo", icon: ClipboardList }, { id: "execucao", label: "Execução", icon: ListChecks }, { id: "materiais", label: "Materiais", icon: Package },
        { id: "fotos", label: "Fotos e arquivos", icon: FileImage }, { id: "adicionais", label: "Adicionais", icon: PlusCircle, count: (o.additionals || []).filter((a: Rec) => a.status === "aguardando").length },
        { id: "chat", label: "Chat", icon: MessageCircle }, { id: "financeiro", label: "Financeiro", icon: Wallet }, { id: "rota", label: "Rota", icon: MapPin }, { id: "historico", label: "Histórico", icon: Clock },
      ]} /></div>
      <div className="p-4 sm:p-5">
        {tab === "resumo" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(FLOW[o.status] || []).map((f) => <button key={f.to} className="btn" onClick={() => setOrderStatus(o, f.to)}>{f.label}</button>)}
              {!closed && <button className="btn btn-primary" onClick={() => setComplete(true)}><CheckCircle2 size={16} /> Concluir OS</button>}
              <select className="input input-sm !w-auto ml-auto" value={o.status} onChange={(e) => (e.target.value === "concluida" ? setComplete(true) : setOrderStatus(o, e.target.value))} aria-label="Status da OS">{opts(OS_STATUS).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Info label="Cliente" value={<button className="text-left hover:text-accent font-semibold" onClick={() => o.customerId && ui.openDetail("customers", o.customerId)}>{cust?.name || "—"}</button>} sub={cust?.whatsapp || cust?.phone} />
              <Info label="Agenda" value={o.date ? `${fmtDate(o.date)} ${o.time || ""}` : "Não agendada"} sub={o.technician ? `Técnico: ${o.technician}` : ""} />
              <Info label="Endereço" value={o.address || "—"} />
              <Info label="Origem" value={o.quoteId ? <button className="hover:text-accent font-semibold" onClick={() => ui.openDetail("quotes", o.quoteId)}>Orçamento de origem <ExternalLink size={12} className="inline" /></button> : "Criada manualmente"} sub={`Garantia ${toNum(o.warrantyDays)} dia(s) · manutenção em ${toNum(o.nextMaintenanceMonths)} mês(es)`} />
            </div>
            {o.description && <p className="text-sm text-fg2 whitespace-pre-wrap">{o.description}</p>}
            {o.completion && <div className="card p-3.5 border-ok/30 bg-ok/5 text-sm"><b className="text-ok">Conclusão confirmada pelo cliente</b> · {fmtDateTime(o.completion.at)} · {o.completion.by}{o.completion.note && <div className="text-fg2 mt-1">“{o.completion.note}”</div>}</div>}
            <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
              <div className="card p-4 space-y-3">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-fg2 flex items-center gap-2"><Link2 size={15} className="text-accent" /> Portal do cliente</h3>
                {linkActive ? (
                  <>
                    <div className="flex gap-2"><input className="input input-sm font-mono text-xs" readOnly value={publicUrl("work_order", o.publicToken)} onFocus={(e) => e.currentTarget.select()} aria-label="Link do portal" /><button className="btn btn-sm" onClick={() => share("copy")}><Copy size={14} /></button></div>
                    <div className="flex flex-wrap gap-2"><button className="btn btn-sm btn-primary" disabled={busy} onClick={() => share("whatsapp", "os_concluida")}><MessageCircle size={14} /> Enviar por WhatsApp</button><a className="btn btn-sm" target="_blank" rel="noreferrer" href={publicUrl("work_order", o.publicToken)}><ExternalLink size={14} /> Abrir</a></div>
                    <p className="text-[11px] text-fg3">O cliente acompanha status, envia mensagens e fotos, aprova adicionais, confirma a conclusão e avalia — sem cadastro. Você pode revogar o link no menu.</p>
                  </>
                ) : (
                  <><p className="text-xs text-fg3">{o.publicToken ? "Link revogado." : "Gere um link seguro (token difícil de adivinhar) para o cliente acompanhar esta OS."}</p><button className="btn btn-sm btn-primary" disabled={busy} onClick={async () => { setBusy(true); await createPublicLink("work_order", { ...o, publicToken: null }); setBusy(false); toast("Link gerado"); }}>{o.publicToken ? "Gerar novo link" : "Gerar link do cliente"}</button></>
                )}
                <div className="flex gap-1.5 pt-1"><select className="input input-sm !w-32" value={tpl || settings.pdfTemplate} onChange={(e) => setTpl(e.target.value)} aria-label="Modelo PDF">{Object.entries(PDF_TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><button className="btn btn-sm" disabled={busy} onClick={() => pdf(false)}><FileDown size={14} /> PDF da OS</button></div>
              </div>
              {o.totals && <PricingSummary t={o.totals} pricing={o.pricing} compact />}
            </div>
          </div>
        )}
        {tab === "execucao" && <ExecutionTab o={o} closed={closed} />}
        {tab === "materiais" && <MaterialsTab o={o} />}
        {tab === "fotos" && <FilesTab o={o} />}
        {tab === "adicionais" && <AdditionalsTab o={o} customerPhone={cust?.whatsapp || cust?.phone} />}
        {tab === "chat" && <ChatTab o={o} phone={cust?.whatsapp || cust?.phone} />}
        {tab === "financeiro" && <FinanceTab o={o} />}
        {tab === "rota" && <RouteTab o={o} />}
        {tab === "historico" && (
          <ol className="space-y-2.5 border-l border-line2 ml-1.5 pl-4">
            {[...(o.history || [])].reverse().map((h: Rec) => <li key={h.id} className="relative text-[13px]"><span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-accent" /><div>{h.text}</div><div className="text-[11px] text-fg3">{fmtDateTime(h.at)}{h.byName ? ` · ${h.byName}` : ""}</div></li>)}
          </ol>
        )}
      </div>
      {complete && <CompleteModal o={o} onClose={() => setComplete(false)} />}
    </Drawer>
  );
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return <div className="card p-3.5"><div className="text-[11px] text-fg3 uppercase font-bold">{label}</div><div className="font-semibold text-sm mt-0.5 break-words">{value}</div>{sub && <div className="text-xs text-fg3 mt-0.5">{sub}</div>}</div>;
}

/* ---------------------------------------------------------------- conclusão */
export function CompleteModal({ o, onClose }: { o: Rec; onClose: () => void }) {
  const [warranty, setWarranty] = useState(String(toNum(o.warrantyDays)));
  const [months, setMonths] = useState(String(toNum(o.nextMaintenanceMonths)));
  const [solution, setSolution] = useState(o.solution || "");
  return (
    <Modal open onClose={onClose} size="md" title={`Concluir ${o.number}`} subtitle="Resumo e termo de conclusão" z={70}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={() => {
        const upd = saveOrder(o.id, { warrantyDays: toNum(warranty), nextMaintenanceMonths: toNum(months), solution });
        setOrderStatus(upd, "concluida", "OS concluída");
        toast("OS concluída — cobrança gerada e pós-venda agendado");
        onClose();
      }}><CheckCircle2 size={16} /> Concluir</button></>}>
      <div className="space-y-3.5">
        <div className="card p-3 text-sm"><div className="font-semibold">{o.title}</div><div className="text-fg2 text-xs mt-0.5">Total: <b>{money(o.total)}</b> · {(o.materials || []).length} material(is) usado(s) · {(o.checklist || []).filter((c: Rec) => c.done).length}/{(o.checklist || []).length} itens do checklist</div></div>
        <label className="block"><span className="label">Solução aplicada</span><textarea className="input" rows={3} value={solution} onChange={(e) => setSolution(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Garantia (dias)</span><input className="input" type="number" value={warranty} onChange={(e) => setWarranty(e.target.value)} /></label>
          <label className="block"><span className="label">Próxima manutenção (meses)</span><input className="input" type="number" value={months} onChange={(e) => setMonths(e.target.value)} /></label>
        </div>
        <p className="text-[11px] text-fg3">Ao concluir: cria a cobrança no financeiro, a garantia, a tarefa de manutenção preventiva e agenda o pós-venda. O cliente confirma a conclusão pelo link.</p>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- execução */
function ExecutionTab({ o, closed }: { o: Rec; closed: boolean }) {
  const [task, setTask] = useState("");
  const check: Rec[] = o.checklist || [];
  const area = (key: string, label: string, ph: string) => (
    <label className="block"><span className="label">{label}</span><textarea key={o.id + key} className="input" rows={3} placeholder={ph} defaultValue={o[key] || ""} disabled={false} onBlur={(e) => e.target.value !== (o[key] || "") && saveOrder(o.id, { [key]: e.target.value })} /></label>
  );
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">{area("problem", "Problema relatado", "O que o cliente informou…")}{area("diagnosis", "Diagnóstico", "O que foi identificado…")}{area("solution", "Solução aplicada", "O que foi feito…")}</div>
      <div>
        <div className="flex items-center justify-between mb-2"><h3 className="text-[13px] font-semibold uppercase tracking-wide text-fg2">Checklist ({check.filter((c) => c.done).length}/{check.length})</h3></div>
        <div className="space-y-1.5">
          {check.map((c) => (
            <div key={c.id} className="flex items-center gap-3 card-solid px-3 h-11">
              <button aria-label={c.done ? "Desmarcar" : "Marcar"} onClick={() => saveOrder(o.id, { checklist: check.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} className={cx("size-5 rounded-md border grid place-items-center shrink-0", c.done ? "bg-ok border-ok text-white" : "border-line2")}>{c.done && <CheckCircle2 size={13} />}</button>
              <span className={cx("flex-1 text-sm", c.done && "line-through text-fg3")}>{c.text}{c.service && <span className="text-[11px] text-fg3 ml-2">{c.service}</span>}</span>
              <button aria-label="Remover" className="text-fg3 hover:text-bad" onClick={() => saveOrder(o.id, { checklist: check.filter((x) => x.id !== c.id) })}><Trash2 size={14} /></button>
            </div>
          ))}
          {!check.length && <p className="text-xs text-fg3">Sem itens. O checklist vem dos serviços cadastrados ao criar a OS a partir de um orçamento, ou adicione abaixo.</p>}
        </div>
        <div className="flex gap-2 mt-2.5"><input className="input input-sm" placeholder="Novo item do checklist" value={task} onChange={(e) => setTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && task.trim()) { saveOrder(o.id, { checklist: [...check, { id: newId(), text: task.trim(), done: false }] }); setTask(""); } }} /><button className="btn btn-sm" onClick={() => { if (task.trim()) { saveOrder(o.id, { checklist: [...check, { id: newId(), text: task.trim(), done: false }] }); setTask(""); } }}><Plus size={14} /></button></div>
      </div>
      {closed && <p className="text-xs text-fg3">OS encerrada — edições continuam permitidas e ficam registradas.</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- materiais */
function MaterialsTab({ o }: { o: Rec }) {
  const products = useActive("products");
  const [pid, setPid] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const prod = products.items.find((p) => p.id === pid);
  const add = (m: { productId?: string; name: string; qty: number; unit?: string }) => {
    const p = m.productId ? products.items.find((x) => x.id === m.productId) : undefined;
    if (p && toNum(p.qty) < m.qty) toast(`Atenção: saldo de ${p.name} ficará negativo (${p.qty} ${p.unit} em estoque)`, "info");
    addOrderMaterial(o, { ...m, unitPrice: p?.price });
    toast(p ? "Material adicionado e baixado do estoque" : "Material adicionado");
  };
  return (
    <div className="space-y-5">
      {(o.suggestedMaterials || []).length > 0 && (
        <div className="card p-3.5 border-accent/25">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-accent mb-2">Materiais sugeridos pelos serviços</h3>
          <div className="space-y-1.5">
            {o.suggestedMaterials.map((m: Rec) => (
              <div key={m.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{m.qty} {m.unit} · {m.name} <span className="text-[11px] text-fg3">({m.service})</span></span>
                <button className="btn btn-sm" onClick={() => add({ productId: m.productId, name: m.name, qty: toNum(m.qty), unit: m.unit })}>Usar</button>
                <button className="btn btn-sm btn-ghost btn-icon" aria-label="Descartar sugestão" onClick={() => saveOrder(o.id, { suggestedMaterials: o.suggestedMaterials.filter((x: Rec) => x.id !== m.id) })}><Trash2 size={13} /></button></div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-fg2 mb-2">Materiais utilizados</h3>
        <div className="space-y-1.5">
          {(o.materials || []).map((m: Rec) => (
            <div key={m.id} className="flex items-center gap-2 card-solid px-3 h-11 text-sm"><Package size={15} className="text-fg3" /><span className="flex-1">{m.qty} {m.unit} · {m.name}</span>{m.productId && <Badge tone="info">baixa no estoque</Badge>}
              <button aria-label="Remover material" className="text-fg3 hover:text-bad" onClick={() => removeOrderMaterial(o, m.id)}><Trash2 size={14} /></button></div>
          ))}
          {!(o.materials || []).length && <p className="text-xs text-fg3">Nenhum material lançado. Itens do estoque dão baixa automática.</p>}
        </div>
      </div>
      <div className="card-solid p-3 space-y-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-accent">Adicionar material</div>
        <div className="grid sm:grid-cols-[1.4fr_1fr_90px_auto] gap-2">
          <select className="input input-sm" value={pid} onChange={(e) => { setPid(e.target.value); const p = products.items.find((x) => x.id === e.target.value); if (p) setName(p.name); }} aria-label="Produto do estoque"><option value="">Produto do estoque…</option>{products.items.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.qty} {p.unit})</option>)}</select>
          <input className="input input-sm" placeholder="ou nome livre" value={name} onChange={(e) => { setName(e.target.value); if (pid) setPid(""); }} />
          <input className="input input-sm" type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantidade" />
          <button className="btn btn-sm btn-primary" disabled={!name.trim() || toNum(qty) <= 0} onClick={() => { add({ productId: prod?.id, name: name.trim(), qty: toNum(qty), unit: prod?.unit }); setPid(""); setName(""); setQty("1"); }}><Plus size={14} /> Lançar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- fotos e arquivos */
export function FilesTab({ o }: { o: Rec }) {
  const { items } = useCollection("work_order_attachments");
  const list = useMemo(() => items.filter((a) => a.workOrderId === o.id && !a.deletedAt).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")), [items, o.id]);
  const { upload, busy } = useUploader();
  const [kind, setKind] = useState("antes");
  const gal = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const doc = useRef<HTMLInputElement>(null);
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      const r = await upload(f, `work-orders/${o.id}`);
      if (r) db.create("work_order_attachments", { workOrderId: o.id, kind: f.type.startsWith("image/") ? kind : "arquivo", name: f.name, url: r.url, path: r.path, type: f.type, size: r.size, uploadedBy: "empresa", released: true });
    }
    saveOrder(o.id, { __silent: true, filesTouched: Date.now() });
    toast("Arquivo(s) enviado(s)");
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input input-sm !w-auto" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Momento da foto"><option value="antes">Antes</option><option value="durante">Durante</option><option value="depois">Depois</option></select>
        <button className="btn btn-sm" disabled={busy} onClick={() => cam.current?.click()}><Camera size={14} /> Câmera</button>
        <button className="btn btn-sm" disabled={busy} onClick={() => gal.current?.click()}><ImagePlus size={14} /> Galeria</button>
        <button className="btn btn-sm" disabled={busy} onClick={() => doc.current?.click()}><Paperclip size={14} /> Arquivo / PDF</button>
        {busy && <Spinner />}
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        <input ref={doc} type="file" hidden multiple onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {!list.length ? <p className="text-xs text-fg3">Nenhum arquivo. Arquivos ficam no Cloud Storage em companies/{COMPANY_ID}/work-orders/{o.id.slice(0, 6)}…</p> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {list.map((a) => (
            <div key={a.id} className="card overflow-hidden group relative">
              {a.type?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name} className="w-full aspect-square object-cover" loading="lazy" /></a>
              ) : <a href={a.url} target="_blank" rel="noreferrer" className="aspect-square grid place-items-center bg-solid2"><Paperclip size={26} className="text-fg3" /></a>}
              <div className="p-2 text-[11px]"><div className="truncate font-medium">{a.name}</div><div className="flex items-center gap-1 mt-0.5"><Badge tone={a.kind === "cliente" ? "violet" : "info"}>{a.kind}</Badge>
                <button className="ml-auto text-fg3 hover:text-bad" aria-label="Excluir arquivo" onClick={async () => { if (await confirmDialog({ title: "Excluir arquivo?", confirmText: "Excluir", danger: true })) { db.removeFile({ path: a.path, url: a.url }); db.remove("work_order_attachments", a.id); } }}><Trash2 size={13} /></button></div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- adicionais */
function AdditionalsTab({ o, customerPhone }: { o: Rec; customerPhone?: string }) {
  const svc = useActive("services");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [lines, setLines] = useState<PricingLine[]>([]);
  const [svcId, setSvcId] = useState("");
  const list: Rec[] = o.additionals || [];
  const total = lines.reduce((a, l) => a + toNum(l.qty) * toNum(l.unitPrice), 0);
  const addSvc = () => { const s = svc.items.find((x) => x.id === svcId); if (s) { setLines([...lines, { ...emptyLine(), serviceId: s.id, name: s.name, unitPrice: toNum(s.priceMid), unitCost: toNum(s.cost) }]); if (!title) setTitle(s.name); setSvcId(""); } };
  const upd = (id: string, p: Partial<PricingLine>) => setLines(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const send = async () => {
    if (!title.trim() || !lines.length) return toast("Informe o título e ao menos um item", "error");
    addAdditional(o, { title: title.trim(), description: desc, lines: lines.map((l) => ({ ...l, qty: toNum(l.qty) || 1, unitPrice: toNum(l.unitPrice) })) });
    setTitle(""); setDesc(""); setLines([]);
    toast("Adicional criado e enviado ao portal do cliente");
    const p = await prepareShare("work_order", o, "os_concluida");
    window.open(waLink(customerPhone, `Olá! Durante o serviço identifiquei um item adicional: "${title}". Veja e aprove pelo link: ${p.url}`), "_blank");
  };
  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        {list.map((a) => (
          <div key={a.id} className="card p-3.5">
            <div className="flex items-center gap-2 flex-wrap"><b className="text-sm">{a.title}</b><Badge tone={a.status === "aprovado" ? "ok" : a.status === "recusado" ? "bad" : "warn"}>{a.status === "aprovado" ? "✓ Aprovado" : a.status === "recusado" ? "✕ Recusado" : "⏳ Aguardando aprovação"}</Badge><span className="ml-auto font-bold tabular-nums">{money(a.total)}</span></div>
            <ul className="text-xs text-fg2 mt-1.5 space-y-0.5">{(a.lines || []).map((l: Rec) => <li key={l.id}>{l.qty}× {l.name} — {money(toNum(l.qty) * toNum(l.unitPrice))}</li>)}</ul>
            {a.status === "aguardando" && <div className="flex gap-2 mt-2.5"><button className="btn btn-sm btn-primary" onClick={() => decideAdditional(o, a.id, true, "Empresa (confirmação direta)")}>Cliente aprovou (registrar)</button><button className="btn btn-sm" onClick={() => decideAdditional(o, a.id, false, "Empresa (confirmação direta)")}>Cliente recusou</button></div>}
            {a.decidedAt && <div className="text-[11px] text-fg3 mt-1.5">Decidido em {fmtDateTime(a.decidedAt)} por {a.decidedBy}</div>}
          </div>
        ))}
        {!list.length && <p className="text-xs text-fg3">Identificou outro problema durante a execução? Crie um serviço adicional: o cliente aprova pelo link e a OS é atualizada (valor, histórico e financeiro).</p>}
      </div>
      <div className="card-solid p-3.5 space-y-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-accent">Adicionar serviço</div>
        <input className="input input-sm" placeholder="Título (ex.: Troca do cabo de energia)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input input-sm" placeholder="Explique o problema identificado" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="flex gap-2"><select className="input input-sm" value={svcId} onChange={(e) => setSvcId(e.target.value)} aria-label="Serviço"><option value="">Serviço cadastrado…</option>{svc.items.map((s) => <option key={s.id} value={s.id}>{s.name} — {money(s.priceMid)}</option>)}</select><button className="btn btn-sm" disabled={!svcId} onClick={addSvc}>Incluir</button><button className="btn btn-sm" onClick={() => setLines([...lines, { ...emptyLine(), tier: "custom" }])}>+ Manual</button></div>
        {lines.map((l) => (
          <div key={l.id} className="grid grid-cols-[1fr_64px_96px_auto] gap-2"><input className="input input-sm" value={l.name} placeholder="Item" onChange={(e) => upd(l.id, { name: e.target.value })} /><input className="input input-sm" type="number" value={l.qty} onChange={(e) => upd(l.id, { qty: toNum(e.target.value) })} aria-label="Qtd" /><input className="input input-sm" type="number" step="0.01" value={l.unitPrice} onChange={(e) => upd(l.id, { unitPrice: toNum(e.target.value) })} aria-label="Preço" /><button className="btn btn-sm btn-ghost btn-icon" aria-label="Remover" onClick={() => setLines(lines.filter((x) => x.id !== l.id))}><Trash2 size={13} /></button></div>
        ))}
        <div className="flex items-center justify-between pt-1"><span className="text-sm">Total adicional: <b>{money(total)}</b></span><button className="btn btn-primary btn-sm" onClick={send}><Send size={14} /> Enviar para aprovação</button></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- chat */
export function ChatTab({ o, phone }: { o: Rec; phone?: string }) {
  const { items } = useCollection("work_order_messages");
  const msgs = useMemo(() => items.filter((m) => m.workOrderId === o.id).sort((a, b) => (a.at || "").localeCompare(b.at || "")), [items, o.id]);
  const [text, setText] = useState("");
  const send = () => { if (text.trim()) { sendCompanyMessage(o, text); setText(""); } };
  return (
    <div className="flex flex-col h-[60vh] min-h-[360px]">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {!msgs.length && <p className="text-xs text-fg3 text-center pt-8">Sem mensagens. As conversas do portal do cliente aparecem aqui e ficam registradas no histórico.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={cx("max-w-[82%] rounded-2xl px-3.5 py-2 text-sm", m.from === "company" ? "ml-auto bg-gradient-to-br from-accent/90 to-accent2/80 text-[var(--accent-fg)]" : "bg-solid3")}>
            <div className="text-[10.5px] opacity-70 mb-0.5">{m.name} · {fmtDateTime(m.at)}</div>{m.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-3"><input className="input" placeholder="Escreva uma mensagem ao cliente…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} disabled={!o.publicToken} /><button className="btn btn-primary" disabled={!o.publicToken || !text.trim()} onClick={send}><Send size={15} /></button></div>
      <p className="text-[11px] text-fg3 mt-1.5">{o.publicToken ? "O cliente vê e responde pelo portal." : "Gere o link do cliente (aba Resumo) para conversar pelo portal."} {phone && <a className="text-accent" href={waLink(phone, "")} target="_blank" rel="noreferrer">Abrir WhatsApp</a>} · Integração com WhatsApp Business API preparada (ver Automações).</p>
    </div>
  );
}

/* ---------------------------------------------------------------- financeiro */
function FinanceTab({ o }: { o: Rec }) {
  const { items: txns } = useCollection("financial_transactions");
  const { items: accs } = useActive("financial_accounts") as unknown as { items: Rec[] };
  const docs = useCollection("documents");
  const mine = txns.filter((t) => t.workOrderId === o.id && !t.deletedAt);
  const pending = mine.filter((t) => t.type === "entrada" && ["pendente", "previsto"].includes(t.status));
  const paid = mine.filter((t) => t.type === "entrada" && t.status === "pago").reduce((a, t) => a + toNum(t.amount), 0);
  const target = pending[0];
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("pix");
  const [acc, setAcc] = useState("");
  const [date, setDate] = useState(todayISO());
  const { settings } = useSettings();
  const receipts = docs.items.filter((d) => d.workOrderId === o.id && d.type === "recibo" && !d.deletedAt);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3"><Info label="Valor da OS" value={money(o.total)} /><Info label="Recebido" value={<span className="text-ok">{money(paid)}</span>} /><Info label="Em aberto" value={<span className={pending.length ? "text-warn" : ""}>{money(pending.reduce((a, t) => a + toNum(t.amount), 0))}</span>} /></div>
      {!mine.length && <div className="card p-4 text-sm flex items-center gap-3"><span className="flex-1 text-fg2">Nenhuma cobrança criada. Ela é gerada ao concluir a OS — ou gere agora (ex.: sinal).</span><button className="btn btn-sm btn-primary" onClick={() => { ensureReceivable(o); toast("Cobrança gerada"); }}>Gerar cobrança</button></div>}
      <div className="space-y-1.5">
        {mine.map((t) => <div key={t.id} className="card-solid px-3 h-11 flex items-center gap-2 text-sm"><span className="flex-1 truncate">{t.description}</span><span className="tabular-nums font-semibold">{money(t.amount)}</span><StatusBadge def={TXN_STATUS[txnStatus(t)]} /></div>)}
      </div>
      {target && (
        <div className="card-solid p-3.5 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent">Registrar pagamento</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input className="input input-sm" type="number" step="0.01" placeholder={`Valor (${toNum(target.amount).toFixed(2)})`} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Valor" />
            <select className="input input-sm" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Forma">{Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select className="input input-sm" value={acc || target.accountId || ""} onChange={(e) => setAcc(e.target.value)} aria-label="Conta"><option value="">Conta…</option>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <input className="input input-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { registerPayment(target, { amount: toNum(amount) || toNum(target.amount), method, accountId: acc || target.accountId || "", paidAt: date }); toast("Pagamento registrado e recibo gerado"); setAmount(""); }}><Wallet size={14} /> Registrar recebimento</button>
        </div>
      )}
      {receipts.length > 0 && (
        <div><div className="text-[11px] font-bold uppercase text-fg3 mb-1.5">Recibos</div>
          {receipts.map((r) => <div key={r.id} className="card-solid px-3 h-11 flex items-center gap-2 text-sm mb-1.5"><Receipt size={15} className="text-fg3" /><span className="flex-1 truncate">{r.title}</span><button className="btn btn-sm" onClick={async () => { const { downloadPdf, docSpec, companyOf } = await import("@/lib/pdf"); downloadPdf(docSpec(r, db.get("customers", r.customerId), settings, o), companyOf(settings), settings.pdfTemplate, `Recibo-${o.number}`); }}><FileDown size={13} /> PDF</button></div>)}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- rota */
function RouteTab({ o }: { o: Rec }) {
  const { settings } = useSettings();
  const [km, setKm] = useState(String(o.route?.km || ""));
  const [min, setMin] = useState(String(o.route?.minutes || ""));
  const dest = encodeURIComponent(o.address || "");
  const fee = travelFee(settings.travel as Rec, { km: toNum(km) });
  return (
    <div className="space-y-4 max-w-2xl">
      <Info label="Endereço" value={o.address || "Sem endereço"} />
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${dest}`}><Navigation size={15} /> Abrir rota no Google Maps</a>
        <a className="btn" target="_blank" rel="noreferrer" href={`https://waze.com/ul?q=${dest}&navigate=yes`}><Truck size={15} /> Waze</a>
      </div>
      <div className="card-solid p-3.5 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-accent">Deslocamento</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Distância (km)</span><input className="input" type="number" value={km} onChange={(e) => setKm(e.target.value)} /></label>
          <label className="block"><span className="label">Tempo estimado (min)</span><input className="input" type="number" value={min} onChange={(e) => setMin(e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="btn btn-sm" onClick={() => { saveOrder(o.id, { route: { km: toNum(km), minutes: toNum(min) } }); toast("Rota salva"); }}>Salvar rota</button>
          {settings.travel?.mode !== "region" && <button className="btn btn-sm" onClick={() => { const p = { ...o.pricing, travel: fee }; const t = computePricing(p, settings.fees); saveOrder(o.id, { route: { km: toNum(km), minutes: toNum(min) }, pricing: p, totals: t, total: t.total }); toast(`Deslocamento de ${money(fee)} aplicado ao valor`); }}>Aplicar taxa de deslocamento ({money(fee)})</button>}
        </div>
        <p className="text-[11px] text-fg3">Distância e tempo são informados manualmente. Integração automática com Google Maps (Distance Matrix) está preparada em Configurações → Integrações e depende de uma chave de API.</p>
      </div>
    </div>
  );
}

export const _u = { Wrench };
