// Limpa todas as tabelas (ordem FK-safe). NÃO repopula — a população honesta vem
// dos scrapers reais (scrape:cnm / scrape:spi) + ingest:olx. Use antes de um
// re-scrape limpo quando quiser garantir que não há resíduo fabricado no banco.
//
// Uso: npm run db:reset
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

const { db } = await import("../lib/db/index.js");
const schema = await import("../lib/db/schema.js");

if (!db) {
  console.error("❌ NEON_POSTGRES_CONNECTION_STRING não definida.");
  process.exit(1);
}

// Filhos antes dos pais
await db.delete(schema.priceObservations);
await db.delete(schema.listings);
await db.delete(schema.leadStatus);
await db.delete(schema.properties);

console.log("🗑️  Banco limpo (properties, listings, price_observations, lead_status).");
console.log("   Para repopular: npm run scrape:cnm && npm run scrape:spi && npm run ingest:olx");
process.exit(0);
