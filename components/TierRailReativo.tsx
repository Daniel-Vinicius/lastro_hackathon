"use client";

import { classificar } from "@/lib/score";
import { useCortes } from "@/lib/useCortes";
import { tierRail } from "@/lib/format";

interface Props {
  score: number;
  className?: string;
}

// Trilho colorido de prioridade que re-classifica o tier a partir dos cortes
// salvos no localStorage, mantendo a cor em sincronia com os critérios.
export default function TierRailReativo({ score, className = "" }: Props) {
  const { cortes } = useCortes();
  return <span className={`${className} ${tierRail[classificar(score, cortes)]}`} />;
}
