"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, MapPin, MessageCircle, Pause, Phone, Play, Plus } from "lucide-react";
import { Spinner, StatusBadge } from "@/components/ui";
import { useActive, useRecord } from "@/lib/data/store";
import { OS_CLOSED, OS_STATUS } from "@/lib/constants";
import { addOrderMaterial, saveOrder, setOrderStatus } from "@/lib/workflows";
import { toast } from "@/lib/toast";
import { cx, fmtDate, toNum } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { CompleteModal, FilesTab } from "./OrderDetail";

/** Modo técnico: visão simplificada e rápida para uso em campo. */
export default function TechMode({ id }: { id: string }) {
  const { rec: o, loading } = useRecord("work_orders", id);
  const { rec: c } = useRecord("customers", o?.customerId);
  const products = useActive("products");
  const [done, setDone] = useState(false);
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState("1");
  if (!o) return <div className="grid place-items-center h-64">{loading ? <Spinner size={26} /> : <p className="text-sm text-fg3">OS não encontrada.</p>}</div>;
  const phone = c?.whatsapp || c?.phone;
  const closed = OS_CLOSED.includes(o.status);
  const running = o.status === "execucao";
  const check: { id: string; text: string; done: boolean }[] = o.checklist || [];
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2"><Link href="/ordens-de-servico" className="btn btn-icon btn-ghost" aria-label="Voltar"><ArrowLeft size={18} /></Link><div className="min-w-0 flex-1"><div className="text-xs text-fg3">Modo técnico · {o.number}</div><div className="font-bold truncate">{o.title}</div></div><StatusBadge def={OS_STATUS[o.status]} /></div>
      <div className="grid grid-cols-2 gap-2.5">
        {!closed && !running && <button className="btn btn-primary !h-14 text-base col-span-2" onClick={() => setOrderStatus(o, "execucao", "Serviço iniciado (modo técnico)")}><Play size={20} /> Iniciar serviço</button>}
        {running && <button className="btn !h-14 text-base" onClick={() => setOrderStatus(o, "aguardando_material", "Serviço pausado — aguardando material")}><Pause size={20} /> Pausar</button>}
        {!closed && <button className={cx("btn !h-14 text-base", running ? "btn-primary" : "col-span-2")} onClick={() => setDone(true)}><CheckCircle2 size={20} /> Finalizar</button>}
      </div>
      <div className="card p-4 space-y-2.5">
        <div className="text-[11px] font-bold uppercase text-fg3">Cliente</div>
        <div className="font-bold text-lg">{c?.name || "—"}</div>
        <div className="flex gap-2 flex-wrap">
          {phone && <a className="btn btn-primary" href={`tel:${phone}`}><Phone size={16} /> Ligar</a>}
          {phone && <a className="btn" href={waLink(phone, `Olá ${(c?.name || "").split(" ")[0]}, estou a caminho!`)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>}
        </div>
        <div className="text-sm text-fg2 flex gap-2"><MapPin size={16} className="shrink-0 mt-0.5 text-accent" />{o.address || "Sem endereço"}</div>
        {o.address && <a className="btn w-full" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.address)}`}>Abrir mapa / rota</a>}
        <div className="text-sm text-fg2">Horário: <b className="text-fg">{o.date ? `${fmtDate(o.date)} ${o.time || ""}` : "não agendado"}</b></div>
      </div>
      {(o.description || o.problem) && <div className="card p-4 text-sm space-y-1"><div className="text-[11px] font-bold uppercase text-fg3">Serviço</div>{o.description && <p>{o.description}</p>}{o.problem && <p className="text-fg2">Problema: {o.problem}</p>}</div>}
      <div className="card p-4">
        <div className="text-[11px] font-bold uppercase text-fg3 mb-2">Checklist ({check.filter((x) => x.done).length}/{check.length})</div>
        <div className="space-y-2">{check.map((t) => <button key={t.id} onClick={() => saveOrder(o.id, { checklist: check.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) })} className="w-full flex items-center gap-3 h-12 px-3 rounded-xl bg-solid2 text-left"><span className={cx("size-6 rounded-lg border grid place-items-center", t.done ? "bg-ok border-ok text-white" : "border-line2")}>{t.done && <CheckCircle2 size={15} />}</span><span className={cx("text-[15px]", t.done && "line-through text-fg3")}>{t.text}</span></button>)}{!check.length && <p className="text-xs text-fg3">Sem checklist nesta OS.</p>}</div>
      </div>
      <div className="card p-4 space-y-2.5">
        <div className="text-[11px] font-bold uppercase text-fg3">Materiais usados</div>
        {(o.materials || []).map((m: { id: string; qty: number; unit: string; name: string }) => <div key={m.id} className="text-sm">• {m.qty} {m.unit} {m.name}</div>)}
        <div className="flex gap-2"><select className="input" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Material"><option value="">Adicionar material…</option>{products.items.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.qty})</option>)}</select><input className="input !w-20" type="number" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantidade" /><button className="btn btn-primary btn-icon" disabled={!pid} aria-label="Adicionar material" onClick={() => { const p = products.items.find((x) => x.id === pid); if (p) { addOrderMaterial(o, { productId: p.id, name: p.name, qty: toNum(qty) || 1, unit: p.unit, unitPrice: p.price }); toast("Material lançado e baixado do estoque"); setPid(""); setQty("1"); } }}><Plus size={18} /></button></div>
      </div>
      <div className="card p-4"><div className="text-[11px] font-bold uppercase text-fg3 mb-2">Fotos e arquivos</div><FilesTab o={o} /></div>
      <div className="card p-4"><div className="text-[11px] font-bold uppercase text-fg3 mb-2">Observações</div><textarea className="input" rows={3} defaultValue={o.notes || ""} placeholder="Anotações do atendimento…" onBlur={(e) => e.target.value !== (o.notes || "") && saveOrder(o.id, { notes: e.target.value })} /></div>
      {done && <CompleteModal o={o} onClose={() => setDone(false)} />}
    </div>
  );
}
