"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { formatCoins } from "@/components/portfolio/format";

export function CoinsCell({
  isEditing,
  coins,
  decimals,
  editCoins,
  setEditCoins,
}: {
  isEditing: boolean;
  coins: number;
  decimals: number;
  editCoins: string;
  setEditCoins: (v: string) => void;
}) {
  return (
    <>
      {isEditing ? (
        <Input
          type="number"
          inputMode="decimal"
          value={editCoins}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditCoins(e.target.value)}
          className="h-8 text-right"
          placeholder={coins.toFixed(decimals)}
        />
      ) : (
        formatCoins(coins, decimals)
      )}
    </>
  );
}
