"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { LeadStatus } from "@/lib/types";
import { statusLabel } from "@/lib/format";

interface Props {
  id: string;
  statusInicial: LeadStatus;
  temBanco: boolean;
}

const TODOS_STATUS: LeadStatus[] = ["novo", "contatado", "negociando", "descartado", "vendido"];

const selectedStyle: Record<LeadStatus, string> = {
  novo: "bg-zinc-200 text-zinc-800 ring-2 ring-zinc-400 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-400",
  contatado: "bg-blue-100 text-blue-800 ring-2 ring-blue-400 dark:bg-blue-900 dark:text-blue-100 dark:ring-blue-400",
  negociando: "bg-violet-100 text-violet-800 ring-2 ring-violet-400 dark:bg-violet-900 dark:text-violet-100 dark:ring-violet-400",
  descartado: "bg-zinc-100 text-zinc-500 ring-2 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-500",
  vendido: "bg-green-100 text-green-800 ring-2 ring-green-400 dark:bg-green-900 dark:text-green-100 dark:ring-green-400",
};

const idleStyle =
  "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800";

export default function StatusControl({ id, statusInicial, temBanco }: Props) {
  const router = useRouter();
  const [statusLocal, setStatusLocal] = useState<LeadStatus>(statusInicial);
  const [isPending, startTransition] = useTransition();

  async function marcar(status: LeadStatus) {
    if (status === statusLocal) return;
    setStatusLocal(status); // optimistic update imediato
    startTransition(async () => {
      try {
        const res = await fetch(`/api/lead/${id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          router.refresh(); // sincroniza o resto da página (LeadCard, etc.)
        } else {
          setStatusLocal(statusInicial); // reverte se falhou
        }
      } catch {
        setStatusLocal(statusInicial);
      }
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      title={!temBanco ? "Requer banco de dados (NEON_POSTGRES_CONNECTION_STRING)" : undefined}
    >
      {TODOS_STATUS.map((s) => {
        const isSelected = s === statusLocal;
        return (
          <button
            key={s}
            type="button"
            disabled={isPending || !temBanco}
            onClick={() => marcar(s)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelected ? selectedStyle[s] : idleStyle
            }`}
          >
            {statusLabel[s]}
          </button>
        );
      })}
    </div>
  );
}
