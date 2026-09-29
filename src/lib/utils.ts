export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export const toNum = (v: unknown): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", "."));
  const m = parseFloat(String(v ?? ""));
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return m;
  return isFinite(n) ? n : 0;
};

export const money = (n: unknown) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const moneyShort = (n: unknown) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")} mil`;
  return money(v);
};
export const num = (n: unknown, d = 0) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: d });
export const pct = (n: unknown, d = 1) => `${(Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: d })}%`;
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const rnd = (len: number, chars: string) => {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
};
export const newId = () => rnd(20, "abcdefghijklmnopqrstuvwxyz0123456789");
/** Token seguro (base62, 32 caracteres) para links públicos. */
export const newToken = (len = 32) => rnd(len, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789");

export const nowISO = () => new Date().toISOString();
const p2 = (n: number) => String(n).padStart(2, "0");
export const dateToISO = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const todayISO = () => dateToISO(new Date());
/** Converte data/datetime em yyyy-mm-dd no fuso local. */
export const dayOf = (s?: string | null): string => {
  if (!s) return "";
  if (s.length === 10) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : dateToISO(d);
};
export const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDays = (s: string, n: number) => {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return dateToISO(d);
};
export const addMonths = (s: string, n: number) => {
  const d = parseDay(s);
  d.setMonth(d.getMonth() + n);
  return dateToISO(d);
};
export const diffDays = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);
export const startOfMonth = (s = todayISO()) => `${s.slice(0, 7)}-01`;
export const endOfMonth = (s = todayISO()) => {
  const d = parseDay(startOfMonth(s));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return dateToISO(d);
};
export const fmtDate = (s?: string | null) => {
  const d = dayOf(s);
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
};
export const fmtDateTime = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
export const fmtTime = (s?: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};
export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

export const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? null));

export const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

export function groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of arr) (out[key(x)] ||= []).push(x);
  return out;
}

export function download(filename: string, content: BlobPart, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCSV(columns: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [columns, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}

export function toExcelHTML(title: string, columns: string[], rows: (string | number | null | undefined)[][]) {
  const e = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><title>${e(title)}</title></head><body><table border="1"><thead><tr>${columns
    .map((c) => `<th>${e(c)}</th>`)
    .join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}

export const debounce = <A extends unknown[]>(fn: (...a: A) => void, ms: number) => {
  let t: ReturnType<typeof setTimeout>;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

/** Redimensiona imagens (fotos da câmera) antes do upload. */
export async function compressImage(file: File, max = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || typeof createImageBitmap === "undefined") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 600_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function fileToDataURL(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export const sanitize = (s: string) => s.replace(/[<>]/g, "").trim();
