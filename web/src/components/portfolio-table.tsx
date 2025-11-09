"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney as _formatMoney, formatPrice as _formatPrice, formatCoins as _formatCoins, moneyClass as _moneyClass } from "@/components/portfolio/format";
import { CoinsCell } from "@/components/portfolio/coins-cell";
import { CostBasisCell } from "@/components/portfolio/cost-basis-cell";
import { FooterTotals } from "@/components/portfolio/footer-totals";
import { MarketCapLegend } from "@/components/portfolio/market-cap-legend";
import { WeightCell } from "@/components/portfolio/weight-cell";
import { AssetCell } from "@/components/portfolio/asset-cell";
import { toNumber } from "@/components/portfolio/normalize";
import { SortableHeader } from "@/components/portfolio/sortable-header";

 type AssetRow = {
  symbol: string;
  name: string;
  coingecko_id?: string;
  is_stable: boolean;
  is_fiat: boolean;
  coins: number;
  price_usd: number;
  price_gbp?: number;
  price_btc?: number;
  mv_usd: number;
  mv_gbp?: number;
  mv_btc?: number;
  cb_usd: number;
 };

 type Portfolio = {
  as_of: string | null;
  portfolio?: string;
  total_mv_usd: number;
  total_mv_gbp?: number;
  total_mv_btc?: number;
  assets: AssetRow[];
 };

 const CCYS = ["USD", "GBP", "BTC"] as const;
 type CCY = typeof CCYS[number];

