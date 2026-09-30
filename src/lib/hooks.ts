"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useActive } from "./data/store";
import type { Data } from "./analytics";

/** Carrega (sob demanda) todas as coleções usadas por dashboards/relatórios. */
export function useAnalyticsData(): { data: Data; loading: boolean } {
  const q = useActive("quotes"), o = useActive("work_orders"), t = useActive("financial_transactions"), c = useActive("customers"), p = useActive("products"), a = useActive("appointments"), g = useActive("goals");
  const act = useActive("crm_activities"), w = useActive("warranties"), s = useActive("services"), ac = useActive("financial_accounts"), cat = useActive("service_categories"), mv = useActive("stock_movements"), ev = useActive("evaluations");
  const loading = [q, o, t, c, p, a, g, act, w, s, ac, cat, mv, ev].some((x) => x.loading);
  const data = useMemo<Data>(
    () => ({ quotes: q.items, orders: o.items, txns: t.items, customers: c.items, products: p.items, appointments: a.items, goals: g.items, activities: act.items, warranties: w.items, services: s.items, accounts: ac.items, categories: cat.items, movements: mv.items, evaluations: ev.items }),
    [q.items, o.items, t.items, c.items, p.items, a.items, g.items, act.items, w.items, s.items, ac.items, cat.items, mv.items, ev.items],
  );
  return { data, loading };
}

const URL_CHANGE = "gbr:urlchange";

/** Assina mudanças na URL (back/forward e limpezas feitas via `clear`). */
function subscribeUrl(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(URL_CHANGE, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(URL_CHANGE, cb);
  };
}

/**
 * Lê um parâmetro da URL sem exigir Suspense (usado por ?new=1 e ?open=).
 * A URL é tratada como store externo: disponível já na primeira renderização
 * no cliente, sem efeitos que fazem setState e com suporte a back/forward.
 */
export function useQueryParam(name: string) {
  const v = useSyncExternalStore(
    subscribeUrl,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
  const clear = useCallback(() => {
    const u = new URL(window.location.href);
    u.searchParams.delete(name);
    window.history.replaceState(null, "", u.pathname + (u.search || ""));
    window.dispatchEvent(new Event(URL_CHANGE));
  }, [name]);
  return [v, clear] as const;
}
