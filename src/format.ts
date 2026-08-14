export function formatTokens(n: number): string {
  const rounded = Math.round(n);
  if (Math.abs(rounded) >= 1_000_000) return `${(rounded / 1_000_000).toFixed(2)}M`;
  if (Math.abs(rounded) >= 1_000) return `${(rounded / 1_000).toFixed(1)}K`;
  return String(rounded);
}

export function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (Math.abs(usd) < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatPercent(fraction: number): string {
  const pct = fraction * 100;
  if (!Number.isFinite(pct)) return '0%';
  return `${pct < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`;
}
