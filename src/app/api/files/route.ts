import { db } from "@/db";
import { files } from "@/db/schema";
import { getContext, newServerId } from "@/server/context";

export const dynamic = "force-dynamic";

const MAX = 14 * 1024 * 1024;

/** Upload de arquivos (equivalente ao Cloud Storage no modo PostgreSQL). */
export async function POST(req: Request) {
  const { companyId } = getContext(req);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return Response.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: "Arquivo maior que 14MB" }, { status: 413 });
  const path = String(form.get("path") || `companies/${companyId}/documents/${file.name}`).slice(0, 400);
  const id = newServerId(32);
  const buf = Buffer.from(await file.arrayBuffer());
  await db.insert(files).values({
    id,
    companyId,
    path,
    name: file.name.slice(0, 200),
    contentType: file.type || "application/octet-stream",
    size: file.size,
    data: buf.toString("base64"),
  });
  return Response.json({ id, url: `/api/files/${id}`, path, name: file.name, contentType: file.type, size: file.size });
}
