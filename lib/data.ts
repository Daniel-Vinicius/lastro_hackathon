import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import type { FiltrosBusca, Lead, LeadComScore } from "./types";
import { avaliarLead } from "./score";
import { db, hasDb } from "./db/index";
import { leadStatus, listings, priceObservations, properties } from "./db/schema";

let cache: Promise<Lead[]> | null = null;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

/** Invalida o cache — chamado após gravar status para a próxima busca refletir. */
export function invalidarCache(): void {
  cache = null;
}

async function carregarDoDb(): Promise<Lead[]> {
  if (!db) return [];

  const now = new Date();

  const [props, listingsRows, obsRows, statusRows] = await Promise.all([
    db.select().from(properties),
    db.select().from(listings),
    db.select().from(priceObservations),
    db.select().from(leadStatus),
  ]);

  // Indexa listings e observações por property_id / listing_id
  const listingsByProperty = new Map<string, typeof listingsRows>();
  for (const l of listingsRows) {
    const arr = listingsByProperty.get(l.propertyId) ?? [];
    arr.push(l);
    listingsByProperty.set(l.propertyId, arr);
  }

  const obsByListing = new Map<string, typeof obsRows>();
  for (const o of obsRows) {
    const arr = obsByListing.get(o.listingId) ?? [];
    arr.push(o);
    obsByListing.set(o.listingId, arr);
  }

  const statusByProperty = new Map<string, string>();
  for (const s of statusRows) {
    statusByProperty.set(s.propertyId, s.status);
  }

  const leads: Lead[] = [];

  for (const prop of props) {
    const propListings = (listingsByProperty.get(prop.id) ?? []).filter(
      (l) => l.active,
    );

    // Coleta todas as observações (todos os listings da property), ordena asc
    const allObs = propListings.flatMap((l) => obsByListing.get(l.id) ?? []);
    allObs.sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());

    if (allObs.length === 0) continue;

    const precoAtual = allObs[allObs.length - 1].price;

    const historicoPreco = allObs.map((o) => ({
      data: o.observedAt.toISOString().slice(0, 10),
      valor: o.price,
    }));

    const diasNoAnuncio = Math.floor(
      (now.getTime() - prop.firstSeen.getTime()) / 86_400_000,
    );

    // Portais distintos entre listings ativos → alimenta pulverização
    const portais = [...new Set(propListings.map((l) => l.portal))];

    const particularListing = propListings.find(
      (l) => l.anuncianteTipo === "particular",
    );

    const anunciantes = [
      ...new Set(
        propListings
          .filter((l) => l.anuncianteTipo === "imobiliaria" && l.anuncianteNome)
          .map((l) => l.anuncianteNome!),
      ),
    ];

    const mainListing = particularListing ?? propListings[0];

    leads.push({
      id: prop.id,
      proprietario: particularListing?.proprietario ?? undefined,
      telefone: particularListing?.telefone ?? undefined,
      bairro: prop.bairro,
      cidade: prop.cidade,
      uf: prop.uf,
      tipo: prop.tipo as Lead["tipo"],
      transacao: prop.transacao as Lead["transacao"],
      area: prop.area,
      quartos: prop.quartos,
      vagas: prop.vagas,
      precoAtual,
      historicoPreco,
      diasNoAnuncio,
      portais,
      anunciante: "particular",
      precoEstimadoMercado: prop.precoEstimadoMercado,
      fotos: (mainListing?.fotos as string[]) ?? [],
      fonte: (mainListing?.fonte ?? "sintetico") as Lead["fonte"],
      anuncioUrl: mainListing?.url ?? undefined,
      anunciantes,
      temContatoDireto: Boolean(particularListing),
      status: (statusByProperty.get(prop.id) ?? "novo") as Lead["status"],
    });
  }

  return leads;
}

function carregarDoJson(): Lead[] {
  const arquivo = path.join(process.cwd(), "data", "leads.json");
  try {
    const raw = JSON.parse(fs.readFileSync(arquivo, "utf-8")) as Lead[];
    // Garante campos novos ausentes no JSON legado
    return raw.map((l) => ({
      ...l,
      anunciantes: (l as { anunciantes?: string[] }).anunciantes ?? [],
      temContatoDireto: (l as { temContatoDireto?: boolean }).temContatoDireto ?? true,
      status: (l as { status?: Lead["status"] }).status ?? "novo",
    }));
  } catch {
    return [];
  }
}

function carregar(): Promise<Lead[]> {
  if (cache) return cache;
  cache = hasDb ? carregarDoDb() : Promise.resolve(carregarDoJson());
  return cache;
}

export async function buscarLeads(filtros: FiltrosBusca = {}): Promise<LeadComScore[]> {
  const todos = await carregar();

  const filtrados = todos.filter((l) => {
    if (filtros.cidade && norm(l.cidade) !== norm(filtros.cidade)) return false;
    if (
      filtros.bairros?.length &&
      !filtros.bairros.some((b) => norm(l.bairro).includes(norm(b)))
    )
      return false;
    if (filtros.transacao && l.transacao !== filtros.transacao) return false;
    if (filtros.tipo && l.tipo !== filtros.tipo) return false;
    if (filtros.precoMin != null && l.precoAtual < filtros.precoMin) return false;
    if (filtros.precoMax != null && l.precoAtual > filtros.precoMax) return false;
    // Filtro por portal
    if (filtros.portais?.length && !filtros.portais.some((p) => l.portais.includes(p)))
      return false;
    // Filtro por status (padrão: esconde descartado/vendido)
    const statusAtivos: string[] = filtros.statusFiltro?.length
      ? filtros.statusFiltro
      : ["novo", "contatado", "negociando"];
    if (!statusAtivos.includes(l.status)) return false;
    return true;
  });

  return filtrados
    .map((l) => ({ ...l, avaliacao: avaliarLead(l) }))
    .sort((a, b) => b.avaliacao.score - a.avaliacao.score);
}

export async function buscarLeadPorId(id: string): Promise<LeadComScore | null> {
  // Se o cache já está quente, usa ele sem ir ao banco
  if (cache) {
    const todos = await cache;
    const lead = todos.find((l) => l.id === id);
    return lead ? { ...lead, avaliacao: avaliarLead(lead) } : null;
  }

  // Sem cache: carrega tudo (preenche o cache para chamadas subsequentes)
  if (hasDb && db) {
    const [prop] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);
    if (!prop) return null;
  }

  const todos = await carregar();
  const lead = todos.find((l) => l.id === id);
  return lead ? { ...lead, avaliacao: avaliarLead(lead) } : null;
}

/** Cidades e bairros presentes — alimenta os filtros da UI. */
export async function facetas(): Promise<{
  cidades: string[];
  bairrosPorCidade: Record<string, string[]>;
}> {
  const todos = await carregar();
  const cidades = [...new Set(todos.map((l) => l.cidade))].sort();
  const bairrosPorCidade: Record<string, string[]> = {};
  for (const l of todos) {
    if (!bairrosPorCidade[l.cidade]) bairrosPorCidade[l.cidade] = [];
    if (!bairrosPorCidade[l.cidade].includes(l.bairro))
      bairrosPorCidade[l.cidade].push(l.bairro);
  }
  for (const c of cidades) bairrosPorCidade[c].sort();
  // chave "" = todos os bairros (sem filtro de cidade)
  bairrosPorCidade[""] = [...new Set(todos.map((l) => l.bairro))].sort();
  return { cidades, bairrosPorCidade };
}
