import fs from "fs";
import path from "path";
import type { FiltrosBusca, Lead, LeadComScore } from "./types";
import { avaliarLead } from "./score";

// Carrega o cache de leads (scrape-once do OLX → JSON, ou gerado sinteticamente)
// e filtra ao vivo pelos filtros do corretor. Para o corretor isso é idêntico a
// "raspar a região na hora", mas roda sobre dado cacheado → zero risco no demo.

let cache: Lead[] | null = null;

function carregar(): Lead[] {
  if (cache) return cache;
  const arquivo = path.join(process.cwd(), "data", "leads.json");
  try {
    cache = JSON.parse(fs.readFileSync(arquivo, "utf-8")) as Lead[];
  } catch {
    cache = [];
  }
  return cache;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

export function buscarLeads(filtros: FiltrosBusca = {}): LeadComScore[] {
  const leads = carregar().filter((l) => {
    if (filtros.cidade && norm(l.cidade) !== norm(filtros.cidade)) return false;
    if (filtros.bairros?.length && !filtros.bairros.some((b) => norm(l.bairro).includes(norm(b))))
      return false;
    if (filtros.transacao && l.transacao !== filtros.transacao) return false;
    if (filtros.tipo && l.tipo !== filtros.tipo) return false;
    if (filtros.precoMin != null && l.precoAtual < filtros.precoMin) return false;
    if (filtros.precoMax != null && l.precoAtual > filtros.precoMax) return false;
    return true;
  });

  return leads
    .map((l) => ({ ...l, avaliacao: avaliarLead(l) }))
    .sort((a, b) => b.avaliacao.score - a.avaliacao.score);
}

export function buscarLeadPorId(id: string): LeadComScore | null {
  const lead = carregar().find((l) => l.id === id);
  return lead ? { ...lead, avaliacao: avaliarLead(lead) } : null;
}

/** Cidades e bairros presentes no cache — alimenta os filtros da UI. */
export function facetas(): { cidades: string[]; bairrosPorCidade: Record<string, string[]> } {
  const leads = carregar();
  const cidades = [...new Set(leads.map((l) => l.cidade))].sort();
  const bairrosPorCidade: Record<string, string[]> = {};
  for (const l of leads) {
    if (!bairrosPorCidade[l.cidade]) bairrosPorCidade[l.cidade] = [];
    if (!bairrosPorCidade[l.cidade].includes(l.bairro))
      bairrosPorCidade[l.cidade].push(l.bairro);
  }
  for (const c of cidades) bairrosPorCidade[c].sort();
  // chave "" = todos os bairros (sem filtro de cidade)
  bairrosPorCidade[""] = [...new Set(leads.map((l) => l.bairro))].sort();
  return { cidades, bairrosPorCidade };
}
