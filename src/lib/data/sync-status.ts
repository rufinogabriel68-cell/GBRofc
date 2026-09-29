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
};

let state: SyncState = { online: true, pending: 0, syncing: false, error: null, mode: "postgres", lastSync: null, fromCache: false };
const SERVER: SyncState = state;
const listeners = new Set<() => void>();

export function setSync(p: Partial<SyncState>) {
  const next = { ...state, ...p };
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  listeners.forEach((l) => l());
}
export function getSync() {
  return state;
}
export function useSyncStatus(): SyncState & { label: "Sincronizado" | "Sincronizando..." | "Offline" } {
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
  const label = !s.online ? "Offline" : s.pending > 0 || s.syncing ? "Sincronizando..." : "Sincronizado";
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
