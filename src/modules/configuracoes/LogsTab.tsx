"use client";
import { useEffect, useState } from "react";
import { Bug, Copy, Trash2 } from "lucide-react";
import { Badge, Panel } from "@/components/ui";
import { clearLogs, formatLogs, getLogs, onLogs } from "@/lib/logs";
import { useSyncStatus } from "@/lib/data/sync-status";
import { toast, toastError } from "@/lib/toast";

const hhmmss = (at: number) => new Date(at).toISOString().slice(11, 19);

export default function LogsTab() {
  const s = useSyncStatus();
  const [, bump] = useState(0);
  useEffect(() => onLogs(() => bump((n) => n + 1)), []);

  const logs = getLogs()
    .slice()
    .reverse();
  const ctx = [
    `modo: ${s.mode}`,
    `status: ${s.label}`,
    `pendências: ${s.pending}${s.stuck ? " (travadas)" : ""}`,
    `online: ${s.online}`,
    `cache local: ${s.fromCache ? "sim" : "não"}`,
    `última sync: ${s.lastSync ? new Date(s.lastSync).toISOString() : "—"}`,
    s.error ? `erro atual: ${s.error}` : "erro atual: —",
  ].join(" · ");

  const copyAll = () => {
    navigator.clipboard
      .writeText(formatLogs(ctx))
      .then(() => toast(`Logs copiados (${logs.length}) — é só colar na conversa`))
      .catch(() => toast("Não foi possível copiar", "error"));
  };

  const tone = (l: string) => (l === "error" ? "warn" : l === "warn" ? "info" : "neutral");

  return (
    <div className="space-y-4">
      <Panel title="Diagnóstico do sistema">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <Badge tone={s.label === "Sincronizado" ? "ok" : s.label === "Sincronizando..." ? "info" : "warn"}>{s.label}</Badge>
          <span className="text-fg2">backend: <b>{s.mode === "firestore" ? "Firebase Firestore" : "PostgreSQL (servidor)"}</b></span>
          <span className="text-fg2">pendências: <b>{s.pending}</b></span>
          <span className="text-fg2">online: <b>{s.online ? "sim" : "não"}</b></span>
          {s.error && <Badge tone="warn">erro: {s.error.slice(0, 60)}{s.error.length > 60 ? "…" : ""}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-primary btn-sm" onClick={copyAll}>
            <Copy size={14} /> Copiar logs para enviar
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              toastError("Erro de teste — ignore, só demonstra que esta aba captura os erros.");
            }}
          >
            <Bug size={14} /> Gerar erro de teste
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              clearLogs();
              toast("Logs limpos");
            }}
          >
            <Trash2 size={14} /> Limpar
          </button>
        </div>
        <p className="text-[11px] text-fg3 mt-2">
          Aqui aparecem erros de console, de rede/sincronização, de promessas e toasts de erro — os últimos 200 eventos ficam guardados neste navegador
          (sobrevivem ao recarregar a página). Cole o texto copiado aqui na conversa quando precisar de ajuda.
        </p>
      </Panel>

      <Panel title={`Eventos (${logs.length})`}>
        {logs.length === 0 ? (
          <p className="text-sm text-fg3">Nenhum erro capturado até agora. Se algo falhar, ele aparece aqui automaticamente.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto space-y-1 font-mono text-[12px] pr-1">
            {logs.map((e) => (
              <div key={e.id} className="flex gap-2 items-start border-b border-line/60 py-1 last:border-0">
                <span className="text-fg3 shrink-0">{hhmmss(e.at)}</span>
                <Badge tone={tone(e.level) as "ok" | "warn" | "info" | "neutral"}>{e.level}</Badge>
                <span className="text-fg3 shrink-0 w-16 truncate">{e.scope}</span>
                <span className="text-fg2 whitespace-pre-wrap break-all min-w-0">{e.msg}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
