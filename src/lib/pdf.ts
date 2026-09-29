"use client";
import type { Rec } from "./types";
import { PAY_METHODS, DOC_TYPES } from "./constants";
import { fmtDate, fmtDateTime, money, pct, toNum } from "./utils";
import { lineTotal } from "./calc";

type Align = "left" | "right" | "center";
export type PdfSection =
  | { type: "text"; title?: string; text: string }
  | { type: "table"; title?: string; head: string[]; rows: (string | number)[][]; align?: Align[]; widths?: number[] }
  | { type: "kv"; title?: string; rows: [string, string][] }
  | { type: "totals"; rows: [string, string, boolean?][] }
  | { type: "images"; urls: string[] };

export type PdfSpec = { title: string; subtitle?: string; number?: string; meta: [string, string][]; sections: PdfSection[]; terms?: string; signatures?: string[] };
export type Company = Record<string, any>;

const hex = (h: string): [number, number, number] => {
  const m = (h || "#38a8ff").replace("#", "");
  return [parseInt(m.slice(0, 2), 16) || 0, parseInt(m.slice(2, 4), 16) || 0, parseInt(m.slice(4, 6), 16) || 0];
};

async function loadImage(url?: string): Promise<{ data: string; w: number; h: number; fmt: string } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const data: string = await new Promise((r, j) => { const f = new FileReader(); f.onload = () => r(String(f.result)); f.onerror = j; f.readAsDataURL(blob); });
    const dims: { w: number; h: number } = await new Promise((r, j) => { const i = new Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = j; i.src = data; });
    return { data, ...dims, fmt: blob.type.includes("png") ? "PNG" : "JPEG" };
  } catch {
    return null;
  }
}

