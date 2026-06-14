"use client";

import { useState } from "react";
import type { FiltrosBusca } from "@/lib/types";

interface Props {
  facetas: { cidades: string[]; bairros: string[] };
  valores: FiltrosBusca;
  carregando: boolean;
  onBuscar: (f: FiltrosBusca) => void;
}

const inputClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400";

const labelClass = "block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1";

export default function FiltroForm({ facetas, valores, carregando, onBuscar }: Props) {
  const [local, setLocal] = useState<FiltrosBusca>(valores);

  const set = (k: keyof FiltrosBusca, v: string) =>
    setLocal((prev) => ({ ...prev, [k]: v || undefined }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const f: FiltrosBusca = {
      cidade: local.cidade,
      bairro: local.bairro,
      transacao: local.transacao,
      tipo: local.tipo,
      precoMin:
        local.precoMin !== undefined && local.precoMin !== (undefined as unknown as number)
          ? Number(local.precoMin)
          : undefined,
      precoMax:
        local.precoMax !== undefined && local.precoMax !== (undefined as unknown as number)
          ? Number(local.precoMax)
          : undefined,
    };
    onBuscar(f);
  }

  function handleLimpar() {
    setLocal({});
    onBuscar({});
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass}>Cidade</label>
          <select
            className={inputClass}
            value={local.cidade ?? ""}
            onChange={(e) => set("cidade", e.target.value)}
          >
            <option value="">Todas as cidades</option>
            {facetas.cidades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Bairro</label>
          <select
            className={inputClass}
            value={local.bairro ?? ""}
            onChange={(e) => set("bairro", e.target.value)}
          >
            <option value="">Todos os bairros</option>
            {facetas.bairros.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Transação</label>
          <select
            className={inputClass}
            value={local.transacao ?? ""}
            onChange={(e) => set("transacao", e.target.value)}
          >
            <option value="">Venda e aluguel</option>
            <option value="venda">Venda</option>
            <option value="aluguel">Aluguel</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Tipo</label>
          <select
            className={inputClass}
            value={local.tipo ?? ""}
            onChange={(e) => set("tipo", e.target.value)}
          >
            <option value="">Todos os tipos</option>
            <option value="apartamento">Apartamento</option>
            <option value="casa">Casa</option>
            <option value="cobertura">Cobertura</option>
            <option value="kitnet">Kitnet</option>
            <option value="sobrado">Sobrado</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Preço mínimo (R$)</label>
          <input
            type="number"
            inputMode="numeric"
            className={inputClass}
            placeholder="Ex: 300000"
            value={local.precoMin ?? ""}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                precoMin: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </div>

        <div>
          <label className={labelClass}>Preço máximo (R$)</label>
          <input
            type="number"
            inputMode="numeric"
            className={inputClass}
            placeholder="Ex: 1500000"
            value={local.precoMax ?? ""}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                precoMax: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={carregando}
          className="h-10 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {carregando ? "Buscando…" : "Buscar"}
        </button>
        <button
          type="button"
          onClick={handleLimpar}
          disabled={carregando}
          className="h-10 rounded-lg border border-zinc-300 px-5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Limpar
        </button>
      </div>
    </form>
  );
}
