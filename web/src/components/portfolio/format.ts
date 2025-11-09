export type CCY = "USD" | "GBP" | "BTC";

export function formatMoney(ccy: CCY, value: number): string {
  const v = value ?? 0;
  if (ccy === "USD") return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  if (ccy === "GBP") return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(v)} BTC`;
}

export function formatPrice(ccy: CCY, value: number): string {
  const v = value ?? 0;
  if (ccy === "USD") return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  if (ccy === "GBP") return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(v)} BTC`;
}

export function formatCoins(value: number, decimals: number): string {
  const v = value ?? 0;
  const places = Math.max(0, decimals || 0);
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: places }).format(v);
}

export function moneyClass(value: number): string {
  return value < 0 ? "text-red-600" : value > 0 ? "text-emerald-700" : "";
}
