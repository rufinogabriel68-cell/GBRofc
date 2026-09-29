"use client";
/**
 * Inicialização do Firebase (somente variáveis públicas NEXT_PUBLIC_*; nenhum segredo no frontend).
 * - Firestore com cache persistente multi-aba (offline first)
 * - Cloud Storage
 * - Firebase Auth anônimo (sem tela de login) — pronto para trocar por login real
 * - App Check (reCAPTCHA v3) quando NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY existir
 * - Analytics e Performance quando suportados
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.projectId && firebaseConfig.apiKey && process.env.NEXT_PUBLIC_DATA_BACKEND !== "postgres",
);

let app: FirebaseApp | null = null;
let fs: Firestore | null = null;
let st: FirebaseStorage | null = null;
let readyPromise: Promise<void> | null = null;

export function getFirebase() {
  if (!isFirebaseConfigured) throw new Error("Firebase não configurado");
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
    if (typeof window !== "undefined" && siteKey) {
      try {
        if (process.env.NEXT_PUBLIC_APPCHECK_DEBUG === "true") {
          (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
      } catch (e) {
        console.warn("[GBR] App Check indisponível", e);
      }
    }
    try {
      fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    } catch {
      fs = getFirestore(app);
    }
    st = getStorage(app);
    if (typeof window !== "undefined") {
      if (firebaseConfig.measurementId) {
        import("firebase/analytics")
          .then(async (m) => {
            if (await m.isSupported()) m.getAnalytics(app!);
          })
          .catch(() => {});
      }
      import("firebase/performance").then((m) => m.getPerformance(app!)).catch(() => {});
    }
  }
  return { app: app!, fs: fs!, st: st! };
}

/** Garante uma identidade (anônima) antes de acessar Firestore/Storage, conforme as Security Rules. */
export function ensureFirebaseReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const { app } = getFirebase();
      if (process.env.NEXT_PUBLIC_FIREBASE_ANON_AUTH === "false") return;
      try {
        const auth = getAuth(app);
        await auth.authStateReady();
        if (!auth.currentUser) await signInAnonymously(auth);
      } catch (e) {
        console.warn("[GBR] Auth anônimo indisponível (habilite Anonymous no Firebase Auth)", e);
      }
    })();
  }
  return readyPromise;
}
