import { eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";

export const dynamic = "force-dynamic";

const INLINE_OK = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|text\/plain|video\/mp4|audio\/)/;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9]{8,64}$/.test(id)) return new Response("Not found", { status: 404 });
  const rows = await db.select().from(files).where(eq(files.id, id)).limit(1);
  const f = rows[0];
  if (!f) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  const safe = INLINE_OK.test(f.contentType);
  const bytes = new Uint8Array(Buffer.from(f.data, "base64"));
  return new Response(bytes, {
    headers: {
      "Content-Type": safe ? f.contentType : "application/octet-stream",
      "Content-Disposition": `${download || !safe ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9]{8,64}$/.test(id)) return Response.json({ ok: false }, { status: 404 });
  await db.delete(files).where(eq(files.id, id));
  return Response.json({ ok: true });
}
