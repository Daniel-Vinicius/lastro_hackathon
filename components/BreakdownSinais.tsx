import type { ResultadoScore } from "@/lib/types";
import { intensidadeBar } from "@/lib/format";
import ScoreBadge from "./ScoreBadge";

interface Props {
  avaliacao: ResultadoScore;
}

export default function BreakdownSinais({ avaliacao }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Score de captabilidade
        </p>
        <ScoreBadge score={avaliacao.score} tier={avaliacao.tier} />
      </div>

      <ol className="flex flex-col gap-4">
        {avaliacao.sinais.map((sinal) => {
          const pct = sinal.maximo > 0 ? (sinal.pontos / sinal.maximo) * 100 : 0;
          return (
            <li key={sinal.chave}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {sinal.rotulo}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {sinal.pontos}/{sinal.maximo} pts
                </span>
              </div>

              {/* Barra de progresso */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all ${intensidadeBar[sinal.intensidade]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {sinal.detalhe}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
