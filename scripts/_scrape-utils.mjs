// Utilitários compartilhados pelos scrapers (Chaves na Mão, SP Imóvel).
// Cada scraper é responsável por: fetch + parse específicos do portal → "bases"
// (campos REAIS do anúncio) → upsert no banco via lib/db/ingest.
//
// Princípio: NÃO inventamos dado. Nenhum proprietário/telefone/redução/pulverização
// fabricada — só o que o portal expõe de fato. O único dado não-real do sistema vive
// em data/olx-mock.json (ingerido por scripts/ingest-olx-mock.mjs).

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function median(nums) {
  const a = [...nums].sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
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

export const TIPOS_VALIDOS = new Set(["apartamento", "casa", "cobertura", "kitnet", "sobrado"]);

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
