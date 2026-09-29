/** Documento genérico (Firestore-like). Todos possuem id, companyId, createdAt, updatedAt. */
export type Rec = { id: string; [k: string]: any };

export type Tier = "economico" | "medio" | "premium" | "custom";

export type PricingLine = {
  id: string;
  serviceId?: string;
  name: string;
  tier: Tier;
  qty: number;
  unitPrice: number;
  unitCost: number;
  discountPct: number;
  material: number;
  materialCost: number;
  note?: string;
};

export type Pricing = {
  lines: PricingLine[];
  travel: number;
  parking: number;
  toll: number;
  extraMaterial: number;
  taxes: number;
  discountValue: number;
  discountType: "value" | "pct";
  paymentMethod: "pix" | "dinheiro" | "debito" | "credito" | "parcelado";
  installments: number;
  marginTarget: number;
};

export type Totals = {
  subtotal: number;
  itemDiscount: number;
  additions: number;
  generalDiscount: number;
  netTarget: number;
  feePct: number;
  feeAmount: number;
  total: number;
  netReceived: number;
  cost: number;
  profit: number;
  margin: number;
  suggestedNet: number;
};

export type FeeTable = {
  pix: number;
  dinheiro: number;
  debito: number;
  credito: number;
  parcelado: Record<string, number>;
};
