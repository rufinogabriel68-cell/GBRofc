"use client";
import { useMemo, useRef, useState } from "react";
import {
  Archive, ClipboardList, Cpu, Download, FileText, FolderOpen, MapPin, MessageCircle, Pencil, Phone, Plus, ShieldCheck, ShieldOff, StickyNote, Trash2, UserRound, Wallet, History, Paperclip, Repeat, Star, MoreHorizontal,
} from "lucide-react";
import { Avatar, Badge, Drawer, Empty, Kpi, Menu, Spinner, StatusBadge, Tabs, confirmDialog } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { useUploader } from "@/components/crud/RecordForm";
import { db, useCollection, useRecord } from "@/lib/data/store";
import { OS_STATUS, PIPELINE, QUOTE_STATUS, TXN_STATUS } from "@/lib/constants";
import { txnStatus } from "@/lib/finance";
import { customerAddress } from "@/lib/workflows";
import { toast } from "@/lib/toast";
import type { Rec } from "@/lib/types";
import { dayOf, download, fmtDate, fmtDateTime, money, nowISO, sum, toNum, todayISO } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { COMPANY_ID } from "@/lib/session";

type Tab = "resumo" | "enderecos" | "historico" | "financeiro" | "equipamentos" | "garantias" | "documentos" | "conversas" | "anotacoes" | "lgpd";

