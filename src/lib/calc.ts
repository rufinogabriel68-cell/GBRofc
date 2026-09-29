import type { FeeTable, Pricing, PricingLine, Rec, Totals } from "./types";
import { newId, round2, toNum } from "./utils";

export const DEFAULT_FEES: FeeTable = {
  pix: 0,
  dinheiro: 0,
  debito: 1.99,
  credito: 3.49,
  parcelado: { "1": 3.49, "2": 5.39, "3": 6.19, "4": 6.99, "5": 7.79, "6": 8.59, "7": 9.39, "8": 10.19, "9": 10.99, "10": 11.79, "11": 12.59, "12": 13.39 },
};

export function emptyLine(): PricingLine {
  return { id: newId(), name: "", tier: "medio", qty: 1, unitPrice: 0, unitCost: 0, discountPct: 0, material: 0, materialCost: 0, note: "" };
}

export function emptyPricing(): Pricing {
  return {
    lines: [],
    travel: 0,
    parking: 0,
    toll: 0,
    extraMaterial: 0,
    taxes: 0,
    discountValue: 0,
    discountType: "value",
    paymentMethod: "pix",
    installments: 1,
    marginTarget: 0,
  };
}

export function feePctFor(fees: FeeTable | undefined, method: Pricing["paymentMethod"], installments: number): number {
  const f = fees || DEFAULT_FEES;
  if (method === "parcelado") return toNum(f.parcelado?.[String(installments)] ?? 0);
  return toNum(f[method] ?? 0);
}

/** Valor bruto necessário para receber `net` líquido após a taxa (repasse ao cliente). */
export function grossUp(net: number, feePct: number) {
  const rate = Math.min(Math.max(feePct, 0), 95) / 100;
  const total = rate > 0 ? net / (1 - rate) : net;
  return { total: round2(total), fee: round2(total - net) };
}

export function lineTotal(l: PricingLine) {
  const base = toNum(l.qty) * toNum(l.unitPrice);
  return round2(base - base * (toNum(l.discountPct) / 100) + toNum(l.material));
}

export function computePricing(p: Pricing, fees?: FeeTable): Totals {
  const lines = p.lines || [];
  const subtotal = round2(lines.reduce((a, l) => a + lineTotal(l), 0));
  const itemDiscount = round2(lines.reduce((a, l) => a + toNum(l.qty) * toNum(l.unitPrice) * (toNum(l.discountPct) / 100), 0));
  const additions = round2(toNum(p.travel) + toNum(p.parking) + toNum(p.toll) + toNum(p.extraMaterial) + toNum(p.taxes));
  const gross = subtotal + additions;
  const generalDiscount = round2(p.discountType === "pct" ? gross * (toNum(p.discountValue) / 100) : toNum(p.discountValue));
  const netTarget = Math.max(0, round2(gross - generalDiscount));
  const feePct = feePctFor(fees, p.paymentMethod, toNum(p.installments) || 1);
  const { total, fee } = grossUp(netTarget, feePct);
  const cost = round2(
    lines.reduce((a, l) => a + toNum(l.qty) * toNum(l.unitCost) + toNum(l.materialCost), 0) + toNum(p.parking) + toNum(p.toll) + toNum(p.extraMaterial) + toNum(p.taxes),
  );
  const profit = round2(netTarget - cost);
  const margin = netTarget > 0 ? round2((profit / netTarget) * 100) : 0;
  const m = Math.min(toNum(p.marginTarget), 95) / 100;
  const suggestedNet = m > 0 ? round2(cost / (1 - m)) : 0;
  return { subtotal, itemDiscount, additions, generalDiscount, netTarget, feePct, feeAmount: fee, total, netReceived: netTarget, cost, profit, margin, suggestedNet };
}

/** Taxa de deslocamento: valor fixo, por km ou por região. */
export function travelFee(travel: Rec | undefined, opts: { km?: number; region?: string }): number {
  if (!travel) return 0;
  if (travel.mode === "km") return round2(toNum(opts.km) * toNum(travel.perKm) * (travel.roundTrip ? 2 : 1));
  if (travel.mode === "region") {
    const r = (travel.regions || []).find((x: Rec) => x.name === opts.region);
    return round2(toNum(r?.fee));
  }
  return round2(toNum(travel.fixed));
}
