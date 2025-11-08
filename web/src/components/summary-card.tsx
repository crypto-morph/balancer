"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

type Summary = {
  total_gbp: number;
  cost_basis_gbp?: number;
  net_gbp?: number;
  delta_1d_gbp: number;
  delta_1m_gbp: number;
  pct_1d_gbp: number;
  pct_1m_gbp: number;
};

function money(n: number) {
  const v = n || 0;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function delta(n: number, pct: number) {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const cls = n > 0 ? "text-emerald-600" : n < 0 ? "text-red-600" : "text-zinc-500";
  return <span className={cls}>{`${sign}${money(abs)} (${pct.toFixed(2)}%)`}</span>;
}

export function SummaryCard() {
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/portfolio/summary", { cache: "no-store" });
        const j = (await r.json()) as Summary;
        setS(j);
      } catch {}
    }
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="p-4">
      <div className="text-sm font-medium mb-2">Portfolio</div>
      <div className="flex flex-col gap-2">
        <div className="text-2xl font-semibold">{money(s?.net_gbp ?? 0)}</div>
        <div className="text-sm text-zinc-600 flex gap-4">
          <div>1d: {delta(s?.delta_1d_gbp || 0, s?.pct_1d_gbp || 0)}</div>
          <div>1m: {delta(s?.delta_1m_gbp || 0, s?.pct_1m_gbp || 0)}</div>
        </div>
      </div>
    </Card>
  );
}
