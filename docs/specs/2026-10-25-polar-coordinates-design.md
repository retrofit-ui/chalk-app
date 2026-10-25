# Polar, cylindrical and spherical coordinates for Ada's plots

Date: 2026-10-25. Status: approved in conversation; implement in full.

## Goal

Ada must be able to *express* and *render* curvilinear coordinates in every
plotting kind: `chalk-graph`, `chalk-vectors`, `chalk-draw`, `chalk-graph3d`.
The motivating use is physics (circular motion, central forces, fields,
radiation patterns), so local bases (r̂, θ̂ …) and curvilinear surfaces are
in scope, not just `r = f(θ)` curves.

## Principles

1. **A coordinate system is a chart: a map to cartesian.** Every renderer
   keeps drawing in cartesian. Specs are *resolved* to cartesian up front by
   pure functions; a polar grid is the chart's constant-r / constant-θ lines
   pushed through the same map. One shared module, `coords.ts`.
2. **Explicit, checkable `coords` on every item.** No inferring the system
   from variable names. `coords` defaults to `"cartesian"` so every existing
   spec is unchanged. A mismatch (a polar curve whose expression uses `x`) is
   a validation error, not a guess.
3. **The grid is separate from the items.** `grid: "cartesian" | "polar"`
   (3D: `"none" | "cartesian" | "polar"`) on the spec; any item can be in any
   system on any grid.
4. **Names that cannot be misread.** 2D polar uses `r`, `theta` (universal).
   Cylindrical uses `r`, `azimuth`, `z`. Spherical uses `rho`, `polar` (angle
   from +z), `azimuth` (angle in the xy-plane from +x). Physics and maths
   swap θ/φ for spherical; these names sidestep that. Ada is told to use the
   student's convention when *talking*.
5. **Validation throws.** Renderers resolve + validate at creation and throw a
   `SpecValidationError` listing every problem. The dispatcher already keeps
   the last good frame while a spec streams and shows the error once it is
   complete, so no streaming special-casing is needed.

## Shared conventions

- `angleUnit?: "radians" | "degrees"` on each spec, default radians.
- An **Angle** value is a number (in `angleUnit`) or a string evaluated by
  mathjs: `"pi/6"`, `"3*pi/4"`, `"30 deg"` (a mathjs unit is converted, so it
  is right in either `angleUnit`).
- Expressions (`r`, surface functions) are always evaluated in radians —
  `sin(theta)` means the radian sine. `angleUnit` affects only numeric Angle
  values, domains, grid labels and click read-outs.
- A **polar grid**: rings at a "nice" radius step (1/2/5 × 10ᵏ, ~4–6 rings)
  out to the farthest visible corner; 12 spokes (every π/6 = 30°). Labels:
  π fractions in radians (`π/6`, `5π/6`), degrees otherwise (`30°`).
- **Equal scale.** A polar grid forces 1 unit = same pixels on both axes
  (the smaller domain span is widened, centred), so circles stay circles.
  Cartesian grids keep today's behaviour exactly.

## Per kind

### chalk-graph (function-plot)

- `grid?: "cartesian" | "polar"`. `graphType` stays accepted (legacy,
  `"cartesian"`); `graphType: "polar"` with no `grid` is read as
  `grid: "polar"`.
- Curves: `{ coords?: "cartesian", fn }` (unchanged) or
  `{ coords: "polar", r: "1 + cos(theta)", thetaDomain?: [Angle, Angle] }`
  (default `[0, 2π]`), rendered with function-plot's native `fnType: "polar"`.
  Params (sliders) work in both.
- Points: `{ x, y, label }` or `{ coords: "polar", r, theta: Angle, label }`.
- The polar grid is drawn as function-plot data (rings = polar `r = k`,
  spokes = polylines, labels = text, all `skipTip`), so pan/zoom keeps it
  aligned for free. function-plot's own grid is turned off under it.
- Polar grid with no `xDomain`/`yDomain`: the domain is fitted to the polar
  curves (sampled with mathjs at the params' defaults) and points, with 15%
  padding; `[-5, 5]` if nothing can be sampled.
- **Fix:** function-plot's parser knows `PI` but not `pi`/`e`; both are put in
  every curve's scope (this also fixes cartesian curves using `pi` today).
- **Clicks on a polar grid** report both: `(r = 3, θ = π/3) ≈ (1.5, 2.6)`.
  θ is normalised to [0, 2π), shown in `angleUnit`, snapped to a π/12
  fraction when within 0.005 rad of one. No snapping of the click position.
  The stored `graphClickData` point gains optional
  `polar: { r, theta, angleUnit }`; old messages render as before.

### chalk-vectors (SVG)

- `grid?`, `angleUnit?`.
- A vector's components: `{ x, y }` (cartesian, unchanged),
  `{ coords: "polar", r, theta }` (magnitude + direction), or
  `{ coords: "polar-basis", radial, tangential }` — components along the
  **local** r̂ and θ̂ at the vector's tail (errors if the tail is the origin,
  where r̂ is undefined).
