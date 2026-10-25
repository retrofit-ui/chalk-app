// Resolves the coordinate forms of chalk-graph / chalk-vectors / chalk-draw / chalk-graph3d
// specs to cartesian, so renderers never see anything but [x, y] / [x, y, z].
//
// Model-written specs are untrusted input. Every problem is collected (not just the first)
// and thrown as one SpecValidationError naming the offending item; ChalkSpecRenderer shows
// the last good frame while a spec is still streaming and the list once it is complete.

import { compile } from 'mathjs';
import {
  CONSTANTS,
  cylindricalBasis,
  cylindricalToCartesian,
  expressionSymbols,
  fitDomain,
  parseAngle,
  polarBasis,
  polarToCartesian,
  sphericalBasis,
  sphericalToCartesian,
  type AngleUnit,
  type V2,
  type V3,
} from './coords';
import { FORM_VARIABLES, type CurvilinearSurfaceInput } from './curvilinearSurface';
import type {
  Chalk3DSurface,
  ChalkDrawSpec,
  ChalkGraph3DSpec,
  ChalkGraphSpec,
  ChalkVectorsSpec,
  PlotGrid,
} from './spec';

export class SpecValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(' '));
    this.name = 'SpecValidationError';
  }
}

const TAU = 2 * Math.PI;
const AXIS_EPSILON = 1e-9;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const named = (field: string, i: number, item: unknown) =>
  isObj(item) && typeof item.id === 'string' ? `${field}[${i}] ("${item.id}")` : `${field}[${i}]`;

class Problems {
  errors: string[] = [];
  constructor(readonly angleUnit: AngleUnit) {}

  add(msg: string) {
    this.errors.push(msg);
  }

  num(obj: Obj, key: string, where: string): number {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    this.add(`${where}: "${key}" must be a number.`);
    return Number.NaN;
  }

  angle(obj: Obj, key: string, where: string): number {
    const parsed = parseAngle(obj[key], this.angleUnit);
    if (parsed.ok) return parsed.value;
    this.add(`${where}: "${key}" ${parsed.error}.`);
    return Number.NaN;
  }

  range(obj: Obj, key: string, where: string, fallback: V2, angular: boolean): V2 {
    const v = obj[key];
    if (v === undefined) return fallback;
    if (!Array.isArray(v) || v.length !== 2) {
      this.add(`${where}: "${key}" must be a [start, end] pair.`);
      return fallback;
    }
    const pair = { a: v[0], b: v[1] };
    return angular
      ? [this.angle(pair, 'a', `${where} ${key}[0]`), this.angle(pair, 'b', `${where} ${key}[1]`)]
      : [this.num(pair, 'a', `${where} ${key}[0]`), this.num(pair, 'b', `${where} ${key}[1]`)];
  }

  oneOf<T extends string>(obj: Obj, key: string, allowed: readonly T[], fallback: T, where = ''): T {
    const v = obj[key];
    if (v === undefined) return fallback;
    if ((allowed as readonly unknown[]).includes(v)) return v as T;
    this.add(`${where}\`${key}\` must be ${allowed.map((a) => `"${a}"`).join(' or ')}, not ${JSON.stringify(v)}.`);
    return fallback;
  }

  /** Checks an expression's free variables. `lenient` skips expressions mathjs can't parse. */
  variables(expr: unknown, allowed: string[], where: string, hint: (extra: string[]) => string, lenient = false): boolean {
    if (typeof expr !== 'string') return false;
    const parsed = expressionSymbols(expr);
    if (!parsed.ok) {
      if (!lenient) this.add(`${where}: ${parsed.error}.`);
      return lenient;
    }
    const extra = [...parsed.symbols].filter((s) => !allowed.includes(s) && !CONSTANTS.includes(s));
    if (extra.length) {
      this.add(`${where}: "${expr}" uses ${extra.join(', ')}. ${hint(extra)}`);
      return false;
    }
    return true;
  }

