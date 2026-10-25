// Coordinate charts shared by every plotting kind. A chart maps a curvilinear
// system to cartesian; renderers resolve specs through these up front and keep
// drawing in cartesian. Spherical names follow neither the maths nor the
// physics convention for θ/φ (they swap): `polar` is the angle from +z,
// `azimuth` the angle in the xy-plane from +x.

import { parse, evaluate, type MathNode } from 'mathjs';
import type { GraphClickPoint } from '../../anthropic';

export type AngleUnit = 'radians' | 'degrees';
/** A number in the spec's angle unit, or a mathjs expression ("pi/6", "30 deg"). */
export type Angle = number | string;

export type V2 = [number, number];
export type V3 = [number, number, number];

const TAU = 2 * Math.PI;

export const normalizeAngle = (theta: number) => ((theta % TAU) + TAU) % TAU;

export const polarToCartesian = (r: number, theta: number): V2 => [r * Math.cos(theta), r * Math.sin(theta)];

export const cartesianToPolar = (x: number, y: number) => ({
  r: Math.hypot(x, y),
  theta: normalizeAngle(Math.atan2(y, x)),
});

export const cylindricalToCartesian = (r: number, azimuth: number, z: number): V3 => [
  r * Math.cos(azimuth),
  r * Math.sin(azimuth),
  z,
];

export const sphericalToCartesian = (rho: number, polar: number, azimuth: number): V3 => [
  rho * Math.sin(polar) * Math.cos(azimuth),
  rho * Math.sin(polar) * Math.sin(azimuth),
  rho * Math.cos(polar),
];

/** Unit vectors at angle θ: r̂ away from the origin, θ̂ towards increasing θ. */
export const polarBasis = (theta: number) => ({
  rHat: [Math.cos(theta), Math.sin(theta)] as V2,
  thetaHat: [-Math.sin(theta), Math.cos(theta)] as V2,
});

export const cylindricalBasis = (azimuth: number) => ({
  rHat: [Math.cos(azimuth), Math.sin(azimuth), 0] as V3,
  azimuthHat: [-Math.sin(azimuth), Math.cos(azimuth), 0] as V3,
  zHat: [0, 0, 1] as V3,
});

export const sphericalBasis = (polar: number, azimuth: number) => ({
  rhoHat: sphericalToCartesian(1, polar, azimuth),
  polarHat: [
    Math.cos(polar) * Math.cos(azimuth),
    Math.cos(polar) * Math.sin(azimuth),
    -Math.sin(polar),
  ] as V3,
  azimuthHat: [-Math.sin(azimuth), Math.cos(azimuth), 0] as V3,
});

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Radians from an Angle. Strings are evaluated by mathjs; a unit result ("30 deg") ignores `unit`. */
export function parseAngle(angle: unknown, unit: AngleUnit): Parsed<number> {
  const scale = unit === 'degrees' ? Math.PI / 180 : 1;
  if (typeof angle === 'number') {
    return Number.isFinite(angle) ? { ok: true, value: angle * scale } : { ok: false, error: 'is not a finite number' };
  }
  if (typeof angle !== 'string') return { ok: false, error: 'must be a number or an expression like "pi/6"' };
  if (unit === 'degrees' && /\bpi\b/i.test(angle)) {
    return { ok: false, error: `"${angle}" uses pi, but angleUnit is degrees — write the angle in degrees, e.g. 30` };
  }
  let value: unknown;
  try {
    value = evaluate(angle);
  } catch {
    return { ok: false, error: `"${angle}" is not a valid angle expression` };
  }
  if (typeof value === 'number' && Number.isFinite(value)) return { ok: true, value: value * scale };
  if (value && typeof value === 'object' && 'toNumber' in value) {
    try {
      return { ok: true, value: (value as { toNumber: (u: string) => number }).toNumber('rad') };
    } catch {
      return { ok: false, error: `"${angle}" is not an angle` };
    }
  }
  return { ok: false, error: `"${angle}" is not a valid angle expression` };
}

const PI_DENOMINATORS = [1, 2, 3, 4, 6, 12];
const SNAP_TOLERANCE = 0.005;

const trimNumber = (n: number, digits = 2) => String(Number(n.toFixed(digits)));

