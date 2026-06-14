"use client";

import { useState, useTransition } from "react";
import type { LeadComScore, FiltrosBusca } from "@/lib/types";
import FiltroForm from "./FiltroForm";
import ListaLeads from "./ListaLeads";

interface Props {
  leadsIniciais: LeadComScore[];
  facetas: { cidades: string[]; bairros: string[] };
}

export default function RadarShell({ leadsIniciais, facetas }: Props) {
  const [leads, setLeads] = useState<LeadComScore[]>(leadsIniciais);
  const [filtros, setFiltros] = useState<FiltrosBusca>({});
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onBuscar(novosFiltros: FiltrosBusca) {
    setFiltros(novosFiltros);
    setErro(null);

    const qs = new URLSearchParams();
    const add = (k: string, v: string | number | undefined) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    };
    add("cidade", novosFiltros.cidade);
    add("bairro", novosFiltros.bairro);
    add("transacao", novosFiltros.transacao);
    add("tipo", novosFiltros.tipo);
    add("precoMin", novosFiltros.precoMin);
    add("precoMax", novosFiltros.precoMax);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/search?${qs}`);
        if (!res.ok) {
          setErro("Não foi possível buscar agora. Tente novamente.");
          return;
        }
        const json = await res.json();
        setLeads(json.leads);
      } catch {
        setErro("Erro de conexão. Verifique sua rede e tente novamente.");
      }
    });
  }

  const quentes = leads.filter((l) => l.avaliacao.tier === "quente").length;

  return (
    <div className="flex flex-col gap-4">
      <FiltroForm
        facetas={facetas}
        valores={filtros}
        carregando={isPending}
        onBuscar={onBuscar}
      />

      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <span>
          <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
            {leads.length}
          </strong>{" "}
          lead{leads.length !== 1 ? "s" : ""} · ordenados por score
        </span>
        {quentes > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            {quentes} quente{quentes !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <ListaLeads leads={leads} carregando={isPending} erro={erro} />
    </div>
  );
}
