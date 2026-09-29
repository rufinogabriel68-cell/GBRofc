"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Clock, FileText, Globe, Link2Off, MessageCircle, Paperclip, Phone, Send, Star, ThumbsDown, ThumbsUp, Pencil, AtSign, Mail } from "lucide-react";
import { fetchPublicLink, postPublicEvent, uploadPublicFile, type PublicResult } from "@/lib/data/public";
import { compressImage, cx, dayOf, fmtDate, fmtDateTime, money, pct, todayISO, toNum } from "@/lib/utils";
import { Logo, Spinner } from "../ui";
import type { Rec } from "@/lib/types";

const STEPS = [["aberta", "Recebida"], ["agendada", "Agendada"], ["deslocamento", "A caminho"], ["execucao", "Em execução"], ["concluida", "Concluída"]] as const;
const stepIndex = (s: string) => { const m: Record<string, number> = { aberta: 0, agendada: 1, deslocamento: 2, execucao: 3, aguardando_material: 3, aguardando_cliente: 3, aguardando_aprovacao: 3, concluida: 4, faturada: 4 }; return m[s] ?? 0; };

function SignaturePad({ onChange }: { onChange: (d: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [(e.clientX - r.left) * (ref.current!.width / r.width), (e.clientY - r.top) * (ref.current!.height / r.height)]; };
  return (
    <div>
      <canvas ref={ref} width={320} height={110} className="w-full rounded-xl bg-white border border-line2 touch-none" aria-label="Assinatura"
        onPointerDown={(e) => { drawing.current = true; const c = ref.current!.getContext("2d")!; c.beginPath(); const [x, y] = pos(e); c.moveTo(x, y); ref.current!.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (!drawing.current) return; const c = ref.current!.getContext("2d")!; c.lineWidth = 2; c.lineCap = "round"; c.strokeStyle = "#111"; const [x, y] = pos(e); c.lineTo(x, y); c.stroke(); }}
        onPointerUp={() => { drawing.current = false; onChange(ref.current!.toDataURL("image/png")); }} />
      <button type="button" className="text-xs text-fg3 mt-1 underline" onClick={() => { ref.current!.getContext("2d")!.clearRect(0, 0, 320, 110); onChange(""); }}>Limpar assinatura</button>
    </div>
  );
}

export default function PublicPortal({ token, kind }: { token: string; kind: "quote" | "work_order" }) {
  const [res, setRes] = useState<PublicResult | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => { setName(localStorage.getItem("gbr-portal-name") || ""); }, []);

  const load = useCallback(async () => setRes(await fetchPublicLink(token)), [token]);
  useEffect(() => {
    load();
    const t = setInterval(load, kind === "work_order" ? 7000 : 15000);
    return () => clearInterval(t);
  }, [load, kind]);

  const send = async (ev: { type: string; text?: string; data?: Record<string, unknown> }, okMsg: string, needName = true) => {
    if (needName && !name.trim()) { setToast("Informe seu nome para continuar."); return false; }
    setBusy(true);
    localStorage.setItem("gbr-portal-name", name.trim());
    const ok = await postPublicEvent(token, { ...ev, name: name.trim() });
    setBusy(false);
    setToast(ok ? okMsg : "Não foi possível enviar agora. Tente novamente.");
    if (ok) await load();
    return ok;
  };

  if (!res) return <div className="min-h-dvh grid place-items-center"><Spinner size={28} /></div>;
  if (res.status !== "ok") {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div className="max-w-sm"><div className="size-14 rounded-2xl bg-solid2 grid place-items-center mx-auto mb-4">{res.status === "revoked" ? <Link2Off className="text-warn" /> : <AlertTriangle className="text-fg3" />}</div>
          <h1 className="text-xl font-bold">{res.status === "revoked" ? "Link desativado" : res.status === "notfound" ? "Link não encontrado" : "Não foi possível carregar"}</h1>
          <p className="text-sm text-fg2 mt-1.5">{res.status === "revoked" ? "Este link foi revogado pela empresa. Solicite um novo link." : res.status === "notfound" ? "Confira o endereço recebido ou peça um novo link." : "Verifique sua conexão e tente novamente."}</p>
          {res.status === "error" && <button className="btn btn-primary mt-4" onClick={load}>Tentar novamente</button>}</div>
      </div>
    );
  }
  const link = res.link;
  const s: Rec = link.snapshot || {};
  const co: Rec = s.company || {};
  const events: Rec[] = link.events || [];
  const mine = events.filter((e) => e.by === "client");
  const color = co.primaryColor || "#38a8ff";

  return (
    <div className="min-h-dvh pb-16" style={{ ["--accent" as string]: color }}>
      <header className="border-b border-line bg-bg/70 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          {co.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={co.logoUrl} alt={co.name} className="h-10 w-auto rounded-lg object-contain" /> : <Logo size={36} />}
          <div className="min-w-0 flex-1"><div className="font-bold truncate">{co.name || "Empresa"}</div><div className="text-[11px] text-fg3 truncate">{kind === "quote" ? "Proposta comercial" : "Acompanhamento de serviço"} · {s.number}</div></div>
          {(co.whatsapp || co.phone) && <a className="btn btn-sm btn-primary" href={`https://wa.me/${String(co.whatsapp || co.phone).replace(/\D/g, "").replace(/^(\d{10,11})$/, "55$1")}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> <span className="hidden sm:inline">Falar com a empresa</span></a>}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-5">
        {toast && <div role="status" className="card px-4 py-3 text-sm flex items-center gap-2 border-accent/40 anim-in"><CheckCircle2 size={16} className="text-ok" />{toast}<button className="ml-auto text-fg3" aria-label="Fechar" onClick={() => setToast("")}>✕</button></div>}
        <div>
          <p className="text-sm text-fg2">Olá{s.customerName ? `, ${String(s.customerName).split(" ")[0]}` : ""}!</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{s.title || (kind === "quote" ? "Seu orçamento" : "Sua ordem de serviço")}</h1>
        </div>

        {kind === "quote" ? <QuoteView s={s} mine={mine} send={send} busy={busy} name={name} setName={setName} /> : <OrderView s={s} events={events} mine={mine} token={token} send={send} busy={busy} name={name} setName={setName} setToast={setToast} />}

        <section className="card p-4 text-xs text-fg3 space-y-1">
          <div className="font-semibold text-fg2 text-sm mb-1">{co.name}</div>
          {co.document && <div>CNPJ/CPF: {co.document}</div>}
          <div className="flex flex-wrap gap-x-4 gap-y-1">{co.phone && <span className="flex items-center gap-1"><Phone size={12} />{co.phone}</span>}{co.email && <span className="flex items-center gap-1"><Mail size={12} />{co.email}</span>}{co.instagram && <span className="flex items-center gap-1"><AtSign size={12} />{co.instagram}</span>}{co.address && <span className="flex items-center gap-1"><Globe size={12} />{co.address}</span>}</div>
          {co.footer && <div className="pt-1">{co.footer}</div>}
        </section>
      </main>
    </div>
  );
}

type Send = (ev: { type: string; text?: string; data?: Record<string, unknown> }, ok: string, needName?: boolean) => Promise<boolean>;

function Items({ s }: { s: Rec }) {
  const t = s.totals || {};
  const ex = s.extras || {};
  return (
    <section className="card overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-[13px]"><thead><tr className="bg-black/10"><th className="th">Serviço / item</th><th className="th text-right">Qtd</th><th className="th text-right">Unit.</th><th className="th text-right">Total</th></tr></thead>
        <tbody>{(s.items || []).map((i: Rec, k: number) => <tr key={k}><td className="td"><div className="font-medium">{i.name}</div>{i.note && <div className="text-xs text-fg3">{i.note}</div>}</td><td className="td text-right">{i.qty}</td><td className="td text-right tabular-nums">{money(i.unitPrice)}</td><td className="td text-right tabular-nums font-semibold">{money(i.total)}</td></tr>)}</tbody></table></div>
      <div className="p-4 space-y-1 text-sm border-t border-line">
        <div className="flex justify-between text-fg2"><span>Subtotal</span><span className="tabular-nums">{money(t.subtotal)}</span></div>
        {toNum(t.itemDiscount) + toNum(t.generalDiscount) > 0 && <div className="flex justify-between text-fg2"><span>Descontos</span><span className="tabular-nums">- {money(toNum(t.itemDiscount) + toNum(t.generalDiscount))}</span></div>}
        {[["travel", "Deslocamento"], ["parking", "Estacionamento"], ["toll", "Pedágio"], ["extraMaterial", "Material adicional"], ["taxes", "Taxas"]].map(([k, l]) => toNum(ex[k]) > 0 && <div key={k} className="flex justify-between text-fg2"><span>{l}</span><span className="tabular-nums">{money(ex[k])}</span></div>)}
        {toNum(t.feeAmount) > 0 && <div className="flex justify-between text-fg2"><span>Taxa de pagamento ({s.paymentMethod}{s.installments > 1 ? ` ${s.installments}x` : ""})</span><span className="tabular-nums">{money(t.feeAmount)}</span></div>}
        <div className="flex justify-between items-baseline pt-2 border-t border-line"><span className="font-bold">Total</span><span className="text-2xl font-extrabold tabular-nums text-accent">{money(t.total)}</span></div>
        {s.paymentMethod && <div className="text-xs text-fg3">Forma de pagamento: {s.paymentMethod}{s.installments > 1 ? ` em ${s.installments}x` : ""}</div>}
      </div>
    </section>
  );
}

function QuoteView({ s, mine, send, busy, name, setName }: { s: Rec; mine: Rec[]; send: Send; busy: boolean; name: string; setName: (v: string) => void }) {
  const [mode, setMode] = useState<"" | "approve" | "reject" | "change_request">("");
  const [text, setText] = useState("");
  const decision = [...mine].reverse().find((e) => e.type === "approve" || e.type === "reject");
  const expired = !!s.validUntil && dayOf(s.validUntil) < todayISO() && !decision && !["aprovado", "faturado"].includes(s.status);
  const closed = decision || ["aprovado", "faturado", "recusado", "cancelado"].includes(s.status);
  const state = decision?.type === "approve" || ["aprovado", "faturado"].includes(s.status) ? "approved" : decision?.type === "reject" || s.status === "recusado" ? "rejected" : s.status === "cancelado" ? "cancelled" : expired ? "expired" : "open";
  const label = { approve: "Aprovar orçamento", reject: "Recusar orçamento", change_request: "Solicitar alteração" };
  return (
    <>
      {state !== "open" && <div className={cx("card p-4 flex items-start gap-3", state === "approved" ? "border-ok/40 bg-ok/5" : state === "rejected" ? "border-bad/40 bg-bad/5" : "border-warn/40 bg-warn/5")}>
        {state === "approved" ? <CheckCircle2 className="text-ok shrink-0" /> : state === "rejected" ? <ThumbsDown className="text-bad shrink-0" /> : <Clock className="text-warn shrink-0" />}
        <div className="text-sm"><b>{state === "approved" ? "Orçamento aprovado" : state === "rejected" ? "Orçamento recusado" : state === "expired" ? "Orçamento expirado" : "Orçamento cancelado"}</b>{decision && <div className="text-fg2">Registrado em {fmtDateTime(decision.at)}{decision.name ? ` por ${decision.name}` : ""}.</div>}{state === "approved" && <div className="text-fg2">A empresa entrará em contato para agendar.</div>}{state === "expired" && <div className="text-fg2">Solicite à empresa a renovação da proposta.</div>}</div></div>}
      {s.description && <p className="text-sm text-fg2 whitespace-pre-wrap">{s.description}</p>}
      <div className="grid grid-cols-2 gap-3 text-sm"><div className="card p-3.5"><div className="text-[11px] text-fg3 uppercase font-bold">Validade</div><div className="font-semibold">{fmtDate(s.validUntil)}</div></div><div className="card p-3.5"><div className="text-[11px] text-fg3 uppercase font-bold">Prazo de execução</div><div className="font-semibold">{s.deliveryDays ? `${s.deliveryDays} dia(s)` : "A combinar"}</div></div></div>
      <Items s={s} />
      {(s.terms || s.notes) && <section className="card p-4 text-xs text-fg2 space-y-2">{s.notes && <div><b className="text-fg">Observações:</b> {s.notes}</div>}{s.terms && <div><b className="text-fg">Condições:</b> {s.terms}</div>}</section>}
      {!closed && !expired && (
        <div className="grid grid-cols-3 gap-2.5 sticky bottom-3">
          <button className="btn btn-primary !h-12" onClick={() => setMode("approve")}><ThumbsUp size={17} /> Aprovar</button>
          <button className="btn !h-12" onClick={() => setMode("reject")}><ThumbsDown size={17} /> Recusar</button>
          <button className="btn !h-12" onClick={() => setMode("change_request")}><Pencil size={16} /> Alterar</button>
        </div>
      )}
      {closed && state !== "cancelled" && !expired && <button className="btn w-full" onClick={() => setMode("change_request")}><Pencil size={15} /> Enviar comentário / solicitar alteração</button>}
      {mode && (
        <section className="card p-4 space-y-3 anim-in border-accent/40">
          <h2 className="font-bold">{label[mode]}</h2>
          <label className="block"><span className="label">Seu nome *</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label className="block"><span className="label">Comentário {mode === "change_request" ? "*" : "(opcional)"}</span><textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "change_request" ? "O que você gostaria de alterar?" : ""} /></label>
          <div className="flex gap-2 justify-end"><button className="btn" onClick={() => setMode("")}>Cancelar</button>
            <button className="btn btn-primary" disabled={busy || (mode === "change_request" && !text.trim())} onClick={async () => { if (await send({ type: mode, text }, mode === "approve" ? "Orçamento aprovado! Obrigado." : mode === "reject" ? "Resposta registrada." : "Solicitação enviada à empresa.")) { setMode(""); setText(""); } }}>{busy ? <Spinner /> : "Confirmar"}</button></div>
        </section>
      )}
      {mine.length > 0 && <section className="card p-4"><h2 className="text-sm font-semibold mb-2">Registro das suas ações</h2><ul className="space-y-1.5 text-[13px]">{mine.map((e) => <li key={e.id}><b>{({ approve: "Aprovou", reject: "Recusou", change_request: "Solicitou alteração", message: "Mensagem" } as Record<string, string>)[e.type] || e.type}</b> · {fmtDateTime(e.at)}{e.text && <span className="text-fg2"> — “{e.text}”</span>}</li>)}</ul></section>}
    </>
  );
}

function OrderView({ s, events, mine, token, send, busy, name, setName, setToast }: { s: Rec; events: Rec[]; mine: Rec[]; token: string; send: Send; busy: boolean; name: string; setName: (v: string) => void; setToast: (v: string) => void }) {
  const idx = stepIndex(s.status);
  const [msg, setMsg] = useState("");
  const [up, setUp] = useState(false);
  const [note, setNote] = useState("");
  const [sig, setSig] = useState("");
  const [rate, setRate] = useState<Record<string, number>>({ quality: 0, service: 0, deadline: 0, price: 0, result: 0 });
  const [comment, setComment] = useState("");
  const gal = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const chat = events.filter((e) => e.type === "message").sort((a, b) => a.at.localeCompare(b.at));
  const decided = (id: string) => mine.find((e) => (e.type === "approve_additional" || e.type === "reject_additional") && e.data?.additionalId === id);
  const done = ["concluida", "faturada"].includes(s.status);
  const confirmed = s.completion || mine.find((e) => e.type === "confirm_completion");
  const evaluated = s.evaluated || mine.find((e) => e.type === "evaluation");
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "nearest" }); }, [chat.length]);

  const onFile = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!name.trim()) return setToast("Informe seu nome no campo do chat antes de enviar arquivos.");
    setUp(true);
    for (const f0 of Array.from(files)) {
      try { const f = await compressImage(f0); const r = await uploadPublicFile(token, f); await postPublicEvent(token, { type: f.type.startsWith("image/") ? "photo" : "file", name: name.trim(), data: r }); setToast("Arquivo enviado à empresa."); } catch (e) { setToast(e instanceof Error ? e.message : "Falha no envio"); }
    }
    setUp(false);
  };

  return (
    <>
      <section className="card p-4">
        <div className="flex items-center justify-between mb-3"><h2 className="font-bold">Andamento</h2><span className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent font-semibold">{s.statusLabel}</span></div>
        <ol className="flex items-start">{STEPS.map(([k, l], i) => <li key={k} className="flex-1 flex flex-col items-center text-center relative">
          {i > 0 && <span className={cx("absolute top-3 right-1/2 w-full h-0.5", i <= idx ? "bg-accent" : "bg-solid3")} />}
          <span className={cx("relative size-6 rounded-full grid place-items-center text-[11px] font-bold z-10", i <= idx ? "bg-accent text-[var(--accent-fg)]" : "bg-solid3 text-fg3")}>{i < idx || (i === idx && done) ? "✓" : i + 1}</span><span className={cx("text-[10.5px] mt-1.5", i <= idx ? "text-fg font-semibold" : "text-fg3")}>{l}</span></li>)}</ol>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm"><div><div className="text-[11px] text-fg3 uppercase font-bold">Data</div>{s.date ? `${fmtDate(s.date)} ${s.time || ""}` : "A agendar"}</div><div><div className="text-[11px] text-fg3 uppercase font-bold">Técnico</div>{s.technician || "—"}</div><div className="col-span-2"><div className="text-[11px] text-fg3 uppercase font-bold">Endereço</div>{s.address || "—"}</div></div>
        {s.description && <p className="text-sm text-fg2 mt-3 whitespace-pre-wrap">{s.description}</p>}
        {s.solution && done && <p className="text-sm mt-3"><b>Solução:</b> <span className="text-fg2">{s.solution}</span></p>}
      </section>

      {(s.additionals || []).length > 0 && (
        <section className="space-y-2.5"><h2 className="font-bold">Serviços adicionais</h2>
          {(s.additionals as Rec[]).map((a) => { const d = decided(a.id); const st = a.status !== "aguardando" ? a.status : d ? (d.type === "approve_additional" ? "aprovado" : "recusado") : "aguardando"; return (
            <div key={a.id} className={cx("card p-4", st === "aguardando" && "border-warn/40")}>
              <div className="flex items-center gap-2 flex-wrap"><b>{a.title}</b><span className="ml-auto font-bold tabular-nums">{money(a.total)}</span></div>
              {a.description && <p className="text-xs text-fg2 mt-1">{a.description}</p>}
              <ul className="text-xs text-fg2 mt-1.5">{(a.items || []).map((i: Rec, k: number) => <li key={k}>{i.qty}× {i.name} — {money(i.total)}</li>)}</ul>
              {st === "aguardando" ? <div className="mt-3 space-y-2"><input className="input input-sm" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} /><div className="grid grid-cols-2 gap-2"><button className="btn btn-primary" disabled={busy} onClick={() => send({ type: "approve_additional", data: { additionalId: a.id } }, "Serviço adicional aprovado. Obrigado!")}><ThumbsUp size={15} /> Aprovar</button><button className="btn" disabled={busy} onClick={() => send({ type: "reject_additional", data: { additionalId: a.id } }, "Resposta registrada.")}><ThumbsDown size={15} /> Recusar</button></div></div>
                : <div className={cx("mt-2 text-xs font-semibold", st === "aprovado" ? "text-ok" : "text-bad")}>{st === "aprovado" ? "✓ Aprovado" : "✕ Recusado"}</div>}
            </div>); })}</section>
      )}

      <Items s={s} />

      {((s.documents || []).length > 0 || (s.attachments || []).length > 0) && (
        <section className="card p-4"><h2 className="font-bold mb-2.5">Documentos e fotos</h2>
          <div className="space-y-1.5">{(s.documents || []).map((d: Rec, i: number) => d.url && <a key={i} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-accent"><FileText size={15} />{d.name}</a>)}</div>
          {(s.attachments || []).length > 0 && <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">{(s.attachments as Rec[]).map((a, i) => /\.(png|jpe?g|webp|gif)$/i.test(a.name || "") || a.kind !== "arquivo" ? /* eslint-disable-next-line @next/next/no-img-element */ <a key={i} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name} loading="lazy" className="aspect-square object-cover rounded-xl border border-line" /></a> : <a key={i} href={a.url} target="_blank" rel="noreferrer" className="aspect-square grid place-items-center rounded-xl bg-solid2 text-xs p-2 text-center"><Paperclip size={18} />{a.name}</a>)}</div>}
        </section>
      )}

      <section className="card p-4">
        <h2 className="font-bold mb-3 flex items-center gap-2"><MessageCircle size={17} className="text-accent" /> Conversa com a empresa</h2>
        <div className="max-h-72 overflow-y-auto space-y-2 mb-3">{!chat.length && <p className="text-xs text-fg3">Tem alguma dúvida ou pedido? Escreva abaixo.</p>}
          {chat.map((m) => <div key={m.id} className={cx("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", m.by === "company" ? "bg-solid3" : "ml-auto bg-gradient-to-br from-accent/90 to-accent2/80 text-[var(--accent-fg)]")}><div className="text-[10.5px] opacity-70">{m.by === "company" ? m.name || "Empresa" : "Você"} · {fmtDateTime(m.at)}</div>{m.text}</div>)}<div ref={chatEnd} /></div>
        <input className="input input-sm mb-2" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <div className="flex gap-2"><input className="input" placeholder="Escreva sua mensagem…" value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && msg.trim() && await send({ type: "message", text: msg }, "Mensagem enviada.")) setMsg(""); }} /><button className="btn btn-primary" disabled={busy || !msg.trim()} aria-label="Enviar mensagem" onClick={async () => { if (await send({ type: "message", text: msg }, "Mensagem enviada.")) setMsg(""); }}><Send size={16} /></button></div>
        <div className="flex gap-2 mt-2.5"><button className="btn btn-sm" disabled={up} onClick={() => cam.current?.click()}><Camera size={14} /> Tirar foto</button><button className="btn btn-sm" disabled={up} onClick={() => gal.current?.click()}><Paperclip size={14} /> Enviar foto/arquivo</button>{up && <Spinner />}</div>
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files); e.target.value = ""; }} />
        <input ref={gal} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { onFile(e.target.files); e.target.value = ""; }} />
      </section>

      {done && !confirmed && (
        <section className="card p-4 space-y-3 border-ok/40">
          <h2 className="font-bold">Confirmar conclusão do serviço</h2><p className="text-sm text-fg2">O serviço foi concluído? Confirme abaixo — ficará registrado com data e hora.</p>
          <input className="input" placeholder="Seu nome *" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="input" rows={2} placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div><span className="label">Assinatura (opcional)</span><SignaturePad onChange={setSig} /></div>
          <button className="btn btn-primary w-full !h-12" disabled={busy} onClick={() => send({ type: "confirm_completion", text: note, data: { signature: sig } }, "Conclusão confirmada. Obrigado!")}><CheckCircle2 size={17} /> Confirmar: serviço concluído</button>
        </section>
      )}
      {confirmed && <section className="card p-4 border-ok/40 bg-ok/5 text-sm flex gap-3"><CheckCircle2 className="text-ok shrink-0" /><div><b>Conclusão confirmada</b><div className="text-fg2">{fmtDateTime(confirmed.at)}{confirmed.by || confirmed.name ? ` · ${confirmed.by || confirmed.name}` : ""}</div></div></section>}

      {done && !evaluated && (
        <section className="card p-4 space-y-3">
          <h2 className="font-bold">Avalie o atendimento</h2>
          {[["quality", "Qualidade"], ["service", "Atendimento"], ["deadline", "Prazo"], ["price", "Preço"], ["result", "Resultado"]].map(([k, l]) => (
            <div key={k} className="flex items-center justify-between"><span className="text-sm">{l}</span><div className="flex gap-1" role="radiogroup" aria-label={l}>{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rate[k] === n} aria-label={`${n} estrela(s)`} onClick={() => setRate({ ...rate, [k]: n })}><Star size={24} className={n <= rate[k] ? "text-warn fill-warn" : "text-fg3"} /></button>)}</div></div>
          ))}
          <textarea className="input" rows={2} placeholder="Comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn btn-primary w-full" disabled={busy || Object.values(rate).some((v) => !v)} onClick={() => send({ type: "evaluation", text: comment, data: { ratings: rate } }, "Obrigado pela avaliação!", false)}>Enviar avaliação</button>
          <p className="text-[11px] text-fg3">Média: {pct(Object.values(rate).reduce((a, b) => a + b, 0) / 5 * 20, 0)}</p>
        </section>
      )}
      {evaluated && <p className="text-center text-xs text-fg3">Obrigado pela sua avaliação ⭐</p>}
    </>
  );
}
