import { buscarLeads, facetas } from "@/lib/data";
import RadarShell from "@/components/RadarShell";

export default function Page() {
  const leadsIniciais = buscarLeads({});
  const facetasData = facetas();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Radar de Captação
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Proprietários particulares, priorizados por captabilidade.
          </p>
        </header>

        <RadarShell leadsIniciais={leadsIniciais} facetas={facetasData} />
      </div>
    </div>
  );
}
