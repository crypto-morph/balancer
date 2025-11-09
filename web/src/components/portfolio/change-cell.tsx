"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Pcts = {
  h1?: number | null;
  d1?: number | null;
  d30?: number | null;
  d60?: number | null;
  d90?: number | null;
  d365?: number | null;
  max?: number | null;
};

export function ChangeCell({ pcts }: { pcts?: Pcts }) {
  const d1 = pcts?.d1 ?? null;
  const d30 = pcts?.d30 ?? null;
  const d365 = pcts?.d365 ?? null;
  const lead = d1 ?? d30 ?? d365 ?? 0;
  const positive = (lead ?? 0) >= 0;

  function fmt(x: number | null | undefined) {
    if (x === null || x === undefined || !isFinite(x)) return "-";
    const sign = x > 0 ? "+" : x < 0 ? "" : "";
    return `${sign}${x.toFixed(2)}%`;
  }

  const Arrow = positive ? ArrowUpRight : ArrowDownRight;

  const inline = (
    <div className={`inline-flex items-center justify-end gap-1 ${positive ? "text-emerald-600" : "text-red-600"}`}>
      <Arrow className="h-3 w-3" />
      <span className="tabular-nums">{fmt(d1)}</span>
      <span className="text-zinc-400">/</span>
      <span className="tabular-nums">{fmt(d30)}</span>
      <span className="text-zinc-400">/</span>
      <span className="tabular-nums">{fmt(d365)}</span>
    </div>
  );

  return (
    <TooltipProvider disableHoverableContent>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help select-none">
            {inline}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="text-zinc-500">1h</span><span className="tabular-nums text-right">{fmt(pcts?.h1 ?? null)}</span>
            <span className="text-zinc-500">1d</span><span className="tabular-nums text-right">{fmt(pcts?.d1 ?? null)}</span>
            <span className="text-zinc-500">30d</span><span className="tabular-nums text-right">{fmt(pcts?.d30 ?? null)}</span>
            <span className="text-zinc-500">60d</span><span className="tabular-nums text-right">{fmt(pcts?.d60 ?? null)}</span>
            <span className="text-zinc-500">90d</span><span className="tabular-nums text-right">{fmt(pcts?.d90 ?? null)}</span>
            <span className="text-zinc-500">365d</span><span className="tabular-nums text-right">{fmt(pcts?.d365 ?? null)}</span>
            <span className="text-zinc-500">Max</span><span className="tabular-nums text-right">{fmt(pcts?.max ?? null)}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
