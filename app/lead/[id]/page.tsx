import { notFound } from "next/navigation";
import Link from "next/link";
import { buscarLeadPorId } from "@/lib/data";
import { brl, area, tipoLabel, tierRail } from "@/lib/format";
import ScoreBadge from "@/components/ScoreBadge";
import GraficoPreco from "@/components/GraficoPreco";
import BreakdownSinais from "@/components/BreakdownSinais";
import BriefingPanel from "@/components/BriefingPanel";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = buscarLeadPorId(id);
  if (!lead) notFound();

  const { avaliacao } = lead;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        {/* Navegação */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Voltar ao Radar
        </Link>

        {/* Cabeçalho do imóvel */}
        <div
          className={`relative mb-6 rounded-xl border border-zinc-200 bg-white p-4 pl-6 dark:border-zinc-800 dark:bg-zinc-900`}
        >
          <span
            className={`absolute left-0 top-0 h-full w-1.5 rounded-l-xl ${tierRail[avaliacao.tier]}`}
          />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {tipoLabel[lead.tipo]} · {lead.bairro}
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                {lead.cidade}/{lead.uf}
              </p>
            </div>
            <ScoreBadge score={avaliacao.score} tier={avaliacao.tier} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
            <span>{area(lead.area)}</span>
            <span>
              {lead.quartos} quarto{lead.quartos !== 1 ? "s" : ""}
            </span>
            <span>
              {lead.vagas} vaga{lead.vagas !== 1 ? "s" : ""}
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {brl(lead.precoAtual)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {lead.portais.map((p) => (
              <span
                key={p}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              >
                {p}
              </span>
            ))}
          </div>

          {lead.anuncioUrl && (
            <a
              href={lead.anuncioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
            >
              Ver anúncio original ↗
            </a>
          )}
        </div>

        {/* Proprietário */}
        <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Proprietário
              </p>
              <p className="mt-0.5 font-semibold text-zinc-900 dark:text-zinc-100">
                {lead.proprietario}
              </p>
              <p className="text-sm text-zinc-500">{lead.telefone}</p>
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
              contato simulado
            </span>
          </div>
        </div>

        {/* Fotos */}
        {lead.fotos.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {lead.fotos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Foto ${i + 1} do imóvel`}
                width={240}
                height={180}
                loading="lazy"
                className="h-44 w-auto shrink-0 rounded-lg object-cover"
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Gráfico de histórico */}
          <GraficoPreco
            historico={lead.historicoPreco}
            precoMercado={lead.precoEstimadoMercado}
          />

          {/* Breakdown dos sinais */}
          <BreakdownSinais avaliacao={avaliacao} />
        </div>

        {/* Briefing da IA */}
        <div className="mt-4">
          <BriefingPanel id={lead.id} />
        </div>
      </div>
    </div>
  );
}
