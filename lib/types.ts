// Domínio do "Radar de Captação" — proprietários anunciando direto (FSBO) que
// uma imobiliária pode captar. Os tipos abaixo modelam exatamente o ativo real
// (agregação de portais + flag particular/imobiliária + contato), mockado.

export type Transacao = "venda" | "aluguel";

export type TipoImovel =
  | "apartamento"
  | "casa"
  | "cobertura"
  | "kitnet"
  | "sobrado";

export interface PontoPreco {
  /** ISO date (YYYY-MM-DD) */
  data: string;
  /** R$ */
  valor: number;
}

export interface Lead {
  id: string;
  /** Nome do proprietário — presente só se houver listing particular. */
  proprietario?: string;
  /** Telefone do proprietário — presente só se houver listing particular. */
  telefone?: string;
  bairro: string;
  cidade: string;
  uf: string;
  tipo: TipoImovel;
  transacao: Transacao;
  /** Área útil em m². */
  area: number;
  quartos: number;
  vagas: number;
  /** Preço atual anunciado (R$). */
  precoAtual: number;
  /** Histórico de preço do anúncio (mais antigo → mais recente). */
  historicoPreco: PontoPreco[];
  /** Dias desde a publicação do anúncio. */
  diasNoAnuncio: number;
  /** Portais onde o imóvel está anunciado (ex.: OLX, Viva Real). */
  portais: string[];
  /** Sempre "particular" — é o recorte FSBO que a gente capta. */
  anunciante: "particular";
  /** Preço estimado de mercado p/ a região (R$) — base do gap de preço. */
  precoEstimadoMercado: number;
  /** URLs de fotos (placeholder no sintético; foto real quando veio de scrape). */
  fotos: string[];
  /** Origem do dado: scrape real de um portal ou gerado sinteticamente. */
  fonte: "sintetico" | "chavesnamao-real" | "spimovel-real";
  /** URL do anúncio real (quando veio de scrape). */
  anuncioUrl?: string;
  /** Imobiliárias que anunciam o mesmo imóvel (Bloco G: pulverização cross-portal). */
  anunciantes: string[];
  /** Existe listing particular ativo — habilita o contato direto com o dono. */
  temContatoDireto: boolean;
}

/** Filtros que o corretor aplica na busca (Tela A). */
export interface FiltrosBusca {
  cidade?: string;
  bairros?: string[];
  transacao?: Transacao;
  tipo?: TipoImovel;
  precoMin?: number;
  precoMax?: number;
}

export type Tier = "frio" | "morno" | "quente";

/** Cortes do score que definem as fronteiras entre tiers. */
export interface Cortes {
  /** Score mínimo para tier "morno" (padrão 40). */
  morno: number;
  /** Score mínimo para tier "quente" (padrão 66). */
  quente: number;
}

export interface SinalScore {
  chave: "dias" | "reducoes" | "gap" | "pulverizacao";
  rotulo: string;
  /** Pontos que este sinal contribuiu ao score. */
  pontos: number;
  /** Pontos máximos possíveis deste sinal (peso). */
  maximo: number;
  /** Explicação legível, pronta pra UI. */
  detalhe: string;
  intensidade: "baixo" | "medio" | "alto";
}

export interface ResultadoScore {
  /** 0–100. */
  score: number;
  tier: Tier;
  sinais: SinalScore[];
  /** Bullets curtos com as razões de maior peso. */
  principaisRazoes: string[];
}

/** Lead já com score calculado — o que a API /search devolve. */
export interface LeadComScore extends Lead {
  avaliacao: ResultadoScore;
}

/** Saída estruturada do Claude na rota /briefing (briefing pro corretor). */
export interface BriefingCaptacao {
  /** 2–3 frases: por que abordar este proprietário agora, ancorado em dados. */
  porQueAgora: string;
  /** A alavanca a puxar + dica de como conduzir a abordagem. */
  comoAbordar: string;
  /** Mensagem de WhatsApp pronta pro corretor copiar (LGPD-compliant). */
  mensagemSugerida: string;
  /** Objeção mais provável + como contornar. */
  objecaoProvavel: string;
}
