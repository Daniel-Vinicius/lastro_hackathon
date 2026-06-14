import { notFound } from "next/navigation";
import Link from "next/link";
import { buscarLeadPorId } from "@/lib/data";
import { brl, area, tipoLabel, tierRail, linkWhatsApp } from "@/lib/format";
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
              <div className="mt-0.5 flex items-center gap-2">
                {linkWhatsApp(lead.telefone) && (
                  <a
                    href={linkWhatsApp(lead.telefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir WhatsApp"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="#25D366"
                      className="h-5 w-5 transition-opacity hover:opacity-80"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                  </a>
                )}
                <p className="text-sm text-zinc-500">{lead.telefone}</p>
              </div>
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