/** Gera o PDF com um dos 4 modelos: moderno, minimalista, premium, técnico. */
export async function buildPdf(spec: PdfSpec, company: Company, template = "moderno") {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 14;
  const [pr, pg, pb] = hex(company.primaryColor);
  const primary: [number, number, number] = [pr, pg, pb];
  const dark: [number, number, number] = [17, 20, 26];
  const logo = await loadImage(company.logoUrl);
  const T = template;

  const drawLogo = (x: number, y: number, maxH: number, maxW: number) => {
    if (!logo) return 0;
    const r = Math.min(maxW / logo.w, maxH / logo.h);
    try { doc.addImage(logo.data, logo.fmt, x, y, logo.w * r, logo.h * r); } catch { return 0; }
    return logo.w * r;
  };
  const companyLines = () => [company.document && `CNPJ/CPF: ${company.document}`, [company.phone, company.whatsapp && company.whatsapp !== company.phone ? `WhatsApp ${company.whatsapp}` : ""].filter(Boolean).join("  |  "), company.email, company.address, company.instagram && `Instagram ${company.instagram}`].filter(Boolean) as string[];

  let y = 0;
  // ---------------- cabeçalho por modelo
  if (T === "moderno") {
    doc.setFillColor(...primary); doc.rect(0, 0, W, 38, "F");
    const lw = drawLogo(M, 8, 22, 40);
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(17);
    doc.text(company.name || "Empresa", M + (lw ? lw + 5 : 0), 17);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    companyLines().slice(0, 3).forEach((l, i) => doc.text(l, M + (lw ? lw + 5 : 0), 23 + i * 4.2));
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(spec.title.toUpperCase(), W - M, 15, { align: "right" });
    doc.setFontSize(10); if (spec.number) doc.text(spec.number, W - M, 21, { align: "right" });
    y = 48;
  } else if (T === "minimalista") {
    const lw = drawLogo(M, 12, 16, 34);
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text(company.name || "Empresa", M + (lw ? lw + 4 : 0), 18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110);
    companyLines().slice(0, 3).forEach((l, i) => doc.text(l, M + (lw ? lw + 4 : 0), 23 + i * 3.8));
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(spec.title, W - M, 18, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110); if (spec.number) doc.text(spec.number, W - M, 23, { align: "right" });
    doc.setDrawColor(40); doc.setLineWidth(0.4); doc.line(M, 36, W - M, 36);
    y = 44;
  } else if (T === "premium") {
    doc.setFillColor(...dark); doc.rect(0, 0, W, 42, "F");
    doc.setFillColor(212, 175, 55); doc.rect(0, 42, W, 1.4, "F");
    const lw = drawLogo(M, 9, 24, 42);
    doc.setTextColor(255); doc.setFont("times", "bold"); doc.setFontSize(20);
    doc.text(company.name || "Empresa", M + (lw ? lw + 5 : 0), 20);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(200);
    companyLines().slice(0, 3).forEach((l, i) => doc.text(l, M + (lw ? lw + 5 : 0), 26 + i * 4));
    doc.setTextColor(212, 175, 55); doc.setFont("times", "italic"); doc.setFontSize(15); doc.text(spec.title, W - M, 18, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); if (spec.number) doc.text(spec.number, W - M, 25, { align: "right" });
    y = 53;
  } else {
    doc.setDrawColor(60); doc.setLineWidth(0.5); doc.rect(M, 10, W - 2 * M, 30);
    doc.setFillColor(235, 238, 242); doc.rect(M, 10, 62, 30, "F");
    const lw = drawLogo(M + 4, 14, 22, 54);
    if (!lw) { doc.setFont("courier", "bold"); doc.setFontSize(12); doc.setTextColor(30); doc.text((company.name || "Empresa").slice(0, 22), M + 4, 27); }
    doc.setTextColor(30); doc.setFont("courier", "bold"); doc.setFontSize(11); doc.text(company.name || "", M + 66, 17);
    doc.setFont("courier", "normal"); doc.setFontSize(7.5);
    companyLines().slice(0, 4).forEach((l, i) => doc.text(l, M + 66, 22 + i * 4));
    doc.setFont("courier", "bold"); doc.setFontSize(10); doc.text(spec.title.toUpperCase(), W - M - 3, 16, { align: "right" });
    if (spec.number) doc.text(spec.number, W - M - 3, 22, { align: "right" });
    y = 48;
  }

  const ink: [number, number, number] = T === "moderno" ? [20, 24, 32] : [25, 25, 25];
  const heading = (t: string) => {
    if (y > 262) { doc.addPage(); y = 20; }
    doc.setFont(T === "tecnico" ? "courier" : T === "premium" ? "times" : "helvetica", "bold");
    doc.setFontSize(T === "premium" ? 12 : 10.5); doc.setTextColor(...(T === "moderno" ? primary : T === "premium" ? [150, 118, 20] as [number, number, number] : ink));
    doc.text(T === "tecnico" ? t.toUpperCase() : t, M, y);
    if (T !== "minimalista") { doc.setDrawColor(...(T === "premium" ? [212, 175, 55] as [number, number, number] : T === "moderno" ? primary : [90, 90, 90] as [number, number, number])); doc.setLineWidth(0.3); doc.line(M, y + 1.5, W - M, y + 1.5); }
    y += 6.5;
  };

  if (spec.subtitle) { doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...ink); const l = doc.splitTextToSize(spec.subtitle, W - 2 * M); doc.text(l, M, y); y += l.length * 6 + 1; }

  // meta (2 colunas)
  if (spec.meta.length) {
    doc.setFontSize(9);
    const colW = (W - 2 * M) / 2;
    const rowsN = Math.ceil(spec.meta.length / 2);
    const boxH = rowsN * 6 + 4;
    if (T === "tecnico") { doc.setDrawColor(90); doc.rect(M, y - 2, W - 2 * M, boxH); }
    else if (T !== "minimalista") { doc.setFillColor(T === "premium" ? 248 : 244, T === "premium" ? 245 : 246, T === "premium" ? 235 : 250); doc.roundedRect(M, y - 2, W - 2 * M, boxH, 2, 2, "F"); }
    spec.meta.forEach(([k, v], i) => {
      const cx = M + 3 + (i % 2) * colW, cy = y + 3 + Math.floor(i / 2) * 6;
      doc.setFont("helvetica", "bold"); doc.setTextColor(110); doc.text(`${k}:`, cx, cy);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...ink);
      const kw = doc.getTextWidth(`${k}: `) + 1;
      doc.text(doc.splitTextToSize(String(v || "—"), colW - kw - 6)[0], cx + kw, cy);
    });
    y += boxH + 5;
  }

  const headFill: [number, number, number] = T === "moderno" ? primary : T === "premium" ? dark : T === "tecnico" ? [70, 76, 86] : [40, 40, 40];
  for (const s of spec.sections) {
    if (s.type === "text") {
      if (s.title) heading(s.title);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...ink);
      const lines = doc.splitTextToSize(s.text || "—", W - 2 * M);
      for (const l of lines) { if (y > 280) { doc.addPage(); y = 20; } doc.text(l, M, y); y += 4.6; }
      y += 3;
    } else if (s.type === "kv") {
      if (s.title) heading(s.title);
      autoTable(doc, { startY: y, body: s.rows, theme: "plain", styles: { fontSize: 9.5, cellPadding: 1.6, textColor: ink }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 48, textColor: [100, 100, 100] } }, margin: { left: M, right: M } });
      y = (doc as any).lastAutoTable.finalY + 5;
    } else if (s.type === "table") {
      if (s.title) heading(s.title);
      autoTable(doc, {
        startY: y, head: [s.head], body: s.rows.map((r) => r.map(String)), theme: T === "minimalista" ? "plain" : T === "tecnico" ? "grid" : "striped",
        headStyles: { fillColor: headFill, textColor: T === "minimalista" ? [20, 20, 20] : 255, fontStyle: "bold", fontSize: 8.5, lineWidth: T === "minimalista" ? { bottom: 0.4 } as any : 0, lineColor: [40, 40, 40] },
        styles: { fontSize: 9, cellPadding: 2.2, textColor: ink, font: T === "tecnico" ? "courier" : "helvetica" },
        alternateRowStyles: { fillColor: T === "premium" ? [250, 247, 238] : [246, 248, 251] },
        columnStyles: Object.fromEntries((s.align || []).map((a, i) => [i, { halign: a }])), margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    } else if (s.type === "totals") {
      const x0 = W - M - 82;
      s.rows.forEach(([k, v, bold]) => {
        if (y > 275) { doc.addPage(); y = 20; }
        if (bold) {
          if (T !== "minimalista") { doc.setFillColor(...(T === "premium" ? dark : headFill)); doc.roundedRect(x0 - 2, y - 5, 84, 9, 1.5, 1.5, "F"); doc.setTextColor(T === "premium" ? 212 : 255, T === "premium" ? 175 : 255, T === "premium" ? 55 : 255); }
          else { doc.setDrawColor(40); doc.line(x0 - 2, y - 5, W - M, y - 5); doc.setTextColor(20); }
          doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        } else { doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90); }
        doc.text(k, x0, y); doc.text(v, W - M - 1, y, { align: "right" });
        y += bold ? 10 : 5.6;
      });
      y += 2;
    } else if (s.type === "images") {
      for (const u of s.urls.slice(0, 8)) {
        const im = await loadImage(u);
        if (!im) continue;
        const maxW = 86, r = Math.min(maxW / im.w, 60 / im.h);
        if (y + im.h * r > 280) { doc.addPage(); y = 20; }
        try { doc.addImage(im.data, im.fmt, M, y, im.w * r, im.h * r); y += im.h * r + 4; } catch {}
      }
    }
  }

  if (spec.terms) { heading("Condições e termos"); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(100); for (const l of doc.splitTextToSize(spec.terms, W - 2 * M)) { if (y > 280) { doc.addPage(); y = 20; } doc.text(l, M, y); y += 4; } y += 2; }
  if (spec.signatures?.length) {
    if (y > 245) { doc.addPage(); y = 30; }
    y += 18;
    const n = spec.signatures.length, cw = (W - 2 * M) / n;
    doc.setDrawColor(90); doc.setTextColor(60); doc.setFontSize(9); doc.setFont("helvetica", "normal");
    spec.signatures.forEach((sg, i) => { const x = M + i * cw + 6; doc.line(x, y, x + cw - 12, y); doc.text(sg, x + (cw - 12) / 2, y + 5, { align: "center" }); });
  }

  // rodapé + paginação
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(140); doc.setFont("helvetica", "normal");
    doc.setDrawColor(210); doc.setLineWidth(0.2); doc.line(M, 285, W - M, 285);
    doc.text(String(company.footer || company.name || ""), M, 290);
    doc.text(`Página ${i} de ${pages}`, W - M, 290, { align: "right" });
  }
  return doc;
}

