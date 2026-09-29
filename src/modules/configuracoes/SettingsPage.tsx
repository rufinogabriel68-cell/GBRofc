"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell, Blocks, Building2, Cloud, Database, FileText, Hammer, HardDriveDownload, KeyRound, Landmark, Monitor, Package, Palette, Plus, ReceiptText, ScrollText, ShieldCheck, Trash2, Upload, UserCog, Users, Workflow, Zap, CalendarDays, Download, CheckCircle2,
} from "lucide-react";
import { CrudView } from "@/components/crud/CrudView";
import { RecordForm, type Field } from "@/components/crud/RecordForm";
import { Badge, PageHeader, Panel, confirmDialog } from "@/components/ui";
import { PAY_METHODS, PDF_TEMPLATES } from "@/lib/constants";
import { COLLECTIONS } from "@/lib/collections";
import { db } from "@/lib/data/store";
import { useSyncStatus } from "@/lib/data/sync-status";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase";
import { COMPANY_ID } from "@/lib/session";
import { useSettings } from "@/lib/settings";
import { seedDefaults } from "@/lib/seed";
import { useQueryParam } from "@/lib/hooks";
import { toast } from "@/lib/toast";
import type { Rec } from "@/lib/types";
import { download, nowISO, todayISO, toNum } from "@/lib/utils";
import { getModule } from "../registry";
import { VERSION } from "@/components/shell/Chrome";
import Link from "next/link";

type Tab = "empresa" | "identidade" | "taxas" | "orcamentos" | "os" | "crm" | "notificacoes" | "automacao" | "estoque" | "agenda" | "documentos" | "usuarios" | "permissoes" | "backup" | "integracoes" | "sistema" | "auditoria";

const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: "empresa", label: "Empresa", icon: Building2 }, { id: "identidade", label: "Identidade visual", icon: Palette }, { id: "taxas", label: "Financeiro e taxas", icon: Landmark }, { id: "orcamentos", label: "Orçamentos", icon: ReceiptText },
  { id: "os", label: "OS", icon: Hammer }, { id: "crm", label: "CRM", icon: Users }, { id: "notificacoes", label: "Notificações", icon: Bell }, { id: "automacao", label: "Automação", icon: Zap }, { id: "estoque", label: "Estoque", icon: Package },
  { id: "agenda", label: "Agenda", icon: CalendarDays }, { id: "documentos", label: "Documentos", icon: FileText }, { id: "usuarios", label: "Usuários", icon: UserCog }, { id: "permissoes", label: "Permissões", icon: KeyRound },
  { id: "backup", label: "Backup", icon: HardDriveDownload }, { id: "integracoes", label: "Integrações", icon: Blocks }, { id: "sistema", label: "Sistema", icon: Monitor }, { id: "auditoria", label: "Auditoria", icon: ScrollText },
];

