// Exporta o estado HONESTO do banco para data/leads.json (fallback offline).
// O JSON resultante reflete o banco: leads reais (cnm/spi) sem dono/telefone/histórico
// fabricado + olx-mock (único dado não-real). Use após repopular o banco.
//
// Uso: npm run export:leads
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

const { buscarLeads } = await import("../lib/data.js");

// Todos os status (sem o filtro padrão que esconde descartado/vendido).
const leads = await buscarLeads({
  statusFiltro: ["novo", "contatado", "negociando", "descartado", "vendido"],
});

// Remove avaliacao (score é recomputado em runtime, nunca persistido).
const limpos = leads.map((lead) => {
  const copia = { ...lead };
  delete copia.avaliacao;
  return copia;
});

const arquivo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/leads.json",
);
fs.writeFileSync(arquivo, JSON.stringify(limpos, null, 2) + "\n", "utf-8");

const fontes = {};
for (const l of limpos) fontes[l.fonte] = (fontes[l.fonte] ?? 0) + 1;
console.log(`✓ ${limpos.length} leads exportados para data/leads.json`);
console.log("  por fonte:", JSON.stringify(fontes));
process.exit(0);
