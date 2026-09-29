import { db } from "./data/store";
import { recordLabel } from "./labels";
import { nowISO } from "./utils";

/** Registra o último acesso a um registro (guardado em settings/recents). */
export function trackRecent(col: string, id: string) {
  const rec = db.get(col, id);
  if (!rec) return;
  const cur = db.get("settings", "recents");
  const items: { col: string; id: string; label: string; at: string }[] = (cur?.items || []).filter((x: { col: string; id: string }) => !(x.col === col && x.id === id));
  items.unshift({ col, id, label: recordLabel(rec), at: nowISO() });
  db.upsert("settings", "recents", { items: items.slice(0, 30) });
}
