import type { NextRequest } from "next/server";
import { buscarLeadPorId } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lead = await buscarLeadPorId(id);

  if (!lead) {
    return Response.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  return Response.json(lead);
}