const F = (key: string, label: string, type: Field["type"], extra: Partial<Field> = {}): Field => ({ key, label, type, ...extra });
const SECTIONS: Partial<Record<Tab, Field[]>> = {
  empresa: [F("name", "Nome / razão social", "text", { required: true }), F("tradeName", "Nome fantasia", "text"), F("responsible", "Responsável", "text"), F("document", "CPF / CNPJ", "text"), F("phone", "Telefone", "phone"), F("whatsapp", "WhatsApp", "phone"), F("email", "E-mail", "email"), F("instagram", "Instagram", "text", { placeholder: "@empresa" }), F("website", "Site", "url"), F("address", "Endereço completo", "text", { span: 2 })],
  identidade: [F("logoUrl", "Logo", "image", { folder: "branding" }), F("theme", "Tema", "select", { options: [{ value: "dark", label: "Escuro (padrão)" }, { value: "light", label: "Claro" }, { value: "auto", label: "Automático (sistema)" }], required: true }), F("primaryColor", "Cor principal", "color"), F("secondaryColor", "Cor secundária", "color"), F("pdfTemplate", "Modelo de PDF", "select", { required: true, options: Object.entries(PDF_TEMPLATES).map(([value, label]) => ({ value, label })) }), F("pdfFooter", "Rodapé dos documentos", "text", { span: 2 })],
  orcamentos: [F("quotePrefix", "Prefixo da numeração", "text"), F("quoteValidityDays", "Validade padrão (dias)", "number"), F("paymentTerms", "Condições de pagamento", "textarea"), F("terms", "Termos e condições padrão", "textarea")],
  os: [F("osPrefix", "Prefixo da numeração", "text"), F("warrantyDays", "Garantia padrão (dias)", "number"), F("nextMaintenanceMonths", "Próxima manutenção recomendada (meses)", "number", { hint: "0 desativa o lembrete automático." })],
  estoque: [F("staleStockDays", "Alertar produto sem movimentação após (dias)", "number")],
  agenda: [F("agendaStart", "Início do expediente", "time"), F("agendaEnd", "Fim do expediente", "time")],
};

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("empresa");
  const [param] = useQueryParam("tab");
  useEffect(() => { if (param && TABS.some((t) => t.id === param)) setTab(param as Tab); }, [param]);
  return (
    <>
      <PageHeader title="Configurações" subtitle="Empresa, identidade, taxas, regras de negócio, usuários, backup e integrações." />
      <div className="grid lg:grid-cols-[220px_1fr] gap-5 items-start">
        <nav className="card p-2 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar lg:sticky lg:top-20" aria-label="Seções">
          {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={"flex items-center gap-2.5 h-9 px-3 rounded-xl text-[13px] font-medium whitespace-nowrap " + (tab === t.id ? "bg-accent/14 text-fg" : "text-fg2 hover:bg-white/5")}><t.icon size={15} className={tab === t.id ? "text-accent" : ""} />{t.label}</button>)}
        </nav>
        <div className="min-w-0 space-y-4"><Section tab={tab} /></div>
      </div>
    </>
  );
}

function Section({ tab }: { tab: Tab }) {
  const { settings, loaded, save } = useSettings();
  const fields = SECTIONS[tab];
  if (fields) {
    return (
      <Panel title={TABS.find((t) => t.id === tab)?.label}>
        {loaded && <RecordForm key={tab + (loaded ? "1" : "0")} fields={fields} initial={settings} submitLabel="Salvar alterações" onSubmit={(v) => { save(v); toast("Configurações salvas"); }} />}
        {tab === "identidade" && <PdfPreview />}
      </Panel>
    );
  }
  switch (tab) {
    case "taxas": return <Fees />;
    case "crm": return <Panel title="CRM"><p className="text-sm text-fg2">O pipeline usa as etapas <b>Lead → Contato → Orçamento → Negociação → Aprovado → Cliente → Pós-venda → Recorrente → Inativo</b>. As etapas avançam automaticamente com orçamentos e OS. Follow-ups e tarefas são gerados pelas automações.</p><div className="flex gap-2 mt-3"><Link className="btn btn-sm" href="/crm">Abrir CRM</Link><Link className="btn btn-sm" href="/automacoes">Editar automações</Link></div></Panel>;
    case "notificacoes": return <Notifications />;
    case "automacao": return <Panel title="Automação e WhatsApp"><p className="text-sm text-fg2">Gerencie gatilhos, condições, ações e modelos de mensagem (com variáveis) na central de automações.</p><Link className="btn btn-primary btn-sm mt-3" href="/automacoes"><Zap size={14} /> Abrir automações</Link></Panel>;
    case "documentos": return <Panel title="Documentos e PDF"><p className="text-sm text-fg2 mb-3">Modelos disponíveis: {Object.values(PDF_TEMPLATES).join(", ")}. Configure logo, cores e rodapé em Identidade visual; termos e validade em Orçamentos.</p><PdfPreview /></Panel>;
    case "usuarios": return <div className="space-y-3"><p className="text-xs text-fg3">Estrutura pronta para multiusuário. Enquanto não há login, todas as ações são registradas como o proprietário; com Firebase Auth cada usuário passa a ser identificado (`createdBy`/`updatedBy`).</p><CrudView config={getModule("users")} /></div>;
    case "permissoes": return <div className="space-y-3"><p className="text-xs text-fg3">Perfis definem módulos permitidos e serão aplicados nas Security Rules e no menu quando a autenticação for ativada.</p><CrudView config={getModule("roles")} /></div>;
    case "auditoria": return <CrudView config={getModule("audit_logs")} />;
    case "backup": return <Backup />;
    case "integracoes": return <Integrations />;
    case "sistema": return <System />;
  }
  return null;
}

