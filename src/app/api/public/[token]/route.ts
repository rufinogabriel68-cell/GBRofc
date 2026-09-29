import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import { TOKEN_RE } from "@/server/context";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "approve",
  "reject",
  "change_request",
  "message",
  "photo",
  "file",
  "approve_additional",
  "reject_additional",
  "confirm_completion",
  "evaluation",
]);

/** Portal do cliente: leitura do link público (token difícil de adivinhar, revogável). */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) return Response.json({ error: "not found" }, { status: 404 });
  const rows = await db
    .select()
    .from(records)
    .where(and(eq(records.collection, "public_links"), eq(records.id, token), eq(records.deleted, false)))
    .limit(1);
  const d = rows[0]?.data as Record<string, unknown> | undefined;
  if (!d) return Response.json({ error: "not found" }, { status: 404 });
  if (d.status === "revoked") return Response.json({ error: "revoked" }, { status: 410 });
  const { companyId: _c, ...safe } = d;
  void _c;
  return Response.json({ link: { ...safe, id: token } });
}

/** Cliente registra uma ação (aprovar, recusar, mensagem...). */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) return Response.json({ error: "not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { event?: Record<string, unknown> } | null;
  const e = body?.event;
  if (!e || typeof e.type !== "string" || !ALLOWED.has(e.type)) {
    return Response.json({ error: "invalid event" }, { status: 422 });
  }
  const dataStr = JSON.stringify(e.data ?? {});
  if (dataStr.length > 40000) return Response.json({ error: "payload too large" }, { status: 413 });
  const ev = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    by: "client",
    type: e.type,
    text: String(e.text ?? "").slice(0, 2000),
    name: String(e.name ?? "").slice(0, 120),
    data: JSON.parse(dataStr),
  };
  const res = await db.execute(sql`
    update records
    set data = jsonb_set(data, '{events}', coalesce(data->'events', '[]'::jsonb) || ${JSON.stringify(ev)}::jsonb),
        updated_at = now()
    where collection = 'public_links' and id = ${token} and deleted = false
      and coalesce(data->>'status', 'active') <> 'revoked'
      and jsonb_array_length(coalesce(data->'events', '[]'::jsonb)) < 300`);
  if (!res.rowCount) return Response.json({ error: "link unavailable" }, { status: 410 });
  return Response.json({ ok: true, event: ev });
}
