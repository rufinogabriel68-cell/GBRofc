"use client";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  Boxes, CalendarDays, Calculator, ClipboardList, CornerDownLeft, FileText, FolderOpen, Search, StickyNote, UserPlus, Users, Wallet, Wrench, Zap, Settings, BarChart3, Target, Sparkles,
} from "lucide-react";
import { useCollection } from "@/lib/data/store";
import { norm, money, fmtDate } from "@/lib/utils";
import type { Rec } from "@/lib/types";
import { useUI } from "./ui-context";

type Item = { id: string; group: string; label: string; hint?: string; icon: ComponentType<{ size?: number | string; className?: string }>; run: () => void; text: string; type: string };

const ALIASES: Record<string, string> = {
  cliente: "customers", clientes: "customers", orcamento: "quotes", orcamentos: "quotes", os: "work_orders", ordem: "work_orders", servico: "services", servicos: "services",
  produto: "products", produtos: "products", documento: "documents", documentos: "documents", nota: "notes", anotacao: "notes", lancamento: "financial_transactions", transacao: "financial_transactions",
};

/** Nenhuma notificação: o snapshot só muda de `false` (servidor) para `true` (cliente). */
const subscribeNone = () => () => {};

export function CommandCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mounted = useSyncExternalStore(subscribeNone, () => true, () => false);
  if (!open || !mounted) return null;
  return createPortal(<Palette onClose={onClose} />, document.body);
}

