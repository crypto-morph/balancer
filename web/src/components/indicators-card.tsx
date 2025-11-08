"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type IndicatorPayload = {
  indicators: Record<string, { value: number; at: string }>;
  series?: Record<string, Array<{ t: string; v: number }>>;
};

function formatVal(name: string, v: number): string {
  if (name === "BTCD") return `${v.toFixed(2)}%`;
  if (name === "FEAR_GREED") return `${v}`; // index 0-100
  if (name === "DXY_TWEX") return v.toFixed(2);
  return v.toString();
}

function label(name: string): string {
  if (name === "BTCD") return "BTC Dominance";
  if (name === "DXY_TWEX") return "DXY (TWEX)";
  if (name === "FEAR_GREED") return "Fear & Greed";
  return name;
}

export function IndicatorsCard() {
  const [data, setData] = useState<IndicatorPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/indicators", { cache: "no-store" });
        const json = (await res.json()) as IndicatorPayload;
        setData(json);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const entries = data ? Object.entries(data.indicators) : [];
  const at = entries.length ? new Date(entries[0][1].at).toLocaleString() : "-";

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm font-medium">Indicators</div>
        <div className="text-xs text-zinc-500">As of {at}</div>
      </div>
      <Separator className="my-2" />
      {loading && <div className="text-sm text-zinc-500">Loading…</div>}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["BTCD", "DXY_TWEX", "FEAR_GREED"] as const).map((k) => {
            const item = data?.indicators?.[k];
            const value = item ? formatVal(k, item.value) : "-";
            const series = data?.series?.[k] || [];
            return (
              <div key={k} className="rounded-md border bg-white/50 dark:bg-zinc-900 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-500">{label(k)}</div>
                  <div className="text-sm font-semibold">{value}</div>
                </div>
                <div className="mt-2">
                  <Sparkline data={series.map(s => s.v)} height={36} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Sparkline({ data, width = 160, height = 36 }: { data: number[]; width?: number; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data || data.length === 0) return <div className="h-9 text-xs text-zinc-500">No data</div>;
  const series = data.length === 1 ? [data[0], data[0]] : data;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const pad = 2;
  const xs = series.map((_, i) => (i / (series.length - 1)) * (width - pad * 2) + pad);
  const ys = series.map((v) => {
    if (max === min) return height / 2;
    const norm = (v - min) / (max - min);
    return height - pad - norm * (height - pad * 2);
  });
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const rising = series[series.length - 1] >= series[0];
  const stroke = rising ? "#059669" : "#ef4444"; // emerald/red
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // find nearest index by x
    let idx = 0, best = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const diff = Math.abs(xs[i] - x);
      if (diff < best) { best = diff; idx = i; }
    }
    setHover(idx);
  };
  const onLeave = () => setHover(null);
  return (
    <div className="relative">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-9"
        onMouseMove={onMove} onMouseLeave={onLeave}>
        <path d={d} fill="none" stroke={stroke} strokeWidth={2} />
        {hover !== null && (
          <g>
            <line x1={xs[hover]} y1={0} x2={xs[hover]} y2={height} stroke="#9ca3af" strokeWidth={1} />
            <circle cx={xs[hover]} cy={ys[hover]} r={2} fill={stroke} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="absolute -bottom-5 left-0 text-[11px] text-zinc-600">{data[hover].toFixed(2)}</div>
      )}
    </div>
  );
}
