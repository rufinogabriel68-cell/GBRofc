# GBR Gestão — Arquitetura

Sistema de gestão para prestadores de serviços ("Sobrinho de Aluguel"): CRM + ERP + Orçamentos + OS + Agenda + Estoque + Financeiro + Documentos + Metas + Pós-venda + Automação.
Abre **direto no Dashboard (sem login)**, mas todo o modelo já é multiempresa/multiusuário.

## 1. Camadas

```
UI (Next.js App Router, React 19, Tailwind 4)  ── modules/*  components/*
   │  hooks reativos: useCollection / useActive / useRecord
Store reativo (src/lib/data/store.ts)  ── cache em memória, escrita otimista, auditoria, soft delete
   │  contrato único: Adapter (subscribe / write / upload / listAll)
   ├── FirestoreAdapter  → Cloud Firestore + Cloud Storage (persistência offline multi-aba, onSnapshot em tempo real)
   └── PgAdapter         → /api/sync + /api/write + /api/files (PostgreSQL, mesmo modelo de coleções, fila offline)
Workflows (src/lib/workflows.ts) ── regras que ligam os módulos
```

**Escolha do backend:** se `NEXT_PUBLIC_FIREBASE_PROJECT_ID` + `NEXT_PUBLIC_FIREBASE_API_KEY` existirem → Firebase. Caso contrário → modo servidor (PostgreSQL). A UI é idêntica; para migrar: *Configurações → Backup → Exportar*, configurar o Firebase e *Restaurar*.

> Firebase não pôde ser validado ao vivo no ambiente de desenvolvimento (sem credenciais do projeto). O adaptador, as regras e a inicialização estão implementados conforme o SDK modular; valide com `firebase emulators:start` ou no projeto real.

## 2. Modelo de dados (Firestore)

```
companies/{companyId}                       documento raiz da empresa
companies/{companyId}/{coleção}/{id}        TODAS as coleções abaixo (isolamento multiempresa)
public_links/{token}                        links públicos (orçamento/OS) — id = token aleatório de 32 caracteres
Storage: companies/{companyId}/{customers|work-orders|quotes|documents|branding}/{id}/arquivo
         public-uploads/{token}/arquivo     (envios do cliente no portal)
```

Coleções: `companies users roles permissions customers customer_addresses customer_equipment service_categories services service_materials products product_categories suppliers stock_movements quotes quote_items quote_status_history work_orders work_order_items work_order_status_history work_order_messages work_order_attachments appointments financial_accounts financial_categories financial_transactions payments goals crm_leads crm_activities crm_tags notes documents document_templates notifications automations automation_logs evaluations warranties audit_logs settings public_links`.

Todos os documentos: `id, companyId, createdAt, updatedAt, createdBy, updatedBy` (+ `archived`, `favorite`, `deletedAt` quando aplicável).

**Relacionamentos por ID** (`customerId`, `workOrderId`, `quoteId`, `supplierId`, `productId`, `accountId`…). Decisão de modelagem (idiomática no Firestore, evita joins e permite gravação atômica):

| Lista do escopo | Implementação |
|---|---|
| `quote_items`, `work_order_items` | array `pricing.lines` dentro do orçamento/OS |
| `quote_status_history`, `work_order_status_history` | array `history` no documento |
| `service_materials` | array `materials` no serviço (+ checklist) |
| `customer_addresses`, `customer_equipment`, `warranties` | coleções próprias ligadas por `customerId` |
| `product_categories`, `crm_tags` | texto/etiquetas nos documentos (coleções reservadas nas regras) |
| `permissions` | lista `permissions` do perfil (`roles`) |

Configurações da empresa: `settings/company` (identidade, taxas, numeração, tema…). Recentes: `settings/recents`.

## 3. Fluxo principal (coração do sistema)

