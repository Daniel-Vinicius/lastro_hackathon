// Scrape do SP Imóvel → upsert no Neon via lib/db/ingest.
// Rodável com: npm run scrape:spi (ou: npx tsx scripts/scrape-spimovel.mjs)
//
// REAL: id, anuncioUrl, precoAtual, tipo, area, quartos, vagas, bairro, fotos (galeria).
// SP Imóvel NÃO tem datePosted → firstSeen = now (T0); diasNoAnuncio real a partir do T0+.
// anuncianteTipo = "imobiliaria" (SP Imóvel é majoritariamente imobiliária).
// Sem proprietario/telefone fake, sem reduções fabricadas.

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import {
  fetchHtml, parseLdJson, pm2PorBairro, TIPOS_VALIDOS, sleep,
} from "./_scrape-utils.mjs";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

const FONTE = "spimovel-real";
const MAX_REAIS = 15;
const PORTAL = "SP Imóvel";
const ID_PREFIX = "spi";

const SEARCHES = [
  "https://www.spimovel.com.br/imoveis/?FinalidadeId=1&CategoriaId=1&TipoIds=2&OrderByOption=7",
];

function listaUrls(html) {
  for (const d of parseLdJson(html)) {
    if (d?.["@type"] === "ItemList" && Array.isArray(d.itemListElement)) {
      return d.itemListElement.map((it) => it.url).filter(Boolean);
    }
  }
  return [];
}

const CONECTORES = new Set(["de", "da", "do", "dos", "das", "e"]);
const titleCase = (s) =>
  s.split(" ").filter(Boolean).map((w, i) =>
    CONECTORES.has(w) && i > 0 ? w : w.charAt(0).toUpperCase() + w.slice(1),
  ).join(" ");

function tipoDeSlug(slug, name) {
  const t = slug.split("-")[0];
  if ((name || "").toLowerCase().includes("cobertura")) return "cobertura";
  if (TIPOS_VALIDOS.has(t)) return t;
  if (["studio", "loft", "flat", "conjugado"].includes(t)) return "kitnet";
  return null;
}

const CRUMB_GENERICO = new Set([
  "home", "comprar", "alugar", "são paulo", "sao paulo", "centro", "apartamentos",
  "casas", "imóveis", "imoveis", "zona oeste", "zona leste", "zona sul", "zona norte",
]);
function bairroDetalhe(html, fallback) {
  for (const d of parseLdJson(html)) {
    if (d?.["@type"] === "BreadcrumbList" && Array.isArray(d.itemListElement)) {
      const nomes = d.itemListElement
        .map((it) => (typeof it.item === "object" ? it.item?.name : it.name) || "")
        .filter(Boolean);
      const last = nomes[nomes.length - 1];
      if (last && !CRUMB_GENERICO.has(last.toLowerCase())) return last;
    }
  }
  return fallback;
}

function parseSlug(url) {
  const slug = (url.split("/imovel/")[1] || "").replace(/\/\d+\/?$/, "").toLowerCase();
  const idNum = (url.match(/\/(\d+)\/?$/) || [])[1];
  const quartos = Number((slug.match(/(\d+)quartos?/) || [])[1]) || 0;
  const vagas = Number((slug.match(/(\d+)vagas?/) || [])[1]) || 0;
  const areaSlug = Number((slug.match(/(\d+)m2/) || [])[1]) || 0;
  const transacao = /-locacao-|-aluguel-/.test(slug) ? "aluguel" : "venda";
  let rest = slug.split(/\d+m2-/)[1] || "";
  if (/-sao-paulo-sao-paulo-sp$/.test(rest)) rest = rest.replace(/-sao-paulo-sao-paulo-sp$/, "");
  else rest = rest.split("-").slice(0, -3).join("-");
  const bairro = rest ? titleCase(rest.replace(/-/g, " ")) : "São Paulo";
  return { idNum, quartos, vagas, areaSlug, transacao, bairro, slug };
}

function precoDetalhe(html) {
  const vals = [...html.matchAll(/valor-historico[^>]*>\s*R\$\s*([\d.]+)/g)]
    .map((m) => parseInt(m[1].replace(/\./g, ""), 10));
  return vals.find((v) => v > 10000) || 0;
}

