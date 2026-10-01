"use client";
/**
 * Chaves/variáveis acessíveis em TEMPO DE EXECUÇÃO (para o sistema-teste
 * configurar tudo de dentro, sem precisar entender deploy).
 *
 * - NEXT_PUBLIC_* normalmente entram no bundle em tempo de BUILD; aqui o app
 *   aceita "overrides" gravados no localStorage e recarrega para re aplicar.
 * - O acesso a process.env precisa ser ESTÁTICO (o bundler só substitui
 *   literais), por isso o mapa ENV abaixo.
 * - Nenhum valor é enviado ao servidor: fica neste navegador (sistema teste).
 */

const ENV: Record<string, string | undefined> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY: process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY,
  NEXT_PUBLIC_FIREBASE_ANON_AUTH: process.env.NEXT_PUBLIC_FIREBASE_ANON_AUTH,
  NEXT_PUBLIC_DATA_BACKEND: process.env.NEXT_PUBLIC_DATA_BACKEND,
  NEXT_PUBLIC_COMPANY_ID: process.env.NEXT_PUBLIC_COMPANY_ID,
};

/** Chaves do app web Firebase (Console → Configurações do projeto → Seus apps). */
export const FIREBASE_CONFIG_KEYS = [
  { name: "NEXT_PUBLIC_FIREBASE_API_KEY", field: "apiKey", label: "API Key", hint: "Identifica o app web no Firebase." },
  { name: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", field: "authDomain", label: "Auth Domain", hint: "Domínio do projeto (ex.: seu-app.firebaseapp.com)." },
  { name: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", field: "projectId", label: "Project ID", hint: "ID do projeto Firebase." },
  { name: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", field: "storageBucket", label: "Storage Bucket", hint: "Bucket de arquivos (imagens, PDFs)." },
  { name: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", field: "messagingSenderId", label: "Sender ID", hint: "ID do remetente de mensagens." },
  { name: "NEXT_PUBLIC_FIREBASE_APP_ID", field: "appId", label: "App ID", hint: "ID da aplicação web registrada." },
  { name: "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", field: "measurementId", label: "Measurement ID", hint: "Analytics (opcional)." },
] as const;

/** Variáveis que só existem no SERVIDOR (Vercel / .env local) — nunca no navegador. */
export const SERVER_ENV_KEYS = [
  { name: "DATABASE_URL", label: "PostgreSQL", hint: "Conexão do banco no modo servidor. Sem ela, /api/sync e /api/write respondem 503." },
  { name: "AI_API_KEY", label: "Chave de IA", hint: "Opcional — ativa IA (resumos, rascunhos de orçamento)." },
  { name: "AI_API_URL", label: "URL da IA", hint: "Opcional — API compatível com OpenAI. Padrão embutido." },
  { name: "AI_MODEL", label: "Modelo de IA", hint: "Opcional — ex.: gpt-4o-mini." },
] as const;

const FB_STORE = "gbr:config:firebase";
const BACKEND_STORE = "gbr:config:backend";

export function getFirebaseOverrides(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(FB_STORE);
    const j = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(j)) if (typeof v === "string" && v) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

export function saveFirebaseOverrides(values: Record<string, string>) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) if (v && v.trim()) clean[k] = v.trim();
  localStorage.setItem(FB_STORE, JSON.stringify(clean));
}

export function clearFirebaseOverrides() {
  localStorage.removeItem(FB_STORE);
}

/** Valor efetivo: override colado aqui > variável do build. */
export function fbEnv(name: string): string | undefined {
  const ov = getFirebaseOverrides()[name];
  return ov || ENV[name] || undefined;
}

export type BackendOverride = "" | "auto" | "firebase" | "postgres";

export function getBackendOverride(): BackendOverride {
  if (typeof window === "undefined") return "";
  const v = localStorage.getItem(BACKEND_STORE);
  return v === "firebase" || v === "postgres" || v === "auto" ? v : "";
}

export function setBackendOverride(v: BackendOverride) {
  if (!v || v === "auto") localStorage.removeItem(BACKEND_STORE);
  else localStorage.setItem(BACKEND_STORE, v);
}
