"use client";
import { useEffect, type ReactNode } from "react";
import { PageHeader } from "../ui";
import { useUI } from "../shell/ui-context";
import { useQueryParam } from "@/lib/hooks";
import { getModule } from "@/modules/registry";
import { CrudView } from "./CrudView";

/** Página padrão de módulo: cabeçalho + tabela CRUD completa. Abre o formulário com ?new=1. */
export function ModulePage({ collection, title, subtitle, actions, toolbar }: { collection: string; title: string; subtitle?: ReactNode; actions?: ReactNode; toolbar?: ReactNode }) {
  const ui = useUI();
  const cfg = getModule(collection);
  const [isNew, clear] = useQueryParam("new");
  useEffect(() => {
    if (isNew) {
      ui.openForm(collection);
      clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);
  if (!cfg) return null;
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      <CrudView config={cfg} toolbar={toolbar} />
    </>
  );
}
