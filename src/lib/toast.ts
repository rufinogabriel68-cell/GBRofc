export type ToastMsg = { id: number; type: "ok" | "error" | "info"; text: string };
import { addLog } from "./logs";
type L = (t: ToastMsg) => void;
const listeners = new Set<L>();
let seq = 0;

export function onToast(l: L) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function toast(text: string, type: ToastMsg["type"] = "ok") {
  if (type === "error") addLog("error", "toast", text);
  const t = { id: ++seq, type, text };
  listeners.forEach((l) => l(t));
}
export const toastError = (text: string) => toast(text, "error");
