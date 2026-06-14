import Link from "next/link";
import { buscarLeads, facetas } from "@/lib/data";
import RadarShell from "@/components/RadarShell";

export default async function Page() {
  const leadsIniciais = await buscarLeads({});
  const facetasData = await facetas();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Radar de Captação
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Proprietários particulares, priorizados por captabilidade.
            </p>
          </div>
          <Link
            href="/criterios"
            className="mt-1 shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Critérios
          </Link>
        </header>

        <RadarShell leadsIniciais={leadsIniciais} facetas={facetasData} />
      </div>
    </div>
  );
}