- `at?: Point2D` — explicit tail (`{x, y}` or `{coords: "polar", r, theta}`).
  Overrides `compose` for that vector. Without `at`, `compose` behaves as
  today.
- `showBasis?: true` draws the unit r̂ and θ̂ at the tail (muted, labelled).
- Default domain for a polar grid without domains: fit every tail/tip with
  padding.

### chalk-draw (canvas)

- `grid?`, `angleUnit?`. The polar grid is drawn into the canvas, so the
  submitted image carries it and Ada sees it. Equal scale applies.

### chalk-graph3d (three.js)

- `grid?: "none" | "cartesian" | "polar"` — a floor grid in z = 0. Default
  `"none"` (today's look). `angleUnit?`.
- **Point3D** everywhere a position is taken (`points[].position`,
  `vectors[].from/to`, `paths[].points[]`, `planes[].point`): `[x, y, z]`
  (unchanged), `{coords: "cartesian", x, y, z}`,
  `{coords: "cylindrical", r, azimuth, z}`,
  `{coords: "spherical", rho, polar, azimuth}`.
- Vectors: `{ from, to }` (unchanged) or `{ from, components }` where
  `components` is `{coords: "cartesian", x, y, z}`,
  `{coords: "cylindrical-basis", r, azimuth, z}` (along r̂, φ̂, ẑ at `from`)
  or `{coords: "spherical-basis", rho, polar, azimuth}` (along r̂, θ̂, φ̂ at
  `from`). `showBasis?: true` draws the local unit basis at `from`.
- Surfaces — the solved variable's key makes the form explicit:
  - `{ fn, xDomain, yDomain }` — z = f(x, y), unchanged (existing pipeline
    untouched).
  - `{ coords: "cylindrical", z: "exp(-r^2)", rDomain?, azimuthDomain? }` —
    polar height map over a disc/wedge. Defaults r ∈ [0, 3], azimuth ∈ [0, 2π].
  - `{ coords: "cylindrical", r: "1 + z^2/4", azimuthDomain?, zDomain? }` —
    defaults azimuth ∈ [0, 2π], z ∈ [-2, 2].
  - `{ coords: "spherical", rho: "sin(polar)^2", polarDomain?, azimuthDomain? }`
    — defaults polar ∈ [0, π], azimuth ∈ [0, 2π].
  - Exactly one of `z` / `r` / `rho`; expression variables are the other two
    coordinates' names (plus `pi`, `e`). Anything else is an error.
  - New sampler (`curvilinearSurface.ts`, pure): an (n+1)² grid over the two
    free coordinates, mapped through the chart; triangles touching a
    non-finite sample are dropped (so `1/sin(polar)` loses its poles instead
    of the whole surface); fails only if nothing is finite. Coloured by the
    solved value. Wire overlay = the coordinate lines themselves (~12 per
    direction: circles and meridians), not EdgesGeometry, which misbehaves on
    the degenerate triangles at poles.
  - `resolution`, `colorScale`, `opacity`, `wireframe`, `label` as today.

## Ada's docs

- Each kind's doc gains its polar fields with one physics-flavoured example.
- One shared "Coordinates" section (Angle values, units, naming, spherical
  convention warning) is appended once by `getSkillDocs` whenever any of the
  four kinds is requested.
- `agentConfig` kind blurbs mention polar/cylindrical/spherical.
- A unit test runs every `chalk-spec` example in the docs through the
  validators, so docs and validation cannot drift.

## Testing

- Unit (vitest): `coords.ts` (round-trips, bases orthonormal, angle parsing,
  labels), `polarGrid.ts`, `curvilinearSurface.ts` (sphere radius exact,
  pole handling, non-finite dropping), validators (each error), docs examples
  validate, click formatting.
- E2E (playwright, layer 1 seeded specs): polar graph renders rings round
  (bbox width ≈ height), polar curve path present; polar click message text;
  vectors polar-basis tail/tip geometry; draw canvas polar grid pixels;
  graph3d each surface form mounts without a spec error; invalid specs show
  the listed errors.
- Revert-and-recheck the discriminating tests.

## Out of scope

- Changing the cartesian `z = f(x, y)` sampler (it still fails the whole
  surface on one non-finite sample).
- Parametric curves/surfaces, vector fields, non-Euclidean geometry.
- Polar for `chalk-sets`.
