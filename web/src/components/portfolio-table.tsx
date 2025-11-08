"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

 type AssetRow = {
  symbol: string;
  name: string;
  is_stable: boolean;
  is_fiat: boolean;
  coins: number;
  price_usd: number;
  mv_usd: number;
  cb_usd: number;
 };

 type Portfolio = {
  as_of: string | null;
  portfolio?: string;
  total_mv_usd: number;
  assets: AssetRow[];
 };

 const CCYS = ["USD", "GBP", "BTC"] as const;
 type CCY = typeof CCYS[number];

 export function PortfolioTable() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [ccy] = useState<CCY>("USD"); // toggle placeholder, USD only for now

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portfolio", { cache: "no-store" });
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const { stables, nonStables } = useMemo(() => {
    const assets = data?.assets ?? [];
    const st = assets.filter((a) => a.is_stable || a.is_fiat);
    const ns = assets.filter((a) => !a.is_stable && !a.is_fiat);
    return { stables: st, nonStables: ns };
  }, [data]);

  if (!data) {
    return <div className="text-sm text-zinc-500">Loading portfolio…</div>;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">Portfolio (as of {data.as_of ? new Date(data.as_of).toLocaleString() : "-"})</div>
        <div className="text-sm text-zinc-500">Total MV (USD): ${data.total_mv_usd.toFixed(2)}</div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead className="text-right">Coins</TableHead>
            <TableHead className="text-right">Price (USD)</TableHead>
            <TableHead className="text-right">MV (USD)</TableHead>
            <TableHead className="text-right">CB (USD)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nonStables.map((a) => (
            <TableRow key={a.symbol}>
              <TableCell className="font-medium">{a.symbol}</TableCell>
              <TableCell className="text-right">{a.coins.toFixed(6)}</TableCell>
              <TableCell className="text-right">{a.price_usd.toFixed(4)}</TableCell>
              <TableCell className="text-right">{a.mv_usd.toFixed(2)}</TableCell>
              <TableCell className="text-right">{a.cb_usd.toFixed(2)}</TableCell>
            </TableRow>
          ))}
          {stables.length > 0 && (
            <TableRow>
              <TableCell className="font-medium">
                Stablecoins <Badge className="ml-2" variant="secondary">{stables.length}</Badge>
              </TableCell>
              <TableCell className="text-right">{stables.reduce((s, a) => s + a.coins, 0).toFixed(2)}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{stables.reduce((s, a) => s + a.mv_usd, 0).toFixed(2)}</TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
 }
