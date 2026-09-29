"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { COMPANY_ID, currentUser } from "../session";
import { AUDIT_CREATE, AUDIT_SKIP, describeChanges, recordLabel, SINGULAR } from "../labels";
import type { Rec } from "../types";
import { clean, newId, nowISO } from "../utils";
import { getAdapter, type UploadResult } from "./adapter";

type Coll = {
  name: string;
  docs: Map<string, Rec>;
  snap: Rec[];
  loaded: boolean;
  listeners: Set<() => void>;
  sub: (l: () => void) => () => void;
  refs: number;
  unsub: (() => void) | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
};

const colls = new Map<string, Coll>();
const EMPTY: Rec[] = [];

function coll(name: string): Coll {
  let c = colls.get(name);
  if (!c) {
    const listeners = new Set<() => void>();
    c = {
      name,
      docs: new Map(),
      snap: EMPTY,
      loaded: false,
      listeners,
      sub: (l) => {
        listeners.add(l);
        return () => {
          listeners.delete(l);
        };
      },
      refs: 0,
      unsub: null,
      stopTimer: null,
    };
    colls.set(name, c);
  }
  return c;
}

function emit(c: Coll) {
  c.snap = Array.from(c.docs.values());
  c.listeners.forEach((l) => l());
}

function start(c: Coll) {
  if (c.unsub) return;
  const ad = getAdapter();
  c.unsub = ad.subscribe(c.name, (ch) => {
    let dirty = !c.loaded;
    if (ch.replaceAll) {
      const ids = new Set(ch.upserts.map((d) => d.id));
      for (const id of Array.from(c.docs.keys())) {
        if (!ids.has(id) && !ad.isPending?.(c.name, id)) {
          c.docs.delete(id);
          dirty = true;
        }
      }
    }
    for (const d of ch.upserts) {
      if (ad.isPending?.(c.name, d.id)) continue;
      const prev = c.docs.get(d.id);
      if (prev && JSON.stringify(prev) === JSON.stringify(d)) continue;
      c.docs.set(d.id, d);
      dirty = true;
    }
    for (const id of ch.removed) {
      if (ad.isPending?.(c.name, id)) continue;
      if (c.docs.delete(id)) dirty = true;
    }
    c.loaded = true;
    if (dirty) emit(c);
  });
}

function retain(c: Coll) {
  c.refs++;
  if (c.stopTimer) clearTimeout(c.stopTimer);
  c.stopTimer = null;
  start(c);
}
function release(c: Coll) {
  c.refs--;
  if (c.refs <= 0) {
    c.stopTimer = setTimeout(() => {
      if (c.refs <= 0 && c.unsub) {
        c.unsub();
        c.unsub = null;
      }
    }, 60_000);
  }
}

/** Assina uma coleção sob demanda (carregamento lazy por página). */
export function useCollection<T extends Rec = Rec>(name: string) {
  const c = coll(name);
  useEffect(() => {
    retain(c);
    return () => release(c);
  }, [c]);
  const items = useSyncExternalStore(c.sub, () => c.snap, () => EMPTY) as T[];
  const loaded = useSyncExternalStore(c.sub, () => c.loaded, () => false);
  return { items, loading: !loaded };
}

/** Somente registros ativos (não arquivados e não excluídos). */
export function useActive<T extends Rec = Rec>(name: string) {
  const { items, loading } = useCollection<T>(name);
  const active = useMemo(() => items.filter((r) => !r.archived && !r.deletedAt), [items]);
  return { items: active, loading };
}

export function useRecord<T extends Rec = Rec>(name: string, id?: string | null) {
  const { items, loading } = useCollection<T>(name);
  const rec = useMemo(() => (id ? items.find((r) => r.id === id) : undefined), [items, id]);
  return { rec, loading };
}

export function useMap<T extends Rec = Rec>(name: string) {
  const { items, loading } = useCollection<T>(name);
  const map = useMemo(() => new Map(items.map((r) => [r.id, r])), [items]);
  return { map, items, loading };
}

/** Garante que várias coleções estejam carregadas (assinatura sob demanda). */
export function useCollections(names: string[]) {
  const key = names.join(",");
  useEffect(() => {
    const cs = key.split(",").filter(Boolean).map(coll);
    cs.forEach(retain);
    return () => cs.forEach(release);
  }, [key]);
}

// ---------------------------------------------------------------- escrita

function apply(col: string, rec: Rec) {
  const c = coll(col);
  c.docs.set(rec.id, rec);
  emit(c);
}

