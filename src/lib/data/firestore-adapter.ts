"use client";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type CollectionReference,
  type DocumentData,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { ensureFirebaseReady, getFirebase } from "../firebase";
import { COMPANY_ID } from "../session";
import { toastError } from "../toast";
import { clean } from "../utils";
import type { Rec } from "../types";
import type { Adapter, Op } from "./adapter";
import { initConnectivity, getSync, setSync } from "./sync-status";

/**
 * Backend Firestore.
 *   companies/{companyId}/{coleção}/{id}   -> dados da empresa (multiempresa)
 *   companies/{companyId}                  -> documento raiz da empresa
 *   public_links/{token}                   -> links públicos (orçamento/OS), leitura por token
 * Storage: companies/{companyId}/{entidade}/{id}/arquivo
 */
export function createFirestoreAdapter(): Adapter {
  initConnectivity();
  setSync({ mode: "firestore" });
  const pendingCols = new Map<string, boolean>();
  const cacheCols = new Map<string, boolean>();
  // Um erro repetido (várias coleções/escritas) não pode inundar de toasts:
  // mesma mensagem reaparece no máximo a cada 30s.
  let lastToast = { text: "", at: 0 };
  const alerta = (error: string, toastMsg: string) => {
    setSync({ error });
    const now = Date.now();
    if (lastToast.text !== toastMsg || now - lastToast.at > 30_000) {
      lastToast = { text: toastMsg, at: now };
      toastError(toastMsg);
    }
  };

  const refresh = () => {
    let pending = 0;
    pendingCols.forEach((v) => v && pending++);
    let fromCache = false;
    cacheCols.forEach((v) => v && (fromCache = true));
    setSync({ pending, fromCache, syncing: false });
  };

  const colRef = (col: string): CollectionReference<DocumentData> => {
    const { fs } = getFirebase();
    return col === "public_links" ? collection(fs, "public_links") : collection(fs, "companies", COMPANY_ID, col);
  };
  const docRef = (col: string, id: string) => {
    const { fs } = getFirebase();
    if (col === "companies") return doc(fs, "companies", id);
    if (col === "public_links") return doc(fs, "public_links", id);
    return doc(fs, "companies", COMPANY_ID, col, id);
  };

  return {
    mode: "firestore",
    subscribe(col, handler) {
      let unsub: () => void = () => {};
      let cancelled = false;
      ensureFirebaseReady().then(() => {
        if (cancelled) return;
        const base = colRef(col);
        const q = col === "public_links" ? query(base, where("companyId", "==", COMPANY_ID)) : base;
        unsub = onSnapshot(
          q,
          { includeMetadataChanges: true },
          (snap) => {
            pendingCols.set(col, snap.metadata.hasPendingWrites);
            cacheCols.set(col, snap.metadata.fromCache);
            refresh();
            // Leitura voltou a funcionar → erros de leitura/init não são mais válidos.
            // (Erros de escrita têm prefixo "Escrita:" e são limpos só por uma escrita OK.)
            const err = getSync().error;
            if (err && !err.startsWith("Escrita:")) setSync({ error: null });
            const upserts: Rec[] = [];
            const removed: string[] = [];
            snap.docChanges().forEach((c) => {
              if (c.type === "removed") removed.push(c.doc.id);
              else upserts.push({ ...(c.doc.data() as object), id: c.doc.id });
            });
            handler({ upserts, removed });
          },
          (err) => {
            console.error(`[GBR] Firestore (${col})`, err);
            alerta(
              `Firestore: ${err.code || err.message}`,
              `Sem permissão/erro ao ler "${col}". Verifique as Security Rules e o Auth anônimo.`,
            );
            handler({ upserts: [], removed: [] });
          },
        );
      }).catch((e) => {
        // Sem este catch, uma falha de init deixava `loaded` falso para sempre e a
        // UI (ex.: aba Empresa) ficava em branco sem nenhum aviso.
        if (cancelled) return;
        console.error("[GBR] Firebase init", e);
        alerta(
          `Firebase init: ${String(e)}`,
          "Falha ao inicializar o Firebase — confira NEXT_PUBLIC_FIREBASE_* no .env e reinicie o servidor.",
        );
        handler({ upserts: [], removed: [] });
      });
      return () => {
        cancelled = true;
        unsub();
      };
    },
    write(ops: Op[]) {
      ensureFirebaseReady().then(() => {
        for (const o of ops) {
          const r = docRef(o.col, o.id);
          const fail = (e: unknown) => {
            console.error("[GBR] Firestore write", e);
            alerta(
              "Escrita: não foi possível salvar no Firebase",
              "Não foi possível salvar no Firebase (verifique a conexão, os bloqueadores e as regras de segurança).",
            );
          };
          if (o.op === "delete") {
            deleteDoc(r).catch(fail);
          } else {
            const data = clean({ ...(o.data || {}) }) as Record<string, unknown>;
            delete data.id;
            if (o.col === "public_links") data.companyId = COMPANY_ID;
            const p =
              o.merge === false ? setDoc(r, data) : setDoc(r, data, { mergeFields: Object.keys(data) });
            p.then(() => {
              if (getSync().error?.startsWith("Escrita:")) setSync({ error: null });
            }).catch(fail);
          }
        }
      }).catch((e) => {
        console.error("[GBR] Firebase write init", e);
        alerta(
          `Escrita: ${String(e)}`,
          "Falha ao gravar no Firebase — confira o .env (NEXT_PUBLIC_FIREBASE_*) e as Security Rules.",
        );
      });
    },
    async upload(path, file, name) {
      await ensureFirebaseReady();
      const { st } = getFirebase();
      const r = ref(st, path);
      const contentType = (file as File).type || "application/octet-stream";
      await uploadBytes(r, file, { contentType });
      const url = await getDownloadURL(r);
      return { url, path, name, contentType, size: file.size };
    },
    async removeFile(f) {
      if (!f.path) return;
      await ensureFirebaseReady();
      const { st } = getFirebase();
      await deleteObject(ref(st, f.path)).catch(() => {});
    },
    async listAll(col) {
      await ensureFirebaseReady();
      const base = colRef(col);
      const q = col === "public_links" ? query(base, where("companyId", "==", COMPANY_ID)) : base;
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }));
    },
  };
}
