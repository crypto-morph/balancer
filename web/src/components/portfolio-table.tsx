"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketCapBadge } from "@/components/market-cap-badge";

 type AssetRow = {
  symbol: string;
  name: string;
  coingecko_id?: string;
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

  function header(label: string, key: typeof sortKey, alignRight = false) {
    const active = sortKey === key;
    const dir = active ? (sortDir === "asc" ? "↑" : "↓") : "";
    return (
      <button
        type="button"
        className={`flex items-center gap-1 ${alignRight ? "justify-end w-full" : ""}`}
        onClick={() => {
          if (active) setSortDir(sortDir === "asc" ? "desc" : "asc");
          else { setSortKey(key); setSortDir(key === "asset" ? "asc" : "desc"); }
        }}
        title={active ? `Sorting ${sortDir}` : "Click to sort"}
      >
        <span>{label}</span>
        <span className="text-xs text-zinc-500">{dir}</span>
      </button>
    );
  }

  function totalForCcy(): number {
    if (!data) return 0;
    if (ccy === "USD") return data.total_mv_usd ?? 0;
    if (ccy === "GBP") return (data as any).total_mv_gbp ?? 0;
    return (data as any).total_mv_btc ?? 0;
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
    if (ccy === "GBP") return (a as any).price_gbp ?? 0;
    return (a as any).price_btc ?? 0;
  }

  function mvFor(a: AssetRow): number {
    if (ccy === "USD") return a.mv_usd ?? 0;
    if (ccy === "GBP") return (a as any).mv_gbp ?? 0;
    return (a as any).mv_btc ?? 0;
  }

  function cbFor(a: AssetRow): number {
    const cb_usd = a.cb_usd ?? 0;
    if (ccy === "USD") return cb_usd;
    // derive FX from per-asset prices to convert USD -> target ccy
    const p_usd = a.price_usd ?? 0;
    if (ccy === "GBP") {
      const p_gbp = (a as any).price_gbp ?? 0;
      const fx = p_gbp > 0 ? (p_usd / p_gbp) : 0; // USD per GBP
      return fx > 0 ? cb_usd / fx : 0;
    }
    const p_btc = (a as any).price_btc ?? 0;
    const fxb = p_btc > 0 ? (p_usd / p_btc) : 0; // USD per BTC
    return fxb > 0 ? cb_usd / fxb : 0;
  }

  function formatMoney(value: number): string {
    const v = value ?? 0;
    if (ccy === "USD") return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    if (ccy === "GBP") return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(v)} BTC`;
  }

  function formatPrice(value: number): string {
    const v = value ?? 0;
    if (ccy === "USD") return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    if (ccy === "GBP") return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(v)} BTC`;
  }

  function formatCoins(value: number, decimals: number): string {
    const v = value ?? 0;
    const places = Math.max(0, decimals || 0);
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: places }).format(v);
  }

  function moneyClass(value: number): string {
    return value < 0 ? "text-red-600" : value > 0 ? "text-emerald-700" : "";
  }

  function iconUrlForRow(a: AssetRow): string | undefined {
    if (a.coingecko_id && cgImages[a.coingecko_id]) return cgImages[a.coingecko_id];
    const s = a.symbol.toLowerCase();
    return `https://cryptoicon-api.vercel.app/api/icon/${s}`;
  }

  function marketCapFor(a: AssetRow): number {
    const capUsd = a.coingecko_id ? cgCaps[a.coingecko_id] ?? 0 : 0;
    if (!capUsd) return 0;
    if (ccy === 'USD') return capUsd;
    const p_usd = a.price_usd ?? 0;
    if (ccy === 'GBP') {
      const p_gbp = (a as any).price_gbp ?? 0;
      const usd_per_gbp = p_gbp > 0 ? (p_usd / p_gbp) : 0;
      return usd_per_gbp > 0 ? capUsd / usd_per_gbp : 0;
    }
    const p_btc = (a as any).price_btc ?? 0;
    const usd_per_btc = p_btc > 0 ? (p_usd / p_btc) : 0;
    return usd_per_btc > 0 ? capUsd / usd_per_btc : 0;
  }

  function marketCapBand(capUsd: number): { label: string; className: string } {
    // thresholds in USD
    if (capUsd >= 10_000_000_000) return { label: 'huge', className: 'bg-emerald-100 text-emerald-700' };
    if (capUsd >= 2_000_000_000) return { label: 'large', className: 'bg-green-100 text-green-700' };
    if (capUsd >= 300_000_000) return { label: 'medium', className: 'bg-amber-100 text-amber-700' };
    if (capUsd >= 50_000_000) return { label: 'small', className: 'bg-yellow-100 text-yellow-700' };
    return { label: 'micro', className: 'bg-zinc-200 text-zinc-800' };
  }

  function formatCompact(n: number): string {
    if (!n) return '0';
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${(n/1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(n/1_000).toFixed(2)}K`;
    return n.toFixed(2);
  }

  async function applyEdit(symbol: string) {
    try {
      setSaving(true);
      const payload: any = { symbol };
      // normalize numbers from various locales (commas or dots as thousand/decimal)
      const normalize = (s: string) => {
        let x = s.trim();
        if (!x) return x;
        x = x.replace(/[$£€\s]/g, "");
        // keep only digits, dot, comma
        x = x.replace(/[^0-9.,-]/g, "");
        const lastDot = x.lastIndexOf('.');
        const lastComma = x.lastIndexOf(',');
        // decide decimal separator as the rightmost of dot/comma
        const decIdx = Math.max(lastDot, lastComma);
        let intPart = x;
        let fracPart = "";
        if (decIdx > 0) {
          intPart = x.slice(0, decIdx);
          fracPart = x.slice(decIdx + 1);
        }
        // remove all separators from intPart
        intPart = intPart.replace(/[.,]/g, "");
        // remove all separators from fracPart (just in case), then rebuild with '.'
        fracPart = fracPart.replace(/[.,]/g, "");
        return decIdx > 0 ? `${intPart}.${fracPart}` : intPart;
      };
      const toNum = (s: string) => {
        if (s.trim() === "") return null;
        const n = Number(normalize(s));
        return Number.isFinite(n) ? n : null;
      };
      const nCoins = toNum(editCoins);
      const nAvg = toNum(editAvg);
      const nCB = toNum(editCB);
      if (nCoins !== null) payload.coins = nCoins;
      if (nAvg !== null) payload.avg_cost_per_unit = nAvg;
      if (nCB !== null) {
        // convert from current display currency to USD if needed
        const row = (data?.assets || []).find((r) => r.symbol === symbol) as any;
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
            <TableHead>{header("Asset", "asset")}</TableHead>
            <TableHead className="text-right">{header("Coins", "coins", true)}</TableHead>
            <TableHead className="text-right">{header(`Price (${ccy})`, "price", true)}</TableHead>
            <TableHead className="text-right">{header(`Market Value (${ccy})`, "mv", true)}</TableHead>
            <TableHead className="text-right">{header(`Cost Basis (${ccy})`, "cb", true)}</TableHead>
            <TableHead className="text-right">{header("Weight", "weight", true)}</TableHead>
          </TableRow>
        </TableHeader>
        {/* Market cap legend */}
        <caption className="caption-bottom text-xs text-zinc-500 mt-2">
          <span className="inline-flex items-center gap-2">
            <span className="px-1.5 py-[2px] rounded bg-zinc-200 text-zinc-800">micro</span>
            <span className="px-1.5 py-[2px] rounded bg-yellow-100 text-yellow-700">small</span>
            <span className="px-1.5 py-[2px] rounded bg-amber-100 text-amber-700">medium</span>
            <span className="px-1.5 py-[2px] rounded bg-green-100 text-green-700">large</span>
            <span className="px-1.5 py-[2px] rounded bg-emerald-100 text-emerald-700">huge</span>
          </span>
        </caption>
        <TableBody>
          {sortedNonStables.map((a) => {
            const isEditing = editing === a.symbol;
            const decimals = coinDecimals(a.price_usd);
            return (
              <TableRow key={a.symbol}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    <img
                      src={iconUrlForRow(a)}
                      alt={a.symbol}
                      className="h-5 w-5 rounded-full border border-zinc-200 bg-white"
                      onError={(e) => {
                        // hide broken icons
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {a.symbol}
                    <MarketCapBadge
                      coingeckoId={a.coingecko_id}
                      caps={cgCaps}
                      price_usd={a.price_usd}
                      price_gbp={(a as any).price_gbp}
                      price_btc={(a as any).price_btc}
                      ccy={ccy}
                    />
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={editCoins}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditCoins(e.target.value)}
                      className="h-8 text-right"
                      placeholder={a.coins.toFixed(decimals)}
                    />
                  ) : (
                    formatCoins(a.coins, decimals)
                  )}
                </TableCell>
                <TableCell className="text-right">{formatPrice(priceFor(a))}</TableCell>
                <TableCell className="text-right">{formatMoney(mvFor(a))}</TableCell>
                <TableCell className="text-right">
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
                    <span className={moneyClass(-Math.abs(cbFor(a)))}>{formatMoney(-Math.abs(cbFor(a)))}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const tot = totalForCcy() || 0;
                    const mv = mvFor(a) || 0;
                    return tot > 0 ? `${((mv / tot) * 100).toFixed(2)}%` : "-";
                  })()}
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
                        const p_gbp = (a as any).price_gbp ?? 0;
                        const fx = p_gbp > 0 ? (p_usd / p_gbp) : 0; // USD per GBP
                        prefill = fx > 0 ? cbUsd / fx : 0;
                      } else if (ccy === 'BTC') {
                        const p_usd = a.price_usd ?? 0;
                        const p_btc = (a as any).price_btc ?? 0;
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
        <tfoot>
          <TableRow>
            <TableCell className="font-medium">Total</TableCell>
            <TableCell></TableCell>
            <TableCell></TableCell>
            <TableCell className="text-right font-semibold">{formatMoney((data.assets || []).reduce((s, a:any) => s + mvFor(a), 0))}</TableCell>
            <TableCell className="text-right font-semibold">
              {(() => { const v = -Math.abs((data.assets || []).reduce((s, a:any) => s + cbFor(a), 0)); return <span className={moneyClass(v)}>{formatMoney(v)}</span>; })()}
            </TableCell>
            <TableCell className="text-right">100%</TableCell>
            <TableCell></TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Profit / Loss</TableCell>
            <TableCell></TableCell>
            <TableCell></TableCell>
            <TableCell className="text-right font-semibold">
              {(() => { const v = (data.assets || []).reduce((s, a:any) => s + (mvFor(a) - cbFor(a)), 0); return <span className={moneyClass(v)}>{formatMoney(v)}</span>; })()}
            </TableCell>
            <TableCell></TableCell>
            <TableCell></TableCell>
            <TableCell></TableCell>
          </TableRow>
        </tfoot>
      </Table>
    </Card>
  );
 }
