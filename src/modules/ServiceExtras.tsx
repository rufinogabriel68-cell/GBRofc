"use client";
import { useState } from "react";
import { ListChecks, Package, Plus, Trash2 } from "lucide-react";
import { useActive } from "@/lib/data/store";
import type { Rec } from "@/lib/types";
import { newId } from "@/lib/utils";
import { UNITS } from "@/lib/constants";

/** Materiais padrão e checklist do serviço (embutidos no documento do serviço). */
export function ServiceExtras({ values, set }: { values: Record<string, any>; set: (k: string, v: any) => void }) {
  const { items: products } = useActive("products");
  const materials: Rec[] = values.materials || [];
  const checklist: string[] = values.checklist || [];
  const [task, setTask] = useState("");

  const updMat = (id: string, patch: Record<string, any>) => set("materials", materials.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  return (
    <div className="space-y-5 pt-2">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5"><Package size={13} /> Materiais normalmente utilizados</div>
          <button type="button" className="btn btn-sm" onClick={() => set("materials", [...materials, { id: newId(), productId: "", name: "", qty: 1, unit: "un" }])}><Plus size={14} /> Material</button>
        </div>
        {materials.length === 0 && <p className="text-xs text-fg3">Ao adicionar este serviço em uma OS, os materiais abaixo serão sugeridos (e poderão ser ajustados).</p>}
        <div className="space-y-2">
          {materials.map((m) => (
            <div key={m.id} className="grid grid-cols-[1fr_72px_84px_auto] sm:grid-cols-[1.2fr_1fr_80px_96px_auto] gap-2 items-center">
              <select className="input input-sm hidden sm:block" value={m.productId || ""} onChange={(e) => {
                const p = products.find((x) => x.id === e.target.value);
                updMat(m.id, { productId: e.target.value, ...(p ? { name: p.name, unit: p.unit || "un" } : {}) });
              }}>
                <option value="">Produto do estoque (opcional)</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="input input-sm" placeholder="Nome do material" value={m.name} onChange={(e) => updMat(m.id, { name: e.target.value })} />
              <input className="input input-sm" type="number" step="any" value={m.qty} onChange={(e) => updMat(m.id, { qty: e.target.value })} aria-label="Quantidade" />
              <select className="input input-sm" value={m.unit} onChange={(e) => updMat(m.id, { unit: e.target.value })} aria-label="Unidade">
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
              <button type="button" className="btn btn-sm btn-ghost btn-icon btn-danger" aria-label="Remover material" onClick={() => set("materials", materials.filter((x) => x.id !== m.id))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5 mb-2"><ListChecks size={13} /> Checklist do serviço</div>
        <div className="space-y-1.5 mb-2">
          {checklist.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-solid2 rounded-xl px-3 h-9 border border-line">
              <span className="text-fg3 text-xs w-5">{i + 1}.</span>
              <span className="flex-1 truncate">{t}</span>
              <button type="button" aria-label="Remover item" className="text-fg3 hover:text-bad" onClick={() => set("checklist", checklist.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input input-sm" placeholder="Ex.: Verificar ponto de energia" value={task} onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (task.trim()) { set("checklist", [...checklist, task.trim()]); setTask(""); } } }} />
          <button type="button" className="btn btn-sm" onClick={() => { if (task.trim()) { set("checklist", [...checklist, task.trim()]); setTask(""); } }}><Plus size={14} /> Adicionar</button>
        </div>
      </div>
    </div>
  );
}
