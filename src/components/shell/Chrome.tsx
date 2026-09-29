"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle, Bell, CalendarDays, Calculator, ChevronsLeft, ChevronsRight, ClipboardList, Cloud, CloudOff, FileText, LayoutDashboard, Loader2, MoreHorizontal, Monitor, Moon, Plus, Search, Settings, StickyNote, Sun, UserPlus, Wallet, Wrench, CalendarPlus,
} from "lucide-react";
import { NAV, NAV_EXTRA, routeTitle, type NavItem } from "@/lib/nav";
import { useSyncStatus } from "@/lib/data/sync-status";
import { useActive } from "@/lib/data/store";
import { useSettings } from "@/lib/settings";
import { cx } from "@/lib/utils";
import { Logo, Modal } from "../ui";
import { useUI } from "./ui-context";

export const VERSION = "1.0.0";

/* ------------------------------------------------------------------ sync */
export function SyncPill({ compact }: { compact?: boolean }) {
  const s = useSyncStatus();
  const tone = s.label === "Offline" ? "text-warn border-warn/30 bg-warn/10" : s.label === "Sincronizado" ? "text-ok border-ok/25 bg-ok/10" : "text-info border-info/30 bg-info/10";
  const Icon = s.label === "Offline" ? AlertTriangle : s.label === "Sincronizado" ? null : Loader2;
  const backend = s.mode === "firestore" ? "Firebase Firestore" : "Servidor (PostgreSQL)";
  const title = `${s.label} · ${backend}${s.pending ? ` · ${s.pending} alteração(ões) pendente(s)` : ""}${s.error ? ` · ${s.error}` : ""}`;
  return (
    <span title={title} role="status" aria-live="polite" className={cx("inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap", tone)}>
      {Icon ? <Icon size={12} className={s.label === "Sincronizando..." ? "animate-spin" : ""} /> : <span className="size-1.5 rounded-full bg-ok animate-pulse" />}
      {!compact && s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ sidebar */
export function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const path = usePathname();
  const s = useSyncStatus();
  const { settings } = useSettings();
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  const Item = ({ href, label, icon: I }: NavItem) => (
    <Link href={href} title={collapsed ? label : undefined} aria-current={active(href) ? "page" : undefined}
      className={cx("flex items-center gap-3 h-10 rounded-xl px-3 text-[13.5px] font-medium transition relative group", active(href) ? "bg-accent/14 text-fg" : "text-fg2 hover:bg-white/5 hover:text-fg", collapsed && "justify-center px-0")}>
      {active(href) && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-gradient-to-b from-accent to-accent2" />}
      <I size={18} className={active(href) ? "text-accent" : ""} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
  return (
    <aside className={cx("hidden lg:flex flex-col fixed left-3 top-3 bottom-3 z-30 glass rounded-3xl transition-[width] duration-300", collapsed ? "w-[72px]" : "w-[248px]")} aria-label="Navegação principal">
      <div className={cx("flex items-center gap-3 px-4 pt-4 pb-3", collapsed && "justify-center px-0")}>
        <Logo size={36} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold tracking-tight leading-none">GBR <span className="text-accent">GESTÃO</span></div>
            <div className="text-[10.5px] text-fg3 mt-1 truncate">{settings.tradeName || settings.name || "Sistema operacional"}</div>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-1 space-y-0.5 no-scrollbar">
        {NAV.map((n) => <Item key={n.href} {...n} />)}
        <div className={cx("h-px bg-line my-2 mx-2")} />
        {NAV_EXTRA.map((n) => <Item key={n.href} {...n} />)}
      </nav>
      <div className="p-3 border-t border-line space-y-2.5">
        {!collapsed ? (
          <div className="rounded-2xl bg-solid2/70 border border-line p-3 space-y-2">
            <div className="flex items-center justify-between"><SyncPill /><span className="kbd">v{VERSION}</span></div>
            <div className="text-[10.5px] text-fg3 leading-snug flex items-center gap-1.5">
              {s.mode === "firestore" ? <Cloud size={12} className="text-accent" /> : <CloudOff size={12} />}
              {s.mode === "firestore" ? "Firebase Firestore" : "Servidor PostgreSQL"}
            </div>
          </div>
        ) : (
          <div className="flex justify-center"><SyncPill compact /></div>
        )}
        <div className={cx("flex gap-1.5", collapsed && "flex-col items-center")}>
          <Link href="/configuracoes" className="btn btn-sm flex-1" title="Configurações"><Settings size={14} />{!collapsed && "Ajustes"}</Link>
          <button className="btn btn-sm btn-icon" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ header */
export function Header() {
  const path = usePathname();
  const ui = useUI();
  const { title, parent } = routeTitle(path);
  const { items } = useActive("notifications");
  const unread = items.filter((n) => !n.read).length;
  const { settings, save } = useSettings();
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  const cycle = () => {
    const next = settings.theme === "dark" ? "light" : settings.theme === "light" ? "auto" : "dark";
    localStorage.setItem("gbr-theme", next);
    save({ theme: next });
  };
  const ThemeIcon = settings.theme === "light" ? Sun : settings.theme === "auto" ? Monitor : Moon;

  return (
    <header className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-3 pb-3 backdrop-blur-xl bg-bg/60 border-b border-line/60">
      <div className="flex items-center gap-3">
        <div className="lg:hidden"><Logo size={30} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-fg3 hidden sm:flex items-center gap-1.5">{parent && <><span>{parent}</span><span>/</span></>}<span className="text-fg2">{title}</span></div>
          <div className="text-[15px] font-bold sm:hidden truncate">{title}</div>
        </div>
        <button onClick={ui.openCommand} className="hidden md:flex items-center gap-2 h-9 px-3 w-[280px] rounded-xl bg-solid2/80 border border-line text-fg3 text-[13px] hover:border-line2 transition" aria-label="Buscar ou executar comando">
          <Search size={15} /> <span className="flex-1 text-left">Buscar ou executar comando…</span>
          <span className="kbd">{mac ? "⌘" : "Ctrl"} K</span>
        </button>
        <button onClick={ui.openCommand} className="md:hidden btn btn-icon btn-ghost" aria-label="Buscar"><Search size={18} /></button>
        <SyncPill compact />
        <button className="btn btn-icon btn-ghost hidden sm:inline-flex" onClick={cycle} aria-label={`Tema: ${settings.theme}`} title={`Tema: ${settings.theme === "auto" ? "automático" : settings.theme === "dark" ? "escuro" : "claro"}`}><ThemeIcon size={17} /></button>
        <Link href="/notificacoes" className="btn btn-icon btn-ghost relative" aria-label={`Notificações${unread ? `: ${unread} não lidas` : ""}`}>
          <Bell size={18} />
          {unread > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-bad text-[10px] font-bold text-white grid place-items-center">{unread > 9 ? "9+" : unread}</span>}
        </Link>
        <button className="btn btn-primary btn-icon sm:w-auto sm:px-3.5 hidden lg:inline-flex" onClick={ui.openQuick} aria-label="Criar novo"><Plus size={17} /><span className="hidden sm:inline">Novo</span></button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ dock (desktop) */
export function Dock() {
  const ui = useUI();
  const router = useRouter();
  const items = [
    { label: "Novo cliente", icon: UserPlus, run: () => ui.openForm("customers"), color: "from-sky-500/30 to-sky-400/10" },
    { label: "Novo orçamento", icon: FileText, run: () => ui.openForm("quotes"), color: "from-indigo-500/30 to-indigo-400/10" },
    { label: "Nova OS", icon: ClipboardList, run: () => ui.openForm("work_orders"), color: "from-emerald-500/30 to-emerald-400/10" },
    { label: "Nova anotação", icon: StickyNote, run: () => router.push("/anotacoes?new=1"), color: "from-amber-500/30 to-amber-400/10" },
    { label: "Novo lançamento", icon: Wallet, run: () => ui.openForm("financial_transactions"), color: "from-teal-500/30 to-teal-400/10" },
    { label: "Abrir agenda", icon: CalendarDays, run: () => router.push("/agenda"), color: "from-rose-500/30 to-rose-400/10" },
    { label: "Calculadora", icon: Calculator, run: () => router.push("/calculadora"), color: "from-violet-500/30 to-violet-400/10" },
  ];
  return (
    <div className="hidden lg:flex fixed bottom-4 left-0 right-0 justify-center z-30 pointer-events-none" style={{ paddingLeft: "var(--sb, 272px)" }}>
      <nav aria-label="Ações rápidas" className="glass rounded-[22px] px-2.5 py-2 flex items-end gap-1.5 pointer-events-auto">
        {items.map((i) => (
          <button key={i.label} onClick={i.run} className="dock-item group relative size-11 rounded-[14px] grid place-items-center border border-line2 bg-gradient-to-b" aria-label={i.label}
            style={{ backgroundImage: undefined }}>
            <span className={cx("absolute inset-0 rounded-[14px] bg-gradient-to-b", i.color)} />
            <i.icon size={20} className="relative" />
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg glass text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition">{i.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ mobile nav */
export function MobileNav() {
  const path = usePathname();
  const ui = useUI();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const Tab = ({ href, label, icon: I }: { href: string; label: string; icon: typeof Wrench }) => {
    const on = href === "/" ? path === "/" : path.startsWith(href);
    return (
      <Link href={href} className={cx("flex flex-col items-center gap-0.5 flex-1 py-1.5 text-[10.5px] font-semibold", on ? "text-accent" : "text-fg3")} aria-current={on ? "page" : undefined}>
        <I size={21} />{label}
      </Link>
    );
  };
  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-x-0 border-b-0 rounded-t-3xl pb-safe" aria-label="Navegação">
        <div className="flex items-end px-2 pt-1">
          <Tab href="/" label="Início" icon={LayoutDashboard} />
          <Tab href="/ordens-de-servico" label="OS" icon={ClipboardList} />
          <div className="flex-1 flex justify-center -mt-6">
            <button onClick={ui.openQuick} aria-label="Ação rápida" className="size-14 rounded-full btn-primary grid place-items-center shadow-xl border-4 border-bg active:scale-95 transition"><Plus size={26} /></button>
          </div>
          <Tab href="/agenda" label="Agenda" icon={CalendarPlus} />
          <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 text-[10.5px] font-semibold text-fg3"><MoreHorizontal size={21} />Mais</button>
        </div>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="Todos os módulos" size="md">
        <div className="grid grid-cols-3 gap-2.5">
          {[...NAV, ...NAV_EXTRA].map((n) => (
            <Link key={n.href} href={n.href} className="card-solid flex flex-col items-center gap-1.5 py-3.5 text-[11.5px] font-semibold text-center px-1 active:scale-95 transition">
              <n.icon size={22} className="text-accent" />{n.label}
            </Link>
          ))}
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ quick create */
export function QuickCreate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ui = useUI();
  const router = useRouter();
  const items = [
    { label: "Novo cliente", icon: UserPlus, run: () => ui.openForm("customers") },
    { label: "Novo orçamento", icon: FileText, run: () => ui.openForm("quotes") },
    { label: "Nova OS", icon: ClipboardList, run: () => ui.openForm("work_orders") },
    { label: "Novo serviço", icon: Wrench, run: () => ui.openForm("services") },
    { label: "Nova anotação", icon: StickyNote, run: () => router.push("/anotacoes?new=1") },
    { label: "Novo lançamento", icon: Wallet, run: () => ui.openForm("financial_transactions") },
    { label: "Novo agendamento", icon: CalendarDays, run: () => ui.openForm("appointments") },
    { label: "Calculadora", icon: Calculator, run: () => router.push("/calculadora") },
  ];
  return (
    <Modal open={open} onClose={onClose} title="Criar novo" subtitle="Ação rápida" size="sm" z={70}>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((i) => (
          <button key={i.label} onClick={() => { onClose(); i.run(); }} className="card-solid flex items-center gap-3 p-3.5 text-left hover:border-accent/50 active:scale-[.97] transition">
            <span className="size-9 rounded-xl bg-accent/12 text-accent grid place-items-center"><i.icon size={18} /></span>
            <span className="text-[13px] font-semibold leading-tight">{i.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-fg3 text-center mt-4">Dica: <span className="kbd">Ctrl</span> <span className="kbd">K</span> abre a busca global e executa comandos.</p>
    </Modal>
  );
}