1. Cliente cadastrado (ou lead convertido) → 2. Serviços/calculadora formam o preço (Econômico/Médio/Premium, taxa de maquininha **repassada**: `total = líquido ÷ (1 − taxa)`) → 3. Orçamento (PDF em 4 modelos, link público seguro) → 4. Cliente **aprova/recusa/pede alteração** (registrado com data, hora e comentário) → 5. **Criar OS** copia cliente, endereço, serviços, valores, materiais sugeridos e checklist → 6. Agenda (compromisso criado/sincronizado automaticamente) → 7. Execução (modo técnico, fotos, materiais com **baixa automática** no estoque, adicionais aprovados pelo cliente) → 8. Conclusão: cobrança no financeiro, garantia, tarefa de manutenção preventiva, pós-venda agendado → 9. Pagamento (total/parcial) gera **recibo** → 10. Cliente confirma conclusão e **avalia** → 11. Histórico/timeline, Central de lucro, metas e insights usam dados reais.

Estados: orçamento (rascunho → enviado → aguardando → aprovado/recusado/expirado → faturado/cancelado), OS (aberta → agendada → em deslocamento → em execução → aguardando material/cliente/aprovação → concluída → faturada/cancelada), lançamento (previsto/pendente/pago/atrasado*/cancelado; *derivado do vencimento).

## 4. Portal do cliente e links públicos

`public_links/{token}` guarda um **snapshot** seguro (empresa, itens, valores, status) e `events[]`. O cliente (sem cadastro) só **lê** por token e **acrescenta eventos** (aprovar, recusar, mensagem, foto, aprovar adicional, confirmar conclusão, avaliar). O app do prestador reconcilia os eventos (idempotente, `appliedEvents`) e atualiza orçamento/OS/notificações. Links podem ser **revogados**.

## 5. Segurança

- `firebase/firestore.rules` e `storage.rules`: acesso só autenticado (anônimo na fase 1), validação de tipo/tamanho/`companyId`, `audit_logs` append-only, links públicos sem listagem e com escrita restrita a `events`.
- **App Check** (reCAPTCHA v3) via `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` — complementa, não substitui, as regras.
- Sem segredos no front: apenas config pública do Firebase; IA/WhatsApp/bancos ficam em rotas server-side/Cloud Functions.
- Modo servidor: coleções em lista permitida, validação de ids/tamanho, tokens de 32 caracteres, upload público restrito a imagem/PDF.
- **Fase 2 (login real):** trocar `isMember()` nas regras por custom claims (`companyId`, `role`) e aplicar `roles.permissions`; `currentUser()` em `src/lib/session.ts` é o único ponto a alterar no cliente.

## 6. Offline e sincronização

Firestore: `persistentLocalCache` + `persistentMultipleTabManager` (leitura offline, escritas enfileiradas). Modo servidor: escrita otimista + fila persistente (outbox) + cache de leitura. Indicador: ● Sincronizado / ↻ Sincronizando… / ⚠ Offline. PWA com service worker (shell offline) e manifest.

## 7. Auditoria, exclusão segura, LGPD

`audit_logs` registra usuário, data/hora, ação, registro, valor anterior/novo (ex.: *"Preço Médio do serviço 'Instalação de câmera' alterado de R$ 180,00 para R$ 220,00"*). Exclusão = lixeira (soft delete) + arquivar; exclusão definitiva só da lixeira, com confirmação. Cliente: consentimento, exportação JSON e anonimização.

## 8. Extensões preparadas (sem simulação)

WhatsApp Business API (`WhatsAppProvider`), Open Finance/bancos (conciliação por CSV já funciona), Google Maps, Google Calendar (export .ics já funciona), Google Business Profile, IA (`/api/ai`, só com `AI_API_KEY`), Cloud Functions (`firebase/functions`) para automações/alertas agendados.

## 9. Ativar o Firebase

1. Crie o projeto, habilite **Firestore**, **Storage** e **Authentication → Anônimo**; registre um app Web e copie a config para `.env` (ver `.env.example`).
2. `cd firebase && firebase deploy --only firestore:rules,firestore:indexes,storage`.
3. (Recomendado) ative **App Check** e informe `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`.
4. Reinicie o app; restaure o backup JSON se estiver migrando do modo servidor.

## 10. Roadmap por etapas (implementado)

1 Fundação · 2 Operação · 3 Gestão · 4 Documentos/PDF · 5 Relacionamento (portal, chat, avaliações) · 6 Automação/notificações/WhatsApp · 7 Inteligência (insights, demanda, IA preparada).
