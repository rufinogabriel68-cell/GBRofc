import { db } from "./data/store";
import { createPublicLink, publicUrl, getSettings } from "./workflows";
import { WA_TEMPLATES } from "./settings";
import { fmtDate, money } from "./utils";
import { renderTemplate } from "./whatsapp";
import type { Rec } from "./types";

/** Prepara o link público + mensagem (WhatsApp/e-mail) de um orçamento ou OS. */
export async function prepareShare(kind: "quote" | "work_order", rec: Rec, templateKey?: string) {
  await db.load(["customers", "document_templates", "settings"]);
  const token = await createPublicLink(kind, rec);
  const url = publicUrl(kind, token);
  const cust = db.get("customers", rec.customerId);
  const key = templateKey || (kind === "quote" ? "orcamento_enviado" : "os_concluida");
  const tpl = db.list("document_templates").find((t) => t.key === key && !t.deletedAt);
  const body = tpl?.body || WA_TEMPLATES.find((t) => t.key === key)?.body || "Olá, {{cliente}}! {{link}}";
  const text = renderTemplate(body, {
    cliente: (cust?.name || "").split(" ")[0] || "cliente",
    orcamento: kind === "quote" ? rec.number : "",
    os: kind === "work_order" ? rec.number : "",
    valor: money(rec.total),
    data: fmtDate(kind === "quote" ? rec.validUntil : rec.date),
    hora: rec.time || "",
    link: url,
  });
  const s = getSettings();
  return { token, url, text, phone: cust?.whatsapp || cust?.phone || "", email: cust?.email || "", customer: cust, subject: `${kind === "quote" ? "Orçamento" : "Ordem de serviço"} ${rec.number} — ${s.tradeName || s.name || ""}` };
}

/** Salva um PDF no Storage (companies/{companyId}/{pasta}) e registra em `documents`. */
export async function savePdfDocument(
  doc: { output: (t: "blob") => Blob },
  o: { folder: string; filename: string; title: string; type: string; customerId?: string; quoteId?: string; workOrderId?: string },
) {
  const blob = doc.output("blob");
  const { COMPANY_ID } = await import("./session");
  const up = await db.upload(`companies/${COMPANY_ID}/${o.folder}/${o.filename}`, blob, o.filename);
  return db.create("documents", {
    kind: "file", type: o.type, title: o.title, customerId: o.customerId || "", quoteId: o.quoteId || "", workOrderId: o.workOrderId || "",
    file: { url: up.url, path: up.path, name: o.filename, type: "application/pdf", size: up.size },
  });
}
