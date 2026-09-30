"use client";
import { useMemo, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { useActive } from "@/lib/data/store";
import { computePricing, emptyLine, feePctFor, lineTotal, travelFee } from "@/lib/calc";
import { PAY_METHODS, TIERS, TIER_FIELD } from "@/lib/constants";
import { useSettings } from "@/lib/settings";
import type { Pricing, PricingLine, Rec, Tier, Totals } from "@/lib/types";
import { cx, money, pct, toNum } from "@/lib/utils";
import { Field } from "@/components/ui";

const TIER_OPTS: { id: Tier; label: string }[] = [
  { id: "economico", label: "Econômico" }, { id: "medio", label: "Médio" }, { id: "premium", label: "Premium" }, { id: "custom", label: "Manual" },
];

function Row({ k, v, tone, strong }: { k: string; v: string; tone?: string; strong?: boolean }) {
  return (
    <div className={cx("flex justify-between gap-3 py-1 text-[13px]", strong && "font-bold text-[15px]")}>
      <span className={strong ? "" : "text-fg2"}>{k}</span><span className={cx("tabular-nums", tone)}>{v}</span>
    </div>
  );
}

export function PricingSummary({ t, pricing, compact }: { t: Totals; pricing: Pricing; compact?: boolean }) {
  return (
    <div className={cx("card p-4", !compact && "border-accent/25")} aria-live="polite">
      <div className="text-[11px] font-bold uppercase tracking-wider text-accent mb-2">Resumo do preço</div>
      <Row k="Subtotal" v={money(t.subtotal)} />
      {t.itemDiscount + t.generalDiscount > 0 && <Row k="Descontos" v={`- ${money(t.itemDiscount + t.generalDiscount)}`} tone="text-warn" />}
      {t.additions > 0 && <Row k="Adicionais (desloc., taxas...)" v={`+ ${money(t.additions)}`} />}
      <div className="h-px bg-line my-1.5" />
      <Row k="Valor do serviço (líquido)" v={money(t.netTarget)} strong />
      {t.feePct > 0 && (
        <>
          <Row k={`Taxa ${PAY_METHODS[pricing.paymentMethod]}${pricing.paymentMethod === "parcelado" ? ` ${pricing.installments}x` : ""} (${pct(t.feePct, 2)})`} v="repassada" tone="text-fg3" />
          <Row k="Valor adicional (taxa)" v={`+ ${money(t.feeAmount)}`} tone="text-warn" />
        </>
      )}
      <div className="rounded-xl bg-gradient-to-r from-accent/15 to-accent2/10 border border-accent/25 px-3 py-2.5 my-2">
        <div className="flex justify-between items-baseline"><span className="text-[11px] font-bold uppercase tracking-wider text-fg2">Total do cliente</span><span className="text-2xl font-extrabold tabular-nums">{money(t.total)}</span></div>
      </div>
      <Row k="Valor líquido estimado" v={money(t.netReceived)} tone="text-ok" />
      <div className="h-px bg-line my-1.5" />
      <Row k="Custo estimado" v={money(t.cost)} />
      <Row k="Lucro estimado" v={money(t.profit)} tone={t.profit >= 0 ? "text-ok" : "text-bad"} />
      <Row k="Margem" v={pct(t.margin, 1)} tone={t.margin >= 20 ? "text-ok" : t.margin >= 0 ? "text-warn" : "text-bad"} />
      {t.suggestedNet > 0 && <div className="text-[11px] text-fg3 mt-1">Para {pct(pricing.marginTarget, 0)} de margem, o valor líquido seria {money(t.suggestedNet)}.</div>}
    </div>
  );
}

export function PricingBuilder({ value, onChange, hideSummary }: { value: Pricing; onChange: (p: Pricing) => void; hideSummary?: boolean }) {
  const { settings } = useSettings();
  const svc = useActive("services");
  const cats = useActive("service_categories");
  const [cat, setCat] = useState("");
  const [svcId, setSvcId] = useState("");
  const [tier, setTier] = useState<Tier>("medio");
  const [km, setKm] = useState("");
  const [region, setRegion] = useState("");
  const totals = useMemo(() => computePricing(value, settings.fees), [value, settings.fees]);
  const set = (patch: Partial<Pricing>) => onChange({ ...value, ...patch });
  const setLine = (id: string, patch: Partial<PricingLine>) => set({ lines: value.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const list = svc.items.filter((s) => s.status !== "inativo" && (!cat || s.categoryId === cat)).sort((a, b) => a.name.localeCompare(b.name));

  const add = () => {
    const s = svc.items.find((x) => x.id === svcId);
    if (!s) return;
    set({ lines: [...value.lines, { ...emptyLine(), serviceId: s.id, name: s.name, tier, unitPrice: toNum(s[TIER_FIELD[tier]]), unitCost: toNum(s.cost) }] });
    setSvcId("");
  };
  const changeTier = (l: PricingLine, t: Tier) => {
    const s = svc.items.find((x) => x.id === l.serviceId);
    setLine(l.id, { tier: t, ...(s && t !== "custom" ? { unitPrice: toNum(s[TIER_FIELD[t]]) } : {}) });
  };
  const methods = Object.entries(PAY_METHODS).filter(([k]) => settings.paymentMethods?.[k as keyof typeof settings.paymentMethods] !== false);
  const tr = settings.travel as Rec;
  const num = (k: keyof Pricing, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className="input input-sm" type="number" step="0.01" inputMode="decimal" value={(value[k] as number) || ""} placeholder="0,00" onChange={(e) => set({ [k]: e.target.value === "" ? 0 : toNum(e.target.value) } as Partial<Pricing>)} />
    </Field>
  );

  return (
    <div className={cx("grid gap-4", !hideSummary && "lg:grid-cols-[1fr_340px]")}>
      <div className="space-y-4 min-w-0">
        {/* adicionar serviço */}
        <div className="card-solid p-3 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent">Adicionar serviço</div>
          <div className="grid grid-cols-2 sm:grid-cols-[150px_1fr_auto_auto] gap-2">
            <select className="input input-sm" value={cat} onChange={(e) => { setCat(e.target.value); setSvcId(""); }} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {cats.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input input-sm col-span-2 sm:col-span-1" value={svcId} onChange={(e) => setSvcId(e.target.value)} aria-label="Serviço">
              <option value="">{list.length ? "Selecione o serviço…" : "Nenhum serviço cadastrado"}</option>
              {list.map((s) => <option key={s.id} value={s.id}>{s.name} — {money(s[TIER_FIELD[tier]])}</option>)}
            </select>
            <select className="input input-sm" value={tier} onChange={(e) => setTier(e.target.value as Tier)} aria-label="Nível">
              {TIER_OPTS.filter((t) => t.id !== "custom").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button type="button" className="btn btn-sm btn-primary" disabled={!svcId} onClick={add}><Plus size={14} /> Adicionar</button>
          </div>
          <button type="button" className="btn btn-sm btn-ghost text-fg2" onClick={() => set({ lines: [...value.lines, { ...emptyLine(), tier: "custom" }] })}><Plus size={13} /> Item manual (sem serviço cadastrado)</button>
        </div>

        {/* linhas */}
        <div className="space-y-2.5">
          {value.lines.length === 0 && <div className="card-solid text-center text-sm text-fg3 py-8">Adicione ao menos um serviço para calcular o preço.</div>}
          {value.lines.map((l) => (
            <div key={l.id} className="card-solid p-3 space-y-2.5">
              <div className="flex gap-2 items-center">
                <input className="input input-sm font-semibold" placeholder="Descrição do serviço" value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} aria-label="Descrição" />
                <span className="font-bold tabular-nums whitespace-nowrap text-sm">{money(lineTotal(l))}</span>
                <button type="button" className="btn btn-sm btn-ghost btn-icon btn-danger" aria-label="Remover item" onClick={() => set({ lines: value.lines.filter((x) => x.id !== l.id) })}><Trash2 size={14} /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Field label="Nível"><select className="input input-sm" value={l.tier} onChange={(e) => changeTier(l, e.target.value as Tier)}>{TIER_OPTS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
                <Field label="Qtd."><input className="input input-sm" type="number" step="any" inputMode="decimal" value={l.qty} onChange={(e) => setLine(l.id, { qty: e.target.value as unknown as number })} onBlur={() => setLine(l.id, { qty: toNum(l.qty) || 1 })} /></Field>
                <Field label="Preço unit. (R$)"><input className="input input-sm" type="number" step="0.01" inputMode="decimal" value={l.unitPrice} onChange={(e) => setLine(l.id, { unitPrice: e.target.value as unknown as number, tier: "custom" })} onBlur={() => setLine(l.id, { unitPrice: toNum(l.unitPrice) })} /></Field>
                <Field label="Desconto (%)"><input className="input input-sm" type="number" step="0.1" inputMode="decimal" value={l.discountPct || ""} placeholder="0" onChange={(e) => setLine(l.id, { discountPct: toNum(e.target.value) })} /></Field>
                <Field label="Material (R$)"><input className="input input-sm" type="number" step="0.01" inputMode="decimal" value={l.material || ""} placeholder="0,00" onChange={(e) => setLine(l.id, { material: toNum(e.target.value) })} /></Field>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-fg3 hover:text-fg2 select-none">Custos e observação</summary>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Field label="Custo unitário (R$)"><input className="input input-sm" type="number" step="0.01" value={l.unitCost || ""} onChange={(e) => setLine(l.id, { unitCost: toNum(e.target.value) })} /></Field>
                  <Field label="Custo do material (R$)"><input className="input input-sm" type="number" step="0.01" value={l.materialCost || ""} onChange={(e) => setLine(l.id, { materialCost: toNum(e.target.value) })} /></Field>
                  <Field label="Observação do item" className="col-span-2"><input className="input input-sm" value={l.note || ""} onChange={(e) => setLine(l.id, { note: e.target.value })} /></Field>
                </div>
              </details>
            </div>
          ))}
        </div>

        {/* adicionais */}
        <div className="card-solid p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent mb-2.5">Adicionais e descontos</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {num("travel", "Deslocamento (R$)")}
            {num("parking", "Estacionamento (R$)")}
            {num("toll", "Pedágio (R$)")}
            {num("extraMaterial", "Material adicional (R$)")}
            {num("taxes", "Taxas / impostos (R$)")}
            <Field label="Desconto geral">
              <div className="flex gap-1.5">
                <input className="input input-sm" type="number" step="0.01" value={value.discountValue || ""} placeholder="0" onChange={(e) => set({ discountValue: toNum(e.target.value) })} />
                <select className="input input-sm !w-16 px-1" value={value.discountType} onChange={(e) => set({ discountType: e.target.value as "value" | "pct" })} aria-label="Tipo de desconto"><option value="value">R$</option><option value="pct">%</option></select>
              </div>
            </Field>
          </div>
          {(tr?.mode === "km" || tr?.mode === "region" || toNum(tr?.fixed) > 0) && (
            <div className="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-line">
              <span className="text-xs text-fg2 flex items-center gap-1.5 pb-2"><MapPin size={14} className="text-accent" /> Taxa de deslocamento ({tr.mode === "km" ? "por km" : tr.mode === "region" ? "por região" : "valor fixo"})</span>
              {tr.mode === "km" && <input className="input input-sm !w-24" type="number" placeholder="km" value={km} onChange={(e) => setKm(e.target.value)} aria-label="Distância em km" />}
              {tr.mode === "region" && (
                <select className="input input-sm !w-44" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Região">
                  <option value="">Região…</option>
                  {(tr.regions || []).map((r: Rec) => <option key={r.name}>{r.name}</option>)}
                </select>
              )}
              <button type="button" className="btn btn-sm" onClick={() => set({ travel: travelFee(tr, { km: toNum(km), region }) })}>Aplicar {money(travelFee(tr, { km: toNum(km), region }))}</button>
            </div>
          )}
        </div>

        {/* pagamento */}
        <div className="card-solid p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent mb-2.5">Forma de pagamento e taxa (repassada ao cliente)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Field label="Forma de pagamento">
              <select className="input input-sm" value={value.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value as Pricing["paymentMethod"], installments: e.target.value === "parcelado" ? Math.max(2, value.installments) : 1 })}>
                {methods.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            {value.paymentMethod === "parcelado" && (
              <Field label="Parcelas">
                <select className="input input-sm" value={value.installments} onChange={(e) => set({ installments: toNum(e.target.value) })}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x — {pct(feePctFor(settings.fees, "parcelado", n), 2)}</option>)}
                </select>
              </Field>
            )}
            <Field label="Taxa aplicada"><div className="input input-sm flex items-center text-fg2">{pct(totals.feePct, 2)}</div></Field>
            {num("marginTarget", "Margem desejada (%)")}
          </div>
        </div>
      </div>
      {!hideSummary && <div className="lg:sticky lg:top-20 self-start"><PricingSummary t={totals} pricing={value} /></div>}
    </div>
  );
}