  throwIfAny() {
    if (this.errors.length) throw new SpecValidationError(this.errors);
  }
}

const startProblems = (spec: Obj) => {
  const unitCheck = new Problems('radians');
  const angleUnit = unitCheck.oneOf(spec, 'angleUnit', ['radians', 'degrees'] as const, 'radians');
  const p = new Problems(angleUnit);
  p.errors.push(...unitCheck.errors);
  return p;
};

/** A 2D point in either system. */
function point2D(p: Problems, raw: unknown, where: string): V2 {
  if (!isObj(raw)) {
    p.add(`${where} must be an object.`);
    return [Number.NaN, Number.NaN];
  }
  const coords = raw.coords ?? 'cartesian';
  if (coords === 'polar') return polarToCartesian(p.num(raw, 'r', where), p.angle(raw, 'theta', where));
  if (coords !== 'cartesian') {
    p.add(`${where}: \`coords\` must be "cartesian" or "polar", not ${JSON.stringify(coords)}.`);
    return [Number.NaN, Number.NaN];
  }
  return [p.num(raw, 'x', where), p.num(raw, 'y', where)];
}

// --- chalk-graph -------------------------------------------------------------------------

export type ResolvedCurve =
  | { coords: 'cartesian'; fn: string; label?: string }
  | { coords: 'polar'; r: string; range: V2; label?: string };

export type ResolvedGraph = {
  grid: PlotGrid;
  angleUnit: AngleUnit;
  curves: ResolvedCurve[];
  points: Array<{ x: number; y: number; label: string }>;
  xDomain?: V2;
  yDomain?: V2;
};

const FIT_SAMPLES = 180;

export function resolveGraph(spec: ChalkGraphSpec): ResolvedGraph {
  const raw = spec as unknown as Obj;
  const p = startProblems(raw);
  const legacy = p.oneOf(raw, 'graphType', ['cartesian', 'polar'] as const, 'cartesian');
  const grid = p.oneOf(raw, 'grid', ['cartesian', 'polar'] as const, legacy);
  const paramNames = list(raw.params).flatMap((q) => (isObj(q) && typeof q.name === 'string' ? [q.name] : []));
  const scope: Record<string, number> = Object.fromEntries(
    list(raw.params).flatMap((q) => (isObj(q) && typeof q.name === 'string' && typeof q.default === 'number' ? [[q.name, q.default]] : [])),
  );

  if (!Array.isArray(raw.curves)) p.add('`curves` must be an array.');
  const curves: ResolvedCurve[] = [];
  list(raw.curves).forEach((c, i) => {
    const where = `curves[${i}]`;
    if (!isObj(c)) return p.add(`${where} must be an object.`);
    const label = typeof c.label === 'string' ? c.label : undefined;
    const coords = c.coords ?? 'cartesian';
    if (coords === 'cartesian') {
      if (typeof c.fn !== 'string') return p.add(`${where}: a cartesian curve needs "fn", a function of x.`);
      // function-plot evaluates these, and parses some things mathjs doesn't: only flag what
      // mathjs can read.
      p.variables(c.fn, ['x', ...paramNames], where, (extra) =>
        extra.includes('theta')
          ? 'A curve in theta is polar: set "coords": "polar" and give it as "r".'
          : 'A cartesian curve is a function of x (and slider params).', true);
      curves.push({ coords: 'cartesian', fn: c.fn, label });
    } else if (coords === 'polar') {
      if (typeof c.r !== 'string') return p.add(`${where}: a polar curve needs "r", a function of theta.`);
      p.variables(c.r, ['theta', ...paramNames], where, () => 'A polar curve gives r as a function of theta (and slider params).');
      curves.push({ coords: 'polar', r: c.r, range: p.range(c, 'thetaDomain', where, [0, TAU], true), label });
    } else {
      p.add(`${where}: \`coords\` must be "cartesian" or "polar", not ${JSON.stringify(coords)}.`);
    }
  });

  const points = list(raw.points).map((pt, i) => {
    const where = `points[${i}]`;
    const [x, y] = point2D(p, pt, where);
    return { x, y, label: isObj(pt) && typeof pt.label === 'string' ? pt.label : '' };
  });

  let xDomain = raw.xDomain === undefined ? undefined : p.range(raw, 'xDomain', 'chalk-graph', [-5, 5], false);
  let yDomain = raw.yDomain === undefined ? undefined : p.range(raw, 'yDomain', 'chalk-graph', [-5, 5], false);
  p.throwIfAny();

  if (grid === 'polar' && !xDomain && !yDomain) {
    const samples: V2[] = points.map((pt) => [pt.x, pt.y]);
    for (const c of curves) {
      if (c.coords !== 'polar') continue;
      try {
        const f = compile(c.r);
        for (let k = 0; k <= FIT_SAMPLES; k++) {
          const theta = c.range[0] + ((c.range[1] - c.range[0]) * k) / FIT_SAMPLES;
          const r = f.evaluate({ ...scope, theta });
          if (typeof r === 'number') samples.push(polarToCartesian(r, theta));
        }
      } catch {
        // Unsampleable here (e.g. a function only function-plot knows): fit to the rest.
      }
    }
    ({ xDomain, yDomain } = fitDomain(samples));
  }

  return { grid, angleUnit: p.angleUnit, curves, points, xDomain, yDomain };
}

