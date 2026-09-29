import type { ReactNode } from "react";
import AppShell from "@/components/shell/AppShell";

/** Área interna: abre direto no Dashboard (sem login). A autenticação futura entra aqui. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
