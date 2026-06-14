// Utilitários compartilhados pelos scrapers (Chaves na Mão, SP Imóvel).
// Cada scraper é responsável só por: fetch + parse específicos do portal → "bases"
// (campos REAIS do anúncio). Aqui mora o que é comum: enriquecimento sintético
// determinístico, merge idempotente em data/leads.json, validação de contrato.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TODAY = "2026-06-14";
export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// --- PRNG determinístico (mulberry32) ---
export function mkRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const r1k = (n) => Math.round(n / 1000) * 1000;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function median(nums) {
  const a = [...nums].sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function subtractDays(isoDate, n) {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - Math.round(n));
  return d.toISOString().slice(0, 10);
}

export async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "pt-BR,pt;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Todos os blocos application/ld+json de uma página, já parseados (ignora inválidos). */
export function parseLdJson(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignora bloco inválido */
    }
  }
  return out;
}

const NOMES_BR = [
  "Carlos Silva", "Ana Oliveira", "Marcos Santos", "Fernanda Lima", "Roberto Costa",
  "Juliana Ferreira", "Paulo Mendes", "Luciana Rocha", "Eduardo Alves", "Patrícia Gomes",
  "Ricardo Nunes", "Mariana Castro", "Diego Souza", "Camila Ribeiro", "Henrique Martins",
  "Beatriz Carvalho", "Felipe Correia", "Renata Dias", "Gustavo Teixeira", "Larissa Barbosa",
];

export const TIPOS_VALIDOS = new Set(["apartamento", "casa", "cobertura", "kitnet", "sobrado"]);

// Histórico: termina em precoAtual (real) hoje; cria `reducoes` quedas espaçadas ao
// longo de diasNoAnuncio (espelha lib/score.ts:contarReducoes).
function buildHistorico(precoAtual, diasNoAnuncio, reducoes, rng) {
  const historico = [];
  if (reducoes === 0) {
    historico.push({ data: subtractDays(TODAY, diasNoAnuncio), valor: precoAtual });
    if (diasNoAnuncio > 15) historico.push({ data: TODAY, valor: precoAtual });
    return historico;
  }
  const prices = [precoAtual];
  for (let i = 0; i < reducoes; i++) {
    prices.push(r1k(prices[prices.length - 1] * (1 + (0.05 + rng() * 0.05))));
  }
  prices.reverse();
  const n = prices.length;
  for (let i = 0; i < n; i++) {
    const daysAgo = i === n - 1 ? 0 : (diasNoAnuncio * (n - 1 - i)) / (n - 1);
    historico.push({ data: daysAgo === 0 ? TODAY : subtractDays(TODAY, daysAgo), valor: prices[i] });
  }
  return historico;
}

// Split de calor garantido (independe do PRNG): ~40% quente / 40% morno / 20% frio.
export const HEAT_SPLIT = ["quente", "quente", "morno", "morno", "frio"];

/**
 * Completa uma "base" (campos REAIS do anúncio) com os campos derivados/sintéticos,
 * de forma determinística (seed = id do anúncio).
 *
 * base: { idNum, anuncioUrl, precoAtual, tipo, area, quartos, bairro, cidade, uf,
 *         fotos, vagas?, temGaragem? }
 * opts: { heat, pm2Bairro, fonte, portalReal, idPrefix }
 *
 * IMPORTANTE: `portais` recebe APENAS o portal onde o anúncio foi REALMENTE
 * encontrado — não inventamos pulverização em dado real (seria desonesto e
 * inflaria o sinal). Pulverização real fica zerada nesses leads.
 */
export function enriquecer(base, { heat, pm2Bairro, fonte, portalReal, idPrefix }) {
  const rng = mkRng(parseInt(base.idNum, 10) || 1);
  const ri = (lo, hi) => Math.floor(rng() * (hi - lo + 1)) + lo;

  // Sem pulverização inventada, o score real vem de dias+reduções+gap (máx 80). As
  // faixas abaixo garantem que cada bucket caia na sua tier mesmo com gap ~0 (metade
  // dos leads fica na mediana do bairro → 0 ponto de gap).
  let diasNoAnuncio, reducoes;
  if (heat === "quente") {
    diasNoAnuncio = ri(110, 148); reducoes = ri(2, 3);
  } else if (heat === "morno") {
    diasNoAnuncio = ri(75, 110); reducoes = ri(2, 3);
  } else {
    diasNoAnuncio = ri(8, 44); reducoes = ri(0, 1);
  }

  const vagas = base.vagas != null ? base.vagas : base.temGaragem ? ri(1, 2) : 0;
  const proprietario = NOMES_BR[(parseInt(base.idNum, 10) || 1) % NOMES_BR.length];
  const telefone = `(11) 9${ri(1000, 9999)}-${ri(1000, 9999)}`;
  const precoEstimadoMercado = r1k(pm2Bairro * base.area);
  const historicoPreco = buildHistorico(base.precoAtual, diasNoAnuncio, reducoes, rng);

  return {
    id: `${idPrefix}-${base.idNum}`,
    proprietario,
    telefone,
    bairro: base.bairro,
    cidade: base.cidade,
    uf: base.uf,
    tipo: base.tipo,
    transacao: base.transacao || "venda",
    area: base.area,
    quartos: base.quartos,
    vagas,
    precoAtual: base.precoAtual,
    historicoPreco,
    diasNoAnuncio,
    portais: [portalReal], // só o portal real — sem pulverização inventada
    anunciante: "particular",
    precoEstimadoMercado,
    fotos: base.fotos,
    fonte,
    anuncioUrl: base.anuncioUrl,
  };
}

