import type { NextRequest } from "next/server";
import { buscarLeads, facetas } from "@/lib/data";
import type { FiltrosBusca } from "@/lib/types";

export const runtime = "nodejs";

const str = (v: string | null): string | undefined =>
  v?.trim() || undefined;

const num = (v: string | null): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && v !== null && v !== "" ? n : undefined;
};

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const filtros: FiltrosBusca = {
    cidade: str(sp.get("cidade")),
    bairro: str(sp.get("bairro")),
    transacao: str(sp.get("transacao")) as FiltrosBusca["transacao"],
    tipo: str(sp.get("tipo")) as FiltrosBusca["tipo"],
    precoMin: num(sp.get("precoMin")),
    precoMax: num(sp.get("precoMax")),
  };

  const leads = buscarLeads(filtros);
  const facetasData = facetas();

  return Response.json({ leads, facetas: facetasData });
}
