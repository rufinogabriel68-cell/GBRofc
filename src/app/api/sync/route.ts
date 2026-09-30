import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import { isCollection } from "@/lib/collections";
import { getContext } from "@/server/context";

export const dynamic = "force-dynamic";

/** Leitura incremental de várias coleções em uma única requisição. */
export async function POST(req: Request) {
  try {
    const { companyId } = getContext(req);
    const body = (await req.json().catch(() => null)) as { cols?: Record<string, string | null> } | null;
    if (!body?.cols || typeof body.cols !== "object") {
      return Response.json({ error: "bad request" }, { status: 400 });
    }
    const names = Object.keys(body.cols).filter(isCollection).slice(0, 50);
    const t = await db.execute(sql`select now() as now`);
    const nowVal = (t.rows[0] as { now: Date | string }).now;
    const serverTime = new Date(nowVal).toISOString();

    const results: Record<string, { docs: unknown[]; deletedIds: string[] }> = {};
    for (const name of names) {
      const since = body.cols[name];
      const sinceDate = since ? new Date(since) : null;
      const validSince = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : null;
      const where = validSince
        ? and(eq(records.companyId, companyId), eq(records.collection, name), gt(records.updatedAt, validSince))
        : and(eq(records.companyId, companyId), eq(records.collection, name), eq(records.deleted, false));
      const rows = await db
        .select({ id: records.id, data: records.data, deleted: records.deleted })
        .from(records)
        .where(where)
        .limit(10000);
      results[name] = {
        docs: rows.filter((r) => !r.deleted).map((r) => ({ ...(r.data as object), id: r.id })),
        deletedIds: rows.filter((r) => r.deleted).map((r) => r.id),
      };
    }
    return Response.json({ serverTime, results });
  } catch (e) {
    // Ex.: DATABASE_URL ausente → 503 com a causa real (o cliente mostra o toast).
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 503 });
  }
}
