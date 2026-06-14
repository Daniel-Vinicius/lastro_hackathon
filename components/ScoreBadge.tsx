import type { Tier } from "@/lib/types";
import { tierBadge, tierLabel } from "@/lib/format";

interface Props {
  score: number;
  tier: Tier;
}

export default function ScoreBadge({ score, tier }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${tierBadge[tier]}`}
    >
      <span className="font-bold tabular-nums">{score}</span>
      <span className="opacity-75">·</span>
      <span>{tierLabel[tier]}</span>
    </span>
  );
}
