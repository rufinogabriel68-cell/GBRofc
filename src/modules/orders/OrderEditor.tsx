"use client";
import { useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { Field, Modal, Spinner } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { db, nextNumber, useActive, useCollection, useRecord } from "@/lib/data/store";
import { computePricing, emptyPricing } from "@/lib/calc";
import { OS_STATUS, opts } from "@/lib/constants";
import { useSettings } from "@/lib/settings";
import { customerAddress, pushHistory, saveOrder, setOrderStatus, syncAppointmentForOrder } from "@/lib/workflows";
import { toast } from "@/lib/toast";
import type { Pricing, Rec } from "@/lib/types";
import { toNum } from "@/lib/utils";
import { PricingBuilder } from "../PricingBuilder";

export default function OrderEditor({ id, defaults, onClose }: { id: string | null; defaults: Record<string, any>; onClose: () => void }) {
  const ui = useUI();
  const { settings, loaded } = useSettings();
  const { rec, loading } = useRecord("work_orders", id);
  const customers = useActive("customers");
  const users = useActive("users");
  const all = useCollection("work_orders");
  const [s, setS] = useState<Record<string, any> | null>(null);
  const init = useRef(false);

  useEffect(() => {
    if (init.current || !loaded) return;
    if (id) {
      if (!rec) return;
      init.current = true;
      setS({ ...rec, pricing: { ...emptyPricing(), ...(rec.pricing || {}) } });
    } else {
      init.current = true;
      const cust = defaults.customerId ? db.get("customers", defaults.customerId) : undefined;
      setS({ customerId: "", title: "", description: "", problem: "", notes: "", address: cust ? customerAddress(cust) : "", technician: settings.responsible || "", date: "", time: "", status: "aberta", warrantyDays: settings.warrantyDays, nextMaintenanceMonths: settings.nextMaintenanceMonths, ...defaults, pricing: { ...emptyPricing(), ...(defaults.pricing || {}) } });
    }
  }, [id, rec, loaded, defaults, settings]);

  const set = (p: Record<string, any>) => setS((x) => (x ? { ...x, ...p } : x));
  const pickCustomer = (cid: string) => {
    const c = customers.items.find((x) => x.id === cid);
    set({ customerId: cid, ...(c && !s?.address ? { address: customerAddress(c) } : {}) });
  };

  const save = () => {
    if (!s) return;
    if (!s.customerId) return toast("Selecione o cliente", "error");
    if (!String(s.title || "").trim()) return toast("Informe o serviço / título da OS", "error");
    const pricing: Pricing = { ...s.pricing, lines: s.pricing.lines.map((l: Rec) => ({ ...l, qty: toNum(l.qty) || 1, unitPrice: toNum(l.unitPrice) })) };
    const totals = computePricing(pricing, settings.fees);
    const base = {
      customerId: s.customerId, title: s.title, description: s.description || "", problem: s.problem || "", diagnosis: s.diagnosis || "", solution: s.solution || "", notes: s.notes || "",
      address: s.address || "", technician: s.technician || "", date: s.date || "", time: s.time || "", warrantyDays: toNum(s.warrantyDays), nextMaintenanceMonths: toNum(s.nextMaintenanceMonths),
      pricing, totals, total: totals.total,
    };
    if (id && rec) {
      const updated = saveOrder(id, { ...base, history: pushHistory(rec, { type: "event", text: "OS editada" }) });
      if (s.status !== rec.status) setOrderStatus(updated, s.status);
      toast("OS atualizada");
    } else {
      const number = nextNumber(settings.osPrefix, all.items);
      const os = db.create("work_orders", { ...base, number, status: s.date ? "agendada" : s.status || "aberta", materials: [], suggestedMaterials: [], checklist: [], additionals: [], history: [{ id: "h0", at: new Date().toISOString(), type: "status", to: s.date ? "agendada" : "aberta", text: "OS criada" }] });
      syncAppointmentForOrder(os);
      toast(`${number} criada`);
      onClose();
      ui.openDetail("work_orders", os.id);
      return;
    }
    onClose();
  };

  const techs = users.items.filter((u) => u.isTechnician).map((u) => u.name);

  return (
    <Modal open onClose={onClose} size="xl" title={id ? `Editar ${rec?.number || "OS"}` : "Nova ordem de serviço"} subtitle="Cliente, agenda, valores e execução"
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!s} onClick={save}>Salvar OS</button></>}>
      {!s ? <div className="grid place-items-center py-16">{loading || !loaded ? <Spinner size={26} /> : <span className="text-sm text-fg3">OS não encontrada.</span>}</div> : (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label={<>Cliente <span className="text-bad">*</span></>}>
              <div className="flex gap-2">
                <select className="input" value={s.customerId} onChange={(e) => pickCustomer(e.target.value)} aria-label="Cliente"><option value="">Selecione…</option>{[...customers.items].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <button type="button" className="btn btn-icon shrink-0" aria-label="Novo cliente" title="Novo cliente" onClick={() => ui.openForm("customers")}><UserPlus size={16} /></button>
              </div>
            </Field>
            <Field label={<>Serviço / título <span className="text-bad">*</span></>}><input className="input" value={s.title} placeholder="Ex.: Manutenção de computador" onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Endereço do atendimento" className="sm:col-span-2"><input className="input" value={s.address} onChange={(e) => set({ address: e.target.value })} /></Field>
            <Field label="Técnico responsável"><input className="input" list="techs" value={s.technician} onChange={(e) => set({ technician: e.target.value })} /><datalist id="techs">{techs.map((t) => <option key={t} value={t} />)}</datalist></Field>
            <Field label="Status"><select className="input" value={s.status} onChange={(e) => set({ status: e.target.value })}>{opts(OS_STATUS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
            <Field label="Data"><input className="input" type="date" value={s.date} onChange={(e) => set({ date: e.target.value })} /></Field>
            <Field label="Horário"><input className="input" type="time" value={s.time} onChange={(e) => set({ time: e.target.value })} /></Field>
            <Field label="Descrição do serviço" className="sm:col-span-2"><textarea className="input" rows={2} value={s.description} onChange={(e) => set({ description: e.target.value })} /></Field>
            <Field label="Problema relatado" className="sm:col-span-2"><textarea className="input" rows={2} value={s.problem} onChange={(e) => set({ problem: e.target.value })} /></Field>
            <Field label="Garantia (dias)"><input className="input" type="number" value={s.warrantyDays} onChange={(e) => set({ warrantyDays: e.target.value })} /></Field>
            <Field label="Próxima manutenção recomendada (meses)" hint="0 = não criar lembrete. Ao concluir, uma tarefa futura é criada."><input className="input" type="number" value={s.nextMaintenanceMonths} onChange={(e) => set({ nextMaintenanceMonths: e.target.value })} /></Field>
          </div>
          <PricingBuilder value={s.pricing} onChange={(pricing) => set({ pricing })} />
          <Field label="Observações"><textarea className="input" rows={2} value={s.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        </div>
      )}
    </Modal>
  );
}