function logAudit(entry: Record<string, any>) {
  const u = currentUser();
  const rec: Rec = {
    ...entry,
    id: newId(),
    companyId: COMPANY_ID,
    userId: u.id,
    userName: u.name,
    at: nowISO(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  apply("audit_logs", rec);
  getAdapter().write([{ op: "set", col: "audit_logs", id: rec.id, data: rec, merge: false }]);
}

export const db = {
  get(col: string, id: string): Rec | undefined {
    return coll(col).docs.get(id);
  },
  list(col: string): Rec[] {
    return coll(col).snap;
  },
  create(col: string, data: Record<string, unknown>, id?: string): Rec {
    const now = nowISO();
    const u = currentUser();
    const rec = clean({
      ...data,
      id: id ?? newId(),
      companyId: COMPANY_ID,
      createdAt: now,
      updatedAt: now,
      createdBy: u.id,
      updatedBy: u.id,
    }) as Rec;
    apply(col, rec);
    getAdapter().write([{ op: "set", col, id: rec.id, data: rec, merge: false }]);
    if (AUDIT_CREATE.has(col)) {
      logAudit({
        action: "create",
        collection: col,
        recordId: rec.id,
        recordLabel: recordLabel(rec),
        message: `${(SINGULAR[col] || col).replace(/^./, (s) => s.toUpperCase())} "${recordLabel(rec)}" criado`,
      });
    }
    return rec;
  },
  update(col: string, id: string, patch: Record<string, unknown>, opts?: { silent?: boolean }): Rec | undefined {
    const prev = coll(col).docs.get(id);
    const u = currentUser();
    const p = clean({ ...patch, updatedAt: nowISO(), updatedBy: u.id }) as Record<string, any>;
    // undefined/removidos: convertidos em null pelo clean; mantém o campo vazio
    const next: Rec = { ...(prev || { companyId: COMPANY_ID }), ...p, id };
    apply(col, next);
    getAdapter().write([{ op: "set", col, id, data: p as Rec, merge: true }]);
    if (prev && !opts?.silent && !AUDIT_SKIP.has(col)) {
      const { changes, message } = describeChanges(col, prev, p);
      if (changes.length) {
        logAudit({ action: "update", collection: col, recordId: id, recordLabel: recordLabel(prev), message, changes: clean(changes) });
      }
    }
    return next;
  },
  /** Cria se não existir, senão atualiza (ids determinísticos, ex.: settings/company). */
  upsert(col: string, id: string, data: Record<string, unknown>): Rec {
    return coll(col).docs.has(id) ? (db.update(col, id, data) as Rec) : db.create(col, data, id);
  },
  remove(col: string, id: string) {
    const c = coll(col);
    const prev = c.docs.get(id);
    c.docs.delete(id);
    emit(c);
    getAdapter().write([{ op: "delete", col, id }]);
    if (prev && !AUDIT_SKIP.has(col)) {
      logAudit({
        action: "delete",
        collection: col,
        recordId: id,
        recordLabel: recordLabel(prev),
        message: `${(SINGULAR[col] || col).replace(/^./, (s) => s.toUpperCase())} "${recordLabel(prev)}" excluído definitivamente`,
      });
    }
  },
  /** Exclusão segura (soft delete): vai para a lixeira e pode ser restaurado. */
  softDelete(col: string, id: string) {
    const prev = coll(col).docs.get(id);
    db.update(col, id, { deletedAt: nowISO(), deletedBy: currentUser().id }, { silent: true });
    if (prev)
      logAudit({
        action: "soft_delete",
        collection: col,
        recordId: id,
        recordLabel: recordLabel(prev),
        message: `${(SINGULAR[col] || col).replace(/^./, (s) => s.toUpperCase())} "${recordLabel(prev)}" movido para a lixeira`,
      });
  },
  restore(col: string, id: string) {
    db.update(col, id, { deletedAt: null, archived: false }, { silent: true });
  },
  archive(col: string, id: string, flag = true) {
    db.update(col, id, { archived: flag }, { silent: true });
  },
  toggleFavorite(col: string, id: string) {
    const r = coll(col).docs.get(id);
    db.update(col, id, { favorite: !r?.favorite }, { silent: true });
  },
  duplicate(col: string, id: string, override: Record<string, unknown> = {}): Rec | undefined {
    const r = coll(col).docs.get(id);
    if (!r) return;
    const { id: _i, createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, deletedAt: _d, publicToken: _t, history: _h, ...rest } = r;
    void [_i, _c, _u, _cb, _ub, _d, _t, _h];
    return db.create(col, { ...rest, archived: false, favorite: false, ...override });
  },
  /** Carrega coleções sob demanda e aguarda o primeiro snapshot (para fluxos assíncronos). */
  async load(names: string[]): Promise<void> {
    await Promise.all(
      names.map(
        (n) =>
          new Promise<void>((res) => {
            const c = coll(n);
            retain(c);
            const fin = () => {
              release(c);
              res();
            };
            if (c.loaded) return fin();
            const off = c.sub(() => {
              if (c.loaded) {
                off();
                fin();
              }
            });
            setTimeout(() => {
              off();
              fin();
            }, 6000);
          }),
      ),
    );
  },
  async upload(path: string, file: Blob, name: string): Promise<UploadResult> {
    return getAdapter().upload(path, file, name);
  },
  async removeFile(f: { path?: string; url?: string }) {
    return getAdapter().removeFile(f);
  },
  async exportAll(cols: string[]): Promise<Record<string, Rec[]>> {
    const out: Record<string, Rec[]> = {};
    for (const c of cols) out[c] = await getAdapter().listAll(c);
    return out;
  },
  importAll(data: Record<string, Rec[]>) {
    const ad = getAdapter();
    let n = 0;
    for (const [col, arr] of Object.entries(data)) {
      if (!Array.isArray(arr)) continue;
      const ops = arr
        .filter((r) => r && r.id)
        .map((r) => ({ op: "set" as const, col, id: r.id, data: { ...r, companyId: COMPANY_ID }, merge: false }));
      for (let i = 0; i < ops.length; i += 100) ad.write(ops.slice(i, i + 100));
      ops.forEach((o) => apply(col, o.data as Rec));
      n += ops.length;
    }
    return n;
  },
};

export function isLive(r: Rec) {
  return !r.archived && !r.deletedAt;
}

export function nextNumber(prefix: string, items: Rec[], key = "number", pad = 4) {
  let max = 0;
  for (const r of items) {
    const m = String(r[key] || "").match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}
