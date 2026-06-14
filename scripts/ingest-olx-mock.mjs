// Ingest do mock OLX → upsert no Neon via lib/db/ingest.
// Rodável com: npm run ingest:olx (ou: npx tsx scripts/ingest-olx-mock.mjs)
//
// Lê data/olx-mock.json (5 imóveis particulares com contato real):
//  - 3 bridges: fingerprint cruza com leads existentes → funde na property da imobiliária
//    → ficha ganha contato direto do dono + histórico de preço extra (queda demonstrada).
//  - 2 FSBOs isolados: properties novas (owner-only).
//
// HONESTO: rotulado como "olx-mock" em fonte; OLX bloqueia scrape real (403 + captcha).

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

async function main() {
  const { db, hasDb } = await import("../lib/db/index.js");
  if (!hasDb || !db) {
    console.error("⚠ NEON_POSTGRES_CONNECTION_STRING não definida — ingest OLX abortado.");
    process.exit(0);
  }
  const { upsertMany } = await import("../lib/db/ingest.js");

  const mockPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/olx-mock.json");
  const raw = JSON.parse(fs.readFileSync(mockPath, "utf-8"));

  const inputs = raw.map((item) => ({
    bairro: item.bairro,
    cidade: item.cidade,
    uf: item.uf,
    tipo: item.tipo,
    transacao: item.transacao,
    area: item.area,
    quartos: item.quartos,
    vagas: item.vagas,
    precoEstimadoMercado: item.precoEstimadoMercado,
    portal: item.portal,
    portalListingId: item.portalListingId,
    idPrefix: item.idPrefix,
    fonte: item.fonte,
    url: item.url,
    anuncianteTipo: item.anuncianteTipo,
    anuncianteNome: item.anuncianteNome ?? undefined,
    proprietario: item.proprietario ?? undefined,
    telefone: item.telefone ?? undefined,
    fotos: item.fotos ?? [],
    firstSeen: new Date(item.firstSeen),
    price: item.price,
    extraObservations: (item.extraObservations ?? []).map((o) => ({
      observedAt: new Date(o.observedAt),
      price: o.price,
    })),
  }));

  console.log(`📦 Ingestando ${inputs.length} leads OLX mock...`);
  await upsertMany(db, inputs);
  console.log("🔗 Bridges cross-portal: imóveis que cruzam com CNM/SP Imóvel revelam o dono.");
}

main().catch((err) => {
  console.error("✗ Erro fatal no ingest OLX:", err);
  process.exit(1);
});
