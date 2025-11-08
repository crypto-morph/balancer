"use client";

import React from "react";

type Props = {
  coingeckoId?: string;
  caps: Record<string, number>;
  price_usd?: number;
  price_gbp?: number;
  price_btc?: number;
  ccy: "USD" | "GBP" | "BTC";
};

function marketCapBand(capUsd: number): { label: string; className: string } {
  if (capUsd >= 10_000_000_000) return { label: "huge", className: "bg-emerald-100 text-emerald-700" };
  if (capUsd >= 2_000_000_000) return { label: "large", className: "bg-green-100 text-green-700" };
  if (capUsd >= 300_000_000) return { label: "medium", className: "bg-amber-100 text-amber-700" };
  if (capUsd >= 50_000_000) return { label: "small", className: "bg-yellow-100 text-yellow-700" };
  return { label: "micro", className: "bg-zinc-200 text-zinc-800" };
}

function formatMoney(ccy: "USD" | "GBP" | "BTC", value: number): string {
  const v = value ?? 0;
  if (ccy === "USD") return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  if (ccy === "GBP") return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(v)} BTC`;
}

export function MarketCapBadge({ coingeckoId, caps, price_usd = 0, price_gbp = 0, price_btc = 0, ccy }: Props) {
  if (!coingeckoId) return null;
  const capUsd = caps[coingeckoId] ?? 0;
  if (!capUsd) return null;
  const band = marketCapBand(capUsd);
  // convert cap to selected currency using per-asset FX ratios
  let capCcy = capUsd;
  if (ccy === "GBP") {
    const usd_per_gbp = price_gbp > 0 ? (price_usd / price_gbp) : 0;
    capCcy = usd_per_gbp > 0 ? capUsd / usd_per_gbp : 0;
  } else if (ccy === "BTC") {
    const usd_per_btc = price_btc > 0 ? (price_usd / price_btc) : 0;
    capCcy = usd_per_btc > 0 ? capUsd / usd_per_btc : 0;
  }
  const tip = `${formatMoney(ccy, capCcy)}`;
  const href = `https://www.coingecko.com/en/coins/${coingeckoId}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`ml-2 px-1.5 py-[2px] rounded text-[10px] font-medium underline-offset-2 hover:underline ${band.className}`}
      title={`Market cap: ${tip}`}
    >
      {band.label}
    </a>
  );
}
