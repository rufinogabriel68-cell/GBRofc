"use client";
import { COMPANY_ID } from "../session";
import { toastError } from "../toast";
import type { Rec } from "../types";
import type { Adapter, Change, Op } from "./adapter";
import { initConnectivity, setSync } from "./sync-status";

type Handler = (c: Change) => void;
type QOp = Op & { seq: number };

const HEADERS = { "Content-Type": "application/json", "x-company-id": COMPANY_ID };
const OUTBOX_KEY = `gbr:${COMPANY_ID}:outbox`;
const cacheKey = (c: string) => `gbr:${COMPANY_ID}:cache:${c}`;

/**
 * Backend PostgreSQL (mesmo modelo de coleções/documentos do Firestore).
 * - leitura incremental (updated_at) com polling único para todas as coleções
 * - escrita otimista + fila persistente (outbox) que sobrevive a recarregamentos/offline
 * - cache local somente para leitura offline (a fonte da verdade é o servidor)
 */
export function createPgAdapter(): Adapter {
  initConnectivity();
  setSync({ mode: "postgres" });

  const subs = new Map<string, Set<Handler>>();
  const since = new Map<string, string | null>();
  const mem = new Map<string, Map<string, Rec>>();
  let outbox: QOp[] = [];
  let seq = 0;
  const pend = new Set<string>();
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let polling = false;
  let flushing = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Coleções que já tiveram a primeira pintura (sucesso, cache ou falha). */
  const painted = new Set<string>();
  let erroredOnce = false;

  try {
    outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
    seq = outbox.reduce((m, o) => Math.max(m, o.seq || 0), 0);
  } catch {
    outbox = [];
  }

  const rebuild = () => {
    pend.clear();
    outbox.forEach((o) => pend.add(`${o.col}/${o.id}`));
    setSync({ pending: outbox.length });
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
    } catch {}
  };
  rebuild();

  const persistCache = (col: string) => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        const m = mem.get(col);
        if (!m) return;
        const s = JSON.stringify(Array.from(m.values()));
        if (s.length < 1_800_000) localStorage.setItem(cacheKey(col), s);
      } catch {}
    }, 800);
  };

  const overlay = (col: string, docs: Rec[], removed: string[]) => {
    const ops = outbox.filter((o) => o.col === col);
    if (!ops.length) return { docs, removed };
    const m = new Map(docs.map((d) => [d.id, d]));
    const rm = new Set(removed);
    for (const o of ops) {
      if (o.op === "delete") {
        m.delete(o.id);
        rm.add(o.id);
      } else {
        const base = m.get(o.id);
        m.set(o.id, o.merge === false || !base ? { ...(o.data as Rec), id: o.id } : { ...base, ...(o.data as Rec), id: o.id });
        rm.delete(o.id);
      }
    }
    return { docs: Array.from(m.values()), removed: Array.from(rm) };
  };

  async function poll() {
    if (polling) return;
    if (!subs.size) return;
    polling = true;
    try {
      const cols: Record<string, string | null> = {};
      subs.forEach((_, c) => (cols[c] = since.get(c) ?? null));
      const res = await fetch("/api/sync", { method: "POST", headers: HEADERS, body: JSON.stringify({ cols }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as {
        serverTime: string;
        results: Record<string, { docs: Rec[]; deletedIds: string[] }>;
      };
      const next = new Date(new Date(j.serverTime).getTime() - 3000).toISOString();
      for (const [c, r] of Object.entries(j.results)) {
        const full = (since.get(c) ?? null) === null;
        const m = mem.get(c) || new Map<string, Rec>();
        if (full) m.clear();
        r.docs.forEach((d) => m.set(d.id, d));
        r.deletedIds.forEach((id) => m.delete(id));
        mem.set(c, m);
        persistCache(c);
        since.set(c, next);
        const o = overlay(c, r.docs, r.deletedIds);
        subs.get(c)?.forEach((h) => h({ upserts: o.docs, removed: o.removed, replaceAll: full }));
        painted.add(c);
      }
      setSync({ online: true, error: null, lastSync: Date.now() });
    } catch (e) {
      const offline = !navigator.onLine || e instanceof TypeError;
      setSync(offline ? { online: false } : { error: String(e) });
      // Primeira pintura offline-first: mesmo sem servidor, conclui o carregamento
      // das coleções com lista vazia — a UI renderiza (ex.: aba Empresa) e o status
      // de sincronização mostra o erro, em vez de uma tela eternamente em branco.
      subs.forEach((set, col) => {
        if (painted.has(col)) return;
        painted.add(col);
        set.forEach((h) => h({ upserts: [], removed: [] }));
      });
      if (!offline && !erroredOnce) {
        erroredOnce = true;
        toastError(`Servidor de dados indisponível (${String(e)}). Verifique o backend no .env (NEXT_PUBLIC_FIREBASE_* ou DATABASE_URL) e reinicie o servidor.`);
      }
    } finally {
      polling = false;
      schedule();
    }
  }

  function schedule(delay?: number) {
    if (pollTimer) clearTimeout(pollTimer);
    if (!subs.size) return;
    const d = delay ?? (document.visibilityState === "visible" ? 4000 : 20000);
    pollTimer = setTimeout(poll, d);
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (outbox.length) {
        const batch = outbox.slice(0, 100);
        const res = await fetch("/api/write", {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify({ ops: batch.map(({ seq: _s, ...o }) => o) }),
        });
        if (res.ok) {
          outbox.splice(0, batch.length);
        } else if (res.status >= 400 && res.status < 500) {
          console.error("[GBR] operação rejeitada pelo servidor", res.status, batch);
          toastError("Uma alteração foi rejeitada pelo servidor (dados inválidos).");
          outbox.splice(0, batch.length);
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
        rebuild();
      }
      setSync({ online: true, error: null });
      schedule(300);
    } catch (e) {
      const offline = !navigator.onLine || e instanceof TypeError;
      setSync(offline ? { online: false } : { error: String(e) });
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 5000);
    } finally {
      flushing = false;
    }
  }

  if (typeof window !== "undefined") {
    const kick = () => {
      flush();
      schedule(200);
    };
    window.addEventListener("online", kick);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && kick());
    if (outbox.length) setTimeout(flush, 500);
  }

  return {
    mode: "postgres",
    isPending: (col, id) => pend.has(`${col}/${id}`),
    subscribe(col, handler) {
      let set = subs.get(col);
      if (!set) subs.set(col, (set = new Set()));
      set.add(handler);
      // pinta rápido com o cache local (leitura offline)
      if (!mem.has(col)) {
        try {
          const raw = localStorage.getItem(cacheKey(col));
          if (raw) {
            const arr = JSON.parse(raw) as Rec[];
            const o = overlay(col, arr, []);
            handler({ upserts: o.docs, removed: o.removed });
            painted.add(col);
          }
        } catch {}
      }
      schedule(30);
      return () => {
        const s = subs.get(col);
        s?.delete(handler);
        if (s && !s.size) subs.delete(col);
      };
    },
    write(ops) {
      ops.forEach((o) => outbox.push({ ...o, seq: ++seq }));
      rebuild();
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 20);
    },
    async upload(path, file, name) {
      const fd = new FormData();
      fd.append("file", file, name);
      fd.append("path", path);
      const res = await fetch("/api/files", { method: "POST", headers: { "x-company-id": COMPANY_ID }, body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Falha no upload (verifique a conexão)");
      }
      const j = await res.json();
      return { url: j.url, path: j.path, name, contentType: j.contentType || "", size: j.size };
    },
    async removeFile(f) {
      const id = f.url?.match(/\/api\/files\/([A-Za-z0-9]+)/)?.[1];
      if (id) await fetch(`/api/files/${id}`, { method: "DELETE" }).catch(() => {});
    },
    async listAll(col) {
      const res = await fetch("/api/sync", { method: "POST", headers: HEADERS, body: JSON.stringify({ cols: { [col]: null } }) });
      if (!res.ok) throw new Error("Falha ao ler " + col);
      const j = await res.json();
      return (j.results[col]?.docs ?? []) as Rec[];
    },
  };
}
