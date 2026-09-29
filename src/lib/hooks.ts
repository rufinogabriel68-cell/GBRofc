"use client";
import { useEffect, useMemo, useState } from "react";
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

/** Lê um parâmetro da URL sem exigir Suspense (usado por ?new=1 e ?open=). */
export function useQueryParam(name: string) {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    setV(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  const clear = () => {
    const u = new URL(window.location.href);
    u.searchParams.delete(name);
    window.history.replaceState(null, "", u.pathname + (u.search || ""));
    setV(null);
  };
  return [v, clear] as const;
}
