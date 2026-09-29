"use client";
import { useState } from "react";
import { Archive, CalendarPlus, Copy, ExternalLink, FileDown, Link2, Mail, MessageCircle, MoreHorizontal, Pencil, Share2, Trash2, Link2Off, Save } from "lucide-react";
import { Drawer, Menu, StatusBadge, confirmDialog, Spinner } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { db, useRecord } from "@/lib/data/store";
import { QUOTE_STATUS, PDF_TEMPLATES, opts } from "@/lib/constants";
import { useSettings } from "@/lib/settings";
import { createOrderFromQuote, publicUrl, revokePublicLink, setQuoteStatus, createPublicLink } from "@/lib/workflows";
import { prepareShare, savePdfDocument } from "@/lib/share";
import { toast } from "@/lib/toast";
import { fmtDate, fmtDateTime, money } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { PricingSummary } from "../PricingBuilder";
import { lineTotal } from "@/lib/calc";
import type { Rec } from "@/lib/types";

export default function QuoteDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const ui = useUI();
  const { settings } = useSettings();
  const { rec: q, loading } = useRecord("quotes", id);
  const { rec: cust } = useRecord("customers", q?.customerId);
  const { rec: link } = useRecord("public_links", q?.publicToken);
  const [busy, setBusy] = useState(false);
  const [tpl, setTpl] = useState<string>("");

  if (!q) return <Drawer open onClose={onClose} title="Orçamento">{loading ? <div className="grid place-items-center h-64"><Spinner size={26} /></div> : <p className="p-6 text-fg3 text-sm">Orçamento não encontrado.</p>}</Drawer>;

  const template = tpl || settings.pdfTemplate || "moderno";
  const pdf = async (save = false) => {
    setBusy(true);
    try {
      const { buildPdf, quoteSpec, companyOf } = await import("@/lib/pdf");
      const doc = await buildPdf(quoteSpec(q, cust, settings), companyOf(settings), template);
      if (save) {
        await savePdfDocument(doc, { folder: `quotes/${q.id}`, filename: `${q.number}.pdf`, title: `Orçamento ${q.number}`, type: "orcamento", customerId: q.customerId, quoteId: q.id });
        toast("PDF salvo na Central de Documentos");
      } else doc.save(`${q.number}.pdf`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao gerar PDF", "error");
    } finally {
      setBusy(false);
    }
  };

  const send = async (via: "whatsapp" | "email" | "share" | "copy") => {
    setBusy(true);
    try {
      const p = await prepareShare("quote", q);
      if (via === "copy") { await navigator.clipboard.writeText(p.url); toast("Link copiado"); }
      else if (via === "share" && navigator.share) await navigator.share({ title: p.subject, text: p.text, url: p.url }).catch(() => {});
      else if (via === "email") window.location.href = `mailto:${p.email}?subject=${encodeURIComponent(p.subject)}&body=${encodeURIComponent(p.text)}`;
      else window.open(waLink(p.phone, p.text), "_blank");
      if (via !== "copy" && q.status === "rascunho") setQuoteStatus(q, "enviado", `Enviado via ${via === "email" ? "e-mail" : via === "share" ? "compartilhamento" : "WhatsApp"}`);
    } finally {
      setBusy(false);
    }
  };

  const url = q.publicToken ? publicUrl("quote", q.publicToken) : "";
  const linkActive = link && link.status !== "revoked";
  const events = (link?.events || []).filter((e: Rec) => e.by === "client");
  const LABEL: Record<string, string> = { approve: "Aprovou", reject: "Recusou", change_request: "Solicitou alteração", message: "Mensagem" };

  return (
    <Drawer open onClose={onClose} size="lg" title={<span className="flex items-center gap-2">{q.number} <StatusBadge def={QUOTE_STATUS[q.status]} /></span>} subtitle={`${cust?.name || "—"} · ${q.title || ""}`}
      actions={
        <>
          <button className="btn btn-sm hidden sm:inline-flex" onClick={() => ui.openForm("quotes", q.id)}><Pencil size={14} /> Editar</button>
          <Menu label="Mais ações" trigger={<MoreHorizontal size={17} />} items={[
            { label: "Editar", icon: Pencil, onClick: () => ui.openForm("quotes", q.id) },
            { label: "Duplicar", icon: Copy, onClick: () => { const d = db.duplicate("quotes", q.id, { status: "rascunho", number: `${q.number}-cópia`, workOrderId: null, history: [] }); if (d) { toast("Duplicado"); ui.openDetail("quotes", d.id); } } },
            { label: q.archived ? "Desarquivar" : "Arquivar", icon: Archive, onClick: () => { db.archive("quotes", q.id, !q.archived); toast(q.archived ? "Desarquivado" : "Arquivado"); } },
            linkActive && { label: "Revogar link público", icon: Link2Off, onClick: async () => { if (await confirmDialog({ title: "Revogar link?", message: "O cliente não conseguirá mais abrir este orçamento pelo link atual.", confirmText: "Revogar", danger: true })) revokePublicLink("quotes", q); } },
            "sep",
            { label: "Mover para a lixeira", icon: Trash2, danger: true, onClick: async () => { if (await confirmDialog({ title: "Mover para a lixeira?", message: `${q.number} poderá ser restaurado depois.`, confirmText: "Excluir", danger: true })) { db.softDelete("quotes", q.id); onClose(); } } },
          ]} />
        </>
      }>
      <div className="p-4 sm:p-5 space-y-5">
        {/* ações principais */}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy} onClick={() => send("whatsapp")}><MessageCircle size={16} /> Enviar por WhatsApp</button>
          <button className="btn" disabled={busy} onClick={() => send("email")}><Mail size={16} /> E-mail</button>
          {typeof navigator !== "undefined" && "share" in navigator && <button className="btn" disabled={busy} onClick={() => send("share")}><Share2 size={16} /> Compartilhar</button>}
          <button className="btn" disabled={busy} onClick={() => send("copy")}><Link2 size={16} /> Copiar link</button>
          <div className="flex gap-1.5 ml-auto">
            <select className="input input-sm !w-32" value={template} onChange={(e) => setTpl(e.target.value)} aria-label="Modelo do PDF">{opts(Object.fromEntries(Object.entries(PDF_TEMPLATES).map(([k, v]) => [k, { label: v }]))).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <button className="btn btn-sm" disabled={busy} onClick={() => pdf(false)}><FileDown size={15} /> PDF</button>
            <button className="btn btn-sm btn-icon" title="Gerar PDF e salvar na Central de Documentos" aria-label="Salvar PDF" disabled={busy} onClick={() => pdf(true)}><Save size={15} /></button>
          </div>
        </div>

        {/* aprovado → OS */}
        {q.status === "aprovado" && (
          <div className="card p-4 border-ok/30 bg-ok/5 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]"><div className="font-semibold">Orçamento aprovado 🎉</div><div className="text-xs text-fg2">{q.workOrderId ? "A ordem de serviço já foi criada." : "Copie cliente, endereço, serviços, valores e materiais para uma OS com um clique."}</div></div>
            {q.workOrderId ? (
              <button className="btn" onClick={() => ui.openDetail("work_orders", q.workOrderId)}><ExternalLink size={15} /> Abrir OS</button>
            ) : (
              <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); const os = await createOrderFromQuote(q); setBusy(false); toast(`${os.number} criada`); onClose(); ui.openDetail("work_orders", os.id); }}><CalendarPlus size={16} /> Criar ordem de serviço</button>
            )}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="card p-3.5"><div className="text-[11px] text-fg3 uppercase font-bold">Cliente</div><button className="font-semibold text-left hover:text-accent" onClick={() => q.customerId && ui.openDetail("customers", q.customerId)}>{cust?.name || "—"}</button><div className="text-xs text-fg3">{cust?.whatsapp || cust?.phone}</div></div>
          <div className="card p-3.5"><div className="text-[11px] text-fg3 uppercase font-bold">Validade</div><div className="font-semibold">{fmtDate(q.validUntil)}</div><div className="text-xs text-fg3">Prazo: {q.deliveryDays ? `${q.deliveryDays} dia(s)` : "a combinar"}</div></div>
          <div className="card p-3.5"><div className="text-[11px] text-fg3 uppercase font-bold">Alterar status</div>
            <select className="input input-sm mt-1" value={q.status} onChange={(e) => setQuoteStatus(q, e.target.value)} aria-label="Status do orçamento">{opts(QUOTE_STATUS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        </div>

        {q.description && <p className="text-sm text-fg2 whitespace-pre-wrap">{q.description}</p>}

        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead><tr className="bg-black/10"><th className="th">Item</th><th className="th text-right">Qtd</th><th className="th text-right">Unit.</th><th className="th text-right">Total</th></tr></thead>
              <tbody>
                {(q.pricing?.lines || []).map((l: Rec) => (
                  <tr key={l.id}><td className="td"><div className="font-medium">{l.name}</div>{l.note && <div className="text-xs text-fg3">{l.note}</div>}</td><td className="td text-right">{l.qty}</td><td className="td text-right tabular-nums">{money(l.unitPrice)}</td><td className="td text-right tabular-nums font-semibold">{money(lineTotal(l as never))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {q.totals && <PricingSummary t={q.totals} pricing={q.pricing} compact />}
        </div>

        {/* link público */}
        <section className="card p-4 space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold uppercase tracking-wide text-fg2 flex items-center gap-2"><Link2 size={15} className="text-accent" /> Link público do cliente</h3>
            {!linkActive && <button className="btn btn-sm" disabled={busy} onClick={async () => { await createPublicLink("quote", { ...q, publicToken: null }); toast("Link gerado"); }}>{q.publicToken ? "Gerar novo link" : "Gerar link"}</button>}</div>
          {linkActive ? (
            <div className="flex gap-2"><input className="input input-sm font-mono text-xs" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link público" />
              <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(url); toast("Link copiado"); }}><Copy size={14} /></button>
              <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a></div>
          ) : <p className="text-xs text-fg3">{q.publicToken ? "Link revogado. Gere um novo para compartilhar novamente." : "Gere um link seguro para o cliente ver o orçamento e aprovar, recusar ou pedir alteração."}</p>}
          {events.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold uppercase text-fg3">Respostas do cliente</div>
              {events.map((e: Rec) => (
                <div key={e.id} className="rounded-xl bg-solid2 border border-line px-3 py-2 text-[13px]"><b>{LABEL[e.type] || e.type}</b> <span className="text-fg3 text-xs">· {fmtDateTime(e.at)}{e.name ? ` · ${e.name}` : ""}</span>{e.text && <div className="text-fg2 mt-0.5">“{e.text}”</div>}</div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-fg2 mb-3">Histórico</h3>
          <ol className="space-y-2.5 border-l border-line2 ml-1.5 pl-4">
            {[...(q.history || [])].reverse().map((h: Rec) => (
              <li key={h.id} className="relative text-[13px]"><span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-accent" /><div>{h.text}</div><div className="text-[11px] text-fg3">{fmtDateTime(h.at)}{h.byName ? ` · ${h.byName}` : ""}</div></li>
            ))}
          </ol>
        </section>
      </div>
    </Drawer>
  );
}
