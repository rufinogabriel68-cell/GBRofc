"use client";
import { useEffect, useMemo, useState } from "react";
import { Boxes, ClipboardCheck, Lightbulb, PackagePlus, ShoppingCart, Truck, Copy, MessageCircle } from "lucide-react";
import { CrudView } from "@/components/crud/CrudView";
import { Donut, HBars } from "@/components/charts";
import { Empty, Field, Kpi, Modal, PageHeader, Panel, Tabs } from "@/components/ui";
import { useUI } from "@/components/shell/ui-context";
import { db, useActive } from "@/lib/data/store";
import { useSettings } from "@/lib/settings";
import { stockMove } from "@/lib/workflows";
import { useQueryParam } from "@/lib/hooks";
import { toast } from "@/lib/toast";
import { addDays, dayOf, diffDays, fmtDate, money, sum, toNum, todayISO } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import { getModule } from "../registry";

type Tab = "produtos" | "movimentacoes" | "fornecedores" | "inteligencia" | "compras";

export default function EstoquePage() {
  const ui = useUI();
  const [tab, setTab] = useState<Tab>("produtos");
  const [move, setMove] = useState<string | null | undefined>(undefined);
  const [isNew, clear] = useQueryParam("new");
  useEffect(() => { if (isNew) { ui.openForm("products"); clear(); } }, [isNew]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: Event) => setMove((e as CustomEvent<string>).detail);
    window.addEventListener("gbr:stock-move", h);
    return () => window.removeEventListener("gbr:stock-move", h);
  }, []);
  return (
    <>
      <PageHeader title="Estoque" subtitle="Produtos, movimentações com baixa automática nas OS, fornecedores e inteligência financeira."
        actions={<button className="btn btn-primary" onClick={() => setMove(null)}><PackagePlus size={16} /> Registrar movimentação</button>} />
      <Tabs<Tab> value={tab} onChange={setTab} className="mb-4" tabs={[
        { id: "produtos", label: "Produtos", icon: Boxes }, { id: "movimentacoes", label: "Movimentações", icon: ClipboardCheck }, { id: "fornecedores", label: "Fornecedores", icon: Truck },
        { id: "inteligencia", label: "Inteligência", icon: Lightbulb }, { id: "compras", label: "Lista de compras", icon: ShoppingCart },
      ]} />
      {tab === "produtos" && <CrudView config={getModule("products")} />}
      {tab === "movimentacoes" && <CrudView config={getModule("stock_movements")} hideCreate />}
      {tab === "fornecedores" && <CrudView config={getModule("suppliers")} />}
      {tab === "inteligencia" && <Intelligence />}
      {tab === "compras" && <Shopping />}
      {move !== undefined && <MovementModal productId={move} onClose={() => setMove(undefined)} />}
    </>
  );
}

