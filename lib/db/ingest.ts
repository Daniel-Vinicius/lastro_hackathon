import { and, desc, eq } from "drizzle-orm";
import * as schema from "./schema";

// Tipo do db inferido de lib/db/index.ts (import de tipo — não executa o módulo)
import type { db as DbRef } from "./index";
type Db = NonNullable<typeof DbRef>;

export type IngestInput = {
  // Imóvel (property)
  bairro: string;
  cidade: string;
  uf: string;
  tipo: string;
  transacao: string;
  area: number;
  quartos: number;
  vagas: number;
  precoEstimadoMercado: number;
  lat?: number;
  lng?: number;
  // Listing
  portal: string;
  portalListingId: string;
  idPrefix: string; // "cnm" | "spi" | "olx"
  fonte: string;
  url?: string;
  anuncianteTipo: "imobiliaria" | "particular";
  anuncianteNome?: string;
  proprietario?: string;
  telefone?: string;
  fotos: string[];
  // Temporal
  firstSeen: Date;
  price: number;
  /** Observações históricas de preço (mais antigas), inseridas apenas no primeiro ingest. */
  extraObservations?: { observedAt: Date; price: number }[];
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

/** Fingerprint para dedup cross-portal: tipo|transacao|norm(bairro)|area|quartos */
export function computeFingerprint(
  input: Pick<IngestInput, "tipo" | "transacao" | "bairro" | "area" | "quartos">,
): string {
  return `${input.tipo}|${input.transacao}|${norm(input.bairro)}|${input.area}|${input.quartos}`;
}

export type UpsertResult = {
  propertyId: string;
  /** Property foi criada (true) vs. encontrada por listing ou fingerprint (false). */
  propertyIsNew: boolean;
  /** Listing foi criado (true) vs. atualizado (false). */
  listingIsNew: boolean;
};

/**
 * Upsert de um listing + property de forma idempotente:
 * - Listing existe por (portal, portalListingId) → atualiza metadata, appenda preço se mudou.
 * - Senão, property existe por fingerprint → merge cross-portal, cria listing novo.
 * - Nada existe → cria property + listing novos com 1ª observação de preço.
 */
export async function upsertOne(db: Db, input: IngestInput): Promise<UpsertResult> {
  const now = new Date();
  const listingId = `${input.idPrefix}-${input.portalListingId}`;

  // 1. Listing já existe?
  const [existingListing] = await db
    .select({ id: schema.listings.id, propertyId: schema.listings.propertyId })
    .from(schema.listings)
    .where(
      and(
        eq(schema.listings.portal, input.portal),
        eq(schema.listings.portalListingId, input.portalListingId),
      ),
    )
    .limit(1);

  let propertyId: string;
  let propertyIsNew = false;
  const listingIsNew = !existingListing;

  if (existingListing) {
    propertyId = existingListing.propertyId;
    await db
      .update(schema.listings)
      .set({
        lastSeen: now,
        url: input.url ?? null,
        anuncianteTipo: input.anuncianteTipo,
        anuncianteNome: input.anuncianteNome ?? null,
        fotos: input.fotos,
        active: true,
      })
      .where(eq(schema.listings.id, existingListing.id));
    await db
      .update(schema.properties)
      .set({ lastSeen: now })
      .where(eq(schema.properties.id, propertyId));
  } else {
    // 2. Property existe por fingerprint? (dedup cross-portal)
    const fingerprint = computeFingerprint(input);
    const [existingProp] = await db
      .select({ id: schema.properties.id, firstSeen: schema.properties.firstSeen })
      .from(schema.properties)
      .where(eq(schema.properties.fingerprint, fingerprint))
      .limit(1);

    if (existingProp) {
      propertyId = existingProp.id;
      const newFirstSeen =
        input.firstSeen < existingProp.firstSeen ? input.firstSeen : existingProp.firstSeen;
      await db
        .update(schema.properties)
        .set({ lastSeen: now, firstSeen: newFirstSeen })
        .where(eq(schema.properties.id, propertyId));
    } else {
      propertyId = listingId;
      propertyIsNew = true;
      await db.insert(schema.properties).values({
        id: propertyId,
        fingerprint,
        bairro: input.bairro,
        cidade: input.cidade,
        uf: input.uf,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        tipo: input.tipo,
        transacao: input.transacao,
        area: input.area,
        quartos: input.quartos,
        vagas: input.vagas,
        precoEstimadoMercado: input.precoEstimadoMercado,
        firstSeen: input.firstSeen,
        lastSeen: now,
      });
    }

    await db.insert(schema.listings).values({
      id: listingId,
      propertyId,
      portal: input.portal,
      portalListingId: input.portalListingId,
      url: input.url ?? null,
      anuncianteTipo: input.anuncianteTipo,
      anuncianteNome: input.anuncianteNome ?? null,
      proprietario: input.proprietario ?? null,
      telefone: input.telefone ?? null,
      fotos: input.fotos,
      fonte: input.fonte,
      active: true,
      firstSeen: input.firstSeen,
      lastSeen: now,
    });
  }

  const effectiveListingId = existingListing?.id ?? listingId;

  // 3. Observações de preço
  if (!existingListing) {
    // Novo listing: insere histórico extra (obs. mais antigas) e depois o preço atual
    if (input.extraObservations?.length) {
      for (const obs of input.extraObservations) {
        await db.insert(schema.priceObservations).values({
          listingId: effectiveListingId,
          observedAt: obs.observedAt,
          price: obs.price,
        });
      }
    }
    await db.insert(schema.priceObservations).values({
      listingId: effectiveListingId,
      observedAt: now,
      price: input.price,
    });
  } else {
    // Reingest: append apenas se o preço mudou desde a última observação
    const [lastObs] = await db
      .select({ price: schema.priceObservations.price })
      .from(schema.priceObservations)
      .where(eq(schema.priceObservations.listingId, effectiveListingId))
      .orderBy(desc(schema.priceObservations.observedAt))
      .limit(1);
    if (!lastObs || lastObs.price !== input.price) {
      await db.insert(schema.priceObservations).values({
        listingId: effectiveListingId,
        observedAt: now,
        price: input.price,
      });
    }
  }

  return { propertyId, propertyIsNew, listingIsNew };
}

/** Upsert em lote. Recebe o db já resolvido (caller faz loadEnvConfig + import dinâmico). */
export async function upsertMany(db: Db, inputs: IngestInput[]): Promise<void> {
  let propertyCreated = 0;
  let crossPortalMerged = 0;
  let updated = 0;

  for (const input of inputs) {
    const { propertyIsNew, listingIsNew } = await upsertOne(db, input);
    if (propertyIsNew) propertyCreated++;
    else if (listingIsNew) crossPortalMerged++;
    else updated++;
  }

  console.log(
    `✅ Upsert: ${propertyCreated} properties novas, ${crossPortalMerged} cross-portal fundidas, ${updated} atualizadas — ${inputs.length} listings processados`,
  );
}
