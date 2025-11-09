"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

type Asset = {
  symbol: string;
  name: string;
  is_stable: boolean;
  is_fiat: boolean;
  mv_usd: number;
  mv_gbp?: number;
};

type Portfolio = {
  total_mv_usd: number;
  total_mv_gbp?: number;
  assets: Asset[];
};

const COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#22c55e", // green
  "#f97316", // orange
];

export function PortfolioPie() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [hover, setHover] = useState<{ key: string; pct: number } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/portfolio", { cache: "no-store" });
        const j = await r.json();
        setData(j);
      } catch {}
    }
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const { slices, legend } = useMemo(() => {
    const assets: Asset[] = (data?.assets || []).filter((a: Asset) => !a.is_stable && !a.is_fiat);
    const tot = (data?.total_mv_gbp as number) || 0;
    const rows = assets
      .map((a) => ({
        key: a.symbol,
        value: (a.mv_gbp ?? 0) || (a.mv_usd ?? 0),
      }))
      .filter((r) => r.value > 0);
    // sort by value desc
    rows.sort((a, b) => b.value - a.value);
    const top = rows.slice(0, 7);
    const otherValue = rows.slice(7).reduce((s, r) => s + r.value, 0);
    if (otherValue > 0) top.push({ key: "Other", value: otherValue });
    const total = top.reduce((s, r) => s + r.value, 0) || 1;
    // build slices with cumulative angles
    const sl = top.reduce((accumulator, r, i) => {
      const frac = r.value / total;
      const start = accumulator.length === 0 ? 0 : accumulator[accumulator.length - 1].end;
      const end = start + frac * Math.PI * 2;
      accumulator.push({ key: r.key, start, end, color: COLORS[i % COLORS.length], frac });
      return accumulator;
    }, [] as Array<{ key: string; start: number; end: number; color: string; frac: number }>);
    const legend = top.map((r, i) => ({ key: r.key, color: COLORS[i % COLORS.length], pct: (r.value / total) * 100 }));
    return { slices: sl, legend };
  }, [data]);

  return (
    <Card className="p-4">
      <div className="text-sm font-medium mb-2">Portfolio Breakdown</div>
      <div className="flex items-center gap-6">
        <div className="relative">
          <Donut slices={slices} size={220} thickness={32} onHover={setHover} />
          {hover && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-sm font-semibold">{hover.key}</div>
              <div className="text-xs text-zinc-600">{hover.pct.toFixed(1)}%</div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {legend.map((l) => (
            <div key={l.key} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
              <span className="w-16 truncate">{l.key}</span>
              <span className="text-zinc-500">{l.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Donut({ slices, size = 140, thickness = 24, onHover }: { slices: Array<{ start: number; end: number; color: string; frac?: number; key?: string }>; size?: number; thickness?: number; onHover?: (v: { key: string; pct: number } | null) => void }) {
  const r = size / 2;
  const ir = r - thickness;
  const cx = r, cy = r;
  const paths = slices.map((s, idx) => {
    const large = s.end - s.start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(s.start);
    const y1 = cy + r * Math.sin(s.start);
    const x2 = cx + r * Math.cos(s.end);
    const y2 = cy + r * Math.sin(s.end);
    const xi1 = cx + ir * Math.cos(s.end);
    const yi1 = cy + ir * Math.sin(s.end);
    const xi2 = cx + ir * Math.cos(s.start);
    const yi2 = cy + ir * Math.sin(s.start);
    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      `L ${xi1} ${yi1}`,
      `A ${ir} ${ir} 0 ${large} 0 ${xi2} ${yi2}`,
      "Z",
    ].join(" ");
    return <path key={idx} d={d} fill={s.color} />;
  });
  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onHover) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;
    const r2 = Math.sqrt(x * x + y * y);
    if (r2 < ir || r2 > r) { onHover(null); return; }
    let ang = Math.atan2(y, x);
    if (ang < 0) ang += Math.PI * 2;
    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      if (ang >= s.start && ang <= s.end) {
        const key = s.key || `Slice ${i+1}`;
        const pct = (s.frac || ((s.end - s.start) / (Math.PI * 2))) * 100;
        onHover({ key, pct });
        return;
      }
    }
    onHover(null);
  };
  const handleLeave = () => onHover && onHover(null);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" onMouseMove={handleMove} onMouseLeave={handleLeave}>
      {paths}
    </svg>
  );
}
