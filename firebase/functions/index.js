/**
 * GBR Gestão — Cloud Functions (estrutura pronta; instale com `npm i firebase-admin firebase-functions` nesta pasta).
 *
 * Hoje o app processa automações, expiração de orçamentos e alertas enquanto está aberto (src/components/shell/Watchers.tsx).
 * Em produção, estas funções assumem o processamento server-side, mesmo com o app fechado:
 *   1. dailyMaintenance   — expira orçamentos, cria notificações (OS atrasada, estoque baixo, contas, garantias)
 *   2. runAutomations     — executa automation_logs agendados (pós-venda, follow-up)
 *   3. onPublicLinkEvent  — aplica no orçamento/OS as respostas do cliente recebidas por public_links/{token}
 *   4. whatsappWebhook    — (futuro) recebe mensagens da WhatsApp Business API e grava em work_order_messages
 *
 * Mantida em JavaScript para não interferir no build do Next.js.
 */
/* eslint-disable */
// const { onSchedule } = require("firebase-functions/v2/scheduler");
// const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
// const admin = require("firebase-admin");
// admin.initializeApp();
// const db = admin.firestore();

// exports.dailyMaintenance = onSchedule("every day 06:00", async () => { /* iterar companies/* e aplicar as mesmas regras de src/lib/alerts.ts */ });
// exports.runAutomations = onSchedule("every 30 minutes", async () => { /* ler automation_logs onde status == 'agendado' e runDate <= hoje */ });
// exports.onPublicLinkEvent = onDocumentUpdated("public_links/{token}", async (event) => { /* reconciliar events não aplicados (appliedEvents) */ });

module.exports = {};
