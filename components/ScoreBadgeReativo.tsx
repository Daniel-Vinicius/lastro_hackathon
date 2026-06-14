"use client";

import { classificar } from "@/lib/score";
import { useCortes } from "@/lib/useCortes";
import ScoreBadge from "./ScoreBadge";

interface Props {
  score: number;
}

// Badge de score que re-classifica o tier a partir dos cortes salvos no
// localStorage (mesma lógica de RadarShell), para a página de detalhe ficar
// em sincronia com os critérios editados na tela de Critérios.
export default function ScoreBadgeReativo({ score }: Props) {
  const { cortes } = useCortes();
  return <ScoreBadge score={score} tier={classificar(score, cortes)} />;
}
