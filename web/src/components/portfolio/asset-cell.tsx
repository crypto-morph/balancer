"use client";

import React from "react";
import { MarketCapBadge } from "@/components/market-cap-badge";
import { CCY } from "@/components/portfolio/format";

export function AssetCell({
  symbol,
  iconUrl,
  coingeckoId,
  caps,
  price_usd,
  price_gbp,
  price_btc,
  ccy,
}: {
  symbol: string;
  iconUrl?: string;
  coingeckoId?: string;
  caps: Record<string, number>;
  price_usd: number;
  price_gbp?: number;
  price_btc?: number;
  ccy: CCY;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {iconUrl && (
        <img
          src={iconUrl}
          alt={symbol}
          className="h-5 w-5 rounded-full border border-zinc-200 bg-white"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      {symbol}
      <MarketCapBadge
        coingeckoId={coingeckoId}
        caps={caps}
        price_usd={price_usd}
        price_gbp={price_gbp}
        price_btc={price_btc}
        ccy={ccy}
      />
    </span>
  );
}