function Fees() {
  const { settings, save } = useSettings();
  const [f, setF] = useState(settings.fees);
  const [pm, setPm] = useState(settings.paymentMethods);
  const [tr, setTr] = useState(settings.travel as Rec);
  const [margin, setMargin] = useState(String(settings.defaultMargin));
  useEffect(() => { setF(settings.fees); setPm(settings.paymentMethods); setTr(settings.travel as Rec); }, [settings.fees, settings.paymentMethods, settings.travel]);
  const num = (v: string) => (v === "" ? 0 : toNum(v));
  const input = (label: string, value: number, on: (v: number) => void) => <label className="block"><span className="label">{label}</span><div className="relative"><input className="input input-sm pr-7" type="number" step="0.01" value={value} onChange={(e) => on(num(e.target.value))} /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-fg3">%</span></div></label>;
  return (
    <div className="space-y-4">
      <Panel title="Taxas de maquininha (repassadas ao cliente)">
        <p className="text-xs text-fg3 mb-3">Valor cobrado = líquido desejado ÷ (1 − taxa). Ajuste conforme seu contrato com a operadora.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{input("PIX", f.pix, (v) => setF({ ...f, pix: v }))}{input("Dinheiro", f.dinheiro, (v) => setF({ ...f, dinheiro: v }))}{input("Débito", f.debito, (v) => setF({ ...f, debito: v }))}{input("Crédito à vista", f.credito, (v) => setF({ ...f, credito: v }))}</div>
        <div className="text-[11px] font-bold uppercase text-fg3 mt-4 mb-2">Crédito parcelado</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">{Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => input(`${n}x`, toNum(f.parcelado[n]), (v) => setF({ ...f, parcelado: { ...f.parcelado, [n]: v } })))}</div>
      </Panel>
      <Panel title="Formas de pagamento aceitas">
        <div className="flex flex-wrap gap-2">{Object.entries(PAY_METHODS).map(([k, l]) => { const on = (pm as Rec)[k] !== false; return <button key={k} className={"h-9 px-3.5 rounded-xl border text-sm font-semibold " + (on ? "bg-accent/15 border-accent/40 text-accent" : "border-line text-fg3")} aria-pressed={on} onClick={() => setPm({ ...pm, [k]: !on })}>{on ? "✓ " : ""}{l}</button>; })}</div>
        <label className="block mt-4 max-w-[220px]"><span className="label">Margem desejada padrão (%)</span><input className="input input-sm" type="number" value={margin} onChange={(e) => setMargin(e.target.value)} /></label>
      </Panel>
      <Panel title="Taxa de deslocamento (opcional)">
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block"><span className="label">Modo</span><select className="input input-sm" value={tr.mode} onChange={(e) => setTr({ ...tr, mode: e.target.value })}><option value="fixed">Valor fixo</option><option value="km">Por km</option><option value="region">Por região</option></select></label>
          {tr.mode === "fixed" && <label className="block"><span className="label">Valor fixo (R$)</span><input className="input input-sm" type="number" value={tr.fixed} onChange={(e) => setTr({ ...tr, fixed: num(e.target.value) })} /></label>}
          {tr.mode === "km" && <><label className="block"><span className="label">Valor por km (R$)</span><input className="input input-sm" type="number" step="0.01" value={tr.perKm} onChange={(e) => setTr({ ...tr, perKm: num(e.target.value) })} /></label><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={!!tr.roundTrip} onChange={(e) => setTr({ ...tr, roundTrip: e.target.checked })} /> Ida e volta</label></>}
        </div>
        {tr.mode === "region" && (
          <div className="mt-3 space-y-2">{(tr.regions || []).map((r: Rec, i: number) => <div key={i} className="flex gap-2"><input className="input input-sm" placeholder="Região / bairro" value={r.name} onChange={(e) => setTr({ ...tr, regions: tr.regions.map((x: Rec, j: number) => (j === i ? { ...x, name: e.target.value } : x)) })} /><input className="input input-sm !w-32" type="number" placeholder="R$" value={r.fee} onChange={(e) => setTr({ ...tr, regions: tr.regions.map((x: Rec, j: number) => (j === i ? { ...x, fee: num(e.target.value) } : x)) })} /><button className="btn btn-sm btn-ghost btn-icon" aria-label="Remover região" onClick={() => setTr({ ...tr, regions: tr.regions.filter((_: Rec, j: number) => j !== i) })}><Trash2 size={14} /></button></div>)}
            <button className="btn btn-sm" onClick={() => setTr({ ...tr, regions: [...(tr.regions || []), { name: "", fee: 0 }] })}><Plus size={14} /> Região</button></div>
        )}
      </Panel>
      <button className="btn btn-primary" onClick={() => { save({ fees: f, paymentMethods: pm, travel: tr, defaultMargin: toNum(margin) }); toast("Taxas e formas de pagamento salvas"); }}>Salvar financeiro</button>
    </div>
  );
}

