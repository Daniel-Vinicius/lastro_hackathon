// Gera data/leads.json com leads sintéticos calibrados em dados BR reais.
// Rodável com: node scripts/gen-data.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = "2026-06-14";

// --- PRNG determinístico (mulberry32) ---
function mkRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mkRng(0xdeadbeef);
const ri = (lo, hi) => Math.floor(rng() * (hi - lo + 1)) + lo;
const rf = (lo, hi) => rng() * (hi - lo) + lo;
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN(arr, n) {
  return shuffle(arr).slice(0, n);
}

// --- Helpers de data/preço ---
function subtractDays(isoDate, n) {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - Math.round(n));
  return d.toISOString().slice(0, 10);
}

const r1k = (n) => Math.round(n / 1000) * 1000;
const r100 = (n) => Math.round(n / 100) * 100;

// --- Dados do domínio ---
const BAIRROS = [
  { nome: "Itaim Bibi",   pm2: 18000 },
  { nome: "Pinheiros",    pm2: 15000 },
  { nome: "Moema",        pm2: 14000 },
  { nome: "Brooklin",     pm2: 13000 },
  { nome: "Consolação",   pm2: 13500 },
  { nome: "Perdizes",     pm2: 11000 },
  { nome: "Vila Mariana", pm2: 12000 },
  { nome: "Lapa",         pm2: 10000 },
  { nome: "Santana",      pm2:  9000 },
  { nome: "Tatuapé",      pm2:  8000 },
];

const PORTAIS = ["OLX", "Viva Real", "ZAP", "Chaves na Mão", "Quinto Andar"];

const TIPOS_VENDA   = ["apartamento", "apartamento", "apartamento", "casa", "sobrado", "cobertura"];
const TIPOS_ALUGUEL = ["apartamento", "apartamento", "kitnet", "casa"];

const NOMES_BR = [
  "Carlos Silva", "Ana Oliveira", "Marcos Santos", "Fernanda Lima",
  "Roberto Costa", "Juliana Ferreira", "Paulo Mendes", "Luciana Rocha",
  "Eduardo Alves", "Patrícia Gomes", "Ricardo Nunes", "Mariana Castro",
  "Diego Souza", "Camila Ribeiro", "Henrique Martins", "Beatriz Carvalho",
  "Felipe Correia", "Renata Dias", "Gustavo Teixeira", "Larissa Barbosa",
  "Thiago Nascimento", "Aline Pires", "Bruno Cardoso", "Vanessa Lima",
  "Leonardo Araújo", "Priscila Moura", "Rafael Freitas", "Daniela Cruz",
  "André Brito", "Isabela Farias", "Rodrigo Vieira", "Cláudia Pereira",
  "Fábio Cunha", "Natália Campos", "Sérgio Ramos", "Tatiana Borges",
  "Alexandre Medeiros", "Simone Carmo", "Júlio César", "Mônica Andrade",
];

function gerarTelefone() {
  return `(11) 9${ri(1000, 9999)}-${ri(1000, 9999)}`;
}

function dimensoesPorTipo(tipo) {
  switch (tipo) {
    case "kitnet":      return { area: ri(25, 42),  quartos: 0,        vagas: 0 };
    case "cobertura":   return { area: ri(90, 180), quartos: ri(3, 4), vagas: ri(1, 2) };
    case "casa":        return { area: ri(80, 200), quartos: ri(2, 4), vagas: ri(0, 2) };
    case "sobrado":     return { area: ri(80, 160), quartos: ri(2, 4), vagas: ri(0, 2) };
    default:            return { area: ri(45, 110), quartos: ri(1, 3), vagas: ri(0, 1) };
  }
}