// --- chalk-vectors -----------------------------------------------------------------------

export type ResolvedArrow = {
  id: string;
  start: V2;
  end: V2;
  label?: string;
  colorIndex?: number;
  /** Unit r̂/θ̂ at the tail, when `showBasis`. */
  basis?: { rHat: V2; thetaHat: V2 };
};

export type ResolvedVectors = {
  grid: PlotGrid;
  angleUnit: AngleUnit;
  arrows: ResolvedArrow[];
  xDomain: V2;
  yDomain: V2;
};

const DEFAULT_DOMAIN: V2 = [-5, 5];

export function resolveVectors(spec: ChalkVectorsSpec): ResolvedVectors {
  const raw = spec as unknown as Obj;
  const p = startProblems(raw);
  const grid = p.oneOf(raw, 'grid', ['cartesian', 'polar'] as const, 'cartesian');
  const compose = p.oneOf(raw, 'compose', ['origin', 'head-to-tail'] as const, 'origin');
  if (!Array.isArray(raw.vectors)) p.add('`vectors` must be an array.');

  let cursor: V2 = [0, 0];
  const arrows: ResolvedArrow[] = [];
  list(raw.vectors).forEach((v, i) => {
    const where = named('vectors', i, v);
    if (!isObj(v)) return p.add(`${where} must be an object.`);
    const start: V2 = v.at !== undefined ? point2D(p, v.at, `${where} at`) : compose === 'head-to-tail' ? cursor : [0, 0];
    const tail = Math.hypot(start[0], start[1]) > AXIS_EPSILON ? polarBasis(Math.atan2(start[1], start[0])) : null;
    const needsBasis = (why: string) => {
      if (!tail) p.add(`${where}: ${why} needs r̂ and θ̂ at the tail, which are undefined at the origin — give the vector an \`at\`.`);
      return tail;
    };

    let d: V2 = [Number.NaN, Number.NaN];
    const coords = v.coords ?? 'cartesian';
    if (coords === 'cartesian') d = [p.num(v, 'x', where), p.num(v, 'y', where)];
    else if (coords === 'polar') d = polarToCartesian(p.num(v, 'r', where), p.angle(v, 'theta', where));
    else if (coords === 'polar-basis') {
      const radial = p.num(v, 'radial', where);
      const tangential = p.num(v, 'tangential', where);
      const b = needsBasis('"polar-basis"');
      if (b) d = [radial * b.rHat[0] + tangential * b.thetaHat[0], radial * b.rHat[1] + tangential * b.thetaHat[1]];
    } else {
      p.add(`${where}: \`coords\` must be "cartesian", "polar" or "polar-basis", not ${JSON.stringify(coords)}.`);
    }
    const basis = v.showBasis === true ? needsBasis('showBasis') ?? undefined : undefined;

    const end: V2 = [start[0] + d[0], start[1] + d[1]];
    cursor = end;
    arrows.push({
      id: typeof v.id === 'string' ? v.id : String(i),
      start,
      end,
      label: typeof v.label === 'string' ? v.label : undefined,
      colorIndex: typeof v.colorIndex === 'number' ? v.colorIndex : undefined,
      basis,
    });
  });

  const given = raw.xDomain !== undefined || raw.yDomain !== undefined;
  const fitted = grid === 'polar' && !given ? fitDomain(arrows.flatMap((a) => [a.start, a.end])) : null;
  const xDomain = fitted?.xDomain ?? p.range(raw, 'xDomain', 'chalk-vectors', DEFAULT_DOMAIN, false);
  const yDomain = fitted?.yDomain ?? p.range(raw, 'yDomain', 'chalk-vectors', DEFAULT_DOMAIN, false);
  p.throwIfAny();
  return { grid, angleUnit: p.angleUnit, arrows, xDomain, yDomain };
}

