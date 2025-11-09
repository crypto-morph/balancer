"use client";

import React from "react";

export function MarketCapLegend() {
  return (
    <caption className="caption-bottom text-xs text-zinc-500 mt-2">
      <span className="inline-flex items-center gap-2">
        <span className="px-1.5 py-[2px] rounded bg-zinc-200 text-zinc-800">micro</span>
        <span className="px-1.5 py-[2px] rounded bg-yellow-100 text-yellow-700">small</span>
        <span className="px-1.5 py-[2px] rounded bg-amber-100 text-amber-700">medium</span>
        <span className="px-1.5 py-[2px] rounded bg-green-100 text-green-700">large</span>
        <span className="px-1.5 py-[2px] rounded bg-emerald-100 text-emerald-700">huge</span>
      </span>
    </caption>
  );
}
