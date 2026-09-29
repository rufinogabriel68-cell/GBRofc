"use client";
import { useEffect, useMemo, useRef } from "react";
import { useCollection, db } from "@/lib/data/store";
import { computeAlerts } from "@/lib/alerts";
import { notify, processPublicLinks, pushHistory, saveQuote } from "@/lib/workflows";
import { runDueAutomations } from "@/lib/automation";
import { dayOf, todayISO } from "@/lib/utils";

/**
 * Processos em segundo plano (enquanto o app está aberto):
 *  1. aplica no sistema as respostas dos clientes recebidas pelos links públicos
 *  2. expira orçamentos vencidos
 *  3. gera notificações a partir de pendências reais (OS atrasada, estoque baixo, contas, garantias)
 *  4. executa automações agendadas
 * Em produção com Firebase, os itens 2–4 devem migrar para Cloud Functions agendadas (firebase/functions).
 */
export function Watchers() {
  const links = useCollection("public_links");
  const quotes = useCollection("quotes");
  const orders = useCollection("work_orders");
  const txns = useCollection("financial_transactions");
  const products = useCollection("products");
  const warranties = useCollection("warranties");
  const activities = useCollection("crm_activities");
  const customers = useCollection("customers");
  const notifs = useCollection("notifications");
  const autos = useCollection("automations");
  const logs = useCollection("automation_logs");
  const ready = !notifs.loading && !links.loading;

  useEffect(() => {
    if (ready && links.items.length) processPublicLinks(links.items);
  }, [links.items, ready]);

  useEffect(() => {
    if (quotes.loading) return;
    const today = todayISO();
    quotes.items.forEach((q) => {
      if (!q.archived && !q.deletedAt && ["enviado", "aguardando"].includes(q.status) && q.validUntil && dayOf(q.validUntil) < today) {
        saveQuote(q.id, { status: "expirado", history: pushHistory(q, { type: "status", from: q.status, to: "expirado", text: "Orçamento expirado automaticamente (validade vencida)" }) });
      }
    });
  }, [quotes.items, quotes.loading]);

  const alerts = useMemo(
    () => computeAlerts({ quotes: quotes.items, orders: orders.items, txns: txns.items, products: products.items, warranties: warranties.items, activities: activities.items, customers: customers.items }),
    [quotes.items, orders.items, txns.items, products.items, warranties.items, activities.items, customers.items],
  );
  const loadedAll = ready && !quotes.loading && !orders.loading && !txns.loading && !products.loading && !warranties.loading && !customers.loading;
  const lastKey = useRef("");
  useEffect(() => {
    if (!loadedAll) return;
    const k = alerts.filter((a) => a.persist).map((a) => a.key).join("|");
    if (k === lastKey.current) return;
    lastKey.current = k;
    alerts.filter((a) => a.persist).forEach((a) => {
      notify({ type: a.type === "late_order" ? "late_order" : a.type === "low_stock" ? "low_stock" : a.type === "due_bill" ? "due_bill" : "warranty", title: a.title, body: a.body, entity: a.entity, key: a.key, severity: a.severity === "bad" ? "bad" : a.severity === "warn" ? "warn" : "info" });
    });
  }, [alerts, loadedAll]);

  useEffect(() => {
    if (autos.loading || logs.loading) return;
    const run = () => runDueAutomations();
    run();
    const t = setInterval(run, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [autos.loading, logs.loading]);

  void db;
  return null;
}
