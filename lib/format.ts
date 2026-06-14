import type { LeadStatus, SinalScore, Tier, TipoImovel } from "./types";

const _brlFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const brl = (n: number): string => _brlFmt.format(n);

export const area = (n: number): string => `${n} m²`;

export const tipoLabel: Record<TipoImovel, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  cobertura: "Cobertura",
  kitnet: "Kitnet",
  sobrado: "Sobrado",
};

export const tierLabel: Record<Tier, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
};

export const tierBadge: Record<Tier, string> = {
  quente:
    "bg-red-100 text-red-700 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
  morno:
    "bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  frio: "bg-sky-100 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900",
};

export const tierRail: Record<Tier, string> = {
  quente: "bg-red-500",
  morno: "bg-amber-400",
  frio: "bg-sky-400",
};

export const intensidadeBar: Record<SinalScore["intensidade"], string> = {
  alto: "bg-red-500",
  medio: "bg-amber-400",
  baixo: "bg-zinc-300 dark:bg-zinc-600",
};

export const statusLabel: Record<LeadStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  negociando: "Negociando",
  descartado: "Descartado",
  vendido: "Vendido",
};

export const statusBadge: Record<LeadStatus, string> = {
  novo: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
  contatado: "bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900",
  negociando: "bg-violet-100 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900",
  descartado: "bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:ring-zinc-700",
  vendido: "bg-green-100 text-green-700 ring-1 ring-green-200 dark:bg-green-950 dark:text-green-300 dark:ring-green-900",
};

// Badge por plataforma/portal — cor de marca, com fallback neutro p/ portais novos.
const _normPortal = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

const _portalCores: Record<string, string> = {
  "chaves na mao":
    "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  "sp imovel":
    "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900",
  olx: "bg-purple-100 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:ring-purple-900",
};

export function portalBadge(portal: string): string {
  return (
    _portalCores[_normPortal(portal)] ??
    "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700"
  );
}

// Monta deeplink WhatsApp com prefixo BR. Retorna "" se não houver dígitos.
// texto é opcional: se omitido/vazio abre o chat sem mensagem pré-preenchida.
export function linkWhatsApp(telefone: string | undefined, texto?: string): string {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  const base = `https://wa.me/55${digitos}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