// --- chalk-draw --------------------------------------------------------------------------

export function resolveDraw(spec: ChalkDrawSpec) {
  const raw = spec as unknown as Obj;
  const p = startProblems(raw);
  const grid = p.oneOf(raw, 'grid', ['cartesian', 'polar'] as const, 'cartesian');
  const xDomain = p.range(raw, 'xDomain', 'chalk-draw', DEFAULT_DOMAIN, false);
  const yDomain = p.range(raw, 'yDomain', 'chalk-draw', DEFAULT_DOMAIN, false);
  p.throwIfAny();
  return { grid, angleUnit: p.angleUnit, xDomain, yDomain };
}

// --- chalk-graph3d -----------------------------------------------------------------------

function point3D(p: Problems, raw: unknown, where: string): V3 {
  if (Array.isArray(raw)) {
    if (raw.length === 3 && raw.every((n) => typeof n === 'number' && Number.isFinite(n))) return raw as V3;
    p.add(`${where} must be [x, y, z] numbers or a { coords, … } object.`);
    return [Number.NaN, Number.NaN, Number.NaN];
  }
  if (!isObj(raw)) {
    p.add(`${where} must be [x, y, z] numbers or a { coords, … } object.`);
    return [Number.NaN, Number.NaN, Number.NaN];
  }
  switch (raw.coords) {
    case 'cartesian':
      return [p.num(raw, 'x', where), p.num(raw, 'y', where), p.num(raw, 'z', where)];
    case 'cylindrical':
      return cylindricalToCartesian(p.num(raw, 'r', where), p.angle(raw, 'azimuth', where), p.num(raw, 'z', where));
    case 'spherical':
      return sphericalToCartesian(p.num(raw, 'rho', where), p.angle(raw, 'polar', where), p.angle(raw, 'azimuth', where));
    default:
      p.add(`${where}: \`coords\` must be "cartesian", "cylindrical" or "spherical", not ${JSON.stringify(raw.coords)}.`);
      return [Number.NaN, Number.NaN, Number.NaN];
  }
}

const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale3 = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];

export type BasisArrow = { dir: V3; label: string };

export type ResolvedVector3D = {
  from: V3;
  to: V3;
  label?: string;
  colorIndex?: number;
  style?: 'solid' | 'dashed';
  basis?: BasisArrow[];
};

export type ResolvedSurface =
  | { kind: 'cartesian'; surface: Extract<Chalk3DSurface, { fn: string }> }
  | { kind: 'curvilinear'; input: CurvilinearSurfaceInput; surface: Chalk3DSurface };

