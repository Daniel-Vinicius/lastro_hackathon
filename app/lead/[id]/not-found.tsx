import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-5xl font-bold text-zinc-200 dark:text-zinc-800">404</p>
        <h1 className="mt-4 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Lead não encontrado
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Este lead pode ter sido removido ou o link está incorreto.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Voltar ao Radar
        </Link>
      </div>
    </div>
  );
}
