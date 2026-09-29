import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Armazém de documentos que espelha o modelo do Firestore:
 * companies/{companyId}/{collection}/{id}
 * Usado quando o Firebase ainda não está configurado (mesma API de coleções).
 */
export const records = pgTable(
  "records",
  {
    companyId: text("company_id").notNull(),
    collection: text("collection").notNull(),
    id: text("id").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.companyId, t.collection, t.id] }),
    index("records_sync_idx").on(t.companyId, t.collection, t.updatedAt),
    index("records_lookup_idx").on(t.collection, t.id),
  ],
);

/** Arquivos (equivalente ao Cloud Storage no modo PostgreSQL). */
export const files = pgTable(
  "files",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull(),
    path: text("path").notNull(),
    name: text("name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull().default(0),
    data: text("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("files_company_idx").on(t.companyId, t.path)],
);
