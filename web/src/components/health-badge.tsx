"use client";

import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Health = {
  ok: boolean;
  now: string;
  assets_total: number;
  prices: { hourly_24h_missing: number; daily_1y_missing: number };
  fx: { GBPUSD: { hourly_24h_missing: number; daily_1y_missing: number }; BTCUSD: { hourly_24h_missing: number; daily_1y_missing: number } };
};

function statusFrom(h?: Health) {
  if (!h) return { label: "Unknown", color: "bg-zinc-400" };
  const issues = (h.prices.hourly_24h_missing > 0 || h.prices.daily_1y_missing > 0 || h.fx.GBPUSD.hourly_24h_missing > 0 || h.fx.GBPUSD.daily_1y_missing > 0 || h.fx.BTCUSD.hourly_24h_missing > 0 || h.fx.BTCUSD.daily_1y_missing > 0);
  if (!issues) return { label: "Healthy", color: "bg-emerald-600" };
  return { label: "Degraded", color: "bg-amber-500" };
}

export function HealthBadge() {
  const [data, setData] = useState<Health | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/data/health', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setData(j);
      } catch {}
    })();
    const id = setInterval(() => {
      (async () => {
        try {
          const r = await fetch('/api/data/health', { cache: 'no-store' });
          if (r.ok) setData(await r.json());
        } catch {}
      })();
    }, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const st = statusFrom(data || undefined);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-2 cursor-help select-none">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${st.color}`} />
            <span className="text-sm text-zinc-500">Data: {st.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <div>Assets: {data?.assets_total ?? '-'}</div>
            <div>Prices (24h hourly missing assets): {data?.prices.hourly_24h_missing ?? '-'}</div>
            <div>Prices (1y daily missing assets): {data?.prices.daily_1y_missing ?? '-'}</div>
            <div>FX GBPUSD (24h/1y missing flags): {(data?.fx.GBPUSD.hourly_24h_missing ?? 0)}/{(data?.fx.GBPUSD.daily_1y_missing ?? 0)}</div>
            <div>FX BTCUSD (24h/1y missing flags): {(data?.fx.BTCUSD.hourly_24h_missing ?? 0)}/{(data?.fx.BTCUSD.daily_1y_missing ?? 0)}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