function RelatedList({ collection, match, defaults, render, add, empty }: { collection: string; match: (r: Rec) => boolean; defaults: Record<string, any>; render: (r: Rec) => React.ReactNode; add: string; empty: string }) {
  const ui = useUI();
  const { items } = useCollection(collection);
  const list = items.filter((r) => !r.deletedAt && match(r));
  return (
    <div className="space-y-2.5">
      <div className="flex justify-end"><button className="btn btn-sm btn-primary" onClick={() => ui.openForm(collection, null, defaults)}><Plus size={14} /> {add}</button></div>
      {!list.length && <p className="text-xs text-fg3 text-center py-6">{empty}</p>}
      {list.map((r) => (
        <div key={r.id} className="card-solid p-3 flex items-start gap-3">
          <div className="flex-1 min-w-0 text-sm">{render(r)}</div>
          <button className="btn btn-sm btn-icon btn-ghost" aria-label="Editar" onClick={() => ui.openForm(collection, r.id)}><Pencil size={14} /></button>
          <button className="btn btn-sm btn-icon btn-ghost btn-danger" aria-label="Excluir" onClick={async () => { if (await confirmDialog({ title: "Excluir registro?", confirmText: "Excluir", danger: true })) db.remove(collection, r.id); }}><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export default function CustomerProfile({ id, onClose }: { id: string; onClose: () => void }) {
  const ui = useUI();
  const { rec: c, loading } = useRecord("customers", id);
  const quotes = useCollection("quotes").items.filter((q) => q.customerId === id && !q.deletedAt);
  const orders = useCollection("work_orders").items.filter((o) => o.customerId === id && !o.deletedAt);
  const txns = useCollection("financial_transactions").items.filter((t) => t.customerId === id && !t.deletedAt);
  const evals = useCollection("evaluations").items.filter((e) => e.customerId === id);
  const tasks = useCollection("crm_activities").items.filter((t) => t.customerId === id && !t.deletedAt);
  const docs = useCollection("documents").items.filter((d) => d.customerId === id && !d.deletedAt);
  const notes = useCollection("notes").items.filter((n) => n.customerId === id && !n.deletedAt);
  const equipment = useCollection("customer_equipment").items.filter((e) => e.customerId === id);
  const msgsAll = useCollection("work_order_messages").items;
  const [tab, setTab] = useState<Tab>("resumo");
  const [note, setNote] = useState("");
  const { upload, busy } = useUploader();
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const paid = txns.filter((t) => t.type === "entrada" && t.status === "pago");
    const revenue = sum(paid, (t) => toNum(t.amount));
    const done = orders.filter((o) => ["concluida", "faturada"].includes(o.status));
    const last = done.map((o) => dayOf(o.completedAt || o.date)).sort().pop();
    const nextTask = tasks.filter((t) => t.status === "aberta").sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];
    return { revenue, done: done.length, ticket: done.length ? revenue / done.length : 0, last, nextTask, recurrent: done.length >= 2 };
  }, [txns, orders, tasks]);

  const timeline = useMemo(() => {
    const ev: { at: string; text: string; tone: string }[] = [];
    quotes.forEach((q) => ev.push({ at: q.createdAt, text: `Orçamento ${q.number} criado (${money(q.total)})`, tone: "info" }));
    quotes.filter((q) => q.approvedAt).forEach((q) => ev.push({ at: q.approvedAt, text: `Orçamento ${q.number} aprovado`, tone: "ok" }));
    orders.forEach((o) => ev.push({ at: o.createdAt, text: `${o.number} aberta — ${o.title}`, tone: "info" }));
    orders.filter((o) => o.completedAt).forEach((o) => ev.push({ at: o.completedAt, text: `${o.number} concluída`, tone: "ok" }));
    txns.filter((t) => t.status === "pago" && t.type === "entrada").forEach((t) => ev.push({ at: t.paidAt ? `${t.paidAt}T12:00:00` : t.updatedAt, text: `Pagamento recebido: ${money(t.amount)}`, tone: "ok" }));
    notes.forEach((n) => ev.push({ at: n.createdAt, text: `Anotação: ${n.title || String(n.body || "").slice(0, 50)}`, tone: "neutral" }));
    evals.forEach((e) => ev.push({ at: e.createdAt, text: `Avaliação ${e.overall}/5${e.comment ? ` — “${e.comment}”` : ""}`, tone: "warn" }));
    equipment.forEach((e) => ev.push({ at: e.installDate ? `${e.installDate}T12:00:00` : e.createdAt, text: `Equipamento: ${e.type} ${e.brand || ""} ${e.model || ""}`.trim(), tone: "neutral" }));
    tasks.filter((t) => t.status === "concluida").forEach((t) => ev.push({ at: t.doneAt || t.updatedAt, text: `Tarefa concluída: ${t.title}`, tone: "neutral" }));
    return ev.filter((e) => e.at).sort((a, b) => b.at.localeCompare(a.at));
  }, [quotes, orders, txns, notes, evals, equipment, tasks]);

  if (!c) return <Drawer open onClose={onClose} title="Cliente">{loading ? <div className="grid place-items-center h-64"><Spinner size={26} /></div> : <p className="p-6 text-sm text-fg3">Cliente não encontrado.</p>}</Drawer>;

  const phone = c.whatsapp || c.phone;
  const exportData = () => {
    const data = { exportedAt: nowISO(), customer: c, addresses: db.list("customer_addresses").filter((a) => a.customerId === id), quotes, orders, transactions: txns, equipment, notes, evaluations: evals, tasks };
    download(`cliente-${c.name.replace(/\W+/g, "_")}.json`, JSON.stringify(data, null, 2), "application/json");
  };
  const anonymize = async () => {
    if (!(await confirmDialog({ title: "Anonimizar cliente (LGPD)?", message: "Nome, contatos, documento, endereço e anotações pessoais serão apagados. Os valores financeiros são mantidos para obrigações legais. Não há volta.", confirmText: "Anonimizar", danger: true }))) return;
    db.update("customers", id, { name: "Cliente anonimizado", phone: "", whatsapp: "", email: "", document: "", street: "", number: "", complement: "", district: "", zip: "", notes: "", tags: [], consent: false, anonymizedAt: nowISO() });
    toast("Dados pessoais anonimizados");
  };
  const uploadDocs = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      const r = await upload(f, `customers/${id}`);
      if (r) db.create("documents", { kind: "file", type: f.type.startsWith("image/") ? "foto" : "arquivo", title: f.name, customerId: id, file: { url: r.url, path: r.path, name: f.name, type: f.type, size: r.size } });
    }
    toast("Arquivo(s) enviado(s)");
  };
  const myOrderIds = new Set(orders.map((o) => o.id));
  const msgs = msgsAll.filter((m) => myOrderIds.has(m.workOrderId)).sort((a, b) => (a.at || "").localeCompare(b.at || ""));

  return (
    <Drawer open onClose={onClose} size="xl" title={<span className="flex items-center gap-3"><Avatar name={c.name} size={32} />{c.name}</span>} subtitle={[c.phone, c.email, c.city].filter(Boolean).join(" · ")}
      actions={
        <>
          {phone && <a className="btn btn-sm hidden sm:inline-flex" href={waLink(phone, "")} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}
          <button className="btn btn-sm btn-primary hidden sm:inline-flex" onClick={() => ui.openForm("quotes", null, { customerId: id })}><FileText size={14} /> Orçamento</button>
          <Menu label="Mais ações" trigger={<MoreHorizontal size={17} />} items={[
            { label: "Editar dados", icon: Pencil, onClick: () => ui.openForm("customers", id) },
            { label: "Novo orçamento", icon: FileText, onClick: () => ui.openForm("quotes", null, { customerId: id }) },
            { label: "Nova OS", icon: ClipboardList, onClick: () => ui.openForm("work_orders", null, { customerId: id }) },
            phone && { label: "Ligar", icon: Phone, onClick: () => (window.location.href = `tel:${phone}`) },
            { label: c.favorite ? "Remover dos favoritos" : "Favoritar", icon: Star, onClick: () => db.toggleFavorite("customers", id) },
            { label: c.archived ? "Desarquivar" : "Arquivar", icon: Archive, onClick: () => db.archive("customers", id, !c.archived) },
            "sep",
            { label: "Mover para a lixeira", icon: Trash2, danger: true, onClick: async () => { if (await confirmDialog({ title: "Mover cliente para a lixeira?", message: "O histórico é preservado e o cliente pode ser restaurado.", confirmText: "Excluir", danger: true })) { db.softDelete("customers", id); onClose(); } } },
          ]} />
        </>
      }>
      <div className="px-4 sm:px-5 pt-4"><Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "resumo", label: "Resumo", icon: UserRound }, { id: "historico", label: "Orçamentos e OS", icon: ClipboardList, count: quotes.length + orders.length }, { id: "financeiro", label: "Pagamentos", icon: Wallet },
        { id: "enderecos", label: "Endereços", icon: MapPin }, { id: "equipamentos", label: "Equipamentos", icon: Cpu }, { id: "garantias", label: "Garantias", icon: ShieldCheck },
        { id: "documentos", label: "Documentos", icon: FolderOpen }, { id: "conversas", label: "Conversas", icon: MessageCircle }, { id: "anotacoes", label: "Anotações", icon: StickyNote }, { id: "lgpd", label: "LGPD", icon: ShieldOff },
      ]} /></div>
      <div className="p-4 sm:p-5 space-y-4">
        {tab === "resumo" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="Faturamento" value={money(stats.revenue)} icon={Wallet} tone="ok" />
              <Kpi label="Serviços" value={stats.done} sub={stats.recurrent ? "Cliente recorrente" : "Concluídos"} icon={Repeat} tone="info" />
              <Kpi label="Ticket médio" value={money(stats.ticket)} icon={FileText} />
              <Kpi label="Último atendimento" value={stats.last ? fmtDate(stats.last) : "—"} sub={stats.nextTask ? `Próximo contato: ${fmtDate(stats.nextTask.dueDate)}` : "Sem contato agendado"} icon={History} tone="violet" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="card p-4 text-sm space-y-1.5">
                <div className="text-[11px] font-bold uppercase text-fg3">Dados</div>
                <div><span className="text-fg3">Documento:</span> {c.document || "—"}</div><div><span className="text-fg3">Telefone:</span> {c.phone || "—"} · <span className="text-fg3">WhatsApp:</span> {c.whatsapp || "—"}</div><div><span className="text-fg3">E-mail:</span> {c.email || "—"}</div>
                <div><span className="text-fg3">Endereço:</span> {customerAddress(c) || "—"}</div><div className="flex flex-wrap gap-1.5 pt-1"><Badge tone="info">{PIPELINE.find((p) => p.id === c.stage)?.label || "Cliente"}</Badge>{(c.tags || []).map((t: string) => <Badge key={t}>{t}</Badge>)}</div>
                {c.notes && <p className="text-fg2 pt-1 whitespace-pre-wrap">{c.notes}</p>}
              </div>
              <div className="card p-4">
                <div className="text-[11px] font-bold uppercase text-fg3 mb-2">Timeline</div>
                <ol className="space-y-2 border-l border-line2 ml-1.5 pl-4 max-h-72 overflow-y-auto">
                  {timeline.slice(0, 25).map((e, i) => <li key={i} className="relative text-[13px]"><span className={`absolute -left-[21px] top-1.5 size-2 rounded-full ${e.tone === "ok" ? "bg-ok" : e.tone === "warn" ? "bg-warn" : e.tone === "info" ? "bg-accent" : "bg-fg3"}`} />{e.text}<div className="text-[11px] text-fg3">{fmtDateTime(e.at)}</div></li>)}
                  {!timeline.length && <p className="text-xs text-fg3">Sem eventos ainda.</p>}
                </ol>
              </div>
            </div>
          </>
        )}
        {tab === "historico" && (
          <div className="space-y-4">
            <div className="flex gap-2"><button className="btn btn-sm btn-primary" onClick={() => ui.openForm("quotes", null, { customerId: id })}><Plus size={14} /> Orçamento</button><button className="btn btn-sm" onClick={() => ui.openForm("work_orders", null, { customerId: id })}><Plus size={14} /> OS</button></div>
            <div><div className="text-[11px] font-bold uppercase text-fg3 mb-1.5">Orçamentos</div>{quotes.length ? quotes.map((q) => <button key={q.id} onClick={() => ui.openDetail("quotes", q.id)} className="card-solid w-full px-3 h-12 mb-1.5 flex items-center gap-2 text-sm text-left hover:border-accent/40"><b>{q.number}</b><span className="flex-1 truncate text-fg2">{q.title}</span><span className="tabular-nums font-semibold">{money(q.total)}</span><StatusBadge def={QUOTE_STATUS[q.status]} /></button>) : <p className="text-xs text-fg3">Nenhum orçamento.</p>}</div>
            <div><div className="text-[11px] font-bold uppercase text-fg3 mb-1.5">Ordens de serviço</div>{orders.length ? orders.map((o) => <button key={o.id} onClick={() => ui.openDetail("work_orders", o.id)} className="card-solid w-full px-3 h-12 mb-1.5 flex items-center gap-2 text-sm text-left hover:border-accent/40"><b>{o.number}</b><span className="flex-1 truncate text-fg2">{o.title}</span><span className="tabular-nums font-semibold">{money(o.total)}</span><StatusBadge def={OS_STATUS[o.status]} /></button>) : <p className="text-xs text-fg3">Nenhuma OS.</p>}</div>
            <div><div className="text-[11px] font-bold uppercase text-fg3 mb-1.5">Serviços contratados</div><div className="flex flex-wrap gap-1.5">{[...new Set(orders.flatMap((o) => (o.pricing?.lines || []).map((l: Rec) => l.name)))].map((n) => <Badge key={String(n)}>{String(n)}</Badge>)}{!orders.length && <span className="text-xs text-fg3">—</span>}</div></div>
          </div>
        )}
        {tab === "financeiro" && (txns.length ? txns.sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || "")).map((t) => <div key={t.id} className="card-solid px-3 h-12 mb-1.5 flex items-center gap-2 text-sm"><span className="text-fg3 w-20">{fmtDate(t.dueDate)}</span><span className="flex-1 truncate">{t.description}</span><span className="tabular-nums font-semibold">{money(t.amount)}</span><StatusBadge def={TXN_STATUS[txnStatus(t)]} /></div>) : <Empty icon={Wallet} title="Sem pagamentos" text="Cobranças aparecem aqui ao concluir uma OS." />)}
        {tab === "enderecos" && <RelatedList collection="customer_addresses" match={(a) => a.customerId === id} defaults={{ customerId: id }} add="Endereço" empty="Endereços adicionais (obra, filial, casa de praia...)." render={(a) => <><b>{a.label || "Endereço"}</b><div className="text-fg2 text-xs">{[a.street, a.number, a.district, a.city].filter(Boolean).join(", ")}</div></>} />}
        {tab === "equipamentos" && <RelatedList collection="customer_equipment" match={(e) => e.customerId === id} defaults={{ customerId: id }} add="Equipamento" empty="Nenhum equipamento cadastrado." render={(e) => <><b>{e.type} {e.brand} {e.model}</b><div className="text-fg2 text-xs">{[e.location, e.serial && `Série ${e.serial}`, e.warrantyUntil && `Garantia até ${fmtDate(e.warrantyUntil)}`].filter(Boolean).join(" · ")}</div>{(e.maintenance || []).length > 0 && <div className="text-[11px] text-fg3 mt-0.5">{e.maintenance.length} manutenção(ões) · última: {fmtDate(e.maintenance[e.maintenance.length - 1].date)}</div>}</>} />}
        {tab === "garantias" && <RelatedList collection="warranties" match={(w) => w.customerId === id} defaults={{ customerId: id }} add="Garantia" empty="Garantias são criadas ao concluir uma OS." render={(w) => <><b>{w.title}</b><div className="text-fg2 text-xs">{fmtDate(w.startDate)} → {fmtDate(w.endDate)} {dayOf(w.endDate) < todayISO() ? "· vencida" : "· ativa"}</div></>} />}
        {tab === "documentos" && (
          <div className="space-y-3">
            <div className="flex justify-end"><button className="btn btn-sm btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}><Paperclip size={14} /> {busy ? "Enviando…" : "Anexar arquivo"}</button><input ref={fileRef} type="file" multiple hidden onChange={(e) => { uploadDocs(e.target.files); e.target.value = ""; }} /></div>
            {!docs.length && <p className="text-xs text-fg3 text-center py-6">Nenhum documento. Arquivos ficam em companies/{COMPANY_ID}/customers/{"{id}"}.</p>}
            {docs.map((d) => <div key={d.id} className="card-solid px-3 h-12 flex items-center gap-2 text-sm"><FolderOpen size={15} className="text-fg3" /><span className="flex-1 truncate">{d.title}</span>{d.file?.url && <a className="btn btn-sm btn-icon btn-ghost" href={d.file.url} target="_blank" rel="noreferrer" aria-label="Abrir"><Download size={14} /></a>}</div>)}
          </div>
        )}
        {tab === "conversas" && (msgs.length ? <div className="space-y-2">{msgs.map((m) => <div key={m.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.from === "company" ? "ml-auto bg-accent/20" : "bg-solid3"}`}><div className="text-[10.5px] text-fg3">{orders.find((o) => o.id === m.workOrderId)?.number} · {m.name} · {fmtDateTime(m.at)}</div>{m.text}</div>)}</div> : <Empty icon={MessageCircle} title="Sem conversas" text="Mensagens trocadas pelo portal da OS aparecem aqui." />)}
        {tab === "anotacoes" && (
          <div className="space-y-3">
            <div className="flex gap-2"><textarea className="input" rows={2} placeholder="Nova anotação sobre o cliente…" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn btn-primary" disabled={!note.trim()} onClick={() => { db.create("notes", { title: "", body: note.trim(), customerId: id, pinned: false, checklist: [], tags: [] }); setNote(""); toast("Anotação salva"); }}>Salvar</button></div>
            {notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((n) => <div key={n.id} className="card-solid p-3 text-sm flex gap-2"><div className="flex-1"><div className="text-[11px] text-fg3 mb-0.5">{fmtDateTime(n.createdAt)}</div><div className="whitespace-pre-wrap">{n.title && <b>{n.title}<br /></b>}{n.body}</div></div><button className="text-fg3 hover:text-bad" aria-label="Excluir" onClick={() => db.softDelete("notes", n.id)}><Trash2 size={14} /></button></div>)}
          </div>
        )}
        {tab === "lgpd" && (
          <div className="space-y-3 max-w-xl">
            <div className="card p-4 text-sm"><div className="font-semibold mb-1">Consentimento</div>{c.consent ? <span className="text-ok">Consentimento registrado em {fmtDateTime(c.consentAt)}.</span> : <span className="text-fg2">Sem consentimento registrado. Edite os dados do cliente para registrar.</span>}</div>
            <div className="card p-4 text-sm space-y-2"><div className="font-semibold">Direitos do titular</div><p className="text-fg2 text-xs">Exporte todos os dados do cliente (portabilidade), corrija cadastro pelo botão Editar ou anonimize os dados pessoais quando legalmente aplicável.</p><div className="flex gap-2"><button className="btn btn-sm" onClick={exportData}><Download size={14} /> Exportar dados (JSON)</button><button className="btn btn-sm" onClick={() => ui.openForm("customers", id)}><Pencil size={14} /> Corrigir dados</button><button className="btn btn-sm btn-danger" onClick={anonymize}>Anonimizar</button></div></div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