export async function downloadPdf(spec: PdfSpec, company: Company, template: string, filename: string) {
  const doc = await buildPdf(spec, company, template);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  return doc;
}

export const companyOf = (s: Rec): Company => ({ name: s.tradeName || s.name, document: s.document, phone: s.phone, whatsapp: s.whatsapp, email: s.email, address: s.address, instagram: s.instagram, logoUrl: s.logoUrl, primaryColor: s.primaryColor, footer: s.pdfFooter });

/* ------------------------------------------------------------------ specs */
export function pricingSections(rec: Rec, s: Rec): PdfSection[] {
  const p = rec.pricing || { lines: [] };
  const t = rec.totals || {};
  const rows = (p.lines || []).map((l: Rec) => [l.note ? `${l.name}\n${l.note}` : l.name, String(l.qty), money(l.unitPrice), toNum(l.discountPct) ? pct(l.discountPct, 0) : "-", toNum(l.material) ? money(l.material) : "-", money(lineTotal(l as never))]);
  const totals: [string, string, boolean?][] = [["Subtotal", money(t.subtotal)]];
  if (toNum(t.itemDiscount) + toNum(t.generalDiscount) > 0) totals.push(["Descontos", `- ${money(toNum(t.itemDiscount) + toNum(t.generalDiscount))}`]);
  if (toNum(p.travel)) totals.push(["Deslocamento", money(p.travel)]);
  if (toNum(p.parking)) totals.push(["Estacionamento", money(p.parking)]);
  if (toNum(p.toll)) totals.push(["Pedágio", money(p.toll)]);
  if (toNum(p.extraMaterial)) totals.push(["Material adicional", money(p.extraMaterial)]);
  if (toNum(p.taxes)) totals.push(["Taxas", money(p.taxes)]);
  if (toNum(t.feeAmount) > 0) totals.push([`Taxa de pagamento (${pct(t.feePct, 2)})`, money(t.feeAmount)]);
  totals.push(["TOTAL", money(t.total), true]);
  void s;
  return [
    { type: "table", title: "Serviços e itens", head: ["Descrição", "Qtd", "Valor unit.", "Desc.", "Material", "Total"], rows, align: ["left", "center", "right", "center", "right", "right"] },
    { type: "totals", rows: totals },
  ];
}

