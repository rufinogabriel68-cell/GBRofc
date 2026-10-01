"use client";
/**
 * Log de erros do sistema (memória + localStorage) para diagnóstico.
 * Captura: console.error/warn, erros de janela, promises rejeitadas,
 * toasts de erro e erros de sincronização. A aba "Configurações → Logs"
 * mostra o buffer e gera um texto pronto para copiar/enviar.
 */

export type LogEntry = { id: number; at: number; level: "error" | "warn" | "info"; scope: string; msg: string };

const MAX = 200;
const STORE = "gbr:logs";
const DEDUPE_MS = 3_000;

let entries: LogEntry[] = [];
let seq = 0;
let inited = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const lastSeen = new Map<string, number>();

function hydrate() {
  try {
    const raw = localStorage.getItem(STORE);
    const arr = raw ? (JSON.parse(raw) as LogEntry[]) : [];
    entries = Array.isArray(arr) ? arr.filter((e) => e && typeof e.msg === "string").slice(-MAX) : [];
    seq = entries.reduce((m, e) => Math.max(m, e.id), 0);
  } catch {
    entries = [];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(entries.slice(-MAX)));
    } catch {
      /* cheio/indisponível — segue só em memória */
    }
  }, 400);
}

function fmt(a: unknown): string {
  if (typeof a === "string") return a;
  if (a instanceof Error) return a.stack || a.message;
  if (typeof a === "object" && a !== null) {
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  }
  return String(a);
}

export function addLog(level: LogEntry["level"], scope: string, ...args: unknown[]) {
  if (typeof window === "undefined") return;
  const msg = args.map(fmt).join(" ").slice(0, 1_500);
  if (!msg) return;
  const now = Date.now();
  const key = `${level}|${scope}|${msg}`;
  const prev = lastSeen.get(key);
  if (prev && now - prev < DEDUPE_MS) return;
  lastSeen.set(key, now);
  entries.push({ id: ++seq, at: now, level, scope, msg });
  if (entries.length > MAX) entries = entries.slice(-MAX);
  persist();
  listeners.forEach((l) => l());
}

export function getLogs(): LogEntry[] {
  return entries;
}

export function onLogs(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function clearLogs() {
  entries = [];
  lastSeen.clear();
  try {
    localStorage.removeItem(STORE);
  } catch {}
  listeners.forEach((l) => l());
}

/** Texto pronto para copiar e enviar (inclui o cabeçalho de contexto). */
export function formatLogs(ctx = ""): string {
  const head = [
    `GBR logs — ${new Date().toISOString()}`,
    typeof location !== "undefined" ? `url: ${location.href}` : "",
    typeof navigator !== "undefined" ? `nav: ${navigator.userAgent}` : "",
    ctx,
  ].filter(Boolean).join("\n");
  const body = entries
    .slice()
    .reverse()
    .map((e) => `${new Date(e.at).toISOString().slice(11, 19)} [${e.level}] ${e.scope}: ${e.msg}`)
    .join("\n");
  return `${head}\n${"-".repeat(48)}\n${body || "(sem eventos)"}`;
}

/** Instala os hooks globais (idempotente; chamado no montar do app). */
export function initLogs() {
  if (inited || typeof window === "undefined") return;
  inited = true;
  hydrate();
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    origError(...args);
    addLog("error", "console", ...args);
  };
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    addLog("warn", "console", ...args);
  };
  window.addEventListener("error", (e) => {
    addLog("error", "window", `${e.message}${e.filename ? ` (${e.filename}:${e.lineno})` : ""}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as unknown;
    addLog("error", "promise", r instanceof Error ? r.stack || r.message : fmt(r));
  });
}
