import type { Cortes, Lead, ResultadoScore, SinalScore, Tier } from "./types";

// Score de Captabilidade — DETERMINÍSTICO e explicável. O número não sai de um
// LLM (precisa ser confiável e estável no demo); o Claude só explica o porquê.
//
// Sinais (peso, soma = 100), calibrados em benchmarks BR reais:
//  - dias no anúncio  (30) — >90 dias = forte sinal de proprietário frustrado
//  - reduções de preço (25) — ≥2 remarcações = urgência (média sobe pós-10 sem.)
//  - gap vs. mercado  (25) — 54% dos imóveis à venda anunciados ACIMA do preço
//  - pulverização     (20) — mesmo imóvel em vários portais = sem exclusividade

export const PESOS = { dias: 30, reducoes: 25, gap: 25, pulverizacao: 20 } as const;

export const CORTES_PADRAO: Cortes = { morno: 40, quente: 66 };

/** Mapeia um score numérico para um tier, usando os cortes configurados. */
export function classificar(score: number, cortes: Cortes = CORTES_PADRAO): Tier {
  return score >= cortes.quente ? "quente" : score >= cortes.morno ? "morno" : "frio";
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Conta quantas vezes o preço caiu ao longo do histórico. */
export function contarReducoes(lead: Lead): number {
  let n = 0;
  for (let i = 1; i < lead.historicoPreco.length; i++) {
    if (lead.historicoPreco[i].valor < lead.historicoPreco[i - 1].valor) n++;
  }
  return n;
}

/** Gap percentual do preço atual vs. o estimado de mercado (positivo = acima). */
export function gapPreco(lead: Lead): number {
  if (!lead.precoEstimadoMercado) return 0;
  return (lead.precoAtual - lead.precoEstimadoMercado) / lead.precoEstimadoMercado;
}

function intensidade(fracao: number): SinalScore["intensidade"] {
  if (fracao >= 0.66) return "alto";
  if (fracao >= 0.33) return "medio";
  return "baixo";
}

export function avaliarLead(lead: Lead): ResultadoScore {
  const reducoes = contarReducoes(lead);
  const gap = gapPreco(lead);
  const nPortais = lead.portais.length;

  // Frações normalizadas (0–1) de cada sinal.
  const fDias = clamp01(lead.diasNoAnuncio / 150); // 150+ dias = máximo
  const fReducoes = clamp01(reducoes / 3); // 3+ remarcações = máximo
  const fGap = gap > 0 ? clamp01(gap / 0.2) : 0; // 20%+ acima = máximo
  const fPulv = clamp01((nPortais - 1) / 3); // 4+ portais = máximo

  const sinais: SinalScore[] = [
    {
      chave: "dias",
      rotulo: "Tempo no anúncio",
      pontos: Math.round(fDias * PESOS.dias),
      maximo: PESOS.dias,
      detalhe: `Anunciado há ${lead.diasNoAnuncio} dias${lead.diasNoAnuncio >= 90 ? " — acima de 90 dias." : "."}`,
      intensidade: intensidade(fDias),
    },
    {
      chave: "reducoes",
      rotulo: "Reduções de preço",
      pontos: Math.round(fReducoes * PESOS.reducoes),
      maximo: PESOS.reducoes,
      detalhe:
        reducoes >= 1
          ? `Baixou o preço ${reducoes}x.`
          : "Sem reduções de preço.",
      intensidade: intensidade(fReducoes),
    },
    {
      chave: "gap",
      rotulo: "Preço vs. mercado",
      pontos: Math.round(fGap * PESOS.gap),
      maximo: PESOS.gap,
      detalhe:
        gap > 0.03
          ? `Anunciado ${Math.round(gap * 100)}% acima do estimado de mercado.`
          : gap < -0.03
            ? `Anunciado ${Math.round(Math.abs(gap) * 100)}% abaixo do estimado de mercado.`
            : "Alinhado com o estimado de mercado.",
      intensidade: intensidade(fGap),
    },
    {
      chave: "pulverizacao",
      rotulo: "Pulverização",
      pontos: Math.round(fPulv * PESOS.pulverizacao),
      maximo: PESOS.pulverizacao,
      detalhe: `Anunciado em ${nPortais} ${nPortais > 1 ? "portais" : "portal"}.`,
      intensidade: intensidade(fPulv),
    },
  ];

  const score = sinais.reduce((acc, s) => acc + s.pontos, 0);
  const tier: Tier = classificar(score);

  const principaisRazoes = [...sinais]
    .sort((a, b) => b.pontos - a.pontos)
    .filter((s) => s.pontos > 0)
    .slice(0, 3)
    .map((s) => s.detalhe);

  return { score, tier, sinais, principaisRazoes };
}
