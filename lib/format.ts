import type { SinalScore, Tier, TipoImovel } from "./types";

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

// Monta deeplink WhatsApp com prefixo BR. Retorna "" se não houver dígitos.
// texto é opcional: se omitido/vazio abre o chat sem mensagem pré-preenchida.
export function linkWhatsApp(telefone: string, texto?: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos) return "";
  const base = `https://wa.me/55${digitos}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