export function quoteSpec(q: Rec, customer: Rec | undefined, s: Rec): PdfSpec {
  const p = q.pricing || {};
  return {
    title: "Orçamento",
    number: q.number,
    subtitle: q.title,
    meta: [
      ["Cliente", customer?.name || ""], ["Contato", customer?.whatsapp || customer?.phone || customer?.email || ""],
      ["Emissão", fmtDate(q.createdAt)], ["Validade", fmtDate(q.validUntil)],
      ["Prazo", q.deliveryDays ? `${q.deliveryDays} dia(s)` : "A combinar"],
      ["Pagamento", `${PAY_METHODS[p.paymentMethod] || "-"}${p.paymentMethod === "parcelado" ? ` em ${p.installments}x` : ""}`],
    ],
    sections: [...(q.description ? [{ type: "text", title: "Descrição", text: q.description } as PdfSection] : []), ...pricingSections(q, s), ...(q.notes ? [{ type: "text", title: "Observações", text: q.notes } as PdfSection] : [])],
    terms: [q.terms || s.terms, s.paymentTerms].filter(Boolean).join("\n\n"),
    signatures: ["Responsável", "De acordo do cliente"],
  };
}

export function orderSpec(o: Rec, customer: Rec | undefined, s: Rec): PdfSpec {
  return {
    title: "Ordem de serviço",
    number: o.number,
    subtitle: o.title,
    meta: [["Cliente", customer?.name || ""], ["Contato", customer?.whatsapp || customer?.phone || ""], ["Endereço", o.address || ""], ["Técnico", o.technician || ""], ["Data", `${fmtDate(o.date)} ${o.time || ""}`], ["Status", o.status]],
    sections: [
      ...(o.problem ? [{ type: "text", title: "Problema relatado", text: o.problem } as PdfSection] : []),
      ...(o.diagnosis ? [{ type: "text", title: "Diagnóstico", text: o.diagnosis } as PdfSection] : []),
      ...(o.solution ? [{ type: "text", title: "Solução aplicada", text: o.solution } as PdfSection] : []),
      ...pricingSections(o, s),
      ...((o.materials || []).length ? [{ type: "table", title: "Materiais utilizados", head: ["Material", "Qtd", "Unid."], rows: (o.materials || []).map((m: Rec) => [m.name, m.qty, m.unit]) } as PdfSection] : []),
    ],
    terms: s.terms,
    signatures: ["Técnico responsável", "Cliente"],
  };
}

