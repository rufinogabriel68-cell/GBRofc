"use client";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, Search, X, Inbox } from "lucide-react";
import { onToast, type ToastMsg } from "@/lib/toast";
import { cx } from "@/lib/utils";

type IconType = ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>;

/* ------------------------------------------------------------------ logo */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-label="GBR">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
        <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d222b" />
          <stop offset="1" stopColor="#0a0c10" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#lg2)" />
      <rect x="6" y="6" width="500" height="500" rx="110" fill="none" stroke="#fff" strokeOpacity=".09" strokeWidth="4" />
      <path d="M336 176A112 112 0 1 0 336 336V272H248" fill="none" stroke="url(#lg1)" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ escape stack */
const stack: number[] = [];
let mid = 0;
function useEscape(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  useLayoutEffect(() => {
    ref.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const id = ++mid;
    stack.push(id);
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack[stack.length - 1] === id) {
        e.stopPropagation();
        ref.current();
      }
    };
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}

function useLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

/** Nenhuma notificação: o snapshot só muda de `false` (servidor) para `true` (cliente). */
const subscribeNone = () => () => {};

function usePortal() {
  // Evita mismatch de hidratação: renderiza no servidor, monta no cliente via store externo.
  return useSyncExternalStore(subscribeNone, () => true, () => false);
}

/* ------------------------------------------------------------------ Modal / Drawer */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "lg",
  children,
  footer,
  z = 60,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  children: ReactNode;
  footer?: ReactNode;
  z?: number;
}) {
  const mounted = usePortal();
  useEscape(open, onClose);
  useLock(open);
  if (!open || !mounted) return null;
  const w = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl", full: "sm:max-w-[1360px]" }[size];
  return createPortal(
    <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-6" style={{ zIndex: z }} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm anim-fade" onClick={onClose} />
      <div className={cx("relative w-full flex flex-col glass rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[94dvh] sm:max-h-[90dvh] anim-in", w)}>
        <header className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-line shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 w-14">
            <button onClick={onClose} aria-label="Fechar" className="size-3 rounded-full bg-[#ff5f57] hover:brightness-110" />
            <span className="size-3 rounded-full bg-[#febc2e]/60" />
            <span className="size-3 rounded-full bg-[#28c840]/60" />
          </div>
          <div className="min-w-0 flex-1 sm:text-center">
            <div className="text-sm font-semibold truncate">{title}</div>
            {subtitle && <div className="text-xs text-fg3 truncate">{subtitle}</div>}
          </div>
          <div className="w-14 hidden sm:block" />
          <button className="btn btn-ghost btn-icon btn-sm sm:hidden" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && <footer className="px-4 sm:px-5 py-3 border-t border-line flex flex-wrap justify-end gap-2 shrink-0 pb-safe">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  actions,
  size = "lg",
  children,
  z = 55,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  size?: "md" | "lg" | "xl";
  children: ReactNode;
  z?: number;
}) {
  const mounted = usePortal();
  useEscape(open, onClose);
  useLock(open);
  if (!open || !mounted) return null;
  const w = { md: "sm:w-[520px]", lg: "sm:w-[760px]", xl: "sm:w-[1000px]" }[size];
  return createPortal(
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: z }} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px] anim-fade" onClick={onClose} />
      <div className={cx("relative h-full w-full flex flex-col glass sm:rounded-l-3xl anim-slide max-w-full", w)}>
        <header className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-line shrink-0">
          <button onClick={onClose} aria-label="Fechar" className="size-3 rounded-full bg-[#ff5f57] hover:brightness-110 hidden sm:block" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold truncate">{title}</div>
            {subtitle && <div className="text-xs text-fg3 truncate">{subtitle}</div>}
          </div>
          {actions}
          <button className="btn btn-ghost btn-icon btn-sm sm:hidden" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ Confirm */