// Basis labels use the physics (ISO) letters: φ is the azimuth, θ the polar angle.
function localBasis(p: Problems, from: V3, system: 'cylindrical' | 'spherical', where: string) {
  const offAxis = Math.hypot(from[0], from[1]) > AXIS_EPSILON;
  if (!offAxis) {
    p.add(`${where}: the ${system} basis is undefined on the z-axis — move \`from\` off it.`);
    return null;
  }
  const azimuth = Math.atan2(from[1], from[0]);
  if (system === 'cylindrical') {
    const b = cylindricalBasis(azimuth);
    return [
      { dir: b.rHat, label: 'r̂' },
      { dir: b.azimuthHat, label: 'φ̂' },
      { dir: b.zHat, label: 'ẑ' },
    ];
  }
  const polar = Math.acos(from[2] / Math.hypot(...from));
  const b = sphericalBasis(polar, azimuth);
  return [
    { dir: b.rhoHat, label: 'r̂' },
    { dir: b.polarHat, label: 'θ̂' },
    { dir: b.azimuthHat, label: 'φ̂' },
  ];
}

function vector3D(p: Problems, v: unknown, where: string): ResolvedVector3D | null {
  if (!isObj(v)) {
    p.add(`${where} must be an object.`);
    return null;
  }
  const from = point3D(p, v.from, `${where} from`);
  const style: ResolvedVector3D['style'] =
    v.style === 'dashed' ? 'dashed' : v.style === undefined || v.style === 'solid' ? 'solid' : undefined;
  if (!style) p.add(`${where}: \`style\` must be "solid" or "dashed".`);
  const base = {
    from,
    label: typeof v.label === 'string' ? v.label : undefined,
    colorIndex: typeof v.colorIndex === 'number' ? v.colorIndex : undefined,
    style,
  };

  if ((v.to === undefined) === (v.components === undefined)) {
    p.add(`${where}: give exactly one of \`to\` or \`components\`.`);
    return null;
  }
  if (v.to !== undefined) {
    if (v.showBasis === true) p.add(`${where}: showBasis needs "cylindrical-basis" or "spherical-basis" components.`);
    return { ...base, to: point3D(p, v.to, `${where} to`) };
  }

  const c = v.components;
  if (!isObj(c)) {
    p.add(`${where}: \`components\` must be an object.`);
    return null;
  }
  if (c.coords === 'cartesian') {
    if (v.showBasis === true) p.add(`${where}: showBasis needs "cylindrical-basis" or "spherical-basis" components.`);
    return { ...base, to: add3(from, [p.num(c, 'x', where), p.num(c, 'y', where), p.num(c, 'z', where)]) };
  }
  if (c.coords !== 'cylindrical-basis' && c.coords !== 'spherical-basis') {
    p.add(`${where}: \`components.coords\` must be "cartesian", "cylindrical-basis" or "spherical-basis".`);
    return null;
  }
  const system = c.coords === 'cylindrical-basis' ? 'cylindrical' : 'spherical';
  const amounts =
    system === 'cylindrical'
      ? [p.num(c, 'radial', where), p.num(c, 'azimuthal', where), p.num(c, 'z', where)]
      : [p.num(c, 'radial', where), p.num(c, 'polar', where), p.num(c, 'azimuthal', where)];
  const basis = localBasis(p, from, system, where);
  if (!basis) return null;
  const d = basis.reduce<V3>((acc, b, k) => add3(acc, scale3(b.dir, amounts[k])), [0, 0, 0]);
  return { ...base, to: add3(from, d), basis: v.showBasis === true ? basis : undefined };
}

