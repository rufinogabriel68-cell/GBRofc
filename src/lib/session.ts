/**
 * Sessão/identidade do sistema.
 * Sem login por enquanto: um proprietário implícito e um companyId fixo.
 * Para adicionar Firebase Auth depois, substitua `currentUser()` e `COMPANY_ID`
 * (ex.: custom claims) — o restante do sistema já usa esses pontos únicos.
 */
export const COMPANY_ID: string = process.env.NEXT_PUBLIC_COMPANY_ID || "gbr-principal";
export const WORKSPACE_ID: string = process.env.NEXT_PUBLIC_WORKSPACE_ID || COMPANY_ID;

export type SessionUser = { id: string; name: string; role: "owner" | "admin" | "manager" | "technician" | "finance" };

let override: SessionUser | null = null;
let ownerName = "Proprietário";

export function setOwnerName(n: string) {
  if (n) ownerName = n;
}
export function setSessionUser(u: SessionUser | null) {
  override = u;
}
export function currentUser(): SessionUser {
  return override ?? { id: "owner", name: ownerName, role: "owner" };
}
