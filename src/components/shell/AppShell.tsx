"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "@/lib/utils";
import { useSettings } from "@/lib/settings";
import { ConfirmHost, ToastHost } from "../ui";
import { CommandCenter } from "./CommandCenter";
import { Dock, Header, MobileNav, QuickCreate, Sidebar } from "./Chrome";
import { UIContext, type UIApi } from "./ui-context";
import { FormHost } from "./FormHost";
import { Onboarding } from "./Onboarding";

const Watchers = dynamic(() => import("./Watchers").then((m) => m.Watchers), { ssr: false });
const DetailHost = dynamic(() => import("./DetailHost").then((m) => m.DetailHost), { ssr: false });

function lum(hex: string) {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m || m.length < 3) return 0;
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* Sidebar recolhida: estado persistido em localStorage tratado como store externo. */
const SIDEBAR_EVENT = "gbr:sidebar";
const subscribeSidebar = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(SIDEBAR_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(SIDEBAR_EVENT, cb);
  };
};
const sidebarCollapsed = () => localStorage.getItem("gbr-sidebar") === "1";

function ThemeApplier() {
  const { settings, loaded } = useSettings();
  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    const resolve = () => (settings.theme === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : settings.theme || "dark");
    root.dataset.theme = resolve();
    localStorage.setItem("gbr-theme", settings.theme || "dark");
    let off = () => {};
    if (settings.theme === "auto") {
      const mq = matchMedia("(prefers-color-scheme: dark)");
      const h = () => (root.dataset.theme = resolve());
      mq.addEventListener("change", h);
      off = () => mq.removeEventListener("change", h);
    }
    const a = settings.primaryColor, b = settings.secondaryColor;
    if (a) {
      const fg = lum(a) > 0.42 ? "#04121f" : "#ffffff";
      root.style.setProperty("--accent", a);
      root.style.setProperty("--accent-fg", fg);
      localStorage.setItem("gbr-accent", a);
      localStorage.setItem("gbr-accent-fg", fg);
    }
    if (b) {
      root.style.setProperty("--accent-2", b);
      localStorage.setItem("gbr-accent2", b);
    }
    return off;
  }, [settings.theme, settings.primaryColor, settings.secondaryColor, loaded]);
  return null;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const collapsed = useSyncExternalStore(subscribeSidebar, sidebarCollapsed, () => false);
  const [form, setForm] = useState<{ col: string; id: string | null; defaults: Record<string, any> } | null>(null);
  const [detail, setDetail] = useState<{ col: string; id: string } | null>(null);
  const [cmd, setCmd] = useState(false);
  const [quick, setQuick] = useState(false);
  const [watch, setWatch] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWatch(true), 1500);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => clearTimeout(t);
  }, []);
  const setCollapsed = (v: boolean) => {
    localStorage.setItem("gbr-sidebar", v ? "1" : "0");
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((c) => !c); }
      else if (mod && e.key.toLowerCase() === "n" && !e.shiftKey) { e.preventDefault(); setQuick(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Fecha formulário e detalhe abertos ao navegar (ajuste durante a renderização, sem efeito).
  const [prevPath, setPrevPath] = useState(path);
  if (path !== prevPath) {
    setPrevPath(path);
    setForm(null);
    setDetail(null);
  }

  const api: UIApi = useMemo(
    () => ({
      openForm: (col, id = null, defaults = {}) => setForm({ col, id: id ?? null, defaults }),
      openDetail: (col, id) => setDetail({ col, id }),
      openCommand: () => setCmd(true),
      openQuick: () => setQuick(true),
    }),
    [],
  );

  return (
    <UIContext.Provider value={api}>
      <div style={{ ["--sb" as string]: collapsed ? "96px" : "272px" }}>
        <ThemeApplier />
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className={cx("min-h-dvh transition-[padding] duration-300", collapsed ? "lg:pl-[96px]" : "lg:pl-[272px]")}>
          <div className="px-4 sm:px-6 lg:px-8 pb-36 max-w-[1500px] mx-auto">
            <Header />
            <main className="pt-5 anim-fade" id="main">{children}</main>
          </div>
        </div>
        <Dock />
        <MobileNav />
        <QuickCreate open={quick} onClose={() => setQuick(false)} />
        <CommandCenter open={cmd} onClose={() => setCmd(false)} />
        <FormHost state={form} onClose={() => setForm(null)} />
        {detail && <DetailHost state={detail} onClose={() => setDetail(null)} />}
        <Onboarding />
        <ConfirmHost />
        <ToastHost />
        {watch && <Watchers />}
      </div>
    </UIContext.Provider>
  );
}
