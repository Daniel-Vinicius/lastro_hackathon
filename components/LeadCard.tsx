import Link from "next/link";
import type { LeadComScore } from "@/lib/types";
import { brl, area, tipoLabel, tierRail } from "@/lib/format";
import ScoreBadge from "./ScoreBadge";

interface Props {
  lead: LeadComScore;
}

export default function LeadCard({ lead }: Props) {
  const { avaliacao } = lead;
  return (
    <Link
      href={`/lead/${lead.id}`}
      className="group relative flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 pl-6 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      {/* Trilho de prioridade */}
      <span
        className={`absolute left-0 top-0 h-full w-1.5 rounded-l-xl ${tierRail[avaliacao.tier]}`}
      />

      {/* Linha topo: tipo/bairro + badge */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
            {tipoLabel[lead.tipo]} · {lead.bairro}
          </p>
          <p className="text-sm text-zinc-500">
            {lead.cidade}/{lead.uf}
          </p>
        </div>
        <ScoreBadge score={avaliacao.score} tier={avaliacao.tier} />
      </div>

      {/* Meta */}
      <p className="text-sm text-zinc-500">
        {area(lead.area)} · {lead.quartos} quarto{lead.quartos !== 1 ? "s" : ""}{" "}
        · {lead.vagas} vaga{lead.vagas !== 1 ? "s" : ""}
      </p>

      {/* Preço */}
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {brl(lead.precoAtual)}
      </p>

      {/* Razões (sinais principais) */}
      {avaliacao.principaisRazoes.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {avaliacao.principaisRazoes.map((razao, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
              {razao}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
