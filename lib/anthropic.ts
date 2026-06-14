import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { BriefingCaptacao, LeadComScore } from "./types";
import { gapPreco, contarReducoes } from "./score";

// Cliente Anthropic + geração do BRIEFING DE ABORDAGEM pro corretor.
// A IA NÃO conversa com o proprietário — ela arma o corretor: explica por que
// abordar agora (ancorado nos sinais), sugere a alavanca, redige a 1ª mensagem
// (LGPD-compliant) e antecipa a objeção.

// Default: claude-opus-4-8 (mais capaz). Troque p/ claude-haiku-4-5 via env se
// quiser respostas mais rápidas/baratas no demo.
const MODELO = process.env.CLAUDE_MODEL || "claude-haiku-4-5";

const SISTEMA = `Você é um consultor sênior de captação de imóveis no Brasil, treinando corretores de uma imobiliária.

Contexto: o corretor tem na frente um PROPRIETÁRIO que anuncia o imóvel SOZINHO ("particular") em portais. O objetivo é o corretor abordar esse dono e convencê-lo a colocar o imóvel com a imobiliária (idealmente em exclusividade).

Seu trabalho é municiar o corretor para a abordagem. Use SEMPRE os dados do lead (dias no anúncio, reduções de preço, gap vs. mercado, pulverização em portais) como âncora — nada genérico.

Regras de escrita:
- Português brasileiro, tom profissional e direto. Sem floreio, sem emoji nos campos de análise.
- A "mensagemSugerida" é o que o CORRETOR manda no WhatsApp do dono. Deve ser curta (2–4 frases), cordial, e COMPLIANT com a LGPD: identificar que viu o anúncio público do imóvel, dizer o propósito, e oferecer saída fácil ("se não fizer sentido, é só ignorar"). Ofereça valor (ajudar a vender mais rápido / no preço certo), não pressione.
- Seja específico e curto em cada campo.
- NUNCA peça o WhatsApp do proprietário na "mensagemSugerida" — a mensagem JÁ está sendo enviada pelo WhatsApp para o número dele. Perguntar "Qual seu WhatsApp?" é contraditório e soa mal.`;

const BriefingSchema = z.object({
  porQueAgora: z
    .string()
    .describe(
      "2 a 3 frases explicando por que vale abordar ESTE proprietário agora, citando os sinais concretos do lead.",
    ),
  comoAbordar: z
    .string()
    .describe(
      "A principal alavanca a puxar (preço, tempo parado, pulverização...) + dica curta de como conduzir a conversa.",
    ),
  mensagemSugerida: z
    .string()
    .describe(
      "Mensagem de WhatsApp pronta pro corretor copiar e enviar ao dono. Curta, cordial, LGPD-compliant (cita o anúncio público + saída fácil).",
    ),
  objecaoProvavel: z
    .string()
    .describe(
      "A objeção mais provável do dono (ex.: 'quero economizar a comissão') + como o corretor contorna em 1 frase.",
    ),
});

// Lead é estático → briefing pode ser cacheado por id (evita regerar e gastar API).
const cacheBriefing = new Map<
  string,
  { briefing: BriefingCaptacao; fonte: "claude" | "fallback" }
>();

function resumoLead(lead: LeadComScore): string {
  const gap = Math.round(gapPreco(lead) * 100);
  const reducoes = contarReducoes(lead);
  return [
    `Proprietário: ${lead.proprietario}`,
    `Imóvel: ${lead.tipo} de ${lead.area}m², ${lead.quartos} quarto(s), ${lead.vagas} vaga(s) em ${lead.bairro}, ${lead.cidade}/${lead.uf}`,
    `Transação: ${lead.transacao}`,
    `Preço anunciado: R$ ${lead.precoAtual.toLocaleString("pt-BR")}`,
    `Preço estimado de mercado: R$ ${lead.precoEstimadoMercado.toLocaleString("pt-BR")} (${gap > 0 ? `+${gap}% acima` : `${gap}%`})`,
    `Dias no anúncio: ${lead.diasNoAnuncio}`,
    `Reduções de preço já feitas: ${reducoes}`,
    `Anunciado em: ${lead.portais.join(", ")} (${lead.portais.length} portais)`,
    `Score de captabilidade: ${lead.avaliacao.score}/100 (${lead.avaliacao.tier})`,
    `Sinais: ${lead.avaliacao.principaisRazoes.join(" | ")}`,
  ].join("\n");
}

/** Fallback determinístico (sem LLM) — usado se faltar API key ou a API falhar. */
function briefingFallback(lead: LeadComScore): BriefingCaptacao {
  const primeiro = (lead.proprietario ?? "").split(" ")[0];
  const gap = Math.round(gapPreco(lead) * 100);
  return {
    porQueAgora: `${lead.avaliacao.principaisRazoes[0] ?? "Proprietário anunciando direto, sem imobiliária."} Score ${lead.avaliacao.score}/100 (${lead.avaliacao.tier}).`,
    comoAbordar:
      gap > 5
        ? "Puxe pelo preço: mostre que o anúncio está acima do mercado e que isso trava a venda."
        : lead.diasNoAnuncio >= 90
          ? "Puxe pelo tempo: o imóvel está parado há meses — ofereça acelerar a venda."
          : "Ofereça estrutura: fotos, divulgação e qualificação de leads que ele não tem sozinho.",
    mensagemSugerida: `Olá, ${primeiro}! Vi seu anúncio do ${lead.tipo} em ${lead.bairro} nos portais. Trabalho com captação aqui na região e acho que consigo te ajudar a vender mais rápido e no preço certo. Posso te mandar uma avaliação rápida, sem compromisso? Se não fizer sentido, é só ignorar. 🙂`,
    objecaoProvavel:
      "‘Estou vendendo sozinho pra economizar a comissão.’ → Mostre que um preço certo + venda mais rápida costuma compensar a comissão.",
  };
}

export async function gerarBriefing(
  lead: LeadComScore,
): Promise<{ briefing: BriefingCaptacao; fonte: "claude" | "fallback" }> {
  const emCache = cacheBriefing.get(lead.id);
  if (emCache) return emCache;

  if (!process.env.ANTHROPIC_API_KEY) {
    const resultado = { briefing: briefingFallback(lead), fonte: "fallback" as const };
    cacheBriefing.set(lead.id, resultado);
    return resultado;
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODELO,
      max_tokens: 1024,
      system: SISTEMA,
      messages: [
        {
          role: "user",
          content: `Monte o briefing de abordagem para este lead de captação:\n\n${resumoLead(lead)}`,
        },
      ],
      output_config: { format: zodOutputFormat(BriefingSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) return { briefing: briefingFallback(lead), fonte: "fallback" };
    const resultado = { briefing: parsed, fonte: "claude" as const };
    cacheBriefing.set(lead.id, resultado);
    return resultado;
  } catch (err) {
    console.error("[briefing] erro ao chamar Claude, usando fallback:", err);
    return { briefing: briefingFallback(lead), fonte: "fallback" };
  }
}
