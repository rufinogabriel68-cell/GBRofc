import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import { isCollection } from "@/lib/collections";
import { getContext, ID_RE } from "@/server/context";

export const dynamic = "force-dynamic";

type Op = { op: "set" | "delete"; col: string; id: string; data?: Record<string, unknown>; merge?: boolean };

/** Escrita em lote (set/merge/delete) com validação de coleção, id e tamanho. */
export async function POST(req: Request) {
  try {
    const { companyId } = getContext(req);
    const body = (await req.json().catch(() => null)) as { ops?: Op[] } | null;
    const ops = body?.ops;
    if (!Array.isArray(ops) || ops.length === 0 || ops.length > 300) {
      return Response.json({ error: "bad request" }, { status: 400 });
    }
    for (const o of ops) {
      if (!o || (o.op !== "set" && o.op !== "delete") || !isCollection(o.col) || !ID_RE.test(String(o.id))) {
        return Response.json({ error: "invalid operation" }, { status: 422 });
      }
      if (o.op === "set") {
        if (!o.data || typeof o.data !== "object" || Array.isArray(o.data)) {
          return Response.json({ error: "invalid data" }, { status: 422 });
        }
        if (JSON.stringify(o.data).length > 900_000) {
          return Response.json({ error: "document too large" }, { status: 413 });
        }
      }
    }
    for (const o of ops) {
      if (o.op === "set") {
        const data = { ...(o.data as Record<string, unknown>) };
        delete data.id;
        data.companyId = companyId;
        await db
          .insert(records)
          .values({ companyId, collection: o.col, id: o.id, data })
          .onConflictDoUpdate({
            target: [records.companyId, records.collection, records.id],
            set: {
              data: o.merge === false ? sql`excluded.data` : sql`${records.data} || excluded.data`,
              deleted: false,
              updatedAt: sql`now()`,
            },
          });
      } else {
        await db
          .update(records)
          .set({ deleted: true, data: {}, updatedAt: sql`now()` })
          .where(and(eq(records.companyId, companyId), eq(records.collection, o.col), eq(records.id, o.id)));
      }
    }
    return Response.json({ ok: true, count: ops.length });
  } catch (e) {
    // Ex.: DATABASE_URL ausente → 503 com a causa real em vez de 500 genérico.
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 503 });
  }
}
