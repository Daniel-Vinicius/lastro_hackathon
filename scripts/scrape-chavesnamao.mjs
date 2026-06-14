// Scrape-once do Chaves na Mão → funde leads REAIS em data/leads.json.
// Rodável com: node scripts/scrape-chavesnamao.mjs
//
// REAL (do anúncio, JSON-LD da própria busca): id, anuncioUrl, precoAtual, tipo,
// area, quartos, bairro, cidade/uf, 1 foto real. DERIVADO: precoEstimadoMercado
// (mediana R$/m² do lote). ENRIQUECIDO (sintético, ver _scrape-utils): dias,
// reduções, historicoPreco, proprietario/telefone. PORTAIS: só "Chaves na Mão"
// (não inventamos pulverização em dado real).
//
// NOTA honesta: o Chaves na Mão é majoritariamente imobiliária, não FSBO. Marcamos
// anunciante "particular" p/ casar com o contrato; a procedência fica transparente
// via fonte:"chavesnamao-real" + anuncioUrl. Idempotente; não toca no JSON se nada raspar.

import {
  fetchHtml, parseLdJson, enriquecer, pm2PorBairro, heatByGap, mergeAndWrite,
  TIPOS_VALIDOS, sleep,
} from "./_scrape-utils.mjs";

const FONTE = "chavesnamao-real";
const MAX_REAIS = 20;

const SEARCHES = [
  { url: "https://www.chavesnamao.com.br/imoveis-a-venda/sp-sao-paulo/", transacao: "venda" },
  { url: "https://www.chavesnamao.com.br/imoveis-a-venda/sp-sao-paulo/?pg=2", transacao: "venda" },
  { url: "https://www.chavesnamao.com.br/casas-a-venda/sp-sao-paulo/", transacao: "venda" },
  { url: "https://www.chavesnamao.com.br/apartamentos-a-venda/sp-sao-paulo/", transacao: "venda" },
];

// A lista vive em RealEstateListing.offers.itemListElement[] (um dos blocos ld+json).
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
  return null; // predio/galpao/terreno/sala → descarta
}

function areaDe(ap) {
  const txt = ap?.floorSize?.unitText;
  if (!txt) return 0;
  const n = parseInt(String(txt).replace(/\./g, "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
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
        brutos.set(idNum, {
          idNum, anuncioUrl, precoAtual, tipo, area,
          quartos: Number(ap.numberOfBedrooms) || 0,
          temGaragem: /com-garagem/.test(anuncioUrl), // slug indica presença, não a contagem
          bairro, cidade: cidade || "São Paulo", uf: uf || "SP",
          fotos: [img], transacao,
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
    console.error("✗ Nenhum anúncio raspado (bloqueio/anti-bot?). leads.json NÃO foi alterado.");
    process.exit(0); // não-fatal: app segue no sintético
  }

  const pm2De = pm2PorBairro(bases);
  const heat = heatByGap(bases, pm2De);
  const reais = bases.map((b) =>
    enriquecer(b, {
      heat: heat.get(b.idNum),
      pm2Bairro: pm2De(b.bairro),
      fonte: FONTE,
      portalReal: "Chaves na Mão",
      idPrefix: "cnm",
    }),
  );

  mergeAndWrite(reais, FONTE);
}

main().catch((err) => {
  console.error("✗ Erro fatal no scraper:", err);
  process.exit(1);
});
