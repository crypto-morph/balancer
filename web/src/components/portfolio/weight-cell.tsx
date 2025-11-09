"use client";

import React from "react";

export function WeightCell({ mv, total }: { mv: number; total: number }) {
  const pct = total > 0 ? (mv / total) * 100 : 0;
  return <>{total > 0 ? `${pct.toFixed(2)}%` : "-"}</>;
}