function MovementModal({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const products = useActive("products");
  const suppliers = useActive("suppliers");
  const [f, setF] = useState({ productId: productId || "", type: "entrada", qty: "", unitCost: "", supplierId: "", note: "", payable: false, due: addDays(todayISO(), 15) });
  const prod = products.items.find((p) => p.id === f.productId);
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const save = () => {
    if (!prod) return toast("Selecione o produto", "error");
    if (toNum(f.qty) < 0 || (f.type !== "ajuste" && toNum(f.qty) <= 0)) return toast("Informe a quantidade", "error");
    stockMove({ productId: prod.id, type: f.type, qty: toNum(f.qty), note: f.note, unitCost: toNum(f.unitCost), supplierId: f.supplierId });
    if (f.type === "entrada" && f.payable && toNum(f.unitCost) > 0) {
      db.create("financial_transactions", { type: "saida", description: `Compra: ${toNum(f.qty)} ${prod.unit} de ${prod.name}`, amount: toNum(f.qty) * toNum(f.unitCost), dueDate: f.due, status: "pendente", supplierId: f.supplierId || prod.supplierId || "", categoryId: "fc_materiais", accountId: "", method: "pix" });
    }
    toast("Movimentação registrada");
    onClose();
  };
  return (
    <Modal open onClose={onClose} size="md" title="Registrar movimentação" subtitle="Entrada, saída, perda, ajuste ou devolução" footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save}>Registrar</button></>}>
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Produto" className="sm:col-span-2"><select className="input" value={f.productId} onChange={(e) => { set("productId", e.target.value); const p = products.items.find((x) => x.id === e.target.value); if (p) { set("unitCost", p.cost || ""); set("supplierId", p.supplierId || ""); } }}><option value="">Selecione…</option>{products.items.map((p) => <option key={p.id} value={p.id}>{p.name} — saldo {p.qty} {p.unit}</option>)}</select></Field>
        <Field label="Tipo"><select className="input" value={f.type} onChange={(e) => set("type", e.target.value)}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="perda">Perda</option><option value="devolucao">Devolução</option><option value="ajuste">Ajuste (define o saldo)</option></select></Field>
        <Field label={f.type === "ajuste" ? "Novo saldo" : "Quantidade"}><input className="input" type="number" step="any" value={f.qty} onChange={(e) => set("qty", e.target.value)} /></Field>
        {f.type === "entrada" && <>
          <Field label="Custo unitário (R$)"><input className="input" type="number" step="0.01" value={f.unitCost} onChange={(e) => set("unitCost", e.target.value)} /></Field>
          <Field label="Fornecedor"><select className="input" value={f.supplierId} onChange={(e) => set("supplierId", e.target.value)}><option value="">—</option>{suppliers.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.payable} onChange={(e) => set("payable", e.target.checked)} /> Lançar no contas a pagar ({money(toNum(f.qty) * toNum(f.unitCost))})</label>
          {f.payable && <Field label="Vencimento"><input className="input" type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></Field>}
        </>}
        <Field label="Observação" className="sm:col-span-2"><input className="input" value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function Intelligence() {
  const products = useActive("products");
  const moves = useActive("stock_movements");
  const { settings } = useSettings();
  const stale = toNum(settings.staleStockDays) || 90;
  const a = useMemo(() => {
    const t = todayISO();
    const last = new Map<string, string>();
    moves.items.forEach((m) => { const c = last.get(m.productId); if (!c || m.createdAt > c) last.set(m.productId, m.createdAt); });
    const idle = products.items.filter((p) => toNum(p.qty) > 0 && diffDays(dayOf(last.get(p.id) || p.createdAt), t) > stale);
    const low = products.items.filter((p) => toNum(p.minQty) > 0 && toNum(p.qty) <= toNum(p.minQty));
    const used: Record<string, number> = {}, bought: Record<string, number> = {};
    moves.items.forEach((m) => { if (["uso_os", "saida"].includes(m.type)) used[m.productId] = (used[m.productId] || 0) + toNum(m.qty); if (m.type === "entrada" && m.note !== "Saldo inicial") bought[m.productId] = (bought[m.productId] || 0) + toNum(m.qty); });
    const name = (id: string) => products.items.find((p) => p.id === id)?.name || "—";
    const byCat: Record<string, number> = {};
    products.items.forEach((p) => (byCat[p.category || "Sem categoria"] = (byCat[p.category || "Sem categoria"] || 0) + toNum(p.qty) * toNum(p.cost)));
    return {
      cost: sum(products.items, (p) => toNum(p.qty) * toNum(p.cost)), sale: sum(products.items, (p) => toNum(p.qty) * toNum(p.price)), idle, idleValue: sum(idle, (p) => toNum(p.qty) * toNum(p.cost)), low,
      topUsed: Object.entries(used).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([id, v]) => ({ label: name(id), value: v })), topBought: Object.entries(bought).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([id, v]) => ({ label: name(id), value: v })),
      byCat: Object.entries(byCat).map(([label, value], i) => ({ label, value, color: ["var(--accent)", "var(--accent-2)", "var(--violet)", "var(--warn)", "var(--info)", "var(--bad)"][i % 6] })),
    };
  }, [products.items, moves.items, stale]);
  if (!products.items.length) return <div className="card"><Empty icon={Lightbulb} title="Sem dados de estoque" text="Cadastre produtos e movimentações para ver a inteligência de estoque." /></div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Valor em estoque (custo)" value={money(a.cost)} icon={Boxes} /><Kpi label="Valor de venda potencial" value={money(a.sale)} icon={Boxes} tone="ok" sub={`lucro potencial ${money(a.sale - a.cost)}`} />
        <Kpi label="Estoque baixo" value={a.low.length} icon={Boxes} tone={a.low.length ? "bad" : "ok"} /><Kpi label={`Parado há +${stale} dias`} value={money(a.idleValue)} icon={Boxes} tone="warn" sub={`${a.idle.length} produto(s)`} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Valor por categoria"><Donut data={a.byCat} format={money} size={140} /></Panel>
        <Panel title="Alertas"><div className="space-y-1.5 text-sm max-h-56 overflow-y-auto">
          {a.low.map((p) => <div key={p.id} className="flex gap-2"><span className="text-bad">▼</span> Estoque baixo: <b>{p.name}</b> ({p.qty}/{p.minQty} {p.unit})</div>)}
          {a.idle.map((p) => <div key={p.id} className="flex gap-2"><span className="text-warn">⏸</span> Sem movimentação há +{stale} dias: <b>{p.name}</b> ({money(toNum(p.qty) * toNum(p.cost))})</div>)}
          {!a.low.length && !a.idle.length && <p className="text-fg3 text-xs">Nenhum alerta. 👌</p>}</div></Panel>
        <Panel title="Produtos mais utilizados"><HBars data={a.topUsed} empty="Sem consumo registrado." /></Panel>
        <Panel title="Produtos mais comprados"><HBars data={a.topBought} color="var(--accent-2)" empty="Sem compras registradas." /></Panel>
      </div>
    </div>
  );
}