function imovelLd(html) {
  for (const d of parseLdJson(html)) {
    for (const it of Array.isArray(d) ? d : [d]) {
      const t = it?.["@type"];
      const arr = Array.isArray(t) ? t : [t];
      if (arr.some((x) => ["Apartment", "SingleFamilyResidence", "House", "Residence"].includes(x))) return it;
    }
  }
  return null;
}

async function main() {
  const { db, hasDb } = await import("../lib/db/index.js");
  if (!hasDb || !db) {
    console.error("⚠ NEON_POSTGRES_CONNECTION_STRING não definida — scraper SP Imóvel abortado.");
    process.exit(0);
  }
  const { upsertMany } = await import("../lib/db/ingest.js");

  const urls = [];
  for (const s of SEARCHES) {
    try {
      urls.push(...listaUrls(await fetchHtml(s)));
    } catch (e) {
      console.warn(`  ⚠ busca falhou ${s}: ${e.message}`);
    }
    await sleep(1500);
  }
  const uniq = [...new Set(urls)];
  console.log(`  ${uniq.length} URLs de anúncio coletadas`);

  const bases = [];
  for (const url of uniq) {
    if (bases.length >= MAX_REAIS) break;
    try {
      const html = await fetchHtml(url);
      const meta = parseSlug(url);
      const ld = imovelLd(html);
      const preco = precoDetalhe(html);
      const tipo = tipoDeSlug(meta.slug, ld?.name);
      const area = Number(ld?.floorSize?.value) || meta.areaSlug;
      let fotos = ld?.image;
      fotos = (Array.isArray(fotos) ? fotos : fotos ? [fotos] : [])
        .filter((u) => /\/Imovel\//i.test(u))
        .slice(0, 5);

      if (!meta.idNum || !tipo || !TIPOS_VALIDOS.has(tipo)) continue;
      if (!(preco > 10000) || !(area > 0) || !fotos.length) {
        console.log(`    – pulando ${meta.idNum} (preço/área/foto ausente)`);
      } else {
        const bairro = bairroDetalhe(html, meta.bairro);
        bases.push({
          idNum: meta.idNum, anuncioUrl: url, precoAtual: preco, tipo, area,
          quartos: meta.quartos, vagas: meta.vagas,
          bairro, cidade: "São Paulo", uf: "SP",
          fotos, transacao: meta.transacao,
        });
        console.log(`    ✓ ${meta.idNum} ${tipo} ${bairro} R$${preco.toLocaleString("pt-BR")} (${fotos.length} fotos)`);
      }
    } catch (e) {
      console.warn(`    ⚠ detalhe falhou …${url.slice(-42)}: ${e.message}`);
    }
    await sleep(1200 + Math.floor(Math.random() * 1200));
  }

  if (bases.length === 0) {
    console.error("✗ Nenhum anúncio raspado do SP Imóvel. Banco NÃO foi alterado.");
    process.exit(0);
  }

  const pm2De = pm2PorBairro(bases);
  const inputs = bases.map((b) => ({
    bairro: b.bairro,
    cidade: b.cidade,
    uf: b.uf,
    tipo: b.tipo,
    transacao: b.transacao,
    area: b.area,
    quartos: b.quartos,
    vagas: b.vagas,
    precoEstimadoMercado: Math.round(pm2De(b.bairro) * b.area / 1000) * 1000,
    portal: PORTAL,
    portalListingId: b.idNum,
    idPrefix: ID_PREFIX,
    fonte: FONTE,
    url: b.anuncioUrl,
    anuncianteTipo: "imobiliaria",
    fotos: b.fotos,
    // SP Imóvel não tem datePosted → firstSeen = now (T0)
    firstSeen: new Date(),
    price: b.precoAtual,
  }));

  console.log(`\n💾 Upserting ${inputs.length} leads no banco...`);
  await upsertMany(db, inputs);
}

main().catch((err) => {
  console.error("✗ Erro fatal no scraper SP Imóvel:", err);
  process.exit(1);
});