export function PortfolioTable() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [ccy, setCcy] = useState<CCY>("USD");
  const [editing, setEditing] = useState<string | null>(null);
  const [editCoins, setEditCoins] = useState<string>("");
  const [editAvg, setEditAvg] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [editCB, setEditCB] = useState<string>("");
  const [cgImages, setCgImages] = useState<Record<string, string>>({}); // coingecko_id -> image URL
  const [cgCaps, setCgCaps] = useState<Record<string, number>>({}); // coingecko_id -> market cap USD
  const [sortKey, setSortKey] = useState<"asset"|"coins"|"price"|"mv"|"cb"|"weight">("weight");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portfolio", { cache: "no-store" });
        const json = await res.json();
        setData(json);
      } catch (e) {
        // ignore
      }
    }
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  // Fetch icon URLs via backend proxy to reduce client-side calls and handle API key
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/icons', { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json() as { images: Record<string, string>, caps?: Record<string, number> }
        if (!cancelled) {
          setCgImages(j.images || {})
          setCgCaps(j.caps || {})
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [data?.as_of])

  const { stables, nonStables } = useMemo(() => {
    const assets = data?.assets ?? [];
    const st = assets.filter((a) => a.is_stable || a.is_fiat);
    const ns = assets.filter((a) => !a.is_stable && !a.is_fiat);
    return { stables: st, nonStables: ns };
  }, [data]);

  const sortedNonStables = useMemo(() => {
    const arr = [...nonStables];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "asset":
          return a.symbol.localeCompare(b.symbol) * dir;
        case "coins":
          return (a.coins - b.coins) * dir;
        case "price":
          return (priceFor(a) - priceFor(b)) * dir;
        case "mv":
          return (mvFor(a) - mvFor(b)) * dir;
        case "cb":
          return (cbFor(a) - cbFor(b)) * dir;
        case "weight":
        default:
          return (weightFor(a) - weightFor(b)) * dir;
      }
    });
    return arr;
  }, [nonStables, sortKey, sortDir, ccy, data]);

  // header rendering handled by SortableHeader component

  function totalForCcy(): number {
    if (!data) return 0;
    if (ccy === "USD") return data.total_mv_usd ?? 0;
    if (ccy === "GBP") return (data as Portfolio & { total_mv_gbp?: number }).total_mv_gbp ?? 0;
    return (data as Portfolio & { total_mv_btc?: number }).total_mv_btc ?? 0;
  }

  function weightFor(a: AssetRow): number {
    const tot = totalForCcy() || 0;
    const mv = mvFor(a) || 0;
    return tot > 0 ? mv / tot : 0;
  }

  function coinDecimals(price: number): number {
    // Aim for coin precision so that a single least-significant digit ~ $1 change.
    // For low-priced assets (<1 unit of the selected ccy), prefer 0 decimals for cleaner display.
    if (!price || price <= 0) return 2;
    if (price < 1) return 0;
    const dec = Math.ceil(Math.log10(price)) + 1; // e.g., 80k -> 6 decimals
    return Math.max(0, Math.min(8, dec));
  }

  function priceFor(a: AssetRow): number {
    if (ccy === "USD") return a.price_usd ?? 0;
    if (ccy === "GBP") return a.price_gbp ?? 0;
    return a.price_btc ?? 0;
  }

  function mvFor(a: AssetRow): number {
    if (ccy === "USD") return a.mv_usd ?? 0;
    if (ccy === "GBP") return a.mv_gbp ?? 0;
    return a.mv_btc ?? 0;
  }

  function cbFor(a: AssetRow): number {
    const cb_usd = a.cb_usd ?? 0;
    if (ccy === "USD") return cb_usd;
    // derive FX from per-asset prices to convert USD -> target ccy
    const p_usd = a.price_usd ?? 0;
    if (ccy === "GBP") {
      const p_gbp = a.price_gbp ?? 0;
      const fx = p_gbp > 0 ? (p_usd / p_gbp) : 0; // USD per GBP
      return fx > 0 ? cb_usd / fx : 0;
    }
    const p_btc = a.price_btc ?? 0;
    const fxb = p_btc > 0 ? (p_usd / p_btc) : 0; // USD per BTC
    return fxb > 0 ? cb_usd / fxb : 0;
  }

  function formatMoney(value: number): string {
    return _formatMoney(ccy, value);
  }

  function formatPrice(value: number): string {
    return _formatPrice(ccy, value);
  }

  function formatCoins(value: number, decimals: number): string {
    return _formatCoins(value, decimals);
  }

  function moneyClass(value: number): string {
    return _moneyClass(value);
  }

  function iconUrlForRow(a: AssetRow): string | undefined {
    if (a.coingecko_id && cgImages[a.coingecko_id]) return cgImages[a.coingecko_id];
    const s = a.symbol.toLowerCase();
    return `https://cryptoicon-api.vercel.app/api/icon/${s}`;
  }


  async function applyEdit(symbol: string) {
    try {
      setSaving(true);
      const payload: { symbol: string; coins?: number; avg_cost_per_unit?: number; cost_basis_usd?: number } = { symbol };
      const nCoins = toNumber(editCoins);
      const nAvg = toNumber(editAvg);
      const nCB = toNumber(editCB);
      if (nCoins !== null) payload.coins = nCoins;
      if (nAvg !== null) payload.avg_cost_per_unit = nAvg;
      if (nCB !== null) {
        // convert from current display currency to USD if needed
        const row = (data?.assets || []).find((r) => r.symbol === symbol);
        let cb_usd = nCB;
        if (ccy === 'GBP') {
          const p_usd = row?.price_usd ?? 0;
          const p_gbp = row?.price_gbp ?? 0;
          const fx = p_gbp > 0 ? (p_usd / p_gbp) : 0; // USD per GBP
          if (fx > 0) cb_usd = nCB * fx;
        } else if (ccy === 'BTC') {
          const p_usd = row?.price_usd ?? 0;
          const p_btc = row?.price_btc ?? 0;
          const fx = p_btc > 0 ? (p_usd / p_btc) : 0; // USD per BTC
          if (fx > 0) cb_usd = nCB * fx;
        }
        payload.cost_basis_usd = cb_usd;
      }
      // If any provided value failed to parse, block submit with a clear message
      if ((editCoins.trim() !== "" && nCoins === null) || (editAvg.trim() !== "" && nAvg === null) || (editCB.trim() !== "" && nCB === null)) {
        throw new Error("Please enter valid numbers (no commas or symbols) for the edited fields.");
      }
      const res = await fetch("/api/positions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "update_failed");
      // Refresh portfolio
      const pr = await fetch("/api/portfolio", { cache: "no-store" });
      setData(await pr.json());
      // Refresh icons (in case new assets/ids were introduced)
      try {
        const ir = await fetch('/api/icons', { cache: 'no-store' });
        if (ir.ok) {
          const ij = await ir.json();
          setCgImages(ij.images || {});
        }
      } catch {}
      setEditing(null);
      setEditCoins("");
      setEditAvg("");
      setEditCB("");
    } catch (e) {
      alert((e as Error).message || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return <div className="text-sm text-zinc-500">Loading portfolio…</div>;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">Portfolio (as of {data.as_of ? new Date(data.as_of).toLocaleString() : "-"})</div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-zinc-500 hidden sm:block">Currency</div>
          <Tabs value={ccy} onValueChange={(v) => setCcy(v as CCY)}>
            <TabsList>
              {CCYS.map((x) => (
                <TabsTrigger key={x} value={x}>
                  {x}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader
                label="Asset"
                columnKey="asset"
                activeKey={sortKey}
                dir={sortDir}
                setKey={(k) => setSortKey(k as "asset"|"coins"|"price"|"mv"|"cb"|"weight")}
                setDir={setSortDir}
              />
            </TableHead>
            <TableHead className="text-right">
              <SortableHeader
                label="Coins"
                columnKey="coins"
                activeKey={sortKey}
                dir={sortDir}
                setKey={(k) => setSortKey(k as "asset"|"coins"|"price"|"mv"|"cb"|"weight")}
                setDir={setSortDir}
                alignRight
              />
            </TableHead>
            <TableHead className="text-right">
              <SortableHeader
                label={`Price (${ccy})`}
                columnKey="price"
                activeKey={sortKey}
                dir={sortDir}
                setKey={(k) => setSortKey(k as "asset"|"coins"|"price"|"mv"|"cb"|"weight")}
                setDir={setSortDir}
                alignRight
              />
            </TableHead>
            <TableHead className="text-right">
              <SortableHeader
                label={`Market Value (${ccy})`}
                columnKey="mv"
                activeKey={sortKey}
                dir={sortDir}
                setKey={(k) => setSortKey(k as "asset"|"coins"|"price"|"mv"|"cb"|"weight")}
                setDir={setSortDir}
                alignRight
              />
            </TableHead>
            <TableHead className="text-right">
              <SortableHeader
                label={`Cost Basis (${ccy})`}
                columnKey="cb"
                activeKey={sortKey}
                dir={sortDir}
                setKey={(k) => setSortKey(k as "asset"|"coins"|"price"|"mv"|"cb"|"weight")}
                setDir={setSortDir}
                alignRight
              />
            </TableHead>
            <TableHead className="text-right">
              <SortableHeader
                label="Weight"
                columnKey="weight"
                activeKey={sortKey}
                dir={sortDir}
                setKey={(k) => setSortKey(k as "asset"|"coins"|"price"|"mv"|"cb"|"weight")}
                setDir={setSortDir}
                alignRight
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        {/* Market cap legend */}
        <MarketCapLegend />
        <TableBody>
          {sortedNonStables.map((a) => {
            const isEditing = editing === a.symbol;
            const decimals = coinDecimals(a.price_usd);
            return (
              <TableRow key={a.symbol}>
                <TableCell className="font-medium">
                  <AssetCell
                    symbol={a.symbol}
                    iconUrl={iconUrlForRow(a)}
                    coingeckoId={a.coingecko_id}
                    caps={cgCaps}
                    price_usd={a.price_usd}
                    price_gbp={a.price_gbp}
                    price_btc={a.price_btc}
                    ccy={ccy}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <CoinsCell isEditing={isEditing} coins={a.coins} decimals={decimals} editCoins={editCoins} setEditCoins={setEditCoins} />
                </TableCell>
                <TableCell className="text-right">{formatPrice(priceFor(a))}</TableCell>
                <TableCell className="text-right">{formatMoney(mvFor(a))}</TableCell>
                <TableCell className="text-right">
                  <CostBasisCell isEditing={isEditing} ccy={ccy} cbDisplay={-Math.abs(cbFor(a))} editCB={editCB} setEditCB={setEditCB} />
                </TableCell>
                <TableCell className="text-right">
                  <WeightCell mv={mvFor(a) || 0} total={totalForCcy() || 0} />
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" disabled={saving} onClick={() => applyEdit(a.symbol)}>
                        {saving ? "Saving…" : "Apply"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { setEditing(null); setEditCoins(""); setEditAvg(""); setEditCB(""); }}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => {
                      setEditing(a.symbol);
                      setEditCoins(a.coins.toString());
                      setEditAvg("");
                      // Prefill CB in current currency from cb_usd via FX
                      const cbUsd = a.cb_usd ?? 0;
                      let prefill = cbUsd;
                      if (ccy === 'GBP') {
                        const p_usd = a.price_usd ?? 0;
                        const p_gbp = a.price_gbp ?? 0;
                        const fx = p_gbp > 0 ? (p_usd / p_gbp) : 0; // USD per GBP
                        prefill = fx > 0 ? cbUsd / fx : 0;
                      } else if (ccy === 'BTC') {
                        const p_usd = a.price_usd ?? 0;
                        const p_btc = a.price_btc ?? 0;
                        const fx = p_btc > 0 ? (p_usd / p_btc) : 0; // USD per BTC
                        prefill = fx > 0 ? cbUsd / fx : 0;
                      }
                      setEditCB(prefill ? String(prefill) : "");
                    }}>
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {stables.length > 0 && (
            <TableRow>
              <TableCell className="font-medium">
                Stablecoins <Badge className="ml-2" variant="secondary">{stables.length}</Badge>
              </TableCell>
              <TableCell className="text-right">{formatCoins(stables.reduce((s, a) => s + a.coins, 0), 2)}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{stables.reduce((s, a) => s + a.mv_usd, 0).toFixed(2)}</TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
          )}
        </TableBody>
        {/* Totals row */}
        {(() => {
          const totalMV = (data.assets || []).reduce((s, a: AssetRow) => s + mvFor(a), 0);
          const totalCB = -Math.abs((data.assets || []).reduce((s, a: AssetRow) => s + cbFor(a), 0));
          const totalPL = (data.assets || []).reduce((s, a: AssetRow) => s + (mvFor(a) - cbFor(a)), 0);
          return <FooterTotals ccy={ccy} totalMV={totalMV} totalCB={totalCB} totalPL={totalPL} />
        })()}
      </Table>
    </Card>
  );
 }
