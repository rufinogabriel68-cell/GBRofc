"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, MessageCircle, Settings, Trash2, XCircle } from "lucide-react";
import { Empty, PageHeader, Segmented } from "@/components/ui";
import { openEntity, useUI } from "@/components/shell/ui-context";
import { db, useCollection } from "@/lib/data/store";
import { cx, fmtDateTime } from "@/lib/utils";

const ICON: Record<string, typeof Bell> = { ok: CheckCircle2, warn: AlertTriangle, bad: XCircle, info: Info };
const TONE: Record<string, string> = { ok: "text-ok bg-ok/12", warn: "text-warn bg-warn/12", bad: "text-bad bg-bad/12", info: "text-info bg-info/12" };

export default function NotificationsPage() {
  const ui = useUI();
  const { items, loading } = useCollection("notifications");
  const [f, setF] = useState<"todas" | "novas">("todas");
  const list = useMemo(() => items.filter((n) => !n.deletedAt && (f === "todas" || !n.read)).sort((a, b) => (b.at || b.createdAt || "").localeCompare(a.at || a.createdAt || "")), [items, f]);
  const unread = items.filter((n) => !n.read && !n.deletedAt).length;
  return (
    <>
      <PageHeader title="Notificações" subtitle={unread ? `${unread} não lida(s)` : "Tudo lido"}
        actions={<><Link href="/configuracoes?tab=notificacoes" className="btn"><Settings size={15} /> Preferências</Link><button className="btn" disabled={!unread} onClick={() => items.filter((n) => !n.read).forEach((n) => db.update("notifications", n.id, { read: true }, { silent: true }))}><CheckCheck size={15} /> Marcar tudo como lido</button></>} />
      <div className="mb-4"><Segmented<typeof f> small value={f} onChange={setF} options={[{ id: "todas", label: "Todas" }, { id: "novas", label: `Não lidas${unread ? ` (${unread})` : ""}` }]} /></div>
      {!list.length && !loading ? <div className="card"><Empty icon={Bell} title="Sem notificações" text="Aprovações de orçamento, mensagens, OS atrasadas, estoque baixo, contas vencendo e metas aparecem aqui." /></div> : (
        <div className="space-y-2">
          {list.map((n) => {
            const I = n.type === "message" || n.type === "upload" ? MessageCircle : ICON[n.severity] || Bell;
            return (
              <div key={n.id} className={cx("card p-3.5 flex items-start gap-3 transition", !n.read && "border-accent/40 bg-accent/[.04]")}>
                <span className={cx("size-9 rounded-xl grid place-items-center shrink-0", TONE[n.severity] || TONE.info)}><I size={17} /></span>
                <button className="min-w-0 flex-1 text-left" onClick={() => { db.update("notifications", n.id, { read: true }, { silent: true }); if (n.entity) openEntity(ui, n.entity); }}>
                  <div className="text-sm font-semibold">{n.title} {!n.read && <span className="inline-block size-1.5 rounded-full bg-accent ml-1 align-middle" aria-label="Não lida" />}</div>
                  {n.body && <div className="text-xs text-fg2 mt-0.5">{n.body}</div>}
                  <div className="text-[11px] text-fg3 mt-1">{fmtDateTime(n.at || n.createdAt)}</div>
                </button>
                <button className="text-fg3 hover:text-bad" aria-label="Excluir notificação" onClick={() => db.remove("notifications", n.id)}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
