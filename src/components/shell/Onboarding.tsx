"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Palette, Wallet } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { seedDefaults } from "@/lib/seed";
import { CATEGORIES_DEFAULT } from "@/lib/constants";
import { toNum, cx } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { FieldInput, ImageUpload } from "../crud/RecordForm";
import { Logo, Modal } from "../ui";

export function Onboarding() {
  const { settings, loaded, save } = useSettings();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [v, setV] = useState<Record<string, any>>({ paymentMethods: { pix: true, dinheiro: true, debito: true, credito: true, parcelado: true } });
  const [cats, setCats] = useState<string[]>(CATEGORIES_DEFAULT);
  const [extra, setExtra] = useState("");
  const set = (k: string, val: any) => setV((s) => ({ ...s, [k]: val }));
  const open = !closed && ((loaded && !settings.onboarded) || step === 3);
  if (!open) return null;

  const finish = async (skip = false) => {
    setBusy(true);
    try {
      const company = { ...settings, ...(skip ? {} : v) };
      const fees = { ...settings.fees, debito: toNum(v.feeDebit ?? settings.fees.debito), credito: toNum(v.feeCredit ?? settings.fees.credito) };
      save({
        name: company.name || "", tradeName: company.name || "", responsible: company.responsible || "", document: company.document || "", phone: company.phone || "", whatsapp: company.whatsapp || "",
        email: company.email || "", address: company.address || "", logoUrl: company.logoUrl || "", logoPath: company.logoPath || "", primaryColor: company.primaryColor || settings.primaryColor,
        paymentMethods: v.paymentMethods, monthlyGoal: toNum(v.monthlyGoal), fees, onboarded: true,
      });
      await seedDefaults({ categories: skip ? CATEGORIES_DEFAULT : cats, monthlyGoal: toNum(v.monthlyGoal), responsible: company.responsible, company });
      toast("Seu sistema está pronto!");
    } finally {
      setBusy(false);
    }
  };

  const canNext = step === 0 ? !!(v.name && v.responsible) : true;
  const steps = [{ i: Building2, t: "Empresa" }, { i: Palette, t: "Identidade" }, { i: Wallet, t: "Pagamentos e meta" }, { i: CheckCircle2, t: "Pronto" }];

  return (
    <Modal open onClose={() => {}} size="md" title="Vamos configurar sua empresa" subtitle={`Passo ${step + 1} de 4`} z={85}
      footer={
        <>
          {step === 0 && <button className="btn btn-ghost mr-auto" onClick={() => finish(true)} disabled={busy}>Configurar depois</button>}
          {step > 0 && step < 3 && <button className="btn" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Voltar</button>}
          {step < 2 && <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continuar <ArrowRight size={15} /></button>}
          {step === 2 && <button className="btn btn-primary" disabled={busy} onClick={async () => { await finish(); setStep(3); }}>{busy ? "Preparando…" : "Concluir configuração"}</button>}
          {step === 3 && <button className="btn btn-primary" onClick={() => setClosed(true)}>Abrir Dashboard</button>}
        </>
      }>
      <div className="flex items-center gap-2 mb-5">
        {steps.map((s, i) => (
          <div key={s.t} className={cx("flex-1 h-1.5 rounded-full", i <= step ? "bg-gradient-to-r from-accent to-accent2" : "bg-solid3")} title={s.t} />
        ))}
      </div>
      {step === 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-3 mb-1"><Logo size={44} /><p className="text-sm text-fg2">Bem-vindo ao <b>GBR Gestão</b>. Comece informando os dados da sua empresa — você pode mudar tudo depois em Configurações.</p></div>
          <Row label="Nome da empresa / profissional *"><FieldInput f={{ key: "name", label: "", type: "text", placeholder: "Ex.: GBR Serviços Técnicos" }} value={v.name} onChange={(x) => set("name", x)} /></Row>
          <Row label="Responsável *"><FieldInput f={{ key: "responsible", label: "", type: "text" }} value={v.responsible} onChange={(x) => set("responsible", x)} /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="CPF / CNPJ"><FieldInput f={{ key: "document", label: "", type: "text" }} value={v.document} onChange={(x) => set("document", x)} /></Row>
            <Row label="Telefone"><FieldInput f={{ key: "phone", label: "", type: "phone" }} value={v.phone} onChange={(x) => set("phone", x)} /></Row>
            <Row label="WhatsApp"><FieldInput f={{ key: "whatsapp", label: "", type: "phone" }} value={v.whatsapp} onChange={(x) => set("whatsapp", x)} /></Row>
            <Row label="E-mail"><FieldInput f={{ key: "email", label: "", type: "email" }} value={v.email} onChange={(x) => set("email", x)} /></Row>
          </div>
          <Row label="Endereço"><FieldInput f={{ key: "address", label: "", type: "text" }} value={v.address} onChange={(x) => set("address", x)} /></Row>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <Row label="Logo"><ImageUpload url={v.logoUrl} folder="branding" label="Logo" onChange={(r) => { set("logoUrl", r?.url || ""); set("logoPath", r?.path || ""); }} /></Row>
          <Row label="Categorias de serviço">
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...CATEGORIES_DEFAULT, ...cats])].map((c) => {
                const on = cats.includes(c);
                return <button key={c} type="button" onClick={() => setCats(on ? cats.filter((x) => x !== c) : [...cats, c])} className={cx("h-8 px-3 rounded-lg border text-xs font-semibold", on ? "bg-accent/15 border-accent/40 text-accent" : "bg-solid2 border-line text-fg2")}>{on ? "✓ " : ""}{c}</button>;
              })}
            </div>
            <div className="flex gap-2 mt-2"><input className="input input-sm" placeholder="Outra categoria" value={extra} onChange={(e) => setExtra(e.target.value)} /><button type="button" className="btn btn-sm" onClick={() => { if (extra.trim()) { setCats([...cats, extra.trim()]); setExtra(""); } }}>Adicionar</button></div>
          </Row>
          <Row label="Cor principal"><FieldInput f={{ key: "c", label: "", type: "color" }} value={v.primaryColor || settings.primaryColor} onChange={(x) => set("primaryColor", x)} /></Row>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <Row label="Formas de pagamento aceitas">
            <div className="flex flex-wrap gap-1.5">
              {[["pix", "PIX"], ["dinheiro", "Dinheiro"], ["debito", "Débito"], ["credito", "Crédito"], ["parcelado", "Parcelado"]].map(([k, l]) => {
                const on = v.paymentMethods?.[k];
                return <button key={k} type="button" onClick={() => set("paymentMethods", { ...v.paymentMethods, [k]: !on })} className={cx("h-8 px-3 rounded-lg border text-xs font-semibold", on ? "bg-accent/15 border-accent/40 text-accent" : "bg-solid2 border-line text-fg2")}>{on ? "✓ " : ""}{l}</button>;
              })}
            </div>
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Taxa da maquininha — débito (%)"><FieldInput f={{ key: "d", label: "", type: "percent" }} value={v.feeDebit ?? settings.fees.debito} onChange={(x) => set("feeDebit", x)} /></Row>
            <Row label="Taxa — crédito à vista (%)"><FieldInput f={{ key: "c", label: "", type: "percent" }} value={v.feeCredit ?? settings.fees.credito} onChange={(x) => set("feeCredit", x)} /></Row>
          </div>
          <p className="text-[11px] text-fg3">As taxas são repassadas ao cliente no orçamento. A tabela completa (1x a 12x) fica em Configurações → Taxas.</p>
          <Row label="Meta mensal de faturamento (R$)"><FieldInput f={{ key: "g", label: "", type: "money" }} value={v.monthlyGoal} onChange={(x) => set("monthlyGoal", x)} /></Row>
        </div>
      )}
      {step === 3 && (
        <div className="text-center py-6">
          <div className="size-16 rounded-full bg-ok/15 text-ok grid place-items-center mx-auto mb-3"><CheckCircle2 size={34} /></div>
          <h3 className="text-xl font-bold">Seu sistema está pronto!</h3>
          <p className="text-sm text-fg2 mt-1">Categorias, contas, modelos de mensagem e automações de pós-venda foram preparados. Comece cadastrando um cliente ou um serviço.</p>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><span className="label">{label}</span>{children}</div>;
}
