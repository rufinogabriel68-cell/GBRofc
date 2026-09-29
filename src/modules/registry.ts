import type { ModuleConfig } from "@/components/crud/CrudView";
import * as c from "./configs";

/** Registro central: coleção → configuração do módulo (campos, colunas, regras). */
export const MODULES: Record<string, ModuleConfig> = {
  customers: c.customers,
  service_categories: c.service_categories,
  services: c.services,
  products: c.products,
  stock_movements: c.stock_movements,
  suppliers: c.suppliers,
  financial_accounts: c.financial_accounts,
  financial_categories: c.financial_categories,
  financial_transactions: c.financial_transactions,
  goals: c.goals,
  crm_leads: c.crm_leads,
  crm_activities: c.crm_activities,
  customer_equipment: c.customer_equipment,
  warranties: c.warranties,
  evaluations: c.evaluations,
  appointments: c.appointments,
  quotes: c.quotes,
  work_orders: c.work_orders,
  automations: c.automations,
  document_templates: c.document_templates,
  roles: c.roles,
  users: c.users,
  audit_logs: c.audit_logs,
};

export const getModule = (col: string) => MODULES[col];