function Notifications() {
  const { settings, save } = useSettings();
  const n = settings.notify as Rec;
  const L: [string, string][] = [["quotes", "Orçamentos aprovados/recusados/alterações"], ["messages", "Novas mensagens e arquivos do cliente"], ["lateOrders", "OS atrasadas"], ["lowStock", "Estoque baixo"], ["dueBills", "Contas vencendo / recebimentos atrasados"], ["payments", "Pagamentos recebidos"], ["goals", "Metas atingidas"], ["warranties", "Garantias próximas do vencimento"]];
  return <Panel title="Notificações">{L.map(([k, l]) => <label key={k} className="flex items-center justify-between h-11 border-b border-line last:border-0 text-sm">{l}<button role="switch" aria-checked={n[k] !== false} onClick={() => save({ notify: { ...n, [k]: n[k] === false } })} className={"w-10 h-6 rounded-full p-0.5 transition " + (n[k] !== false ? "bg-accent" : "bg-solid3")}><span className={"block size-5 rounded-full bg-white transition " + (n[k] !== false ? "translate-x-4" : "")} /></button></label>)}</Panel>;
}

function PdfPreview() {
  const { settings } = useSettings();
  return (
    <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-2">
      <span className="text-xs text-fg3">Pré-visualizar modelo:</span>
      {Object.entries(PDF_TEMPLATES).map(([k, l]) => <button key={k} className="btn btn-sm" onClick={async () => {
        const { downloadPdf, companyOf } = await import("@/lib/pdf");
        await downloadPdf({ title: "Orçamento", number: "EXEMPLO", subtitle: "Pré-visualização do modelo", meta: [["Cliente", "Nome do cliente"], ["Validade", "—"]], sections: [{ type: "table", title: "Serviços e itens", head: ["Descrição", "Qtd", "Total"], rows: [["Serviço de exemplo", "1", "R$ 100,00"]], align: ["left", "center", "right"] }, { type: "totals", rows: [["Subtotal", "R$ 100,00"], ["TOTAL", "R$ 100,00", true]] }], terms: settings.terms, signatures: ["Responsável", "Cliente"] }, companyOf(settings), k, `modelo-${k}`);
      }}><Download size={13} /> {l}</button>)}
    </div>
  );
}

