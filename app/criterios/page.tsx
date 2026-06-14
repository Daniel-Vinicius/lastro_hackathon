import Link from "next/link";
import { buscarLeads } from "@/lib/data";
import { PESOS } from "@/lib/score";
import { intensidadeBar } from "@/lib/format";
import CriteriosPanel from "@/components/CriteriosPanel";

const SINAIS = [
  {
    chave: "dias",
    rotulo: "Tempo no anúncio",
    peso: PESOS.dias,
    descricao:
      "Imóveis com mais de 90 dias no ar mostram que o dono está cansado de esperar. As visitas caem ~50% nas primeiras 4 semanas — quem passa de 3 meses quer resolver logo.",
    intensidade: "alto" as const,
  },
  {
    chave: "reducoes",
    rotulo: "Reduções de preço",
    peso: PESOS.reducoes,
    descricao:
      "Cada remarcação revela que o dono reconheceu que o preço estava errado. Com 2 ou mais reduções, a abertura à negociação já está demonstrada nos fatos.",
    intensidade: "alto" as const,
  },
  {
    chave: "gap",
    rotulo: "Preço vs. mercado",
    peso: PESOS.gap,
    descricao:
      "54% dos imóveis à venda no Brasil são anunciados acima do preço de mercado. Quanto maior o gap, mais difícil vender sozinho — e maior a motivação para aceitar ajuda.",
    intensidade: "medio" as const,
  },
  {
    chave: "pulverizacao",
    rotulo: "Pulverização",
    peso: PESOS.pulverizacao,
    descricao:
      "O mesmo imóvel em vários portais significa que não há exclusividade com nenhuma imobiliária — o proprietário está claramente aberto a qualquer canal que resolva.",
    intensidade: "medio" as const,
  },
] as const;

export default async function CriteriosPage() {
  const scores = (await buscarLeads({})).map((l) => l.avaliacao.score);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <header className="mb-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Radar
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Critérios do score
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Como o índice de captabilidade é calculado — e como calibrar os tiers.
          </p>
        </header>

        {/* Sinais read-only */}
        <section className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            4 sinais · pesos fixos
          </h2>
          <div className="flex flex-col gap-3">
            {SINAIS.map((s) => (
              <div
                key={s.chave}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {s.rotulo}
                  </span>
                  <span className="text-sm font-semibold text-zinc-500">
                    {s.peso} pts
                  </span>
                </div>
                {/* Barra de peso */}
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${intensidadeBar[s.intensidade]}`}
                    style={{ width: `${s.peso}%` }}
                  />
                </div>
                <p className="text-sm text-zinc-500">{s.descricao}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-400">
            Os pesos são fixos — alterar exigiria recalcular todos os scores no servidor.
            Os cortes abaixo você pode ajustar livremente.
          </p>
        </section>

        {/* Cortes editáveis + preview */}
        <CriteriosPanel scores={scores} />
      </div>
    </div>
  );
}
