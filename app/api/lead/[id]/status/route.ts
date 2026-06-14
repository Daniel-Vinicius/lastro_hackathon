import type { NextRequest } from "next/server";
import { db, hasDb } from "@/lib/db/index";
import { leadStatus } from "@/lib/db/schema";
import { invalidarCache } from "@/lib/data";
import type { LeadStatus } from "@/lib/types";

export const runtime = "nodejs";

const STATUS_VALIDOS: LeadStatus[] = ["novo", "contatado", "negociando", "descartado", "vendido"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasDb || !db) {
    return Response.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status: LeadStatus = body?.status;
  const note: string | undefined = body?.note;

  if (!status || !STATUS_VALIDOS.includes(status)) {
    return Response.json(
      { error: `Status inválido. Use: ${STATUS_VALIDOS.join(", ")}` },
      { status: 400 },
    );
  }

  await db
    .insert(leadStatus)
    .values({ propertyId: id, status, note: note ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: leadStatus.propertyId,
      set: { status, note: note ?? null, updatedAt: new Date() },
    });

  invalidarCache();

  return Response.json({ ok: true, status });
}
