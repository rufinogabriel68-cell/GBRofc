"use client";
import { useMemo, useState } from "react";
import { FilePlus2, RotateCcw } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { computePricing, emptyPricing, feePctFor, grossUp } from "@/lib/calc";
import { PAY_METHODS } from "@/lib/constants";
import { useSettings } from "@/lib/settings";
import type { Pricing } from "@/lib/types";
import { money, pct, toNum } from "@/lib/utils";
import { PricingBuilder } from "../PricingBuilder";

export default function Calculator() {
  const ui = useUI();
  const { settings } = useSettings();
  const [p, setP] = useState<Pricing>(() => ({ ...emptyPricing() }));
  const [net, setNet] = useState("100");
  const totals = useMemo(() => computePricing(p, settings.fees), [p, settings.fees]);
  const rows = useMemo(() => {
    const n = toNum(net);
    const list: { label: string; fee: number }[] = [
      { label: PAY_METHODS.pix, fee: feePctFor(settings.fees, "pix", 1) }, { label: PAY_METHODS.dinheiro, fee: feePctFor(settings.fees, "dinheiro", 1) },
      { label: PAY_METHODS.debito, fee: feePctFor(settings.fees, "debito", 1) }, { label: PAY_METHODS.credito, fee: feePctFor(settings.fees, "credito", 1) },
      ...Array.from({ length: 12 }, (_, i) => ({ label: `Parcelado ${i + 1}x`, fee: feePctFor(settings.fees, "parcelado", i + 1) })),
    ];
    return list.map((r) => ({ ...r, ...grossUp(n, r.fee) }));
  }, [net, settings.fees]);

  return (
    <>
      <PageHeader title="Calculadora profissional" subtitle="Forme o preço com serviços, adicionais, desconto, margem e taxa da maquininha repassada ao cliente."
        actions={<><button className="btn" onClick={() => setP(emptyPricing())}><RotateCcw size={15} /> Limpar</button><button className="btn btn-primary" disabled={!p.lines.length} onClick={() => ui.openForm("quotes", null, { pricing: p })}><FilePlus2 size={16} /> Criar orçamento com esta simulação</button></>} />
      <PricingBuilder value={p} onChange={setP} />
      <div className="mt-5 grid lg:grid-cols-2 gap-4">
        <Panel title="Como a taxa é repassada">
          <p className="text-sm text-fg2 leading-relaxed">Para receber <b className="text-fg">{money(totals.netTarget)}</b> líquidos com taxa de <b className="text-fg">{pct(totals.feePct, 2)}</b>, o cliente paga <b className="text-fg">{money(totals.total)}</b> (valor do serviço ÷ (1 − taxa)). A diferença de <b className="text-warn">{money(totals.feeAmount)}</b> cobre a maquininha e você recebe ≈ {money(totals.netReceived)}.</p>
          <p className="text-[11px] text-fg3 mt-2">Ajuste as taxas em Configurações → Taxas de maquininha.</p>
        </Panel>
        <Panel title="Simulador de taxas">
          <label className="flex items-center gap-2 mb-3 text-sm">Líquido desejado (R$) <input className="input input-sm !w-32" type="number" value={net} onChange={(e) => setNet(e.target.value)} /></label>
          <div className="max-h-64 overflow-y-auto"><table className="w-full text-[13px]"><thead><tr><th className="th">Forma</th><th className="th text-right">Taxa</th><th className="th text-right">Cliente paga</th><th className="th text-right">Adicional</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.label}><td className="td">{r.label}</td><td className="td text-right">{pct(r.fee, 2)}</td><td className="td text-right font-semibold tabular-nums">{money(r.total)}</td><td className="td text-right text-warn tabular-nums">{r.fee ? `+ ${money(r.fee)}` : "—"}</td></tr>)}</tbody></table></div>
        </Panel>
      </div>
    </>
  );
}