function surface3D(p: Problems, s: unknown, where: string): ResolvedSurface | null {
  if (!isObj(s)) {
    p.add(`${where} must be an object.`);
    return null;
  }
  const surface = s as unknown as Chalk3DSurface;
  const coords = s.coords ?? 'cartesian';
  const vars = (names: string[]) => () => `This form is a function of ${names.join(', ')}.`;

  if (coords === 'cartesian') {
    if (typeof s.fn !== 'string') {
      p.add(`${where}: a cartesian surface needs "fn", z as a function of x, y.`);
      return null;
    }
    // A parse failure keeps today's behaviour (Scene3D skips the surface with a warning).
    p.variables(s.fn, ['x', 'y'], where, vars(['x, y']), true);
    return { kind: 'cartesian', surface: surface as Extract<Chalk3DSurface, { fn: string }> };
  }

  const solved = (['z', 'r', 'rho'] as const).filter((k) => s[k] !== undefined);
  let form: CurvilinearSurfaceInput['form'] | null = null;
  if (coords === 'cylindrical') {
    if (solved.length !== 1 || solved[0] === 'rho') {
      p.add(`${where}: a cylindrical surface needs exactly one of "z" (z = f(r, azimuth), a height map) or "r" (r = f(azimuth, z)).`);
      return null;
    }
    form = solved[0] === 'z' ? 'cylindrical-z' : 'cylindrical-r';
  } else if (coords === 'spherical') {
    if (solved.length !== 1 || solved[0] !== 'rho') {
      p.add(`${where}: a spherical surface needs exactly "rho" (rho = f(polar, azimuth)).`);
      return null;
    }
    form = 'spherical-rho';
  } else {
    p.add(`${where}: \`coords\` must be "cartesian", "cylindrical" or "spherical", not ${JSON.stringify(coords)}.`);
    return null;
  }

  const expr = s[solved[0]];
  if (typeof expr !== 'string') {
    p.add(`${where}: "${solved[0]}" must be an expression string.`);
    return null;
  }
  const names = FORM_VARIABLES[form];
  if (!p.variables(expr, names, where, vars(names))) return null;

  const domains: Record<typeof form, [V2, V2]> = {
    'cylindrical-z': [p.range(s, 'rDomain', where, [0, 3], false), p.range(s, 'azimuthDomain', where, [0, TAU], true)],
    'cylindrical-r': [p.range(s, 'azimuthDomain', where, [0, TAU], true), p.range(s, 'zDomain', where, [-2, 2], false)],
    'spherical-rho': [p.range(s, 'polarDomain', where, [0, Math.PI], true), p.range(s, 'azimuthDomain', where, [0, TAU], true)],
  };
  const [uDomain, vDomain] = domains[form];
  return { kind: 'curvilinear', input: { form, expr, uDomain, vDomain }, surface };
}

export function resolveScene(spec: ChalkGraph3DSpec) {
  const raw = spec as unknown as Obj;
  const p = startProblems(raw);
  const grid = p.oneOf(raw, 'grid', ['none', 'cartesian', 'polar'] as const, 'none');

  const points = list(raw.points).map((pt, i) => ({
    ...(pt as object),
    position: point3D(p, isObj(pt) ? pt.position : undefined, `${named('points', i, pt)}`),
  })) as Array<Omit<NonNullable<ChalkGraph3DSpec['points']>[number], 'position'> & { position: V3 }>;
  const planes = list(raw.planes).map((pl, i) => ({
    ...(pl as object),
    point: point3D(p, isObj(pl) ? pl.point : undefined, `planes[${i}] point`),
  })) as Array<Omit<NonNullable<ChalkGraph3DSpec['planes']>[number], 'point'> & { point: V3 }>;
  const vectors = list(raw.vectors).flatMap((v, i) => vector3D(p, v, `vectors[${i}]`) ?? []);
  const paths = list(raw.paths).map((path, i) => ({
    ...(path as object),
    points: list(isObj(path) ? path.points : undefined).map((pt, k) => point3D(p, pt, `${named('paths', i, path)} points[${k}]`)),
  })) as Array<Omit<NonNullable<ChalkGraph3DSpec['paths']>[number], 'points'> & { points: V3[] }>;
  const surfaces = list(raw.surfaces).flatMap((s, i) => surface3D(p, s, `surfaces[${i}]`) ?? []);

  p.throwIfAny();
  return { grid, angleUnit: p.angleUnit, points, planes, vectors, paths, surfaces };
}

export type ResolvedScene = ReturnType<typeof resolveScene>;
