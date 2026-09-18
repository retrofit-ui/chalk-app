// Shared value -> color mapping, extracted from MatrixHeatmap.tsx so both the 2D matrix
// heatmap and the 3D surface renderer (Scene3D.tsx) use identical sequential/diverging
// color math. Pure numeric logic only — no DOM/three.js/Solid involved.

export type RGB = [number, number, number];

const WHITE: RGB = [255, 255, 255];
const DIVERGING_NEG: RGB = [37, 99, 235]; // #2563eb, matches PALETTE blue
const DIVERGING_POS: RGB = [220, 38, 38]; // #dc2626, matches PALETTE red

export const interpolateColor = (c1: RGB, c2: RGB, t: number): RGB => {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * clamped),
    Math.round(c1[1] + (c2[1] - c1[1]) * clamped),
    Math.round(c1[2] + (c2[2] - c1[2]) * clamped),
  ];
};

export const rgbToCss = (rgb: RGB): string => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

// Sequential scale: fixed hue ~217 (blue), sat ~70%, lightness 97% (low) -> 35% (high).
export const hslToRgb = (h: number, s: number, l: number): RGB => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};

export const luminance = (rgb: RGB): number => 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];

export const textColor = (rgb: RGB): string => (luminance(rgb) < 140 ? '#ffffff' : '#1e293b');

// Maps a scalar `v` within [min, max] (or, for diverging, within [-maxAbs, maxAbs]) to an RGB
// color. Used for matrix cell backgrounds and, in Scene3D, per-vertex surface coloring by z-height.
export const cellRgb = (
  v: number,
  min: number,
  max: number,
  scale: 'sequential' | 'diverging',
): RGB => {
  if (scale === 'diverging') {
    // Normalize by max absolute magnitude (not min/max range) so that v=0 always
    // maps to true white, regardless of how skewed min/max are — this keeps
    // e.g. off-diagonal entries visually stable when comparing X^T X to X^T X + λI,
    // where only the diagonal shifts.
    const maxAbs = Math.max(Math.abs(min), Math.abs(max));
    if (maxAbs === 0) return WHITE;
    const t = v / maxAbs;
    return t < 0
      ? interpolateColor(WHITE, DIVERGING_NEG, -t)
      : interpolateColor(WHITE, DIVERGING_POS, t);
  }
  if (min === max) return hslToRgb(217, 70, (97 + 35) / 2);
  const t = (v - min) / (max - min);
  const lightness = 97 + (35 - 97) * Math.max(0, Math.min(1, t));
  return hslToRgb(217, 70, lightness);
};
