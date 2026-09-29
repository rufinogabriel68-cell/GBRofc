"use client";
import { MessageCircle, Phone } from "lucide-react";
import { useMemo } from "react";
import { useActive, useMap, useCollection } from "@/lib/data/store";
import { accountBalance, isLive } from "@/lib/finance";
import { waLink } from "@/lib/whatsapp";
import { cx, fmtDate, money, todayISO, dayOf, sum, toNum } from "@/lib/utils";
import type { Rec } from "@/lib/types";
import { Badge } from "./ui";

export function RefLabel({ collection, id, fallback = "—", field }: { collection: string; id?: string; fallback?: string; field?: string }) {
  const { map } = useMap(collection);
  const r = id ? map.get(id) : undefined;
  if (!r) return <span className="text-fg3">{fallback}</span>;
  return <>{field ? String(r[field] ?? fallback) : String(r.name || r.title || r.number || fallback)}</>;
}

export function Money({ v, tone }: { v: unknown; tone?: "auto" | "in" | "out" }) {
  const n = Number(v) || 0;
  return <span className={cx("tabular-nums", tone === "in" && "text-ok", tone === "out" && "text-bad", tone === "auto" && (n < 0 ? "text-bad" : "text-ok"))}>{money(n)}</span>;
}

export function DateCell({ v, warnIfPast }: { v?: string; warnIfPast?: boolean }) {
  if (!v) return <span className="text-fg3">—</span>;
  const past = warnIfPast && dayOf(v) < todayISO();
  return <span className={past ? "text-bad font-semibold" : ""}>{fmtDate(v)}</span>;
}

export function ContactCell({ phone, whatsapp }: { phone?: string; whatsapp?: string }) {
  const p = whatsapp || phone;
  if (!p) return <span className="text-fg3">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <span className="text-fg2">{p}</span>
      <a href={waLink(p, "")} target="_blank" rel="noreferrer" aria-label="Abrir WhatsApp" className="text-ok hover:brightness-125"><MessageCircle size={14} /></a>
      <a href={`tel:${p}`} aria-label="Ligar" className="text-info"><Phone size={13} /></a>
    </span>
  );
}

export function StockQty({ r }: { r: Rec }) {
  const low = toNum(r.qty) <= toNum(r.minQty) && toNum(r.minQty) > 0;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      {r.qty ?? 0} {r.unit}
      {low && <Badge tone="bad">▼ baixo</Badge>}
    </span>
  );
}

export function AccountBalanceCell({ acc }: { acc: Rec }) {
  const { items } = useCollection("financial_transactions");
  const b = useMemo(() => accountBalance(acc, items), [acc, items]);
  return <Money v={b} tone="auto" />;
}

export function SupplierStats({ id, kind }: { id: string; kind: "products" | "payable" }) {
  const products = useActive("products");
  const txns = useActive("financial_transactions");
  if (kind === "products") return <>{products.items.filter((p) => p.supplierId === id).length}</>;
  const open = sum(txns.items.filter((t) => t.supplierId === id && t.type === "saida" && ["pendente", "previsto"].includes(t.status)), (t) => toNum(t.amount));
  return <Money v={open} tone={open > 0 ? "out" : undefined} />;
}

export function ActiveOrders({ customerId }: { customerId: string }) {
  const os = useActive("work_orders");
  return <>{os.items.filter((o) => o.customerId === customerId).length}</>;
}

export { isLive };
