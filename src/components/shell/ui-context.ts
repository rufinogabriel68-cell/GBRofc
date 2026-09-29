"use client";
import { createContext, useContext } from "react";

export type UIApi = {
  /** Abre o formulário (modal) de criação/edição de qualquer coleção. */
  openForm: (col: string, id?: string | null, defaults?: Record<string, any>) => void;
  /** Abre a visão detalhada (drawer) — perfil do cliente, OS, orçamento. */
  openDetail: (col: string, id: string) => void;
  openCommand: () => void;
  openQuick: () => void;
};

const noop = () => {};
export const UIContext = createContext<UIApi>({ openForm: noop, openDetail: noop, openCommand: noop, openQuick: noop });
export const useUI = () => useContext(UIContext);

/** Abre o registro certo (detalhe ou formulário) a partir de uma referência {col,id}. */
export function openEntity(ui: UIApi, e: { col: string; id: string }) {
  if (["customers", "quotes", "work_orders"].includes(e.col)) ui.openDetail(e.col, e.id);
  else ui.openForm(e.col, e.id);
}
