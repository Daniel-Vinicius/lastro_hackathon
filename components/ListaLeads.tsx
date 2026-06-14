import type { LeadComScore } from "@/lib/types";
import LeadCard from "./LeadCard";

interface Props {
  leads: LeadComScore[];
  carregando: boolean;
  erro: string | null;
}

function Skeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 pl-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-24 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="h-7 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="mt-3 h-4 w-36 rounded bg-zinc-100 dark:bg-zinc-800" />
      <div className="mt-2 h-6 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

export default function ListaLeads({ leads, carregando, erro }: Props) {
  if (erro) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        {erro}
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="font-medium text-zinc-700 dark:text-zinc-300">
          Nenhum lead encontrado para esses filtros.
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Tente ampliar a busca removendo alguns critérios.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {leads.map((lead) => (
        <li key={lead.id}>
          <LeadCard lead={lead} />
        </li>
      ))}
    </ol>
  );
}
