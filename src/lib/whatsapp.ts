import { digits } from "./utils";

/**
 * Camada de WhatsApp.
 * Hoje: gera links wa.me (o usuário confirma o envio no app).
 * Futuro: implementar `WhatsAppProvider` com a WhatsApp Business API (Cloud API / BSP)
 * dentro de uma Cloud Function, sem alterar as telas.
 */
export interface WhatsAppProvider {
  send(to: string, text: string, opts?: { template?: string }): Promise<{ id: string }>;
}

export const whatsappApiConfigured = false;

export function renderTemplate(body: string, vars: Record<string, string | number | undefined>) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== "" ? String(vars[k]) : `{{${k}}}`));
}

export function normalizePhone(p?: string) {
  let d = digits(p);
  if (!d) return "";
  if (d.length <= 11) d = "55" + d;
  return d;
}

export function waLink(phone: string | undefined, text: string) {
  const n = normalizePhone(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export const TEMPLATE_VARS = ["cliente", "data", "hora", "valor", "os", "orcamento", "link"];