export function docSpec(d: Rec, customer: Rec | undefined, s: Rec, os?: Rec): PdfSpec {
  const c = d.content || {};
  const base = { number: d.number || "", meta: [["Cliente", customer?.name || ""], ["Data", fmtDate(c.date || d.createdAt)], ...(os ? [["OS", os.number] as [string, string]] : [])] as [string, string][] };
  switch (d.type) {
    case "recibo":
      return { ...base, title: "Recibo", subtitle: `Recibo de pagamento — ${money(c.amount)}`, sections: [{ type: "text", text: `Recebemos de ${customer?.name || "cliente"} a quantia de ${money(c.amount)} referente a: ${c.description || d.title}. Forma de pagamento: ${PAY_METHODS[c.method] || c.method || "-"}. Data do pagamento: ${fmtDate(c.date)}.\n\nPelo que firmamos o presente recibo, dando plena quitação do valor recebido.` }], signatures: ["Assinatura do responsável"] };
    case "laudo":
      return { ...base, title: "Laudo técnico", subtitle: d.title, meta: [...base.meta, ["Local", c.local || ""], ["Equipamento", c.equipment || ""], ["Responsável", c.responsible || s.responsible || ""]], sections: [
        { type: "text", title: "Problema relatado", text: c.problem }, { type: "text", title: "Diagnóstico", text: c.diagnosis }, { type: "text", title: "Testes realizados", text: c.tests },
        { type: "text", title: "Resultado", text: c.result }, { type: "text", title: "Recomendação", text: c.recommendation }, ...(c.notes ? [{ type: "text", title: "Observações", text: c.notes } as PdfSection] : []),
        ...((d.photos || []).length ? [{ type: "images", urls: d.photos.map((p: Rec) => p.url) } as PdfSection] : []),
      ], signatures: [c.responsible || "Responsável técnico"] };
    case "termo_entrega":
      return { ...base, title: "Termo de entrega", subtitle: d.title, sections: [{ type: "text", text: c.body || `Declaro que recebi os serviços/equipamentos descritos neste termo em perfeitas condições de funcionamento, após testes realizados na presença do responsável.` }], signatures: ["Responsável", "Cliente"] };
    case "termo_garantia":
      return { ...base, title: "Termo de garantia", subtitle: d.title, meta: [...base.meta, ["Prazo", c.period || ""]], sections: [{ type: "text", text: c.body || "A garantia cobre defeitos de execução do serviço pelo prazo informado. Não cobre mau uso, danos por variação elétrica, intervenção de terceiros ou desgaste natural." }], signatures: ["Responsável", "Cliente"] };
    case "declaracao":
      return { ...base, title: "Declaração", subtitle: d.title, sections: [{ type: "text", text: c.body }], signatures: ["Responsável"] };
    default:
      return { ...base, title: DOC_TYPES[d.type] || "Documento", subtitle: d.title, sections: [{ type: "text", text: c.body }], signatures: ["Responsável"] };
  }
}

export function tableSpec(title: string, sub: string, head: string[], rows: (string | number)[][], meta: [string, string][] = []): PdfSpec {
  return { title, subtitle: sub, meta, sections: [{ type: "table", head, rows, align: head.map((_, i) => (i === 0 ? "left" : "right")) as Align[] }] };
}

export { fmtDateTime };
