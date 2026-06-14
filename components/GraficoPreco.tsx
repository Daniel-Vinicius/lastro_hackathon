"use client";

import { useState } from "react";
import type { PontoPreco } from "@/lib/types";
import { brl } from "@/lib/format";

interface Props {
  historico: PontoPreco[];
  precoMercado: number;
  area?: number;
  bairro?: string;
}

const WIDTH = 600;
const HEIGHT = 180;
const PAD = { top: 20, right: 16, bottom: 32, left: 16 };

function toX(i: number, total: number): number {
  const inner = WIDTH - PAD.left - PAD.right;
  return PAD.left + (total === 1 ? inner / 2 : (i / (total - 1)) * inner);
}

function toY(valor: number, min: number, max: number): number {
  const inner = HEIGHT - PAD.top - PAD.bottom;
  if (max === min) return PAD.top + inner / 2;
  return PAD.top + (1 - (valor - min) / (max - min)) * inner;
}

function fmtDataCurta(iso: string): string {
  const [, mm, dd] = iso.split("-");
  return `${dd}/${mm}`;
}

export default function GraficoPreco({ historico, precoMercado, area, bairro }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  if (historico.length === 0) return null;

  const valores = historico.map((p) => p.valor);
  const domMin = Math.min(...valores, precoMercado) * 0.97;
  const domMax = Math.max(...valores, precoMercado) * 1.03;

  const pontos = historico.map((p, i) => ({
    x: toX(i, historico.length),
    y: toY(p.valor, domMin, domMax),
    ...p,
    reducao: i > 0 && p.valor < historico[i - 1].valor,
  }));

  const polylinePoints = pontos.map((p) => `${p.x},${p.y}`).join(" ");
  const yMercado = toY(precoMercado, domMin, domMax);

  const primeiro = historico[0].valor;
  const ultimo = historico[historico.length - 1].valor;
  const varPct = Math.round(((ultimo - primeiro) / primeiro) * 100);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Histórico de preço
        {varPct !== 0 && (
          <span
            className={`ml-2 text-xs font-semibold ${varPct < 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}
          >
            {varPct > 0 ? "+" : ""}
            {varPct}%
          </span>
        )}
      </p>

      <div className="relative" style={{ height: "140px" }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="block w-full h-full"
        aria-hidden="true"
      >
        {/* Linha de mercado tracejada */}
        <line
          x1={PAD.left}
          y1={yMercado}
          x2={WIDTH - PAD.right}
          y2={yMercado}
          stroke="currentColor"
          strokeDasharray="6 4"
          strokeWidth="1.5"
          className="text-zinc-400 dark:text-zinc-500"
        />
        <text
          x={WIDTH - PAD.right - 2}
          y={yMercado - 5}
          textAnchor="end"
          fontSize="11"
          className="fill-zinc-400 dark:fill-zinc-500"
        >
          mercado
        </text>

        {/* Linha de preço */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-zinc-700 dark:text-zinc-300"
        />

        {/* Pontos */}
        {pontos.map((p, i) => (
          <g key={i}>
            {hover === i && (
              <line
                x1={p.x}
                y1={PAD.top}
                x2={p.x}
                y2={HEIGHT - PAD.bottom}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 3"
                className="text-zinc-300 dark:text-zinc-600"
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? "7" : "5"}
              className={
                p.reducao
                  ? "fill-amber-400 stroke-amber-500"
                  : "fill-zinc-700 stroke-zinc-600 dark:fill-zinc-300 dark:stroke-zinc-400"
              }
              strokeWidth="1.5"
            />
            {/* Alvo de hover (transparente, maior que o ponto) */}
            <circle
              cx={p.x}
              cy={p.y}
              r="16"
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}

        {/* Label primeiro preço */}
        <text
          x={pontos[0].x}
          y={HEIGHT - 4}
          textAnchor="start"
          fontSize="10"
          className="fill-zinc-400 dark:fill-zinc-500"
        >
          {fmtDataCurta(historico[0].data)}
        </text>

        {/* Label último preço */}
        {historico.length > 1 && (
          <text
            x={pontos[pontos.length - 1].x}
            y={HEIGHT - 4}
            textAnchor="end"
            fontSize="10"
            className="fill-zinc-400 dark:fill-zinc-500"
          >
            {fmtDataCurta(historico[historico.length - 1].data)}
          </text>
        )}
      </svg>

      {/* Tooltip de preço no ponto sob o cursor */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-center shadow-md dark:border-zinc-700 dark:bg-zinc-800"
          style={{
            left: `${(pontos[hover].x / WIDTH) * 100}%`,
            top: `${(pontos[hover].y / HEIGHT) * 100}%`,
            marginTop: "-12px",
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {brl(pontos[hover].valor)}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {fmtDataCurta(pontos[hover].data)}
            {pontos[hover].reducao && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                · redução
              </span>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Legenda */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-zinc-700 dark:bg-zinc-300" />
          {brl(ultimo)} (atual)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-zinc-400" />
          {brl(precoMercado)} (mercado)
        </span>
        {pontos.some((p) => p.reducao) && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            redução de preço
          </span>
        )}
      </div>
      {area && precoMercado > 0 && (
        <p className="mt-1 text-xs italic text-zinc-400 dark:text-zinc-500">
          Estimativa de mercado: ~{Math.round(precoMercado / area).toLocaleString("pt-BR")} R$/m² × {area} m² — mediana R$/m² do lote raspado
        </p>
      )}
    </div>
  );
}
