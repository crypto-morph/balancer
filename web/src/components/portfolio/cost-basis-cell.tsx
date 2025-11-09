"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { CCY, formatMoney, moneyClass } from "@/components/portfolio/format";

export function CostBasisCell({
  isEditing,
  ccy,
  cbDisplay,
  editCB,
  setEditCB,
}: {
  isEditing: boolean;
  ccy: CCY;
  cbDisplay: number; // already in selected ccy, negative for display if desired by caller
  editCB: string;
  setEditCB: (v: string) => void;
}) {
  return (
    <>
      {isEditing ? (
        <Input
          type="number"
          inputMode="decimal"
          value={editCB}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditCB(e.target.value)}
          className="h-8 text-right"
          placeholder={`Cost Basis (${ccy})`}
        />
      ) : (
        <span className={moneyClass(cbDisplay)}>{formatMoney(ccy, cbDisplay)}</span>
      )}
    </>
  );
}