function Backup() {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const exportAll = async () => {
    setBusy(true);
    try {
      const data = await db.exportAll([...COLLECTIONS].filter((c) => c !== "companies"));
      const total = Object.values(data).reduce((a, l) => a + l.length, 0);
      download(`gbr-backup-${todayISO()}.json`, JSON.stringify({ app: "gbr-gestao", version: 1, exportedAt: nowISO(), companyId: COMPANY_ID, data }, null, 1), "application/json");
      toast(`Backup gerado: ${total} registros`);
    } catch (e) { toast(e instanceof Error ? e.message : "Falha no backup", "error"); } finally { setBusy(false); }
  };
  const importAll = async (file: File) => {
    try {
      const j = JSON.parse(await file.text());
      if (j.app !== "gbr-gestao" || !j.data) return toast("Arquivo de backup inválido", "error");
      const total = Object.values(j.data as Record<string, unknown[]>).reduce((a, l) => a + (Array.isArray(l) ? l.length : 0), 0);
      if (!(await confirmDialog({ title: "Restaurar backup?", message: `${total} registros serão gravados (documentos com o mesmo ID serão substituídos). Também serve para migrar dados entre PostgreSQL e Firebase.`, confirmText: "Restaurar" }))) return;
      toast(`${db.importAll(j.data)} registros restaurados`);
    } catch { toast("Não foi possível ler o arquivo", "error"); }
  };
  return (
    <div className="space-y-4">
      <Panel title="Exportar / restaurar / migrar">
        <div className="flex flex-wrap gap-2"><button className="btn btn-primary" disabled={busy} onClick={exportAll}><HardDriveDownload size={16} /> {busy ? "Gerando…" : "Exportar backup completo (JSON)"}</button><button className="btn" onClick={() => ref.current?.click()}><Upload size={15} /> Restaurar de arquivo</button><input ref={ref} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importAll(f); e.target.value = ""; }} /></div>
        <p className="text-xs text-fg3 mt-3">O backup contém todas as coleções da empresa <code className="kbd">{COMPANY_ID}</code>. Para <b>migrar</b> do modo PostgreSQL para o Firebase: exporte aqui → configure as variáveis do Firebase → abra o sistema → restaure o arquivo. Arquivos do Storage não estão no JSON (ficam nas URLs).</p>
      </Panel>
      <Panel title="Backup gerenciado (Firebase)"><p className="text-xs text-fg2">Em produção, ative backups agendados do Firestore e exportações: <code className="kbd">gcloud firestore export gs://SEU-BUCKET/backups</code> (ou Backup schedules no console). Recomendado além do JSON manual.</p></Panel>
    </div>
  );
}

function Integrations() {
  const s = useSyncStatus();
  const [ai, setAi] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/ai").then((r) => r.json()).then((j) => setAi(!!j.configured)).catch(() => setAi(false)); }, []);
  const Item = ({ icon: I, title, status, children }: { icon: typeof Cloud; title: string; status: ReactNode; children: ReactNode }) => <div className="card p-4"><div className="flex items-center gap-2.5 mb-1.5"><span className="size-8 rounded-xl bg-accent/12 text-accent grid place-items-center"><I size={16} /></span><b className="text-sm flex-1">{title}</b>{status}</div><div className="text-xs text-fg2 leading-relaxed">{children}</div></div>;
  const off = <Badge>não configurado</Badge>;
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Item icon={Cloud} title="Firebase (Firestore + Storage)" status={isFirebaseConfigured ? <Badge tone="ok">● ativo</Badge> : <Badge tone="warn">não configurado</Badge>}>
        {isFirebaseConfigured ? <>Projeto <b>{firebaseConfig.projectId}</b>. Dados em <code className="kbd">companies/{COMPANY_ID}/…</code>, arquivos no Storage, cache offline persistente. App Check: {process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY ? "ativo" : "defina NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY"}.</> : <>Rodando no <b>modo servidor (PostgreSQL)</b> com o mesmo modelo de coleções. Para ativar o Firebase defina <code className="kbd">NEXT_PUBLIC_FIREBASE_*</code> (ver .env.example), publique <code className="kbd">firebase/firestore.rules</code> e <code className="kbd">storage.rules</code>. Estado atual: {s.mode}.</>}
      </Item>
      <Item icon={ShieldCheck} title="App Check / Security Rules" status={<Badge tone={isFirebaseConfigured ? "info" : "neutral"}>{isFirebaseConfigured ? "regras no projeto" : "preparado"}</Badge>}>Regras validam dados, isolam por empresa e liberam links públicos apenas por token. Autenticação anônima hoje; Firebase Auth completo depois.</Item>
      <Item icon={Workflow} title="WhatsApp Business API" status={off}>Interface <code className="kbd">WhatsAppProvider</code> pronta. Hoje: links wa.me com mensagem do modelo.</Item>
      <Item icon={CalendarDays} title="Google / Apple / Outlook Calendar" status={<Badge tone="info">.ics disponível</Badge>}>Exportação .ics funcional na Agenda. Sincronização bidirecional: futura (OAuth em Cloud Function).</Item>
      <Item icon={Landmark} title="Open Finance / bancos" status={off}>Conciliação por CSV disponível. Conectores automáticos entram pelo mesmo fluxo em `financial_transactions`.</Item>
      <Item icon={Database} title="Google Maps / rotas" status={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ? <Badge tone="ok">chave definida</Badge> : off}>Abrir rota no Maps/Waze funciona. Distância e tempo automáticos requerem <code className="kbd">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> + Distance Matrix (etapa futura).</Item>
      <Item icon={Blocks} title="Google Business Profile" status={off}>Avaliações internas já são registradas; importação/solicitação pública: futura.</Item>
      <Item icon={Zap} title="Inteligência artificial" status={ai === null ? <Badge>verificando</Badge> : ai ? <Badge tone="ok">● ativa</Badge> : off}>Rota <code className="kbd">/api/ai</code> pronta (OpenAI-compatível). Sem chave = desativada; nada é simulado.</Item>
    </div>
  );
}

