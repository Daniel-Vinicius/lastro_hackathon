import type { NextRequest } from "next/server";
import { buscarLeadPorId } from "@/lib/data";
import { gerarBriefing } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.id) {
    return Response.json({ error: "id obrigatório" }, { status: 400 });
  }

  const lead = await buscarLeadPorId(body.id);
  if (!lead) {
    return Response.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const { briefing, fonte } = await gerarBriefing(lead);
  return Response.json({ briefing, fonte });
}
