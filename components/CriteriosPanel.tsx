"use client";

import { useMemo } from "react";
import { classificar, CORTES_PADRAO } from "@/lib/score";
import { useCortes } from "@/lib/useCortes";
import { tierLabel, tierRail } from "@/lib/format";
import type { Tier } from "@/lib/types";

interface Props {
  scores: number[];
}

const TIERS: Tier[] = ["quente", "morno", "frio"];

export default function CriteriosPanel({ scores }: Props) {
  const { cortes, setCortes, hidratado } = useCortes();

  const distribuicao = useMemo(() => {
    const contagem: Record<Tier, number> = { quente: 0, morno: 0, frio: 0 };
    for (const s of scores) contagem[classificar(s, cortes)]++;
    return contagem;
  }, [scores, cortes]);

  const total = scores.length || 1;

  // Valor exibido/controlado pelos sliders — usa o padrão até hidratar para
  // não dar mismatch de hidratação.
  const c = hidratado ? cortes : CORTES_PADRAO;

  function handleMorno(v: number) {
    // Morno fica sempre ao menos 1 abaixo de Quente.
    const morno = Math.max(0, Math.min(v, cortes.quente - 1));
    setCortes({ morno, quente: cortes.quente });
  }

  function handleQuente(v: number) {
    // Quente fica sempre ao menos 1 acima de Morno.
    const quente = Math.min(100, Math.max(v, cortes.morno + 1));
    setCortes({ morno: cortes.morno, quente });
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Cortes de tier
      </h2>
      <p className="mb-6 text-sm text-zinc-500">
        Arraste os cortes para ajustar o que é Frio, Morno e Quente. Persiste entre sessões.
      </p>

      <div className="mb-6 flex flex-col gap-5">
        {/* Corte morno (frio → morno) */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Corte Frio → Morno
            </label>
            <span className="tabular-nums text-sm font-semibold text-amber-600 dark:text-amber-400">
              {c.morno}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={c.quente - 1}
            value={c.morno}
            onChange={(e) => handleMorno(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-xs text-zinc-400">
            <span>0</span>
            <span>{c.quente - 1}</span>
          </div>
        </div>

        {/* Corte quente (morno → quente) */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Corte Morno → Quente
            </label>
            <span className="tabular-nums text-sm font-semibold text-red-600 dark:text-red-400">
              {c.quente}
            </span>
          </div>
          <input
            type="range"
            min={c.morno + 1}
            max={100}
            value={c.quente}
            onChange={(e) => handleQuente(Number(e.target.value))}
            className="w-full accent-red-500"
          />
          <div className="mt-1 flex justify-between text-xs text-zinc-400">
            <span>{c.morno + 1}</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* Preview de distribuição */}
      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Distribuição com esses cortes ({scores.length} leads)
        </p>

        {/* Barra empilhada */}
        <div className="mb-3 flex h-4 w-full overflow-hidden rounded-full">
          {TIERS.map((t) => {
            const pct = (distribuicao[t] / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={t}
                className={`${tierRail[t]} transition-all duration-150`}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>

        {/* Contagens */}
        <div className="flex flex-wrap gap-3">
          {TIERS.map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-full ${tierRail[t]}`} />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                <strong className="font-semibold">{distribuicao[t]}</strong>{" "}
                {tierLabel[t].toLowerCase()}{" "}
                <span className="text-zinc-400">
                  ({Math.round((distribuicao[t] / total) * 100)}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCortes(CORTES_PADRAO)}
        className="mt-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        Restaurar padrão (40 / 66)
      </button>
    </section>
  );
}
