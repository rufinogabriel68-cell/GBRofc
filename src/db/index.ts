import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type AppDatabase = NodePgDatabase<Record<string, never>>;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlDb?: AppDatabase;
};

/**
 * Inicializa pool e Drizzle apenas no primeiro acesso.
 * Importar este módulo (ex.: na coleta de page data do `next build`)
 * não falha mais quando DATABASE_URL ainda não está configurado.
 */
function resolve(): { pool: Pool; db: AppDatabase } {
  const cachedPool = globalForDb.__arenaNextJsPostgresqlPool;
  const cachedDb = globalForDb.__arenaNextJsPostgresqlDb;
  if (cachedPool && cachedDb) return { pool: cachedPool, db: cachedDb };

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = cachedPool ?? new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  globalForDb.__arenaNextJsPostgresqlPool = pool;
  globalForDb.__arenaNextJsPostgresqlDb = db;
  return { pool, db };
}

/** Instância do Drizzle, resolvida de forma preguiçosa no primeiro uso. */
export const db: AppDatabase = new Proxy({} as AppDatabase, {
  get(_target, prop) {
    const real = resolve().db as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
  has(_target, prop) {
    return prop in (resolve().db as unknown as object);
  },
});

/** Pool do PostgreSQL, também resolvido de forma preguiçosa. */
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = resolve().pool as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
  has(_target, prop) {
    return prop in (resolve().pool as unknown as object);
  },
});
