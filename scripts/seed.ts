import { loadEnvConfig } from "@next/env";
import path from "path";
import fs from "fs";

// Carrega .env ANTES de importar lib/db.
loadEnvConfig(process.cwd());

async function main() {
  // Import dinâmico após o loadEnvConfig para que a env já esteja disponível
  // quando lib/db/index.ts for avaliado.
  const { db } = await import("../lib/db/index.js");
  const schema = await import("../lib/db/schema.js");

  if (!db) {
    console.error(
      "❌ NEON_POSTGRES_CONNECTION_STRING não definida. Adicione ao .env e tente novamente.",
    );
    process.exit(1);
  }

  // Lê os 30 leads reais do JSON (fonte do seed)
  const leadsPath = path.join(process.cwd(), "data", "leads.json");
  const leads = JSON.parse(fs.readFileSync(leadsPath, "utf-8")) as Array<{
    id: string;
    proprietario: string;
    telefone: string;
    bairro: string;
    cidade: string;
    uf: string;
    tipo: string;
    transacao: string;
    area: number;
    quartos: number;
    vagas: number;
    precoAtual: number;
    historicoPreco: Array<{ data: string; valor: number }>;
    diasNoAnuncio: number;
    portais: string[];
    precoEstimadoMercado: number;
    fotos: string[];
    fonte: string;
    anuncioUrl?: string;
  }>;

  // Época fixa — todos os rows compartilham o mesmo ponto de referência
  const seedNow = new Date();

  console.log(
    `🌱 Seed iniciado — ${leads.length} leads, epoch: ${seedNow.toISOString()}`,
  );

  // Idempotente: limpa em ordem FK-safe (filhos antes dos pais)
  await db.delete(schema.priceObservations);
  await db.delete(schema.listings);
  await db.delete(schema.leadStatus);
  await db.delete(schema.properties);
  console.log("🗑️  Tabelas limpas");

  for (const lead of leads) {
    const firstSeen = new Date(
      seedNow.getTime() - lead.diasNoAnuncio * 86_400_000,
    );
    const portal = lead.portais[0] ?? "desconhecido";
    // portal_listing_id: parte numérica do id (ex: "cnm-42593585" → "42593585")
    const portalListingId = lead.id.split("-").pop() ?? lead.id;

    await db.insert(schema.properties).values({
      id: lead.id,
      fingerprint: null,
      bairro: lead.bairro,
      cidade: lead.cidade,
      uf: lead.uf,
      lat: null,
      lng: null,
      tipo: lead.tipo,
      transacao: lead.transacao,
      area: lead.area,
      quartos: lead.quartos,
      vagas: lead.vagas,
      precoEstimadoMercado: lead.precoEstimadoMercado,
      firstSeen,
      lastSeen: seedNow,
    });

    const listingId = `${lead.id}-listing`;
    await db.insert(schema.listings).values({
      id: listingId,
      propertyId: lead.id,
      portal,
      portalListingId,
      url: lead.anuncioUrl ?? null,
      anuncianteTipo: "particular",
      anuncianteNome: null,
      proprietario: lead.proprietario,
      telefone: lead.telefone,
      fotos: lead.fotos,
      fonte: lead.fonte,
      active: true,
      firstSeen,
      lastSeen: seedNow,
    });

    // 1 observação por listing — reduções começam em 0 (Bloco G acumula ao longo do tempo)
    await db.insert(schema.priceObservations).values({
      listingId,
      observedAt: seedNow,
      price: lead.precoAtual,
    });
  }

  console.log(
    `✅ Seed concluído — ${leads.length} properties, ${leads.length} listings, ${leads.length} price_observations`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
