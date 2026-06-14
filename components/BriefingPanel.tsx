"use client";

import { useEffect, useRef, useState } from "react";
import type { BriefingCaptacao } from "@/lib/types";

interface Props {
  id: string;
}

type Estado = "loading" | "ok" | "erro";

function Skeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-3 w-5/6 rounded bg-zinc-100 dark:bg-zinc-800" />
      <div className="mt-2 h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
      <div className="mt-2 h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-16 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
      <div className="mt-2 h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 w-4/6 rounded bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}

interface CampoProps {
  rotulo: string;
  children: React.ReactNode;
}

function Campo({ rotulo, children }: CampoProps) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {rotulo}
      </p>
      {children}
    </div>
  );
}

export default function BriefingPanel({ id }: Props) {
  const [estado, setEstado] = useState<Estado>("loading");
  const [briefing, setBriefing] = useState<BriefingCaptacao | null>(null);
  const [fonte, setFonte] = useState<"claude" | "fallback" | null>(null);
  const [copiado, setCopiado] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Incrementar para forçar re-fetch no retry sem setState síncrono no effect
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();

    fetch("/api/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      signal: ctrl.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("status " + r.status);
        return r.json();
      })
      .then((data) => {
        setBriefing(data.briefing);
        setFonte(data.fonte);
        setEstado("ok");
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setEstado("erro");
      });

    return () => {
      ctrl.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id, tentativa]);

  function tentarDeNovo() {
    setBriefing(null);
    setFonte(null);
    setEstado("loading");
    setTentativa((n) => n + 1);
  }

  function copiar() {
    if (!briefing?.mensagemSugerida) return;
    navigator.clipboard.writeText(briefing.mensagemSugerida).then(() => {
      setCopiado(true);
      timerRef.current = setTimeout(() => setCopiado(false), 2000);
    });
  }

  if (estado === "loading") return <Skeleton />;

  if (estado === "erro") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Não foi possível gerar o briefing agora.
        </p>
        <button
          onClick={tentarDeNovo}
          className="mt-2 text-sm font-medium text-red-700 underline underline-offset-2 hover:no-underline dark:text-red-400"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Cabeçalho com fonte */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Briefing de abordagem
        </p>
        {fonte === "fallback" && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
            modo demonstração
          </span>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <Campo rotulo="Por que abordar agora">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {briefing.porQueAgora}
          </p>
        </Campo>

        <Campo rotulo="Como abordar">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {briefing.comoAbordar}
          </p>
        </Campo>

        <Campo rotulo="Mensagem sugerida (WhatsApp)">
          <div className="relative rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
            <p className="pr-24 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {briefing.mensagemSugerida}
            </p>
            <button
              onClick={copiar}
              className="absolute right-2 top-2 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </Campo>

        <Campo rotulo="Objeção provável">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {briefing.objecaoProvavel}
          </p>
        </Campo>
      </div>
    </div>
  );
}
