"use client";
import { useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { Modal, Spinner } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { db, nextNumber, useActive, useCollection, useRecord } from "@/lib/data/store";
import { computePricing, emptyPricing } from "@/lib/calc";
import { useSettings } from "@/lib/settings";
import { pushHistory, saveQuote, syncLeadStage } from "@/lib/workflows";
import { toast } from "@/lib/toast";
import type { Pricing } from "@/lib/types";
import { addDays, todayISO, toNum } from "@/lib/utils";
import { PricingBuilder } from "../PricingBuilder";
import { Field } from "@/components/ui";

type S = { customerId: string; title: string; description: string; notes: string; terms: string; validUntil: string; deliveryDays: string; pricing: Pricing };

export default function QuoteEditor({ id, defaults, onClose }: { id: string | null; defaults: Record<string, any>; onClose: () => void }) {
  const ui = useUI();
  const { settings, loaded } = useSettings();
  const { rec, loading } = useRecord("quotes", id);
  const customers = useActive("customers");
  const all = useCollection("quotes");
  const [s, setS] = useState<S | null>(null);
  const init = useRef(false);

  useEffect(() => {
    if (init.current || !loaded) return;
    if (id) {
      if (!rec) return;
      init.current = true;
      setS({ customerId: rec.customerId || "", title: rec.title || "", description: rec.description || "", notes: rec.notes || "", terms: rec.terms || "", validUntil: rec.validUntil || "", deliveryDays: rec.deliveryDays || "", pricing: { ...emptyPricing(), ...(rec.pricing || {}) } });
    } else {
      init.current = true;
      setS({ customerId: defaults.customerId || "", title: defaults.title || "", description: "", notes: "", terms: settings.terms, validUntil: addDays(todayISO(), toNum(settings.quoteValidityDays) || 15), deliveryDays: "", pricing: { ...emptyPricing(), marginTarget: toNum(settings.defaultMargin) || 0, ...(defaults.pricing || {}) } });
    }
  }, [id, rec, loaded, defaults, settings]);

  const set = (p: Partial<S>) => setS((x) => (x ? { ...x, ...p } : x));
  const waiting = !s;

  const save = (openAfter: boolean) => {
    if (!s) return;
    if (!s.customerId) return toast("Selecione o cliente", "error");
    if (!s.pricing.lines.length) return toast("Adicione ao menos um serviço", "error");
    if (s.pricing.lines.some((l) => !l.name.trim())) return toast("Preencha a descrição de todos os itens", "error");
    const pricing: Pricing = { ...s.pricing, lines: s.pricing.lines.map((l) => ({ ...l, qty: toNum(l.qty) || 1, unitPrice: toNum(l.unitPrice) })) };
    const totals = computePricing(pricing, settings.fees);
    const base = { customerId: s.customerId, title: s.title || pricing.lines[0].name, description: s.description, notes: s.notes, terms: s.terms, validUntil: s.validUntil, deliveryDays: s.deliveryDays, pricing, totals, total: totals.total };
    let qid = id;
    if (id && rec) {
      const before = rec.total;
      saveQuote(id, { ...base, history: pushHistory(rec, { type: "event", text: Math.abs(toNum(before) - totals.total) > 0.005 ? `Orçamento editado (total de R$ ${toNum(before).toFixed(2)} para R$ ${totals.total.toFixed(2)})` : "Orçamento editado" }) });
      toast("Orçamento atualizado");
    } else {
      const number = nextNumber(settings.quotePrefix, all.items);
      const q = db.create("quotes", { ...base, number, status: "rascunho", history: [{ id: "h0", at: new Date().toISOString(), type: "status", to: "rascunho", text: "Orçamento criado", byName: "" }] });
      qid = q.id;
      syncLeadStage(s.customerId, "orcamento");
      toast(`${number} criado`);
    }
    onClose();
    if (openAfter && qid) ui.openDetail("quotes", qid);
  };

  return (
    <Modal open onClose={onClose} size="xl" title={id ? `Editar orçamento ${rec?.number || ""}` : "Novo orçamento"} subtitle="Cliente → serviços → preço → enviar, tudo nesta tela"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn" disabled={waiting} onClick={() => save(false)}>Salvar</button>
          <button className="btn btn-primary" disabled={waiting} onClick={() => save(true)}>Salvar e abrir</button>
        </>
      }>
      {waiting ? <div className="grid place-items-center py-16">{loading || !loaded ? <Spinner size={26} /> : <span className="text-sm text-fg3">Orçamento não encontrado.</span>}</div> : (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label={<>Cliente <span className="text-bad">*</span></>}>
              <div className="flex gap-2">
                <select className="input" value={s.customerId} onChange={(e) => set({ customerId: e.target.value })} aria-label="Cliente">
                  <option value="">Selecione o cliente…</option>
                  {[...customers.items].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" className="btn btn-icon shrink-0" title="Novo cliente" aria-label="Novo cliente" onClick={() => ui.openForm("customers")}><UserPlus size={16} /></button>
              </div>
            </Field>
            <Field label="Título do orçamento"><input className="input" value={s.title} placeholder="Ex.: Instalação de 4 câmeras" onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Válido até"><input className="input" type="date" value={s.validUntil} onChange={(e) => set({ validUntil: e.target.value })} /></Field>
            <Field label="Prazo de execução (dias)"><input className="input" type="number" value={s.deliveryDays} onChange={(e) => set({ deliveryDays: e.target.value })} /></Field>
            <Field label="Descrição / escopo" className="sm:col-span-2"><textarea className="input" rows={2} value={s.description} onChange={(e) => set({ description: e.target.value })} /></Field>
          </div>
          <PricingBuilder value={s.pricing} onChange={(pricing) => set({ pricing })} />
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Observações"><textarea className="input" rows={3} value={s.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
            <Field label="Termos e condições"><textarea className="input" rows={3} value={s.terms} onChange={(e) => set({ terms: e.target.value })} /></Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
