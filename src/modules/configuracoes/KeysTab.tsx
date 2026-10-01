"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Badge, Panel } from "@/components/ui";
import { buildIsFirebaseConfigured, isFirebaseConfigured } from "@/lib/firebase";
import {
  FIREBASE_CONFIG_KEYS,
  SERVER_ENV_KEYS,
  clearFirebaseOverrides,
  fbEnv,
  getBackendOverride,
  getFirebaseOverrides,
  saveFirebaseOverrides,
  setBackendOverride,
} from "@/lib/runtime-config";
import { COMPANY_ID } from "@/lib/session";
import { toast } from "@/lib/toast";

type Status = {
  server: Record<string, boolean>;
  build: { DATA_BACKEND: string; COMPANY_ID: string; FIREBASE: Record<string, boolean | string> };
  db: boolean;
} | null;

const copy = (text: string) => {
  navigator.clipboard
    .writeText(text)
    .then(() => toast("Copiado!"))
    .catch(() => toast("Não foi possível copiar", "error"));
};

const initialFb = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const k of FIREBASE_CONFIG_KEYS) out[k.name] = fbEnv(k.name) || "";
  out.NEXT_PUBLIC_FIREBASE_ANON_AUTH = fbEnv("NEXT_PUBLIC_FIREBASE_ANON_AUTH") || "true";
  out.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY = fbEnv("NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY") || "";
  return out;
};