type CD = { title: string; message?: ReactNode; confirmText?: string; danger?: boolean; resolve: (v: boolean) => void };
let confirmSetter: ((c: CD | null) => void) | null = null;
export function confirmDialog(o: { title: string; message?: ReactNode; confirmText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((res) => {
    if (!confirmSetter) return res(window.confirm(o.title));
    confirmSetter({ ...o, resolve: res });
  });
}
export function ConfirmHost() {
  const [c, set] = useState<CD | null>(null);
  useEffect(() => {
    confirmSetter = set;
    return () => {
      confirmSetter = null;
    };
  }, []);
  const done = (v: boolean) => {
    c?.resolve(v);
    set(null);
  };
  return (
    <Modal open={!!c} onClose={() => done(false)} title={c?.title} size="sm" z={90}
      footer={
        <>
          <button className="btn" onClick={() => done(false)}>Cancelar</button>
          <button className={cx("btn", c?.danger ? "btn-danger !border-bad/40 !bg-bad/10" : "btn-primary")} onClick={() => done(true)} autoFocus>
            {c?.confirmText || "Confirmar"}
          </button>
        </>
      }>
      <div className="flex gap-3 text-sm text-fg2">
        <AlertTriangle className={c?.danger ? "text-bad shrink-0" : "text-warn shrink-0"} size={20} />
        <div>{c?.message || "Tem certeza?"}</div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Toasts */
export function ToastHost() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(
    () =>
      onToast((t) => {
        setList((l) => [...l.slice(-3), t]);
        setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 4200);
      }),
    [],
  );
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 lg:bottom-28 z-[100] flex flex-col gap-2 items-center pointer-events-none px-4 w-full max-w-md">
      {list.map((t) => (
        <div key={t.id} className="glass anim-in rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2.5 pointer-events-auto max-w-full">
          {t.type === "ok" ? <CheckCircle2 size={17} className="text-ok shrink-0" /> : t.type === "error" ? <AlertTriangle size={17} className="text-bad shrink-0" /> : <Info size={17} className="text-info shrink-0" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Badges */
export type Tone = "neutral" | "info" | "ok" | "warn" | "bad" | "violet";
export type StatusDef = { label: string; tone: Tone; icon: IconType };
const TONES: Record<Tone, string> = {
  neutral: "bg-white/5 text-fg2 border-line2",
  info: "bg-info/12 text-info border-info/30",
  ok: "bg-ok/12 text-ok border-ok/30",
  warn: "bg-warn/12 text-warn border-warn/30",
  bad: "bg-bad/12 text-bad border-bad/30",
  violet: "bg-violet/12 text-violet border-violet/30",
};
/** Badge acessível: ícone + texto + forma (não depende só da cor). */
export function StatusBadge({ def, className }: { def?: StatusDef; className?: string }) {
  if (!def) return <span className="text-fg3">—</span>;
  const I = def.icon;
  return (
    <span className={cx("inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap", TONES[def.tone], className)}>
      <I size={12} strokeWidth={2.4} />
      {def.label}
    </span>
  );
}
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 h-5 px-2 rounded-md border text-[10.5px] font-semibold whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

/* ------------------------------------------------------------------ Layout helpers */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[1.7rem] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-fg2 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, icon: Icon, action, children, className, pad = true }: { title?: ReactNode; icon?: IconType; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("card overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-1">
          <h2 className="text-[13px] font-semibold flex items-center gap-2 text-fg2 uppercase tracking-wide">
            {Icon && <Icon size={15} className="text-accent" />}
            {title}
          </h2>
          {action}
        </div>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, icon: Icon, tone = "accent", href, onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon?: IconType; tone?: "accent" | "ok" | "warn" | "bad" | "info" | "violet"; href?: string; onClick?: () => void }) {
  const color = { accent: "text-accent bg-accent/12", ok: "text-ok bg-ok/12", warn: "text-warn bg-warn/12", bad: "text-bad bg-bad/12", info: "text-info bg-info/12", violet: "text-violet bg-violet/12" }[tone];
  const inner = (
    <div className="card p-3.5 sm:p-4 h-full transition hover:border-line2 hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-fg3 truncate">{label}</span>
        {Icon && (
          <span className={cx("size-7 rounded-lg grid place-items-center shrink-0", color)}>
            <Icon size={15} />
          </span>
        )}
      </div>
      <div className="text-xl sm:text-2xl font-bold mt-2 tracking-tight tabular-nums">{value}</div>
      {sub && <div className="text-xs text-fg3 mt-1 truncate">{sub}</div>}
    </div>
  );
  if (href) return <Link href={href} className="block h-full">{inner}</Link>;
  if (onClick) return <button onClick={onClick} className="block h-full w-full text-left">{inner}</button>;
  return inner;
}

export function Empty({ icon: Icon = Inbox, title, text, action }: { icon?: IconType; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <div className="size-12 rounded-2xl bg-solid2 border border-line grid place-items-center text-fg3 mb-3">
        <Icon size={22} />
      </div>
      <div className="font-semibold text-sm">{title}</div>
      {text && <p className="text-xs text-fg3 mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton h-4", className)} />;
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string; icon?: IconType; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx("flex gap-1 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-solid2/70 border border-line w-full sm:w-fit max-w-full", className)} role="tablist">
      {tabs.map((t) => {
        const I = t.icon;
        const on = t.id === value;
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            className={cx("h-8 px-3 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition", on ? "bg-solid3 text-fg shadow-sm border border-line2" : "text-fg2 hover:text-fg border border-transparent")}>
            {I && <I size={14} />}
            {t.label}
            {typeof t.count === "number" && t.count > 0 && <span className="text-[10px] px-1.5 rounded-full bg-accent/15 text-accent">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, small }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className="inline-flex p-0.5 rounded-xl bg-solid2 border border-line overflow-x-auto no-scrollbar max-w-full">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={o.id === value}
          className={cx("px-3 rounded-[10px] font-semibold whitespace-nowrap transition", small ? "h-7 text-xs" : "h-8 text-[13px]", o.id === value ? "bg-solid3 text-fg border border-line2" : "text-fg2 hover:text-fg border border-transparent")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Pesquisar...", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx("relative", className)}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg3" />
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

export function Field({ label, children, hint, className }: { label?: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="block text-[11px] text-fg3 mt-1">{hint}</span>}
    </label>
  );
}

export function Avatar({ name, size = 34 }: { name?: string; size?: number }) {
  const ini = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <span className="rounded-full grid place-items-center font-bold text-[11px] shrink-0 bg-gradient-to-br from-accent/30 to-accent2/25 border border-line2" style={{ width: size, height: size }}>
      {ini || "?"}
    </span>
  );
}

/* ------------------------------------------------------------------ Menu (popover) */
export type MenuItem = { label: string; icon?: IconType; onClick: () => void; danger?: boolean; disabled?: boolean } | "sep" | null | false | undefined;
export function Menu({ trigger, items, className, label = "Ações" }: { trigger: ReactNode; items: MenuItem[]; className?: string; label?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const mounted = usePortal();
  const close = useCallback(() => setPos(null), []);
  useEscape(!!pos, close);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos) return close();
    const r = btn.current!.getBoundingClientRect();
    const up = r.bottom + 300 > window.innerHeight && r.top > 300;
    setPos({ x: Math.min(r.right, window.innerWidth - 8), y: up ? r.top - 6 : r.bottom + 6, up });
  };
  const list = items.filter(Boolean) as Exclude<MenuItem, null | false | undefined>[];
  return (
    <>
      <button ref={btn} onClick={toggle} className={className || "btn btn-ghost btn-icon btn-sm"} aria-label={label} aria-haspopup="menu" aria-expanded={!!pos}>
        {trigger}
      </button>
      {pos && mounted &&
        createPortal(
          <div className="fixed inset-0 z-[95]" onClick={close}>
            <div role="menu" className="glass anim-in absolute rounded-2xl p-1.5 min-w-[190px] max-h-[70vh] overflow-y-auto"
              style={{ left: Math.max(8, pos.x - 210), top: pos.up ? undefined : pos.y, bottom: pos.up ? window.innerHeight - pos.y : undefined }}
              onClick={(e) => e.stopPropagation()}>
              {list.map((it, i) =>
                it === "sep" ? (
                  <div key={i} className="h-px bg-line my-1" />
                ) : (
                  <button key={i} role="menuitem" disabled={it.disabled}
                    className={cx("w-full flex items-center gap-2.5 px-3 h-9 rounded-xl text-[13px] text-left hover:bg-solid3 disabled:opacity-40", it.danger && "text-bad")}
                    onClick={() => {
                      close();
                      it.onClick();
                    }}>
                    {it.icon && <it.icon size={15} className="shrink-0" />}
                    {it.label}
                  </button>
                ),
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    h();
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return m;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="inline-block rounded-full border-2 border-fg3 border-t-accent animate-spin" style={{ width: size, height: size }} />;
}