/** "π/6", "5π/6", "1.23" in radians; "30°" in degrees. */
export function formatAngle(theta: number, unit: AngleUnit): string {
  if (unit === 'degrees') return `${trimNumber((theta * 180) / Math.PI, 1)}°`;
  if (Math.abs(theta) < SNAP_TOLERANCE) return '0';
  for (const d of PI_DENOMINATORS) {
    const n = Math.round((theta * d) / Math.PI);
    if (n !== 0 && Math.abs(theta - (n * Math.PI) / d) < SNAP_TOLERANCE) {
      const sign = n < 0 ? '-' : '';
      const k = Math.abs(n);
      return `${sign}${k === 1 ? '' : k}π${d === 1 ? '' : `/${d}`}`;
    }
  }
  return trimNumber(theta);
}

export type { GraphClickPoint };

export function formatClickPoint(p: GraphClickPoint): string {
  if (!p.polar) return `(${p.x}, ${p.y})`;
  return `(r = ${trimNumber(p.polar.r)}, θ = ${formatAngle(p.polar.theta, p.polar.angleUnit)}) ≈ (${p.x}, ${p.y})`;
}

/** 1, 2 or 5 × 10ᵏ, giving roughly 4–6 steps across `span`. */
export function niceStep(span: number): number {
  const raw = span / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const m = raw / pow;
  const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
  return Number(step.toPrecision(6));
}

export const SPOKE_COUNT = 12;

/** Rings out to the farthest visible corner, and spokes every π/6. */
export function polarGrid(xDomain: V2, yDomain: V2) {
  const rMax = Math.max(...xDomain.flatMap((x) => yDomain.map((y) => Math.hypot(x, y))));
  const step = niceStep(rMax);
  const rings: number[] = [];
  for (let k = 1; k * step < rMax + step; k++) rings.push(Number((k * step).toPrecision(6)));
  const spokes = Array.from({ length: SPOKE_COUNT }, (_, i) => (i * TAU) / SPOKE_COUNT);
  return { rMax, step, rings, spokes };
}

/** Widens the smaller span (centred) so one unit covers the same pixels on both axes. */
export function equalScaleDomains(xDomain: V2, yDomain: V2, width: number, height: number): { xDomain: V2; yDomain: V2 } {
  const xPer = (xDomain[1] - xDomain[0]) / width;
  const yPer = (yDomain[1] - yDomain[0]) / height;
  const widen = (d: V2, span: number): V2 => {
    const mid = (d[0] + d[1]) / 2;
    return [mid - span / 2, mid + span / 2];
  };
  if (xPer > yPer) return { xDomain, yDomain: widen(yDomain, xPer * height) };
  return { xDomain: widen(xDomain, yPer * width), yDomain };
}

/** A square-ish domain containing every point with 15% padding (min half-width 1). */
export function fitDomain(points: V2[], fallback: V2 = [-5, 5]): { xDomain: V2; yDomain: V2 } {
  const finite = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!finite.length) return { xDomain: fallback, yDomain: fallback };
  const extent = Math.max(1, ...finite.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))) * 1.15;
  return { xDomain: [-extent, extent], yDomain: [-extent, extent] };
}

/** Free variables of a mathjs expression (function names excluded). */
export function expressionSymbols(expr: string): Parsed<Set<string>> & { symbols: Set<string> } {
  const symbols = new Set<string>();
  let root: MathNode;
  try {
    root = parse(expr);
  } catch (err) {
    return { ok: false, error: `"${expr}" does not parse: ${(err as Error).message}`, symbols };
  }
  root.traverse((node, path, parent) => {
    if ((node as { isSymbolNode?: boolean }).isSymbolNode && !((parent as { isFunctionNode?: boolean })?.isFunctionNode && path === 'fn')) {
      symbols.add((node as unknown as { name: string }).name);
    }
  });
  return { ok: true, value: symbols, symbols };
}

export const CONSTANTS = ['pi', 'e', 'PI', 'E'];

/**
 * Where a spoke's angle label goes: on the spoke, `inset` units inside the edge of the view,
 * so labels ring the border instead of landing on the content. Null when the origin (where
 * spokes start) is not inside the inset view.
 */
export function spokeLabelPoint(theta: number, xDomain: V2, yDomain: V2, inset: number): V2 | null {
  const [x0, x1] = [xDomain[0] + inset, xDomain[1] - inset];
  const [y0, y1] = [yDomain[0] + inset, yDomain[1] - inset];
  if (!(x0 < 0 && 0 < x1 && y0 < 0 && 0 < y1)) return null;
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  const tx = dx > 1e-12 ? x1 / dx : dx < -1e-12 ? x0 / dx : Infinity;
  const ty = dy > 1e-12 ? y1 / dy : dy < -1e-12 ? y0 / dy : Infinity;
  const t = Math.min(tx, ty);
  return [t * dx, t * dy];
}
