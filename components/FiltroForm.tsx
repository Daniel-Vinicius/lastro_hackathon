"use client";

import { useEffect, useRef, useState } from "react";
import type { FiltrosBusca, LeadStatus } from "@/lib/types";
import { statusLabel } from "@/lib/format";

interface Props {
  facetas: { cidades: string[]; bairros: string[] };
  valores: FiltrosBusca;
  carregando: boolean;
  onBuscar: (f: FiltrosBusca) => void;
}

const PORTAIS_DISPONIVEIS = ["Chaves na Mão", "SP Imóvel", "OLX"];
const STATUS_OPCOES: LeadStatus[] = ["novo", "contatado", "negociando", "descartado", "vendido"];
const STATUS_PADRAO: LeadStatus[] = ["novo", "contatado", "negociando"];

const inputClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400";

const optionClass = "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

const labelClass = "block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1";

export default function FiltroForm({ facetas, valores, carregando, onBuscar }: Props) {
  const [local, setLocal] = useState<FiltrosBusca>({ statusFiltro: STATUS_PADRAO, ...valores });
  const [bairroOpen, setBairroOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const bairroRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const set = (k: keyof FiltrosBusca, v: string) =>
    setLocal((prev) => ({ ...prev, [k]: v || undefined }));

  // --- Bairros ---
  function toggleBairro(bairro: string) {
    setLocal((prev) => {
      const atual = prev.bairros ?? [];
      const proximo = atual.includes(bairro)
        ? atual.filter((b) => b !== bairro)
        : [...atual, bairro];
      return { ...prev, bairros: proximo.length ? proximo : undefined };
    });
  }
  function removeBairro(bairro: string) {
    const proximo = (local.bairros ?? []).filter((b) => b !== bairro);
    const atualizado = { ...local, bairros: proximo.length ? proximo : undefined };
    setLocal(atualizado);
    onBuscar(atualizado);
  }

  // --- Portais ---
  function togglePortal(portal: string) {
    setLocal((prev) => {
      const atual = prev.portais ?? [];
      const proximo = atual.includes(portal)
        ? atual.filter((p) => p !== portal)
        : [...atual, portal];
      return { ...prev, portais: proximo.length ? proximo : undefined };
    });
  }
  function removePortal(portal: string) {
    const proximo = (local.portais ?? []).filter((p) => p !== portal);
    const atualizado = { ...local, portais: proximo.length ? proximo : undefined };
    setLocal(atualizado);
    onBuscar(atualizado);
  }

  // --- Status ---
  function toggleStatus(s: LeadStatus) {
    setLocal((prev) => {
      const atual = prev.statusFiltro ?? STATUS_PADRAO;
      const proximo = atual.includes(s)
        ? atual.filter((x) => x !== s)
        : [...atual, s];
      // Vazio = padrão (server vai usar default)
      return { ...prev, statusFiltro: proximo.length ? proximo : STATUS_PADRAO };
    });
  }

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bairroRef.current && !bairroRef.current.contains(e.target as Node))
        setBairroOpen(false);
      if (portalRef.current && !portalRef.current.contains(e.target as Node))
        setPortalOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const bairrosDisponiveis = facetas.bairros.filter((b) => !(local.bairros ?? []).includes(b));
  const portaisDisponiveis = PORTAIS_DISPONIVEIS.filter((p) => !(local.portais ?? []).includes(p));
  const statusAtivos = local.statusFiltro ?? STATUS_PADRAO;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBairroOpen(false);
    setPortalOpen(false);
    const f: FiltrosBusca = {
      cidade: local.cidade,
      bairros: local.bairros,
      transacao: local.transacao,
      tipo: local.tipo,
      precoMin: local.precoMin !== undefined ? Number(local.precoMin) : undefined,
      precoMax: local.precoMax !== undefined ? Number(local.precoMax) : undefined,
      portais: local.portais,
      statusFiltro: local.statusFiltro,
    };
    onBuscar(f);
  }

  function handleLimpar() {
    const reset: FiltrosBusca = { statusFiltro: STATUS_PADRAO };
    setLocal(reset);
    setBairroOpen(false);
    setPortalOpen(false);
    onBuscar(reset);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Cidade */}
        <div>
          <label className={labelClass}>Cidade</label>
          <select
            className={inputClass}
            value={local.cidade ?? ""}
            onChange={(e) => {
              set("cidade", e.target.value);
              setLocal((prev) => ({ ...prev, cidade: e.target.value || undefined, bairros: undefined }));
            }}
          >
            <option value="" className={optionClass}>Todas as cidades</option>
            {facetas.cidades.map((c) => (
              <option key={c} value={c} className={optionClass}>{c}</option>
            ))}
          </select>
        </div>

        {/* Bairros — multi-select com chips */}
        <div ref={bairroRef}>
          <label className={labelClass}>Bairro</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setBairroOpen((v) => !v)}
              className="flex h-10 w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <span className="text-zinc-400 dark:text-zinc-500">
                {bairrosDisponiveis.length === 0 ? "Todos selecionados" : "+ Adicionar bairro"}
              </span>
              <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {bairroOpen && bairrosDisponiveis.length > 0 && (
              <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {bairrosDisponiveis.map((b) => (
                  <button key={b} type="button" onClick={() => toggleBairro(b)} className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700">
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(local.bairros ?? []).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(local.bairros ?? []).map((b) => (
                <span key={b} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {b}
                  <button type="button" onClick={() => removeBairro(b)} className="ml-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100" aria-label={`Remover ${b}`}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Portal — multi-select com chips */}
        <div ref={portalRef}>
          <label className={labelClass}>Portal</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPortalOpen((v) => !v)}
              className="flex h-10 w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <span className="text-zinc-400 dark:text-zinc-500">
                {portaisDisponiveis.length === 0 ? "Todos selecionados" : "+ Adicionar portal"}
              </span>
              <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {portalOpen && portaisDisponiveis.length > 0 && (
              <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {portaisDisponiveis.map((p) => (
                  <button key={p} type="button" onClick={() => togglePortal(p)} className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700">
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(local.portais ?? []).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(local.portais ?? []).map((p) => (
                <span key={p} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {p}
                  <button type="button" onClick={() => removePortal(p)} className="ml-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100" aria-label={`Remover ${p}`}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Transação */}
        <div>
          <label className={labelClass}>Transação</label>
          <select className={inputClass} value={local.transacao ?? ""} onChange={(e) => set("transacao", e.target.value)}>
            <option value="" className={optionClass}>Venda e aluguel</option>
            <option value="venda" className={optionClass}>Venda</option>
            <option value="aluguel" className={optionClass}>Aluguel</option>
          </select>
        </div>

        {/* Tipo */}
        <div>
          <label className={labelClass}>Tipo</label>
          <select className={inputClass} value={local.tipo ?? ""} onChange={(e) => set("tipo", e.target.value)}>
            <option value="" className={optionClass}>Todos os tipos</option>
            <option value="apartamento" className={optionClass}>Apartamento</option>
            <option value="casa" className={optionClass}>Casa</option>
            <option value="cobertura" className={optionClass}>Cobertura</option>
            <option value="kitnet" className={optionClass}>Kitnet</option>
            <option value="sobrado" className={optionClass}>Sobrado</option>
          </select>
        </div>

        {/* Preço mínimo */}
        <div>
          <label className={labelClass}>Preço mínimo (R$)</label>
          <input
            type="number" inputMode="numeric" className={inputClass} placeholder="Ex: 300000"
            value={local.precoMin ?? ""}
            onChange={(e) => setLocal((prev) => ({ ...prev, precoMin: e.target.value ? Number(e.target.value) : undefined }))}
          />
        </div>

        {/* Preço máximo */}
        <div>
          <label className={labelClass}>Preço máximo (R$)</label>
          <input
            type="number" inputMode="numeric" className={inputClass} placeholder="Ex: 1500000"
            value={local.precoMax ?? ""}
            onChange={(e) => setLocal((prev) => ({ ...prev, precoMax: e.target.value ? Number(e.target.value) : undefined }))}
          />
        </div>

        {/* Status — toggle buttons */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelClass}>Status</label>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPCOES.map((s) => {
              const ativo = statusAtivos.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    ativo
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {statusLabel[s]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={carregando}
          className="h-10 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
          {carregando ? "Buscando…" : "Buscar"}
        </button>
        <button type="button" onClick={handleLimpar} disabled={carregando}
          className="h-10 rounded-lg border border-zinc-300 px-5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          Limpar
        </button>
      </div>
    </form>
  );
}