export default function KeysTab() {
  const [status, setStatus] = useState<Status>(null);
  // Estado inicial vazio de propósito: o servidor renderiza vazio/"auto" e a
  // hidratação bate; os valores reais entram no efeito (pós-mount).
  const [fb, setFb] = useState<Record<string, string>>({});
  const [backend, setBackend] = useState("auto");
  const [meta, setMeta] = useState({ hasOverride: false, override: "" });
  const [mounted, setMounted] = useState(false);
  const [srv, setSrv] = useState<Record<string, string>>({});

  const load = () => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((j: Status) => setStatus(j))
      .catch(() => setStatus(null));
  };
  useEffect(() => {
    setMounted(true);
    setFb(initialFb());
    setBackend(getBackendOverride() || "auto");
    setMeta({ hasOverride: Object.keys(getFirebaseOverrides()).length > 0, override: getBackendOverride() });
    load();
  }, []);

  const buildFb = status?.build?.FIREBASE || {};

  // Bloco pronto para colar no Vercel/.env (usa o valor efetivo deste navegador).
  const fbBlock = [
    ...FIREBASE_CONFIG_KEYS.map((k) => `${k.name}=${fbEnv(k.name) || ""}`),
    `NEXT_PUBLIC_FIREBASE_ANON_AUTH=${fbEnv("NEXT_PUBLIC_FIREBASE_ANON_AUTH") || "true"}`,
    `NEXT_PUBLIC_COMPANY_ID=${COMPANY_ID}`,
  ].join("\n");

  const saveFb = () => {
    saveFirebaseOverrides(fb);
    toast("Chaves salvas — recarregando…");
    setTimeout(() => location.reload(), 400);
  };
  const clearFb = () => {
    clearFirebaseOverrides();
    toast("Overrides removidos — usando as chaves do build. Recarregando…");
    setTimeout(() => location.reload(), 400);
  };
  const applyBackend = () => {
    setBackendOverride(backend as "" | "auto" | "firebase" | "postgres");
    toast(`Modo "${backend}" salvo — recarregando…`);
    setTimeout(() => location.reload(), 400);
  };

  const input = (value: string, on: (v: string) => void, placeholder = "") => (
    <input className="input input-sm font-mono text-[12px]" value={value} placeholder={placeholder} onChange={(e) => on(e.target.value)} spellCheck={false} autoComplete="off" />
  );

  // Pré-mount (servidor + hidratação) usa o valor do build; depois do efeito,
  // o valor efetivo considerando overrides colados nesta aba.
  const fbOn = mounted ? isFirebaseConfigured : buildIsFirebaseConfigured;

  return (
    <div className="space-y-4">
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            Firebase — configurar por dentro{" "}
            <Badge tone={fbOn ? "ok" : "warn"}>{fbOn ? "● ativo" : "○ inativo"}</Badge>
            {meta.hasOverride && <Badge tone="info">override colado</Badge>}
          </span>
        }
      >
        <p className="text-xs text-fg3 mb-3">
          Cole os valores (Console do Firebase → Configurações do projeto → Seus apps → Configuração do seu app web) e clique em <b>Salvar e aplicar</b> — o app
          recarrega já usando essas chaves, <b>sem precisar de deploy</b>. Campo vazio = usa a variável do build. Depois, copie o bloco para o Vercel
          (Environment Variables) para valer em qualquer dispositivo.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {FIREBASE_CONFIG_KEYS.map((k) => (
            <label key={k.name} className="block">
              <span className="label">
                {k.label} <span className="text-fg3 font-normal normal-case">· {k.name}</span>
              </span>
              {input(fb[k.name] || "", (v) => setFb({ ...fb, [k.name]: v }))}
              <span className="text-[11px] text-fg3">{k.hint}</span>
            </label>
          ))}
          <label className="block">
            <span className="label">
              Login anônimo <span className="text-fg3 font-normal normal-case">· NEXT_PUBLIC_FIREBASE_ANON_AUTH</span>
            </span>
            <select className="input input-sm" value={fb.NEXT_PUBLIC_FIREBASE_ANON_AUTH || ""} onChange={(e) => setFb({ ...fb, NEXT_PUBLIC_FIREBASE_ANON_AUTH: e.target.value })}>
              <option value="" disabled>
                carregando…
              </option>
              <option value="true">ativado (padrão — sem tela de login)</option>
              <option value="false">desativado (exige Auth real)</option>
            </select>
          </label>
          <label className="block">
            <span className="label">
              App Check (opcional) <span className="text-fg3 font-normal normal-case">· APPCHECK_SITE_KEY</span>
            </span>
            {input(fb.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY || "", (v) => setFb({ ...fb, NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY: v }), "chave reCAPTCHA v3, se usar App Check")}
          </label>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn btn-primary" onClick={saveFb}>
            <Save size={15} /> Salvar e aplicar
          </button>
          <button className="btn" onClick={clearFb}>
            <RotateCcw size={15} /> Limpar (usar do build)
          </button>
          <button className="btn" onClick={() => copy(fbBlock)}>
            <Copy size={15} /> Copiar bloco NEXT_PUBLIC
          </button>
        </div>
        <p className="text-[11px] text-fg3 mt-2">
          Valores efetivos hoje: projeto <b>{fb.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "—"}</b> · origem: {meta.hasOverride ? "override desta aba" : "build/Vercel"}.
        </p>
      </Panel>

      <Panel title="Modo de dados">
        <p className="text-xs text-fg3 mb-3">
          Escolhe de onde vêm os dados: <b>Firebase (Firestore)</b> ou <b>servidor (PostgreSQL + DATABASE_URL)</b>. Equivale à variável{" "}
          <code className="kbd">NEXT_PUBLIC_DATA_BACKEND</code> no Vercel; aqui aplica só neste navegador.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { v: "auto", l: "Automático (Firebase se as chaves existirem)" },
            { v: "firebase", l: "Forçar Firebase" },
            { v: "postgres", l: "Forçar PostgreSQL (servidor)" },
          ].map((o) => (
            <button key={o.v} onClick={() => setBackend(o.v)} aria-pressed={backend === o.v} className={"h-9 px-3.5 rounded-xl border text-[13px] font-semibold " + (backend === o.v ? "bg-accent/15 border-accent/40 text-accent" : "border-line text-fg2")}>
              {backend === o.v ? "✓ " : ""}
              {o.l}
            </button>
          ))}
          <button className="btn btn-sm btn-primary" onClick={applyBackend}>
            <Save size={14} /> Aplicar e recarregar
          </button>
        </div>
        <p className="text-[11px] text-fg3 mt-2">
          Valor atual: <b>{meta.override || status?.build?.DATA_BACKEND || "auto"}</b> {meta.override ? "(override local)" : "(do build)"} · modo efetivo do
          adapter: <b>{mounted ? (isFirebaseConfigured ? "Firebase Firestore" : "PostgreSQL (servidor)") : "…"}</b>.
        </p>
      </Panel>

      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            Variáveis do servidor (Vercel){" "}
            <button className="btn btn-sm" onClick={load}>
              <RefreshCw size={13} /> Verificar
            </button>
          </span>
        }
      >
        <p className="text-xs text-fg3 mb-3">
          Estas <b>não</b> existem no navegador: coloque-as no <b>Vercel → Settings → Environment Variables</b> (ou no <code className="kbd">.env</code> local) e
          faça um novo deploy. Cole o valor aqui só para montar a linha pronta de copiar.
        </p>
        <div className="space-y-2">
          {SERVER_ENV_KEYS.map((k) => {
            const present = status ? status.server[k.name] : null;
            return (
              <div key={k.name} className="grid sm:grid-cols-[220px_1fr_auto] gap-2 items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="kbd text-[11px]">{k.name}</code>
                    {present === null ? <Badge>—</Badge> : present ? <Badge tone="ok">carregado</Badge> : <Badge tone="warn">ausente</Badge>}
                  </div>
                  <div className="text-[11px] text-fg3">
                    {k.label} — {k.hint}
                  </div>
                </div>
                {input(srv[k.name] || "", (v) => setSrv({ ...srv, [k.name]: v }), "cole o valor…")}
                <button className="btn btn-sm" disabled={!srv[k.name]} onClick={() => copy(`${k.name}=${srv[k.name]}`)}>
                  <Copy size={13} /> Copiar linha
                </button>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn btn-sm" disabled={!Object.values(srv).some(Boolean)} onClick={() => copy(SERVER_ENV_KEYS.filter((k) => srv[k.name]).map((k) => `${k.name}=${srv[k.name]}`).join("\n"))}>
              <Copy size={13} /> Copiar todas as linhas preenchidas
            </button>
            <span className="text-[11px] text-fg3 self-center">
              Status do banco:{" "}
              {status === null ? "…" : status.db ? <b className="text-ok">conectado</b> : <b className="text-warn">sem conexão</b>}
            </span>
          </div>
        </div>
      </Panel>

      <Panel title="Chaves de build — o que já está no deploy do Vercel">
        <p className="text-xs text-fg3 mb-3">
          Cada linha abaixo é uma variável <b>NEXT_PUBLIC_*</b> como ela existe <b>agora no build</b> deste deploy (as NEXT_PUBLIC entram no app na hora do
          build — mudou no Vercel → precisa de redeploy). O botão copia <code className="kbd">NOME=valor</code> pronto para colar no Vercel.
        </p>
        <div className="space-y-1.5">
          {FIREBASE_CONFIG_KEYS.map((k) => {
            const inBuild = Boolean(buildFb[k.name.replace("NEXT_PUBLIC_FIREBASE_", "")]);
            return (
              <div key={k.name} className="grid sm:grid-cols-[260px_1fr_auto_auto] gap-2 items-center text-[12px]">
                <code className="kbd text-[11px] truncate">{k.name}</code>
                <span className="truncate text-fg2 font-mono" title={fb[k.name] || ""}>
                  {fb[k.name] || "—"}
                </span>
                <Badge tone={inBuild ? "ok" : "warn"}>{inBuild ? "✓ no build" : "✗ não checou"}</Badge>
                <button className="btn btn-sm" onClick={() => copy(`${k.name}=${fbEnv(k.name) || ""}`)}>
                  <Copy size={13} /> Copiar
                </button>
              </div>
            );
          })}
          <div className="grid sm:grid-cols-[260px_1fr_auto_auto] gap-2 items-center text-[12px]">
            <code className="kbd text-[11px] truncate">NEXT_PUBLIC_COMPANY_ID</code>
            <span className="truncate text-fg2 font-mono">{status?.build?.COMPANY_ID || COMPANY_ID}</span>
            <Badge tone={status?.build?.COMPANY_ID ? "ok" : "neutral"}>{status?.build?.COMPANY_ID ? "✓ no build" : "—"}</Badge>
            <button className="btn btn-sm" onClick={() => copy(`NEXT_PUBLIC_COMPANY_ID=${status?.build?.COMPANY_ID || COMPANY_ID}`)}>
              <Copy size={13} /> Copiar
            </button>
          </div>
          <div className="grid sm:grid-cols-[260px_1fr_auto_auto] gap-2 items-center text-[12px]">
            <code className="kbd text-[11px] truncate">NEXT_PUBLIC_DATA_BACKEND</code>
            <span className="truncate text-fg2 font-mono">{status?.build?.DATA_BACKEND || "auto"}</span>
            <Badge tone="neutral">{status ? "info" : "—"}</Badge>
            <button className="btn btn-sm" onClick={() => copy(`NEXT_PUBLIC_DATA_BACKEND=${status?.build?.DATA_BACKEND || "auto"}`)}>
              <Copy size={13} /> Copiar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-sm btn-primary" onClick={() => copy(fbBlock)}>
            <Copy size={13} /> Copiar todas as NEXT_PUBLIC de uma vez
          </button>
          <button className="btn btn-sm" onClick={() => copy(SERVER_ENV_KEYS.map((k) => `${k.name}=${srv[k.name] || ""}`).filter((l) => !l.endsWith("=")).join("\n"))}>
            <CheckCircle2 size={13} /> Copiar linhas do servidor preenchidas
          </button>
        </div>
      </Panel>
    </div>
  );
}
