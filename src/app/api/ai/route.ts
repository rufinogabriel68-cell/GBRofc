export const dynamic = "force-dynamic";

/**
 * Camada de IA (preparada, sem simulação).
 * Só responde quando AI_API_KEY estiver configurada (API compatível com OpenAI Chat Completions).
 * Variáveis: AI_API_KEY, AI_API_URL (opcional), AI_MODEL (opcional).
 */
const SYSTEM: Record<string, string> = {
  describe_service: "Você escreve descrições comerciais claras e objetivas de serviços técnicos (elétrica, CFTV, informática, automação) em português do Brasil.",
  quote_from_text: "Você transforma o pedido de um cliente em uma lista de serviços/itens de orçamento em português do Brasil. Responda em tópicos curtos.",
  summarize_customer: "Você resume o histórico de um cliente de um prestador de serviços em português do Brasil, destacando oportunidades e pendências.",
  report: "Você redige relatórios gerenciais objetivos em português do Brasil a partir dos dados fornecidos, sem inventar números.",
  message: "Você escreve mensagens curtas e cordiais de WhatsApp para clientes de um prestador de serviços, em português do Brasil.",
  followup: "Você sugere a melhor abordagem de follow-up comercial em português do Brasil, com uma mensagem pronta.",
  diagnosis: "Você auxilia no diagnóstico técnico de problemas de elétrica, CFTV, informática e automação, listando hipóteses e testes. Deixe claro que é apoio à decisão.",
  laudo: "Você redige laudos técnicos formais em português do Brasil a partir das informações fornecidas, sem inventar fatos.",
  opportunities: "Você identifica oportunidades de venda e manutenção preventiva a partir do histórico do cliente, em português do Brasil.",
};

export async function GET() {
  return Response.json({ configured: Boolean(process.env.AI_API_KEY), tasks: Object.keys(SYSTEM) });
}

export async function POST(req: Request) {
  const key = process.env.AI_API_KEY;
  if (!key) {
    return Response.json(
      { configured: false, error: "IA não configurada. Defina AI_API_KEY (e opcionalmente AI_API_URL / AI_MODEL) nas variáveis de ambiente." },
      { status: 501 },
    );
  }
  const body = (await req.json().catch(() => null)) as { task?: string; prompt?: string } | null;
  if (!body?.task || !SYSTEM[body.task] || !body.prompt || body.prompt.length > 12000) {
    return Response.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const url = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM[body.task] },
        { role: "user", content: body.prompt },
      ],
      temperature: 0.4,
    }),
  });
  if (!res.ok) return Response.json({ error: `Falha no provedor de IA (${res.status})` }, { status: 502 });
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return Response.json({ configured: true, text: j.choices?.[0]?.message?.content ?? "" });
}
