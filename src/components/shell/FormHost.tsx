"use client";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { db, useRecord } from "@/lib/data/store";
import { toast } from "@/lib/toast";
import { getModule } from "@/modules/registry";
import { Modal, Spinner } from "../ui";
import { RecordForm } from "../crud/RecordForm";

const QuoteEditor = dynamic(() => import("@/modules/quotes/QuoteEditor"), { loading: () => <Loading /> });
const OrderEditor = dynamic(() => import("@/modules/orders/OrderEditor"), { loading: () => <Loading /> });

function Loading() {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40"><Spinner size={28} /></div>;
}

export type FormState = { col: string; id: string | null; defaults: Record<string, any> } | null;

export function FormHost({ state, onClose }: { state: FormState; onClose: () => void }) {
  if (!state) return null;
  if (state.col === "quotes") return <QuoteEditor id={state.id} defaults={state.defaults} onClose={onClose} />;
  if (state.col === "work_orders") return <OrderEditor id={state.id} defaults={state.defaults} onClose={onClose} />;
  return <GenericForm key={`${state.col}:${state.id}`} state={state} onClose={onClose} />;
}

function GenericForm({ state, onClose }: { state: NonNullable<FormState>; onClose: () => void }) {
  const cfg = getModule(state.col);
  const { rec, loading } = useRecord(state.col, state.id);
  const initial = useMemo(() => ({ ...(cfg?.defaults?.() || {}), ...state.defaults, ...(rec || {}) }), [cfg, state.defaults, rec]);
  if (!cfg) return null;
  const editing = !!state.id;
  const waiting = editing && !rec && loading;

  const submit = (values: Record<string, any>) => {
    const v = cfg.beforeSave ? cfg.beforeSave(values, rec) : values;
    if (!v) return;
    const isNew = !editing;
    const saved = isNew ? db.create(cfg.collection, v) : db.update(cfg.collection, state.id!, v);
    if (saved) cfg.afterSave?.(saved, isNew, rec);
    toast(isNew ? `${cfg.singular} criad${cfg.gender === "f" ? "a" : "o"}` : "Alterações salvas");
    onClose();
  };

  return (
    <Modal open onClose={onClose} size={cfg.formSize || "md"} title={`${editing ? "Editar" : cfg.gender === "f" ? "Nova" : "Novo"} ${cfg.singular.toLowerCase()}`}
      subtitle={editing && rec ? cfg.title(rec) : undefined}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" type="submit" form="record-form" disabled={waiting}>Salvar</button>
        </>
      }>
      {waiting ? <div className="grid place-items-center py-16"><Spinner size={26} /></div> : (
        <RecordForm fields={cfg.fields} initial={initial} onSubmit={submit} hideActions extra={cfg.extraForm} />
      )}
    </Modal>
  );
}
