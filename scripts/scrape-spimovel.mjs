// Scrape-once do SP Imóvel → funde leads REAIS em data/leads.json.
// Rodável com: node scripts/scrape-spimovel.mjs
//
// Diferente do Chaves na Mão, o SP Imóvel mascara o preço na busca (slug "rs1" =
// R$1). Então: a BUSCA dá só a lista de URLs (via ItemList ld+json) e o slug
// (tipo/quartos/vagas/área/bairro); o PREÇO real e as FOTOS reais vêm da página de
// DETALHE (preço no HTML `valor-historico`; fotos no ld+json Apartment.image[]).
//
// REAL: id, anuncioUrl, precoAtual, tipo, area, quartos, vagas, bairro, fotos (galeria).
// DERIVADO/ENRIQUECIDO: ver _scrape-utils. PORTAIS: só "SP Imóvel". Idempotente.

import {
  fetchHtml, parseLdJson, enriquecer, pm2PorBairro, heatByGap, mergeAndWrite,
  TIPOS_VALIDOS, sleep,
} from "./_scrape-utils.mjs";

const FONTE = "spimovel-real";
const MAX_REAIS = 15;

// Busca de apartamentos à venda em SP (FinalidadeId=1 venda; OrderByOption=7).
const SEARCHES = [
  "https://www.spimovel.com.br/imoveis/?FinalidadeId=1&CategoriaId=1&TipoIds=2&OrderByOption=7",
];

// Lista de URLs de anúncio (bloco ItemList do ld+json da busca).
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
  return null; // sala/galpao/terreno/predio → descarta
}

// Bairro acentuado: último item do BreadcrumbList (ex.: "Alto de Pinheiros", "Brás").
// Fallback no bairro derivado do slug (sem acento) se o breadcrumb faltar/for genérico.
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

// Slug ex.: apartamento-venda-rs1-4quartos-4vagas-327m2-alto-de-pinheiros-sao-paulo-sao-paulo-sp
function parseSlug(url) {
  // remove o segmento "/{id}/" final antes de parsear (senão a cidade gruda no bairro)
  const slug = (url.split("/imovel/")[1] || "").replace(/\/\d+\/?$/, "").toLowerCase();
  const idNum = (url.match(/\/(\d+)\/?$/) || [])[1];
  const quartos = Number((slug.match(/(\d+)quartos?/) || [])[1]) || 0;
  const vagas = Number((slug.match(/(\d+)vagas?/) || [])[1]) || 0;
  const areaSlug = Number((slug.match(/(\d+)m2/) || [])[1]) || 0;
  const transacao = /-locacao-|-aluguel-/.test(slug) ? "aluguel" : "venda";
  // bairro: o que está entre "{area}m2-" e o sufixo "{cidade}-{estado}-{uf}".
  let rest = slug.split(/\d+m2-/)[1] || "";
  if (/-sao-paulo-sao-paulo-sp$/.test(rest)) rest = rest.replace(/-sao-paulo-sao-paulo-sp$/, "");
  else rest = rest.split("-").slice(0, -3).join("-"); // remove cidade-estado-uf genéricos
  const bairro = rest ? titleCase(rest.replace(/-/g, " ")) : "São Paulo";
  return { idNum, quartos, vagas, areaSlug, transacao, bairro, slug };
}

// Preço real: primeiro <div class="valor-historico">R$ X</div> com valor plausível.
function precoDetalhe(html) {
  const vals = [...html.matchAll(/valor-historico[^>]*>\s*R\$\s*([\d.]+)/g)]
    .map((m) => parseInt(m[1].replace(/\./g, ""), 10));
  return vals.find((v) => v > 10000) || 0;
}

// Bloco ld+json do imóvel (pode vir como @type ["Product","Apartment"]).
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
  // 1) URLs de anúncio das buscas
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

  // 2) detalhe por anúncio (preço + fotos reais) até MAX_REAIS
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
        const bairro = bairroDetalhe(html, meta.bairro); // acentuado via breadcrumb
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
    console.error("✗ Nenhum anúncio raspado do SP Imóvel (bloqueio/preços mascarados). leads.json NÃO foi alterado.");
    process.exit(0);
  }

  const pm2De = pm2PorBairro(bases);
  const heat = heatByGap(bases, pm2De);
  const reais = bases.map((b) =>
    enriquecer(b, {
      heat: heat.get(b.idNum),
      pm2Bairro: pm2De(b.bairro),
      fonte: FONTE,
      portalReal: "SP Imóvel",
      idPrefix: "spi",
    }),
  );

  mergeAndWrite(reais, FONTE);
}

main().catch((err) => {
  console.error("✗ Erro fatal no scraper:", err);
  process.exit(1);
});
