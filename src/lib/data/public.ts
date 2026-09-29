"use client";
import { arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { ensureFirebaseReady, getFirebase, isFirebaseConfigured } from "../firebase";
import type { Rec } from "../types";
import { newId, nowISO } from "../utils";

export type PublicResult = { status: "ok"; link: Rec } | { status: "revoked" } | { status: "notfound" } | { status: "error" };

/** Acesso do cliente (sem login) ao link público via token. */
export async function fetchPublicLink(token: string): Promise<PublicResult> {
  try {
    if (isFirebaseConfigured) {
      await ensureFirebaseReady();
      const { fs } = getFirebase();
      const snap = await getDoc(doc(fs, "public_links", token));
      if (!snap.exists()) return { status: "notfound" };
      const d = snap.data() as Rec;
      if (d.status === "revoked") return { status: "revoked" };
      return { status: "ok", link: { ...d, id: token } };
    }
    const res = await fetch(`/api/public/${token}`, { cache: "no-store" });
    if (res.status === 404) return { status: "notfound" };
    if (res.status === 410) return { status: "revoked" };
    if (!res.ok) return { status: "error" };
    const j = await res.json();
    return { status: "ok", link: j.link };
  } catch {
    return { status: "error" };
  }
}

export async function postPublicEvent(
  token: string,
  ev: { type: string; text?: string; name?: string; data?: Record<string, unknown> },
): Promise<boolean> {
  try {
    if (isFirebaseConfigured) {
      await ensureFirebaseReady();
      const { fs } = getFirebase();
      const full = { id: newId(), at: nowISO(), by: "client", type: ev.type, text: (ev.text || "").slice(0, 2000), name: (ev.name || "").slice(0, 120), data: ev.data || {} };
      await updateDoc(doc(fs, "public_links", token), { events: arrayUnion(full) });
      return true;
    }
    const res = await fetch(`/api/public/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: ev }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadPublicFile(token: string, file: File) {
  if (isFirebaseConfigured) {
    await ensureFirebaseReady();
    const { st } = getFirebase();
    const path = `public-uploads/${token}/${newId()}-${file.name}`;
    const r = ref(st, path);
    await uploadBytes(r, file, { contentType: file.type });
    const url = await getDownloadURL(r);
    return { url, name: file.name, type: file.type, size: file.size };
  }
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await fetch(`/api/public/${token}/upload`, { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Falha no envio");
  return { url: j.url as string, name: file.name, type: file.type, size: file.size };
}
