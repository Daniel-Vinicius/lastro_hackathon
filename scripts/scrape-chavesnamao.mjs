// Scrape do Chaves na Mão → upsert no Neon via lib/db/ingest.
// Rodável com: npm run scrape:cnm (ou: npx tsx scripts/scrape-chavesnamao.mjs)
//
// REAL (do anúncio): id, anuncioUrl, precoAtual, tipo, area, quartos, bairro,
// cidade/uf, 1 foto real, anuncianteNome (via offeredBy), lat/lng/cep do offer.
// REAL (da página de detalhe): datePosted → diasNoAnuncio real.
// DERIVADO: precoEstimadoMercado (mediana R$/m² do lote).
// SEM INVENTAR: sem proprietario/telefone fake, sem reduções fabricadas,
// sem portais inventados. anuncianteTipo = "imobiliaria".
//
// Fallback: se 403/bloqueio, loga e sai sem tocar no banco.

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import {
  fetchHtml, parseLdJson, pm2PorBairro, TIPOS_VALIDOS, sleep,
} from "./_scrape-utils.mjs";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

const FONTE = "chavesnamao-real";
const MAX_REAIS = 20;
const PORTAL = "Chaves na Mão";
const ID_PREFIX = "cnm";

const SEARCHES = [
  { url: "https://www.chavesnamao.com.br/imoveis-a-venda/sp-sao-paulo/", transacao: "venda" },
  { url: "https://www.chavesnamao.com.br/imoveis-a-venda/sp-sao-paulo/?pg=2", transacao: "venda" },
  { url: "https://www.chavesnamao.com.br/casas-a-venda/sp-sao-paulo/", transacao: "venda" },
  { url: "https://www.chavesnamao.com.br/apartamentos-a-venda/sp-sao-paulo/", transacao: "venda" },
];

function extrairOffers(html) {
  for (const d of parseLdJson(html)) {
    const items = d?.offers?.itemListElement;
    if (Array.isArray(items) && items.length) return items;
  }
  return [];
}

function tipoDe(url, name) {
  const slug = (url.split("/imovel/")[1] || "").toLowerCase();
  const nome = (name || "").toLowerCase();
  if (slug.startsWith("kitnet") || /\bstudio\b|\bloft\b|\bkitnet/.test(nome)) return "kitnet";
  if (slug.startsWith("cobertura") || nome.includes("cobertura")) return "cobertura";
  if (slug.startsWith("sobrado") || nome.includes("sobrado")) return "sobrado";
  if (slug.startsWith("casa")) return "casa";
  if (slug.startsWith("apartamento")) return "apartamento";
  return null;
}

function areaDe(ap) {
  const txt = ap?.floorSize?.unitText;
  if (!txt) return 0;
  const n = parseInt(String(txt).replace(/\./g, "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Lê datePosted da página de detalhe do anúncio (RealEstateListing). */
async function fetchDatePosted(url) {
  try {
    const html = await fetchHtml(url);
    for (const d of parseLdJson(html)) {
      // Pode vir em RealEstateListing ou Apartment
      const date = d?.datePosted ?? d?.offers?.datePosted;
      if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) return date;
    }
  } catch {
    // Ignora — usa firstSeen = now como fallback
  }
  return null;
}

async function main() {
  const { db, hasDb } = await import("../lib/db/index.js");
  if (!hasDb || !db) {
    console.error("⚠ NEON_POSTGRES_CONNECTION_STRING não definida — scraper CNM abortado (banco ausente).");
    process.exit(0);
  }
  const { upsertMany } = await import("../lib/db/ingest.js");

  const brutos = new Map(); // idNum → base (dedupe entre páginas)

  for (const { url, transacao } of SEARCHES) {
    if (brutos.size >= MAX_REAIS + 8) break;
    try {
      const offers = extrairOffers(await fetchHtml(url));
      let ok = 0;
      for (const off of offers) {
        const ap = off.itemOffered || off;
        const anuncioUrl = (off.url || ap.url || "").replace(/([^:])\/\//g, "$1/");
        const idNum = (anuncioUrl.match(/id-(\d+)/) || [])[1];
        const precoAtual = Number(off.price || 0);
        const tipo = tipoDe(anuncioUrl, off.name || ap.name);
        const area = areaDe(ap);
        const bairro = ap?.address?.addressLocality;
        const img = Array.isArray(ap?.image) ? ap.image[0] : ap?.image;

        if (!idNum || !tipo || !TIPOS_VALIDOS.has(tipo)) continue;
        if (!(precoAtual > 0) || !(area > 0) || !bairro || !img) continue;
        if (brutos.has(idNum)) continue;

        const [cidade, uf] = (ap?.address?.addressRegion || "").split(",").map((s) => s.trim());

        // Anunciante: offeredBy no offer ou fallback "imobiliária"
        const anuncianteNome = off.offeredBy?.name || off.seller?.name || null;

        // Geo e CEP (disponíveis no offer da busca)
        const lat = ap?.geo?.latitude ? Number(ap.geo.latitude) : null;
        const lng = ap?.geo?.longitude ? Number(ap.geo.longitude) : null;

        brutos.set(idNum, {
          idNum, anuncioUrl, precoAtual, tipo, area,
          quartos: Number(ap.numberOfBedrooms) || 0,
          bairro, cidade: cidade || "São Paulo", uf: uf || "SP",
          fotos: [img], transacao, anuncianteNome, lat, lng,
        });
        ok++;
      }
      console.log(`  ✓ ${ok} anúncios válidos de ${url}`);
    } catch (err) {
      console.warn(`  ⚠ pulando ${url}: ${err.message}`);
    }
    await sleep(1500 + Math.floor(Math.random() * 1500));
  }

  const bases = [...brutos.values()].slice(0, MAX_REAIS);
  if (bases.length === 0) {
    console.error("✗ Nenhum anúncio raspado (bloqueio/anti-bot?). Banco NÃO foi alterado.");
    process.exit(0);
  }

  const pm2De = pm2PorBairro(bases);

  // Fetch das páginas de detalhe para datePosted (real)
  console.log(`\n📄 Buscando datePosted de ${bases.length} anúncios...`);
  const inputs = [];
  for (const b of bases) {
    const datePosted = await fetchDatePosted(b.anuncioUrl);
    const firstSeen = datePosted ? new Date(datePosted + "T12:00:00Z") : new Date();
    const precoEstimadoMercado = Math.round(pm2De(b.bairro) * b.area / 1000) * 1000;

    inputs.push({
      // Imóvel
      bairro: b.bairro,
      cidade: b.cidade,
      uf: b.uf,
      tipo: b.tipo,
      transacao: b.transacao,
      area: b.area,
      quartos: b.quartos,
      vagas: 0, // CNM não expõe vagas de forma confiável na busca
      precoEstimadoMercado,
      lat: b.lat ?? undefined,
      lng: b.lng ?? undefined,
      // Listing
      portal: PORTAL,
      portalListingId: b.idNum,
      idPrefix: ID_PREFIX,
      fonte: FONTE,
      url: b.anuncioUrl,
      anuncianteTipo: "imobiliaria",
      anuncianteNome: b.anuncianteNome ?? undefined,
      fotos: b.fotos,
      // Temporal
      firstSeen,
      price: b.precoAtual,
    });
    await sleep(800 + Math.floor(Math.random() * 800));
  }

  console.log(`\n💾 Upserting ${inputs.length} leads no banco...`);
  await upsertMany(db, inputs);
}

main().catch((err) => {
  console.error("✗ Erro fatal no scraper CNM:", err);
  process.exit(1);
});
