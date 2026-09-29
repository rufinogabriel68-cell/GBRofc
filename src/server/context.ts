/**
 * Ponto único para descobrir "quem" e "qual empresa" está fazendo a requisição.
 * Hoje não há login: usa o companyId do cabeçalho/variável de ambiente.
 * Quando a autenticação (Firebase Auth) for adicionada, basta validar o token aqui.
 */
export function getContext(req: Request) {
  const fallback = process.env.DEFAULT_COMPANY_ID || "gbr-principal";
  const raw = req.headers.get("x-company-id") || fallback;
  const companyId = /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : fallback;
  return { companyId, userId: "owner" };
}

export function newServerId(len = 24): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export const ID_RE = /^[A-Za-z0-9_\-:.]{1,128}$/;
export const TOKEN_RE = /^[A-Za-z0-9]{16,64}$/;
