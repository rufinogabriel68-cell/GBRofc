"use client";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Camera, ImagePlus, Trash2, X } from "lucide-react";
import { COMPANY_ID } from "@/lib/session";
import { db, useActive } from "@/lib/data/store";
import { toastError } from "@/lib/toast";
import type { Rec } from "@/lib/types";
import { compressImage, cx, newId, toNum } from "@/lib/utils";
import { Spinner } from "../ui";

export type Opt = { value: string; label: string };
export type Field = {
  key: string;
  label: string;
  type:
    | "text" | "textarea" | "number" | "money" | "percent" | "select" | "multiselect" | "date" | "datetime" | "time"
    | "checkbox" | "tags" | "ref" | "phone" | "email" | "url" | "color" | "image" | "password";
  options?: Opt[] | string[];
  ref?: { collection: string; label: (r: Rec) => string; filter?: (r: Rec) => boolean };
  required?: boolean;
  placeholder?: string;
  span?: 1 | 2;
  hint?: string;
  rows?: number;
  section?: string;
  showIf?: (v: Record<string, any>) => boolean;
  readOnly?: boolean;
  step?: string;
  folder?: string;
};

/* ---------------------------------------------------------------- upload helpers */
export function useUploader() {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File, folder: string) => {
    setBusy(true);
    try {
      const f = await compressImage(file);
      const name = f.name.replace(/[^\w.\-]+/g, "_");
      const path = `companies/${COMPANY_ID}/${folder}/${newId()}-${name}`;
      return await db.upload(path, f, f.name);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Falha no upload");
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { upload, busy };
}

export function ImageUpload({ url, onChange, folder, label = "Imagem", round }: { url?: string; onChange: (v: { url: string; path: string } | null) => void; folder: string; label?: string; round?: boolean }) {
  const { upload, busy } = useUploader();
  const ref = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const pick = async (f?: File | null) => {
    if (!f) return;
    const r = await upload(f, folder);
    if (r) onChange({ url: r.url, path: r.path });
  };
  return (
    <div className="flex items-center gap-3">
      <div className={cx("size-16 border border-line2 bg-solid2 grid place-items-center overflow-hidden shrink-0", round ? "rounded-full" : "rounded-2xl")}>
        {busy ? <Spinner /> : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="size-full object-cover" />
        ) : <ImagePlus size={20} className="text-fg3" />}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm" onClick={() => ref.current?.click()}><ImagePlus size={14} /> Escolher</button>
        <button type="button" className="btn btn-sm sm:hidden" onClick={() => cam.current?.click()}><Camera size={14} /> Câmera</button>
        {url && <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => onChange(null)}><Trash2 size={14} /></button>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

/* ---------------------------------------------------------------- field inputs */
function RefSelect({ f, value, onChange }: { f: Field; value: string; onChange: (v: string) => void }) {
  const { items } = useActive(f.ref!.collection);
  const list = useMemo(() => items.filter((r) => (f.ref!.filter ? f.ref!.filter(r) : true)).map((r) => ({ value: r.id, label: f.ref!.label(r) })).sort((a, b) => a.label.localeCompare(b.label)), [items, f.ref]);
  return (
    <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{f.placeholder || "Selecione..."}</option>
      {list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      {value && !list.find((o) => o.value === value) && <option value={value}>(registro removido)</option>}
    </select>
  );
}

function TagsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [raw, setRaw] = useState((value || []).join(", "));
  return (
    <input className="input" value={raw} placeholder={placeholder || "separe por vírgula"}
      onChange={(e) => { setRaw(e.target.value); onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean)); }} />
  );
}