// Constrói historicoPreco: oldest→newest, com `reducoes` quedas de preço,
// terminando em precoAtual na data de hoje.
function buildHistorico({ transacao, area, bairro, diasNoAnuncio, reducoes, gapFinal }) {
  const noise = 1 + rf(-0.03, 0.03);
  let precoEstimadoMercado;
  if (transacao === "venda") {
    precoEstimadoMercado = r1k(area * bairro.pm2 * noise);
  } else {
    // Aluguel: ~0,4% do valor do imóvel/mês
    precoEstimadoMercado = r100(area * bairro.pm2 * 0.004 * noise);
  }

  const round = transacao === "venda" ? r1k : r100;
  const precoAtual = round(precoEstimadoMercado * (1 + gapFinal));

  const historicoPreco = [];

  if (reducoes === 0) {
    historicoPreco.push({ data: subtractDays(TODAY, diasNoAnuncio), valor: precoAtual });
    if (diasNoAnuncio > 15) {
      historicoPreco.push({ data: TODAY, valor: precoAtual });
    }
  } else {
    // Cria preços do mais novo (precoAtual) para o mais antigo (mais caro), depois inverte.
    const prices = [precoAtual];
    for (let i = 0; i < reducoes; i++) {
      prices.push(round(prices[prices.length - 1] * (1 + rf(0.05, 0.10))));
    }
    prices.reverse(); // [mais antigo/alto ... mais recente/baixo]

    const n = prices.length;
    for (let i = 0; i < n; i++) {
      const daysAgo = i === n - 1 ? 0 : diasNoAnuncio * (n - 1 - i) / (n - 1);
      const data = daysAgo === 0 ? TODAY : subtractDays(TODAY, daysAgo);
      historicoPreco.push({ data, valor: prices[i] });
    }
  }

  return { precoEstimadoMercado, precoAtual, historicoPreco };
}

function buildLead({ id, bairro, tipo, transacao, diasNoAnuncio, reducoes, gapFinal, nPortais, nomeIdx }) {
  const { area, quartos, vagas } = dimensoesPorTipo(tipo);
  const { precoEstimadoMercado, precoAtual, historicoPreco } = buildHistorico({
    transacao, area, bairro, diasNoAnuncio, reducoes, gapFinal,
  });
  const portais = pickN(PORTAIS, nPortais);
  const fotos = [
    `https://picsum.photos/seed/${id}a/800/600`,
    `https://picsum.photos/seed/${id}b/800/600`,
    `https://picsum.photos/seed/${id}c/800/600`,
  ];

  return {
    id,
    proprietario: NOMES_BR[nomeIdx % NOMES_BR.length],
    telefone: gerarTelefone(),
    bairro: bairro.nome,
    cidade: "São Paulo",
    uf: "SP",
    tipo,
    transacao,
    area,
    quartos,
    vagas,
    precoAtual,
    historicoPreco,
    diasNoAnuncio,
    portais,
    anunciante: "particular",
    precoEstimadoMercado,
    fotos,
    fonte: "sintetico",
  };
}

// --- Leads-herói curados (score garantidamente alto pro demo) ---
// score = round(fDias*30)+round(fRed*25)+round(fGap*25)+round(fPulv*20)
// Tier quente >= 66
const HEROES = [
  { bairro: "Moema",        tipo: "apartamento", transacao: "venda",  dias: 127, red: 3, gap: 0.22, portais: 4 }, // score ~95
  { bairro: "Pinheiros",    tipo: "casa",        transacao: "venda",  dias: 112, red: 2, gap: 0.18, portais: 4 }, // score ~82
  { bairro: "Vila Mariana", tipo: "apartamento", transacao: "venda",  dias: 143, red: 3, gap: 0.15, portais: 3 }, // score ~85
  { bairro: "Itaim Bibi",   tipo: "cobertura",   transacao: "venda",  dias: 98,  red: 2, gap: 0.21, portais: 4 }, // score ~82
];

// --- Perfis para geração (transacao, qty, ranges) ---
// quente adicional: dias altos + reduções + gap > 10%
// morno: dias médios, pelo menos 1 redução ou gap razoável, 2+ portais
// frio: anúncio novo, sem redução, preço alinhado/abaixo
const PROFILES = [
  // Quente não-herói (venda) — ~5
  { transacao: "venda",   qty: 5,
    diasLo: 80,  diasHi: 130, redLo: 1, redHi: 2, gapLo: 0.10, gapHi: 0.20, portaisLo: 2, portaisHi: 4 },
  // Morno (venda) — ~10
  { transacao: "venda",   qty: 10,
    diasLo: 55,  diasHi: 90,  redLo: 1, redHi: 2, gapLo: 0.06, gapHi: 0.14, portaisLo: 2, portaisHi: 3 },
  // Frio (venda) — ~11
  { transacao: "venda",   qty: 11,
    diasLo: 3,   diasHi: 45,  redLo: 0, redHi: 0, gapLo: -0.05, gapHi: 0.07, portaisLo: 1, portaisHi: 1 },
  // Aluguel morno — ~5
  { transacao: "aluguel", qty: 5,
    diasLo: 50,  diasHi: 90,  redLo: 1, redHi: 2, gapLo: 0.05, gapHi: 0.14, portaisLo: 2, portaisHi: 3 },
  // Aluguel frio — ~5
  { transacao: "aluguel", qty: 5,
    diasLo: 5,   diasHi: 40,  redLo: 0, redHi: 0, gapLo: -0.05, gapHi: 0.06, portaisLo: 1, portaisHi: 1 },
];
// Total: 4 + 5 + 10 + 11 + 5 + 5 = 40