/** precoEstimadoMercado por bairro: mediana de R$/m² do lote (fallback: mediana geral). */
export function pm2PorBairro(bases) {
  const geral = median(bases.map((b) => b.precoAtual / b.area));
  const porBairro = {};
  for (const b of bases) (porBairro[b.bairro] ||= []).push(b.precoAtual / b.area);
  return (bairro) => {
    const arr = porBairro[bairro] || [];
    return arr.length >= 3 ? median(arr) : geral;
  };
}

/**
 * Atribui o "calor" (perfil de dias/reduções) pelo GAP REAL vs. mercado: o imóvel
 * mais acima do preço de mercado recebe o perfil mais quente — coerente com a
 * história "parado + remarcado + superprecificado", que é o lead quente verossímil.
 * Top ~40% de gap → quente, próximos ~40% → morno, resto → frio.
 * Retorna Map<idNum, "quente"|"morno"|"frio">.
 */
export function heatByGap(bases, pm2De) {
  const ordered = bases
    .map((b) => ({ idNum: b.idNum, gap: b.precoAtual / b.area / (pm2De(b.bairro) || 1) }))
    .sort((x, y) => y.gap - x.gap);
  const heat = new Map();
  ordered.forEach((o, i) => {
    const frac = i / ordered.length;
    heat.set(o.idNum, frac < 0.4 ? "quente" : frac < 0.8 ? "morno" : "frio");
  });
  return heat;
}

const OBRIGATORIOS = ["id", "proprietario", "telefone", "bairro", "cidade", "uf", "tipo",
  "transacao", "area", "quartos", "vagas", "precoAtual", "historicoPreco", "diasNoAnuncio",
  "portais", "anunciante", "precoEstimadoMercado", "fotos", "fonte"];

function scoreRapido(l) {
  const c = (x) => Math.max(0, Math.min(1, x));
  let red = 0;
  for (let i = 1; i < l.historicoPreco.length; i++)
    if (l.historicoPreco[i].valor < l.historicoPreco[i - 1].valor) red++;
  const gap = l.precoEstimadoMercado ? (l.precoAtual - l.precoEstimadoMercado) / l.precoEstimadoMercado : 0;
  return Math.round(c(l.diasNoAnuncio / 150) * 30) + Math.round(c(red / 3) * 25) +
    Math.round((gap > 0 ? c(gap / 0.2) : 0) * 25) + Math.round(c((l.portais.length - 1) / 3) * 20);
}

/**
 * Funde leads reais em data/leads.json de forma idempotente: cria a pasta/arquivo
 * se não existir, remove os leads da MESMA `fonte` (re-scrape limpo), mantém o resto,
 * reanexa e valida o contrato. Não grava se a validação falhar.
 */
export function mergeAndWrite(reais, fonte) {
  const dir = path.join(ROOT, "data");
  const arquivo = path.join(dir, "leads.json");

  // contrato
  const erros = [];
  for (const l of reais) {
    for (const c of OBRIGATORIOS) if (l[c] === undefined || l[c] === null) erros.push(`${l.id}: campo ausente ${c}`);
    const last = l.historicoPreco[l.historicoPreco.length - 1];
    if (last?.valor !== l.precoAtual) erros.push(`${l.id}: precoAtual != último historicoPreco`);
  }
  if (erros.length) {
    console.error("ERROS DE CONTRATO (abortado, JSON intacto):");
    erros.forEach((e) => console.error("  ", e));
    process.exit(1);
  }

  fs.mkdirSync(dir, { recursive: true }); // cria data/ se não existir
  let existentes = [];
  try {
    existentes = JSON.parse(fs.readFileSync(arquivo, "utf-8"));
  } catch {
    existentes = []; // arquivo ainda não existe → começa vazio
  }
  const mantidos = existentes.filter((l) => l.fonte !== fonte);
  const fundido = [...mantidos, ...reais];
  fs.writeFileSync(arquivo, JSON.stringify(fundido, null, 2), "utf-8");

  const dist = { quente: 0, morno: 0, frio: 0 };
  for (const l of reais) {
    const s = scoreRapido(l);
    dist[s >= 66 ? "quente" : s >= 40 ? "morno" : "frio"]++;
  }
  console.log(`\n✓ ${reais.length} leads reais (${fonte}) fundidos em ${arquivo}`);
  console.log(`  Total no cache: ${fundido.length} (${mantidos.length} de outras fontes + ${reais.length} desta)`);
  console.log(`  Tiers: quente=${dist.quente} morno=${dist.morno} frio=${dist.frio}`);
  console.log(`  ⚠ Reinicie o dev server p/ recarregar o cache de data.ts.`);
}