export function FieldInput({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  const o = (f.options || []).map((x) => (typeof x === "string" ? { value: x, label: x } : x));
  const common = { disabled: f.readOnly, placeholder: f.placeholder };
  switch (f.type) {
    case "textarea":
      return <textarea className="input" rows={f.rows || 3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "select":
      return (
        <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={f.readOnly}>
          {!f.required && <option value="">{f.placeholder || "—"}</option>}
          {o.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
      );
    case "ref":
      return <RefSelect f={f} value={value} onChange={onChange} />;
    case "multiselect": {
      const cur: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {o.map((x) => {
            const on = cur.includes(x.value);
            return (
              <button type="button" key={x.value} aria-pressed={on} onClick={() => onChange(on ? cur.filter((v) => v !== x.value) : [...cur, x.value])}
                className={cx("h-7 px-2.5 rounded-lg border text-xs font-semibold transition", on ? "bg-accent/15 border-accent/40 text-accent" : "bg-solid2 border-line text-fg2 hover:text-fg")}>
                {on ? "✓ " : ""}{x.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "checkbox":
      return (
        <button type="button" role="switch" aria-checked={!!value} onClick={() => onChange(!value)} className="flex items-center gap-2 h-10">
          <span className={cx("w-10 h-6 rounded-full p-0.5 transition", value ? "bg-accent" : "bg-solid3")}>
            <span className={cx("block size-5 rounded-full bg-white transition", value && "translate-x-4")} />
          </span>
          <span className="text-sm text-fg2">{value ? "Sim" : "Não"}</span>
        </button>
      );
    case "money":
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-fg3">R$</span>
          <input className="input pl-9" type="number" step="0.01" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />
        </div>
      );
    case "percent":
      return (
        <div className="relative">
          <input className="input pr-8" type="number" step="0.01" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg3">%</span>
        </div>
      );
    case "number":
      return <input className="input" type="number" step={f.step || "any"} inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "date":
      return <input className="input" type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={f.readOnly} />;
    case "datetime":
      return <input className="input" type="datetime-local" value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={f.readOnly} />;
    case "time":
      return <input className="input" type="time" value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={f.readOnly} />;
    case "color":
      return <input className="input p-1 h-10 w-24" type="color" value={value || "#38a8ff"} onChange={(e) => onChange(e.target.value)} />;
    case "tags":
      return <TagsInput value={Array.isArray(value) ? value : []} onChange={onChange} placeholder={f.placeholder} />;
    case "image":
      return <ImageUpload url={value} folder={f.folder || "images"} label={f.label} onChange={(v) => onChange(v)} />;
    case "phone":
      return <input className="input" type="tel" inputMode="tel" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "email":
      return <input className="input" type="email" inputMode="email" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "url":
      return <input className="input" type="url" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "password":
      return <input className="input" type="password" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    default:
      return <input className="input" type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />;
  }
}

/** Normaliza os valores digitados para o formato de armazenamento. */
export function normalizeValues(fields: Field[], v: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...v };
  for (const f of fields) {
    if (f.type === "number" || f.type === "money" || f.type === "percent") out[f.key] = v[f.key] === "" || v[f.key] == null ? 0 : toNum(v[f.key]);
    else if (f.type === "image") {
      // image guarda url e path (chave *Path) — tratado no onChange
    }
    else if (typeof out[f.key] === "string") out[f.key] = (out[f.key] as string).replace(/[<>]/g, "").trim();
  }
  return out;
}

export function RecordForm({
  fields,
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Salvar",
  extra,
  formId = "record-form",
  hideActions,
}: {
  fields: Field[];
  initial: Record<string, any>;
  onSubmit: (v: Record<string, any>) => void;
  onCancel?: () => void;
  submitLabel?: string;
  extra?: (values: Record<string, any>, set: (k: string, v: any) => void) => ReactNode;
  formId?: string;
  hideActions?: boolean;
}) {
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (f.showIf && !f.showIf(values)) continue;
      const v = values[f.key];
      if (f.required && (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length))) errs[f.key] = "Campo obrigatório";
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      const el = document.querySelector(`[data-field="${Object.keys(errs)[0]}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onSubmit(normalizeValues(fields, values));
  };

  // Pré-calcula quais campos abrem cabeçalho de seção (primeiro campo visível de cada seção),
  // evitando mutação de variável dentro do callback do map.
  const sectionHeads = new Set<string>();
  let prevSection = "";
  for (const f of fields) {
    if (f.showIf && !f.showIf(values)) continue;
    if (f.section) {
      if (f.section !== prevSection) sectionHeads.add(f.key);
      prevSection = f.section;
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
      {fields.map((f) => {
        if (f.showIf && !f.showIf(values)) return null;
        const head = f.section && sectionHeads.has(f.key) ? f.section : null;
        return (
          <div key={f.key} data-field={f.key} className={cx(f.span === 2 || f.type === "textarea" || f.type === "multiselect" || f.type === "image" ? "sm:col-span-2" : "")}>
            {head && <div className="sm:col-span-2 text-[11px] font-bold uppercase tracking-wider text-accent mb-2 mt-1.5">{head}</div>}
            <label className="block">
              <span className="label">{f.label}{f.required && <span className="text-bad"> *</span>}</span>
              <FieldInput f={f} value={values[f.key]} onChange={(v) => {
                if (f.type === "image") {
                  set(f.key, v ? v.url : "");
                  set(f.key.replace(/Url$/, "Path"), v ? v.path : "");
                } else set(f.key, v);
              }} />
            </label>
            {f.hint && <div className="text-[11px] text-fg3 mt-1">{f.hint}</div>}
            {errors[f.key] && <div className="text-[11px] text-bad mt-1" role="alert">{errors[f.key]}</div>}
          </div>
        );
      })}
      {extra && <div className="sm:col-span-2">{extra(values, set)}</div>}
      {!hideActions && (
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          {onCancel && <button type="button" className="btn" onClick={onCancel}><X size={15} /> Cancelar</button>}
          <button type="submit" className="btn btn-primary">{submitLabel}</button>
        </div>
      )}
    </form>
  );
}
