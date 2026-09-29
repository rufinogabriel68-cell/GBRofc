import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { files, records } from "@/db/schema";
import { newServerId, TOKEN_RE } from "@/server/context";

export const dynamic = "force-dynamic";

const MAX = 10 * 1024 * 1024;
const OK_TYPE = /^(image\/(png|jpe?g|webp|gif|heic|heif)|application\/pdf)$/;

/** Upload feito pelo cliente no portal (somente imagens e PDF, exige link ativo). */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) return Response.json({ error: "not found" }, { status: 404 });
  const rows = await db
    .select()
    .from(records)
    .where(and(eq(records.collection, "public_links"), eq(records.id, token), eq(records.deleted, false)))
    .limit(1);
  const link = rows[0];
  const d = link?.data as Record<string, unknown> | undefined;
  if (!link || !d || d.status === "revoked") return Response.json({ error: "link unavailable" }, { status: 410 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: "Arquivo maior que 10MB" }, { status: 413 });
  if (!OK_TYPE.test(file.type)) return Response.json({ error: "Tipo de arquivo não permitido" }, { status: 415 });
  const id = newServerId(32);
  const path = `public-uploads/${token}/${id}-${file.name}`.slice(0, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  await db.insert(files).values({
    id,
    companyId: link.companyId,
    path,
    name: file.name.slice(0, 200),
    contentType: file.type,
    size: file.size,
    data: buf.toString("base64"),
  });
  return Response.json({ id, url: `/api/files/${id}`, path, name: file.name, contentType: file.type, size: file.size });
}
