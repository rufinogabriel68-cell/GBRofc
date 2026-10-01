import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Status das variáveis de ambiente — só presença/nomes, nunca valores secretos.
 * Mostra ao usuário do sistema-teste o que já "chegou" no build do Vercel e o
 * que existe no servidor, para conferir o copiar-e-colar da aba "Chaves".
 */
const has = (v?: string) => Boolean(v);

export async function GET() {
  let databaseOk = false;
  try {
    await db.execute(sql`select 1`);
    databaseOk = true;
  } catch {
    /* DATABASE_URL ausente/inválido → false */
  }
  return Response.json({
    server: {
      DATABASE_URL: has(process.env.DATABASE_URL),
      AI_API_KEY: has(process.env.AI_API_KEY),
      AI_API_URL: has(process.env.AI_API_URL),
      AI_MODEL: has(process.env.AI_MODEL),
    },
    build: {
      DATA_BACKEND: process.env.NEXT_PUBLIC_DATA_BACKEND || "auto",
      COMPANY_ID: process.env.NEXT_PUBLIC_COMPANY_ID || "gbr-principal",
      FIREBASE: {
        API_KEY: has(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
        AUTH_DOMAIN: has(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
        PROJECT_ID: has(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
        STORAGE_BUCKET: has(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
        MESSAGING_SENDER_ID: has(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
        APP_ID: has(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
        MEASUREMENT_ID: has(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
        APPCHECK_SITE_KEY: has(process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY),
        ANON_AUTH: process.env.NEXT_PUBLIC_FIREBASE_ANON_AUTH || "true",
      },
    },
    db: databaseOk,
  });
}