function Palette({ onClose }: { onClose: () => void }) {
  const ui = useUI();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const customers = useCollection("customers").items;
  const quotes = useCollection("quotes").items;
  const orders = useCollection("work_orders").items;
  const services = useCollection("services").items;
  const products = useCollection("products").items;
  const docs = useCollection("documents").items;
  const notes = useCollection("notes").items;
  const txns = useCollection("financial_transactions").items;

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onClose]);

  const go = (fn: () => void) => () => { onClose(); fn(); };

  const actions: Item[] = useMemo(() => {
    const a = (label: string, kw: string, icon: Item["icon"], run: () => void, group = "Ações"): Item => ({ id: "a_" + label, group, label, icon, run: go(run), text: norm(label + " " + kw), type: "action" });
    return [
      a("Novo cliente", "cadastrar cliente adicionar", UserPlus, () => ui.openForm("customers")),
      a("Novo orçamento", "nova cotacao proposta", FileText, () => ui.openForm("quotes")),
      a("Nova OS", "ordem de servico novo os", ClipboardList, () => ui.openForm("work_orders")),
      a("Novo serviço", "cadastrar servico", Wrench, () => ui.openForm("services")),
      a("Novo produto", "cadastrar produto estoque", Boxes, () => ui.openForm("products")),
      a("Nova anotação", "nota anotacao", StickyNote, () => router.push("/anotacoes?new=1")),
      a("Novo lançamento financeiro", "despesa receita entrada saida", Wallet, () => ui.openForm("financial_transactions")),
      a("Novo agendamento", "compromisso visita", CalendarDays, () => ui.openForm("appointments")),
      a("Abrir agenda", "calendario", CalendarDays, () => router.push("/agenda"), "Navegar"),
      a("Abrir calculadora", "preco formacao", Calculator, () => router.push("/calculadora"), "Navegar"),
      a("Ir para Dashboard", "inicio painel", Sparkles, () => router.push("/"), "Navegar"),
      a("Ir para Orçamentos", "", FileText, () => router.push("/orcamentos"), "Navegar"),
      a("Ir para Ordens de Serviço", "os", ClipboardList, () => router.push("/ordens-de-servico"), "Navegar"),
      a("Ir para CRM", "clientes pipeline", Users, () => router.push("/crm"), "Navegar"),
      a("Ir para Estoque", "produtos", Boxes, () => router.push("/estoque"), "Navegar"),
      a("Ir para Financeiro", "caixa contas", Wallet, () => router.push("/financeiro"), "Navegar"),
      a("Ir para Metas", "", Target, () => router.push("/metas"), "Navegar"),
      a("Ir para Documentos", "arquivos pdf", FolderOpen, () => router.push("/documentos"), "Navegar"),
      a("Ir para Relatórios", "exportar", BarChart3, () => router.push("/relatorios"), "Navegar"),
      a("Ir para Automações", "whatsapp pos venda", Zap, () => router.push("/automacoes"), "Navegar"),
      a("Ir para Configurações", "ajustes empresa taxas backup", Settings, () => router.push("/configuracoes"), "Navegar"),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const records: Item[] = useMemo(() => {
    const live = (r: Rec) => !r.deletedAt && !r.archived;
    const cname = (id: string) => customers.find((c) => c.id === id)?.name || "";
    const list: Item[] = [];
    customers.filter(live).forEach((r) => list.push({ id: "c" + r.id, group: "Clientes", label: r.name, hint: [r.phone, r.city].filter(Boolean).join(" · "), icon: Users, run: go(() => ui.openDetail("customers", r.id)), text: norm([r.name, r.phone, r.whatsapp, r.email, r.document].join(" ")), type: "customers" }));
    quotes.filter(live).forEach((r) => list.push({ id: "q" + r.id, group: "Orçamentos", label: `${r.number} — ${r.title || ""}`, hint: `${cname(r.customerId)} · ${money(r.total)}`, icon: FileText, run: go(() => ui.openDetail("quotes", r.id)), text: norm([r.number, r.title, cname(r.customerId)].join(" ")), type: "quotes" }));
    orders.filter(live).forEach((r) => list.push({ id: "o" + r.id, group: "Ordens de serviço", label: `${r.number} — ${r.title || ""}`, hint: `${cname(r.customerId)} · ${money(r.total)}`, icon: ClipboardList, run: go(() => ui.openDetail("work_orders", r.id)), text: norm([r.number, r.title, cname(r.customerId), r.address].join(" ")), type: "work_orders" }));
    services.filter(live).forEach((r) => list.push({ id: "s" + r.id, group: "Serviços", label: r.name, hint: money(r.priceMid), icon: Wrench, run: go(() => ui.openForm("services", r.id)), text: norm([r.name, r.code, r.description].join(" ")), type: "services" }));
    products.filter(live).forEach((r) => list.push({ id: "p" + r.id, group: "Produtos", label: r.name, hint: `${r.qty} ${r.unit}`, icon: Boxes, run: go(() => ui.openForm("products", r.id)), text: norm([r.name, r.code, r.category].join(" ")), type: "products" }));
    docs.filter(live).forEach((r) => list.push({ id: "d" + r.id, group: "Documentos", label: r.title || r.file?.name || "Documento", hint: fmtDate(r.createdAt), icon: FolderOpen, run: go(() => router.push("/documentos")), text: norm([r.title, r.file?.name, cname(r.customerId)].join(" ")), type: "documents" }));
    notes.filter(live).forEach((r) => list.push({ id: "n" + r.id, group: "Anotações", label: r.title || "Sem título", hint: String(r.body || "").slice(0, 60), icon: StickyNote, run: go(() => router.push(`/anotacoes?open=${r.id}`)), text: norm([r.title, r.body].join(" ")), type: "notes" }));
    txns.filter(live).forEach((r) => list.push({ id: "t" + r.id, group: "Transações", label: r.description, hint: `${money(r.amount)} · ${fmtDate(r.dueDate)}`, icon: Wallet, run: go(() => ui.openForm("financial_transactions", r.id)), text: norm([r.description, cname(r.customerId), money(r.amount)].join(" ")), type: "financial_transactions" }));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, quotes, orders, services, products, docs, notes, txns]);

  const results = useMemo(() => {
    const raw = norm(q).trim();
    if (!raw) return [...actions.filter((a) => a.group === "Ações"), ...records.slice(0, 0)];
    let tokens = raw.split(/\s+/);
    let typeFilter = "";
    if (tokens.length > 1 && ALIASES[tokens[0]]) {
      typeFilter = ALIASES[tokens[0]];
      tokens = tokens.slice(1);
    }
    const match = (it: Item) => tokens.every((t) => it.text.includes(t));
    const score = (it: Item) => {
      const l = norm(it.label);
      return (l.startsWith(tokens[0]) ? 0 : l.includes(tokens[0]) ? 1 : 2) + (it.type === "action" ? -0.5 : 0);
    };
    const acts = typeFilter ? [] : actions.filter(match);
    const recs = records.filter((r) => (!typeFilter || r.type === typeFilter) && match(r));
    return [...acts.sort((a, b) => score(a) - score(b)).slice(0, 6), ...recs.sort((a, b) => score(a) - score(b)).slice(0, 24)];
  }, [q, actions, records]);

  // Reinicia o destaque quando a busca muda (ajuste durante a renderização, sem efeito).
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setIdx(0);
  }
  useEffect(() => { listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest" }); }, [idx]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); results[idx]?.run(); }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[8vh] sm:pt-[12vh] px-3" role="dialog" aria-modal="true" aria-label="Busca global">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm anim-fade" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass rounded-3xl overflow-hidden anim-in">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
          <Search size={18} className="text-fg3" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder='Buscar clientes, OS, orçamentos… ou digite "novo orçamento"'
            className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-fg3" aria-label="Buscar" />
          <span className="kbd">ESC</span>
        </div>
        <div ref={listRef} className="max-h-[56vh] overflow-y-auto p-2">
          {results.length === 0 && <div className="text-center text-sm text-fg3 py-10">Nada encontrado para “{q}”.</div>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={r.id}>
                {head && <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-fg3">{head}</div>}
                <button data-i={i} onMouseMove={() => setIdx(i)} onClick={r.run}
                  className={"w-full flex items-center gap-3 px-3 h-11 rounded-xl text-left transition " + (i === idx ? "bg-accent/15" : "hover:bg-white/5")}>
                  <span className="size-7 rounded-lg bg-solid3 grid place-items-center shrink-0"><r.icon size={15} className="text-accent" /></span>
                  <span className="flex-1 min-w-0 truncate text-[13.5px] font-medium">{r.label}</span>
                  {r.hint && <span className="text-xs text-fg3 truncate max-w-[40%]">{r.hint}</span>}
                  {i === idx && <CornerDownLeft size={13} className="text-fg3 shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 px-4 h-9 border-t border-line text-[11px] text-fg3">
          <span><span className="kbd">↑↓</span> navegar</span><span><span className="kbd">↵</span> abrir</span><span className="ml-auto">Ex.: “cliente joão”, “os 0003”, “novo orçamento”</span>
        </div>
      </div>
    </div>
  );
}
