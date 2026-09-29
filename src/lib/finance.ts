import type { Rec } from "./types";
import { dayOf, todayISO, toNum, sum } from "./utils";

/** Status efetivo: pendente/previsto vencido vira "atrasado". */
export function txnStatus(t: Rec): string {
  if ((t.status === "pendente" || t.status === "previsto") && t.dueDate && dayOf(t.dueDate) < todayISO()) return "atrasado";
  return t.status;
}

export const isLive = (r: Rec) => !r.archived && !r.deletedAt;

/** Saldo = saldo inicial + entradas pagas − saídas pagas ± transferências. */
export function accountBalance(acc: Rec, txns: Rec[]): number {
  let b = toNum(acc.initialBalance);
  for (const t of txns) {
    if (!isLive(t) || t.status !== "pago") continue;
    if (t.type === "transferencia") {
      if (t.accountId === acc.id) b -= toNum(t.amount);
      if (t.toAccountId === acc.id) b += toNum(t.amount);
    } else if (t.accountId === acc.id) b += t.type === "entrada" ? toNum(t.amount) : -toNum(t.amount);
  }
  return b;
}

export const totalBalance = (accs: Rec[], txns: Rec[]) => sum(accs.filter(isLive), (a) => accountBalance(a, txns));
