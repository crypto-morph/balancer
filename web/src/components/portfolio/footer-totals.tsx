"use client";

import React from "react";
import { CCY, formatMoney, moneyClass } from "@/components/portfolio/format";

export function FooterTotals({
  ccy,
  totalMV,
  totalCB,
  totalPL,
}: {
  ccy: CCY;
  totalMV: number;
  totalCB: number; // expected negative for display
  totalPL: number;
}) {
  return (
    <tfoot>
      <tr>
        <td className="font-medium">Total</td>
        <td></td>
        <td></td>
        <td className="text-right font-semibold">{formatMoney(ccy, totalMV)}</td>
        <td className="text-right font-semibold"><span className={moneyClass(totalCB)}>{formatMoney(ccy, totalCB)}</span></td>
        <td className="text-right">100%</td>
        <td></td>
      </tr>
      <tr>
        <td className="font-medium">Profit / Loss</td>
        <td></td>
        <td></td>
        <td className="text-right font-semibold"><span className={moneyClass(totalPL)}>{formatMoney(ccy, totalPL)}</span></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    </tfoot>
  );
}