function System() {
  const s = useSyncStatus();
  const { save } = useSettings();
  const [prompt, setPrompt] = useState<Event & { prompt?: () => void } | null>(null);
  useEffect(() => { const h = (e: Event) => { e.preventDefault(); setPrompt(e as Event & { prompt?: () => void }); }; window.addEventListener("beforeinstallprompt", h); return () => window.removeEventListener("beforeinstallprompt", h); }, []);
  return (
    <div className="space-y-4">
      <Panel title="Sistema">
        <dl className="grid grid-cols-2 gap-y-2 text-sm max-w-lg"><dt className="text-fg3">Versão</dt><dd>GBR Gestão {VERSION}</dd><dt className="text-fg3">Empresa (companyId)</dt><dd><code className="kbd">{COMPANY_ID}</code></dd><dt className="text-fg3">Banco de dados</dt><dd>{s.mode === "firestore" ? "Firebase Cloud Firestore" : "PostgreSQL (modo servidor)"}</dd><dt className="text-fg3">Conexão</dt><dd>{s.label}{s.pending ? ` · ${s.pending} pendente(s)` : ""}</dd><dt className="text-fg3">Autenticação</dt><dd>Desativada (arquitetura pronta)</dd></dl>
        <div className="flex flex-wrap gap-2 mt-4">
          {prompt && <button className="btn btn-primary" onClick={() => (prompt as unknown as { prompt: () => void }).prompt()}><Download size={15} /> Instalar aplicativo (PWA)</button>}
          <button className="btn" onClick={async () => { if (await confirmDialog({ title: "Limpar cache local?", message: "Remove somente o cache de leitura offline deste dispositivo. Nada é apagado do servidor.", confirmText: "Limpar" })) { Object.keys(localStorage).filter((k) => k.startsWith("gbr:") && k.includes(":cache:")).forEach((k) => localStorage.removeItem(k)); location.reload(); } }}>Limpar cache local</button>
          <button className="btn" onClick={async () => { await seedDefaults({}); toast("Padrões restaurados (nada existente foi sobrescrito)"); }}><CheckCircle2 size={15} /> Reaplicar padrões iniciais</button>
          <button className="btn" onClick={() => { save({ onboarded: false }); }}>Refazer configuração inicial</button>
        </div>
      </Panel>
      <Panel title="Atalhos de teclado"><div className="grid sm:grid-cols-2 gap-2 text-sm">{[["Ctrl/⌘ + K", "Busca global e comandos"], ["Ctrl/⌘ + N", "Criar novo (menu rápido)"], ["Esc", "Fechar janela/modal"], ["↑ ↓ Enter", "Navegar na busca"]].map(([k, d]) => <div key={k} className="flex items-center gap-3"><span className="kbd">{k}</span><span className="text-fg2">{d}</span></div>)}</div><p className="text-[11px] text-fg3 mt-2">Atalhos configuráveis: planejado.</p></Panel>
    </div>
  );
}
