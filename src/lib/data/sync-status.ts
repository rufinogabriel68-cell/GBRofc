"use client";
import { useSyncExternalStore } from "react";

export type SyncState = {
  online: boolean;
  pending: number;
  syncing: boolean;
  error: string | null;
  mode: "firestore" | "postgres";
  lastSync: number | null;
  fromCache: boolean;
  /** Início da fila atual (epoch ms); null quando não há pendências. */
  pendingSince: number | null;
  /** true quando pendências passam de STUCK_MS sem confirmação do servidor. */
  stuck: boolean;
};

/** Pendências normais confirmam em <5s; após 15s algo está errado de verdade. */
const STUCK_MS = 15_000;

let state: SyncState = {
  online: true,
  pending: 0,
  syncing: false,
  error: null,
  mode: "postgres",
  lastSync: null,
  fromCache: false,
  pendingSince: null,
  stuck: false,
};
const SERVER: SyncState = state;
const listeners = new Set<() => void>();
let stuckTimer: ReturnType<typeof setTimeout> | null = null;

export function setSync(p: Partial<SyncState>) {
  const next = { ...state, ...p };
  // Fila 0→N: marca o início e agenda o alerta de "travado". N→0: limpa tudo.
  // Reativos com N>0 não reiniciam o timer (senão um snapshot espúrio esconderia o problema).
  if (p.pending !== undefined && p.pending !== state.pending) {
    if (p.pending > 0) {
      if (state.pending === 0) {
        next.pendingSince = Date.now();
        next.stuck = false;
        if (stuckTimer) clearTimeout(stuckTimer);
        stuckTimer = typeof window === "undefined" ? null : setTimeout(() => setSync({ stuck: true }), STUCK_MS);
      }
    } else {
      next.pendingSince = null;
      next.stuck = false;
      if (stuckTimer) {
        clearTimeout(stuckTimer);
        stuckTimer = null;
      }
    }
  }
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  listeners.forEach((l) => l());
}
export function getSync() {
  return state;
}
export type SyncLabel = "Sincronizado" | "Sincronizando..." | "Offline" | "Servidor não responde";
export function useSyncStatus(): SyncState & { label: SyncLabel } {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state,
    () => SERVER,
  );
  const label: SyncLabel = !s.online
    ? "Offline"
    : s.stuck && s.pending > 0
      ? "Servidor não responde"
      : s.pending > 0 || s.syncing
        ? "Sincronizando..."
        : "Sincronizado";
  return { ...s, label };
}

let inited = false;
export function initConnectivity() {
  if (inited || typeof window === "undefined") return;
  inited = true;
  setSync({ online: navigator.onLine });
  window.addEventListener("online", () => setSync({ online: true }));
  window.addEventListener("offline", () => setSync({ online: false }));
}