const leads = [];
let idx = 0;

// Herói leads
for (const h of HEROES) {
  const bairro = BAIRROS.find((b) => b.nome === h.bairro);
  const id = `lead-${String(++idx).padStart(3, "0")}`;
  leads.push(buildLead({
    id, bairro, tipo: h.tipo, transacao: h.transacao,
    diasNoAnuncio: h.dias, reducoes: h.red, gapFinal: h.gap,
    nPortais: h.portais, nomeIdx: idx - 1,
  }));
}

// Leads gerados pelos perfis
for (const p of PROFILES) {
  const tiposBase = p.transacao === "venda" ? TIPOS_VENDA : TIPOS_ALUGUEL;
  for (let i = 0; i < p.qty; i++) {
    const bairro = pick(BAIRROS);
    const tipo = pick(tiposBase);
    const diasNoAnuncio = ri(p.diasLo, p.diasHi);
    const maxRed = diasNoAnuncio < 20 ? 0 : p.redHi;
    const reducoes = ri(p.redLo, maxRed);
    const gapFinal = rf(p.gapLo, p.gapHi);
    const nPortais = ri(p.portaisLo, p.portaisHi);
    const id = `lead-${String(++idx).padStart(3, "0")}`;
    leads.push(buildLead({
      id, bairro, tipo, transacao: p.transacao,
      diasNoAnuncio, reducoes, gapFinal, nPortais, nomeIdx: idx - 1,
    }));
  }
}

// --- Gravar ---
const outDir = path.join(ROOT, "data");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "leads.json");
fs.writeFileSync(outFile, JSON.stringify(leads, null, 2), "utf-8");
console.log(`✓ ${leads.length} leads gravados em ${outFile}`);

// --- Sanity check: replica avaliarLead do score.ts e imprime distribuição ---
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function contarReducoes(lead) {
  let n = 0;
  for (let i = 1; i < lead.historicoPreco.length; i++) {
    if (lead.historicoPreco[i].valor < lead.historicoPreco[i - 1].valor) n++;
  }
  return n;
}
function calcScore(lead) {
  const red = contarReducoes(lead);
  const gap = lead.precoEstimadoMercado
    ? (lead.precoAtual - lead.precoEstimadoMercado) / lead.precoEstimadoMercado
    : 0;
  const nP = lead.portais.length;
  return (
    Math.round(clamp01(lead.diasNoAnuncio / 150) * 30) +
    Math.round(clamp01(red / 3) * 25) +
    Math.round((gap > 0 ? clamp01(gap / 0.2) : 0) * 25) +
    Math.round(clamp01((nP - 1) / 3) * 20)
  );
}

const dist = { quente: 0, morno: 0, frio: 0 };
let erros = [];
for (const l of leads) {
  // Valida campos obrigatórios
  for (const campo of ["id","proprietario","telefone","bairro","cidade","uf","tipo","transacao",
      "area","quartos","vagas","precoAtual","historicoPreco","diasNoAnuncio","portais",
      "anunciante","precoEstimadoMercado","fotos","fonte"]) {
    if (l[campo] === undefined || l[campo] === null) erros.push(`${l.id}: campo ausente: ${campo}`);
  }
  if (l.anunciante !== "particular") erros.push(`${l.id}: anunciante != particular`);
  const last = l.historicoPreco[l.historicoPreco.length - 1];
  if (last?.valor !== l.precoAtual) erros.push(`${l.id}: precoAtual != ultimo historicoPreco`);

  const s = calcScore(l);
  const tier = s >= 66 ? "quente" : s >= 40 ? "morno" : "frio";
  dist[tier]++;
}

if (erros.length) {
  console.error("ERROS DE CONTRATO:");
  erros.forEach((e) => console.error(" ", e));
  process.exit(1);
}

console.log(`  Tiers: quente=${dist.quente} morno=${dist.morno} frio=${dist.frio}`);
console.log(`  Venda=${leads.filter(l=>l.transacao==="venda").length} Aluguel=${leads.filter(l=>l.transacao==="aluguel").length}`);