function Shopping() {
  const products = useActive("products");
  const suppliers = useActive("suppliers");
  const list = products.items.filter((p) => toNum(p.minQty) > 0 && toNum(p.qty) <= toNum(p.minQty)).map((p) => ({ p, need: Math.max(toNum(p.minQty) * 2 - toNum(p.qty), toNum(p.minQty)) }));
  const groups = new Map<string, typeof list>();
  list.forEach((r) => groups.set(r.p.supplierId || "", [...(groups.get(r.p.supplierId || "") || []), r]));
  if (!list.length) return <div className="card"><Empty icon={ShoppingCart} title="Nada para comprar" text="Quando um produto ficar abaixo do mínimo, ele entra aqui com a quantidade sugerida (repor até 2× o mínimo)." /></div>;
  return (
    <div className="space-y-3">
      {Array.from(groups.entries()).map(([sid, rows]) => {
        const s = suppliers.items.find((x) => x.id === sid);
        const text = `Olá${s ? `, ${s.contact || s.name}` : ""}! Preciso de:\n${rows.map((r) => `• ${Math.ceil(r.need)} ${r.p.unit} de ${r.p.name}`).join("\n")}\nPode me passar valores e prazo?`;
        return (
          <div key={sid} className="card overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-2 bg-black/10"><Truck size={15} className="text-accent" /><b className="text-sm">{s?.name || "Sem fornecedor definido"}</b>
              <div className="ml-auto flex gap-1.5"><button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(text); toast("Lista copiada"); }}><Copy size={13} /> Copiar</button>{(s?.whatsapp || s?.phone) && <a className="btn btn-sm btn-primary" target="_blank" rel="noreferrer" href={waLink(s.whatsapp || s.phone, text)}><MessageCircle size={13} /> WhatsApp</a>}</div></div>
            <table className="w-full text-[13px]"><tbody>{rows.map((r) => <tr key={r.p.id}><td className="td font-medium">{r.p.name}</td><td className="td text-fg2">saldo {r.p.qty} / mín {r.p.minQty}</td><td className="td text-right font-semibold">comprar ≈ {Math.ceil(r.need)} {r.p.unit}</td><td className="td text-right tabular-nums text-fg2">{money(Math.ceil(r.need) * toNum(r.p.cost))}</td></tr>)}</tbody></table>
          </div>
        );
      })}
      <p className="text-[11px] text-fg3">Estrutura preparada para o módulo de compras: pedido → recebimento (entrada no estoque) → conta a pagar do fornecedor. Hoje, use “Registrar movimentação → Entrada → Lançar no contas a pagar”. Atualizado em {fmtDate(todayISO())}.</p>
    </div>
  );
}
