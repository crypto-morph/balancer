export function normalizeNumberString(s: string): string {
  let x = (s || "").trim();
  if (!x) return x;
  x = x.replace(/[$£€\s]/g, "");
  // keep only digits, dot, comma and minus
  x = x.replace(/[^0-9.,-]/g, "");
  const lastDot = x.lastIndexOf(".");
  const lastComma = x.lastIndexOf(",");
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
}

export function toNumber(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const n = Number(normalizeNumberString(s));
  return Number.isFinite(n) ? n : null;
}
