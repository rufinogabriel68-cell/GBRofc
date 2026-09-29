"use client";
import type { Rec } from "../types";
import { isFirebaseConfigured } from "../firebase";
import { createFirestoreAdapter } from "./firestore-adapter";
import { createPgAdapter } from "./pg-adapter";

export type Change = { upserts: Rec[]; removed: string[]; replaceAll?: boolean };
export type Op = { op: "set" | "delete"; col: string; id: string; data?: Rec; merge?: boolean };
export type UploadResult = { url: string; path: string; name: string; contentType: string; size: number };

/**
 * Contrato de persistência. A UI nunca fala direto com Firestore/PostgreSQL:
 * qualquer backend novo (ex.: Supabase) só precisa implementar esta interface.
 */
export interface Adapter {
  mode: "firestore" | "postgres";
  subscribe(col: string, handler: (c: Change) => void): () => void;
  write(ops: Op[]): void;
  isPending?(col: string, id: string): boolean;
  upload(path: string, file: Blob, name: string): Promise<UploadResult>;
  removeFile(f: { path?: string; url?: string }): Promise<void>;
  listAll(col: string): Promise<Rec[]>;
}

let inst: Adapter | null = null;
export function getAdapter(): Adapter {
  if (!inst) inst = isFirebaseConfigured ? createFirestoreAdapter() : createPgAdapter();
  return inst;
}
