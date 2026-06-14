import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const properties = pgTable("properties", {
  id: text("id").primaryKey(),
  fingerprint: text("fingerprint"),
  bairro: text("bairro").notNull(),
  cidade: text("cidade").notNull(),
  uf: text("uf").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  tipo: text("tipo").notNull(),
  transacao: text("transacao").notNull(),
  area: integer("area").notNull(),
  quartos: integer("quartos").notNull(),
  vagas: integer("vagas").notNull(),
  precoEstimadoMercado: integer("preco_estimado_mercado").notNull(),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
});

export const listings = pgTable(
  "listings",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id),
    portal: text("portal").notNull(),
    portalListingId: text("portal_listing_id").notNull(),
    url: text("url"),
    anuncianteTipo: text("anunciante_tipo").notNull(), // 'imobiliaria' | 'particular'
    anuncianteNome: text("anunciante_nome"),
    proprietario: text("proprietario"),
    telefone: text("telefone"),
    fotos: jsonb("fotos").$type<string[]>().notNull().default([]),
    fonte: text("fonte").notNull(),
    active: boolean("active").notNull().default(true),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
  },
  (t) => [unique().on(t.portal, t.portalListingId)],
);

export const priceObservations = pgTable("price_observations", {
  id: serial("id").primaryKey(),
  listingId: text("listing_id")
    .notNull()
    .references(() => listings.id),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  price: integer("price").notNull(),
});

export const leadStatus = pgTable("lead_status", {
  propertyId: text("property_id")
    .primaryKey()
    .references(() => properties.id),
  status: text("status").notNull().default("novo"),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
