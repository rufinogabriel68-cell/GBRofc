import {
  BarChart3, Bell, Boxes, CalendarDays, Calculator, ClipboardList, Clock, FileText, FolderOpen, LayoutDashboard, Settings, Sparkles, Star, StickyNote, Target, Users, Wallet, Wrench, Zap,
} from "lucide-react";
import type { ComponentType } from "react";

export type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number | string; className?: string }> };

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/servicos", label: "Serviços", icon: Wrench },
  { href: "/calculadora", label: "Calculadora", icon: Calculator },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/ordens-de-servico", label: "Ordens de Serviço", icon: ClipboardList },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/documentos", label: "Documentos", icon: FolderOpen },
  { href: "/anotacoes", label: "Anotações", icon: StickyNote },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export const NAV_EXTRA: NavItem[] = [
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/automacoes", label: "Automações", icon: Zap },
  { href: "/favoritos", label: "Favoritos", icon: Star },
  { href: "/recentes", label: "Recentes", icon: Clock },
  { href: "/notificacoes", label: "Notificações", icon: Bell },
];

export function routeTitle(path: string): { title: string; parent?: string } {
  const all = [...NAV, ...NAV_EXTRA];
  const hit = all.find((n) => (n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/")));
  if (path.endsWith("/tecnico")) return { title: "Modo técnico", parent: "Ordens de Serviço" };
  return { title: hit?.label || "GBR Gestão", parent: hit && hit.href !== "/" ? "GBR Gestão" : undefined };
}
