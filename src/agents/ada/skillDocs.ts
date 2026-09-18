export type AdaSkillKind =
  | 'chalk-graph'
  | 'chalk-draw'
  | 'chalk-sets'
  | 'chalk-graph3d'
  | 'chalk-vectors'
  | 'chalk-matrix'
  | 'chalk-matmul'
  | 'chalk-compute-graph'
  | 'layout';

export const SKILL_KINDS: AdaSkillKind[] = [
  'chalk-graph',
  'chalk-draw',
  'chalk-sets',
  'chalk-graph3d',
  'chalk-vectors',
  'chalk-matrix',
  'chalk-matmul',
  'chalk-compute-graph',
  'layout',
];

export const SKILL_DOCS: Record<AdaSkillKind, string> = {
  'chalk-graph': `## chalk-graph

To render a graph, emit a fenced code block with the language tag \`chalk-spec\` containing a JSON object:

\`\`\`chalk-spec
{
  "kind": "chalk-graph",
  "graphType": "cartesian",
  "curves": [
    { "fn": "sin(x)", "label": "sin(x)" }
  ],
  "xDomain": [-6.28, 6.28],
  "title": "The sine function"
}
\`\`\`

You may also mark specific points on the graph with labels — useful for highlighting intercepts, extrema, or notable values:

\`\`\`chalk-spec
{
  "kind": "chalk-graph",
  "graphType": "cartesian",
  "curves": [{ "fn": "x^2 - 1" }],
  "points": [
    { "x": 1, "y": 0, "label": "(1, 0)" },
    { "x": -1, "y": 0, "label": "(-1, 0)" }
  ],
  "xDomain": [-3, 3],
  "yDomain": [-2, 5],
  "title": "Roots of x² - 1"
}
\`\`\`

Graph rules:
- \`fn\` uses mathjs expression syntax: x^2, sin(x), exp(x), sqrt(x), abs(x), log(x), etc.
- \`graphType\` must always be "cartesian"
- \`size\`: "small", "medium" (default), or "large" — use "large" for a diagram that deserves full attention, "small" for a compact aside
- You may include multiple curves in one graph to compare functions visually
- Use \`points\` to label intercepts, critical points, or any value worth calling out
- **Domain and range**: always add enough padding so the curve sits comfortably inside the viewport — a curve that reaches the edge of the plot loses context. As a rule: extend the domain at least 15% beyond the region of interest on each side, and set \`yDomain\` so the curve's extrema sit no closer than 20% from the top/bottom edges
- **Default to graphs** — if a function, curve, or geometric shape is mentioned, render it. Plain prose descriptions of shapes are a last resort.
- Continue your explanation in markdown after the graph block
- The \`chalk-spec\` block must be valid JSON (no trailing commas, no comments)

**Interactive graphs**: You can ask the student to click on a region of the graph to check their understanding. Add \`"interactive": true\` to the chalk-spec to enable this. Clicks accumulate and are submitted together, so you can ask for multiple points at once (e.g., "mark all three roots"). When the student submits, you will receive all clicked points — validate their answers and give feedback. Example usage: identify a root, a maximum, an inflection point, or where two curves intersect. Only set interactive on one graph at a time.

**Slider-driven parameters**: You can add a continuous parameter the student drags with a slider, e.g. to show how Ridge regression shrinks as λ grows. Add a \`params\` array; each param's \`name\` becomes a variable usable inside any curve's \`fn\`:

\`\`\`chalk-spec
{
  "kind": "chalk-graph",
  "graphType": "cartesian",
  "curves": [{ "fn": "x^2 + lambda", "label": "x² + λ" }],
  "params": [
    { "name": "lambda", "min": 0, "max": 10, "default": 0, "step": 0.1, "label": "λ" }
  ],
  "xDomain": [-4, 4],
  "yDomain": [-2, 20],
  "title": "Shifting the parabola with λ"
}
\`\`\`

- A param's \`name\` must be a valid identifier and can appear anywhere in a curve's \`fn\` expression (mathjs scope variable).
- \`min\`/\`max\`/\`default\` are required; \`step\` defaults to \`(max-min)/100\`; \`label\` defaults to \`name\` and is shown next to the slider.
- You may declare multiple params, each referenced independently across one or more curves.
- \`params\` and \`interactive\` (click-to-mark) are independent — a graph can use either, both, or neither.
- Labelled \`points\` do not currently react to \`params\` — their coordinates are fixed numbers, not expressions.`,

  'chalk-draw': `## chalk-draw

**Drawing canvas**: You can ask the student to draw something — a curve, a diagram, a sketch. Emit a \`chalk-draw\` spec:

\`\`\`chalk-spec
{
  "kind": "chalk-draw",
  "xDomain": [-5, 5],
  "yDomain": [-4, 4],
  "title": "Sketch the graph",
  "prompt": "Draw what you think the graph of x² - 1 looks like."
}
\`\`\`

The student draws freehand on a coordinate grid and submits an image. You will receive their drawing as an image — look at the shape they drew and give specific feedback on what's right, what's wrong, and why. Use this for: sketching functions from memory, drawing geometric constructions, illustrating transformations, or any conceptual diagram. Supports \`"size"\`: "small", "medium" (default), or "large".`,

  'chalk-sets': `## chalk-sets

**Set and space diagrams**: For probability spaces, Venn diagrams, and set theory illustrations, use a \`chalk-sets\` spec. All coordinates are normalized: (0,0) is top-left, (1,1) is bottom-right.

Bayes' theorem — universe rectangle, one set A, vertical partition splitting B from Bᶜ:
\`\`\`chalk-spec
{
  "kind": "chalk-sets",
  "title": "Bayes' Theorem",
  "universe": "Ω",
  "sets": [
    { "id": "A", "label": "A", "cx": 0.38, "cy": 0.5, "rx": 0.28, "ry": 0.35 }
  ],
  "partitions": [
    { "id": "B_split", "x": 0.55 }
  ],
  "annotations": [
    { "x": 0.22, "y": 0.25, "text": "A ∩ B" },
    { "x": 0.46, "y": 0.25, "text": "A ∩ Bᶜ" },
    { "x": 0.28, "y": 0.82, "text": "B" },
    { "x": 0.75, "y": 0.82, "text": "Bᶜ" }
  ]
}
\`\`\`

Venn diagram — two overlapping sets:
\`\`\`chalk-spec
{
  "kind": "chalk-sets",
  "title": "A ∩ B",
  "universe": "Ω",
  "sets": [
    { "id": "A", "label": "A", "cx": 0.38, "cy": 0.5, "rx": 0.22, "ry": 0.3 },
    { "id": "B", "label": "B", "cx": 0.62, "cy": 0.5, "rx": 0.22, "ry": 0.3 }
  ],
  "annotations": [
    { "x": 0.5, "y": 0.5, "text": "A ∩ B" }
  ]
}
\`\`\`

Sets rules:
- \`cx\`, \`cy\` are the ellipse center; \`rx\`, \`ry\` are half-widths in normalized space (\`rx: 0.22\` means the oval spans 44% of diagram width)
- A partition with \`x: 0.55\` draws a vertical line at 55% from the left; \`y: 0.5\` draws a horizontal line at 50% from the top
- \`annotations\` place text at arbitrary positions — use for region labels like P(A|B), A ∩ Bᶜ, etc.
- \`universe\` labels the bounding rectangle — use "Ω" for probability spaces
- Hover highlighting is handled automatically; you do not control it
- \`size\`: "small", "medium" (default), or "large"
- Use for: set theory (∪ ∩ ᶜ), Bayes, law of total probability, sigma-algebras — not for function graphs`,

  'chalk-graph3d': `## chalk-graph3d

**3D scenes**: For linear algebra in R³ — planes (e.g. col(X)), points, and vectors, with a camera the student can drag to rotate. Emit a \`chalk-graph3d\` spec:

\`\`\`chalk-spec
{
  "kind": "chalk-graph3d",
  "title": "Projecting y onto col(X)",
  "planes": [
    { "point": [0, 0, 0], "basis1": [1, 0, 0], "basis2": [0, 1, 0], "label": "col(X)", "extent": 3 }
  ],
  "points": [
    { "id": "y", "position": [1, 1.5, 2], "label": "y", "draggable": true }
  ]
}
\`\`\`

- \`planes[].point\`/\`basis1\`/\`basis2\` define a plane through \`point\`, spanned by the two basis vectors (they need not be unit length or orthogonal — the renderer orthonormalizes them).
- **Auto-projection**: if \`points\` has exactly one point with \`"draggable": true\` and you do NOT supply \`vectors\`, the renderer automatically computes and draws the orthogonal projection ŷ onto the first plane, plus the residual vector e = y − ŷ, live as the student drags the point. This is the primary way to teach OLS projection — just declare the plane and the point, do not try to compute ŷ/e yourself.
- If you need vectors that aren't the auto-derived projection (e.g. showing arbitrary basis vectors or a fixed decomposition), supply an explicit \`vectors\` array of \`{ from, to, label?, style?: "solid"|"dashed" }\` — this disables auto-projection.
- \`showAxes\`: defaults to true; set false to hide the R³ axis gizmo for a cleaner shot.
- The student can drag to rotate the camera at any time; dragging the point marked \`draggable\` moves it and live-updates the projection.
- Use for: column space / row space, orthogonal projection, residuals, basis and span in R³ — not for 2D functions (\`chalk-graph\`) or flat set diagrams (\`chalk-sets\`).

**Surfaces and paths (loss landscapes, gradient descent)**: For visualizing a scalar loss L(w1, w2) as a 3D surface, with the optimizer's trajectory drawn as a path across it:

\`\`\`chalk-spec
{
  "kind": "chalk-graph3d",
  "title": "Gradient descent on a quadratic loss bowl",
  "surfaces": [
    {
      "fn": "(x - 1)^2 + 2*(y + 0.5)^2",
      "label": "L(w1, w2)",
      "xDomain": [-3, 3],
      "yDomain": [-3, 3],
      "resolution": 40,
      "colorScale": "sequential",
      "opacity": 0.85
    }
  ],
  "paths": [
    {
      "id": "descent",
      "points": [[-2, 2, 21.5], [-1.4, 1.0, 10.26], [-0.92, 0.4, 5.31], [-0.536, 0.04, 2.94], [-0.229, -0.176, 1.72]],
      "colorIndex": 1,
      "showMarkers": true
    }
  ],
  "points": [
    { "id": "start", "position": [-2, 2, 21.5], "label": "start", "colorIndex": 1 },
    { "id": "min", "position": [1, -0.5, 0], "label": "minimum", "colorIndex": 2 }
  ]
}
\`\`\`

- \`surfaces[].fn\` uses the **same mathjs-expression syntax as \`chalk-graph\`'s \`fn\`** (x^2, sin(x), exp(x), sqrt(x), etc.), but here it is genuinely evaluated by mathjs (not \`function-plot\`, which only handles single-variable curves) as a function of **both** \`x\` and \`y\` — e.g. \`"(x-1)^2 + 2*(y+0.5)^2"\`.
- \`xDomain\`/\`yDomain\` default to \`[-3, 3]\`; \`resolution\` (samples per axis) defaults to 40 and is capped at 80 — keep it at the default unless you have a real reason to raise it, since higher values cost real render time.
- \`colorScale\`: use \`"sequential"\` (the default) for surfaces that are always non-negative, like a typical loss bowl; use \`"diverging"\` for surfaces that cross zero (e.g. a saddle point), same convention as \`chalk-matrix\`.
- \`wireframe: true\` renders only the grid lines with no filled surface — useful when a path or point would otherwise be hidden inside/behind the mesh.
- \`paths[].points\` is an ordered list of \`[x, y, z]\` waypoints that **you must compute and provide** — the renderer only draws the polyline and marker spheres you give it; it never runs gradient descent (or any other iterative solve) itself. Compute the trajectory yourself (e.g. a few steps of gradient descent on the same \`fn\`) and pass the resulting points.
- \`paths[].showMarkers\` (default true) draws a small sphere at each waypoint; \`paths[].animate: true\` additionally animates a marker traveling once along the path when it first renders — good for narrating "watch it descend," but the path itself is always fully visible regardless of \`animate\`.
- Combine with regular \`points\`/\`vectors\` as usual — e.g. marking the start and the minimum, as in the example above.
- Use for: loss landscapes, gradient descent / optimization trajectories, visualizing a two-variable function's shape — not for single-variable curves (\`chalk-graph\`) or abstract vector decomposition (\`chalk-vectors\`).`,

  'chalk-vectors': `## chalk-vectors

**Vector decomposition diagrams**: For showing a vector sum like y = ŷ + e as composed arrows. Emit a \`chalk-vectors\` spec:

\`\`\`chalk-spec
{
  "kind": "chalk-vectors",
  "title": "y = ŷ + e",
  "compose": "head-to-tail",
  "vectors": [
    { "id": "yhat", "x": 3, "y": 1, "label": "ŷ", "colorIndex": 0 },
    { "id": "e", "x": 0.5, "y": 1.5, "label": "e", "colorIndex": 1 }
  ],
  "xDomain": [-1, 5],
  "yDomain": [-1, 4]
}
\`\`\`

- \`compose: "head-to-tail"\` (as above) chains each vector from the tip of the previous one — the final tip lands at the sum of all vectors, which is exactly right for decompositions like y = ŷ + e.
- \`compose: "origin"\` (default) draws every vector from (0,0) instead — better for comparing several vectors' magnitude/direction directly (e.g. showing y, ŷ, and e all relative to the same origin).
- Add enough \`xDomain\`/\`yDomain\` padding that every arrow tip and label sits comfortably inside the viewport (defaults to \`[-5, 5]\` on both axes if omitted).
- Use for: vector addition/subtraction, decomposition (y = ŷ + e), basis combinations in 2D — not for 3D scenes (\`chalk-graph3d\`) or function curves (\`chalk-graph\`).`,

  'chalk-matrix': `## chalk-matrix

**Matrix heatmaps**: For visualizing a matrix's structure by coloring cells by value — e.g. XᵀX, how adding λI shifts it, or diagonal dominance. Emit a \`chalk-matrix\` spec:

\`\`\`chalk-spec
{
  "kind": "chalk-matrix",
  "title": "XᵀX + λI (λ = 2)",
  "values": [[7, 2, 0], [2, 9, 1], [0, 1, 6]],
  "rowLabels": ["x₁", "x₂", "x₃"],
  "colLabels": ["x₁", "x₂", "x₃"],
  "highlightDiagonal": true
}
\`\`\`

- \`values\` is a rectangular array of numbers (rows of equal length).
- \`colorScale\`: omit to auto-detect — "diverging" (blue↔white↔red, zero always white) if values cross zero, else "sequential" (white→blue). Set explicitly to override.
- \`highlightDiagonal\`: outlines the \`row === col\` cells — use when calling out what λI adds, or diagonal dominance.
- \`precision\`: decimal places shown per cell, default 2.
- Use for: XᵀX / Gram matrix structure, regularization (λI), covariance/correlation matrices, diagonal dominance and eigenvalue-adjacent structure — not for plain tables of unrelated numbers (use \`grid\`/\`text\` layout instead).

**Hover-reveal formulas for Jacobians**: add \`cellNotes\` (plus optionally \`outputVar\`/\`inputVar\`) when a matrix is a Jacobian and you want the student to inspect individual partial derivatives by hovering (or tapping, on touch) a cell:

\`\`\`chalk-spec
{
  "kind": "chalk-matrix",
  "title": "Jacobian of w = f(r) at r = (2, 3)",
  "values": [[4, 1], [3, 2]],
  "rowLabels": ["w₁ = r₁² + r₂", "w₂ = r₁ r₂"],
  "colLabels": ["r₁", "r₂"],
  "outputVar": "w",
  "inputVar": "r",
  "cellNotes": [
    { "row": 0, "col": 0, "formula": "\\\\dfrac{\\\\partial w_1}{\\\\partial r_1} = 2r_1 = 4", "note": "w₁ grows quadratically in r₁" },
    { "row": 0, "col": 1, "formula": "\\\\dfrac{\\\\partial w_1}{\\\\partial r_2} = 1", "note": "r₂ enters w₁ additively — constant sensitivity" },
    { "row": 1, "col": 0, "formula": "\\\\dfrac{\\\\partial w_2}{\\\\partial r_1} = r_2 = 3", "note": "product rule: holding r₂ fixed" },
    { "row": 1, "col": 1, "formula": "\\\\dfrac{\\\\partial w_2}{\\\\partial r_2} = r_1 = 2", "note": "product rule: holding r₁ fixed" }
  ]
}
\`\`\`

- \`cellNotes\` is an array of \`{row, col, formula, note?}\`. \`formula\` is bare LaTeX (no \`$$\` delimiters — the renderer adds display-math wrapping itself). \`note\` is an optional short plain-language explanation.
- \`outputVar\`/\`inputVar\`: short variable names (e.g. \`"w"\`, \`"r"\`) used to render a running header like "∂w / ∂r" above the revealed formula. Supply both or neither — the header is skipped if either is missing.
- Hovering/tapping a cell that has a matching \`cellNotes\` entry bolds that cell's row and column labels, reinforcing "row = output component, column = input component" for a Jacobian, and shows the formula (plus \`note\`, if given) below the grid. Reveal is independent per cell — there is no step-through order.
- Omit \`cellNotes\` entirely for a plain matrix heatmap (XᵀX, covariance, regularization) — this feature only activates when you supply it, and is meant for small illustrative Jacobians (roughly up to 3×3/4×4), not large matrices.`,

  'chalk-matmul': `## chalk-matmul

**Interactive matrix multiplication**: For teaching how a product AB is actually computed — e.g. chain-rule Jacobian products (∂z/∂x = (∂z/∂y)(∂y/∂x)), or composing linear maps. Emit a \`chalk-matmul\` spec:

\`\`\`chalk-spec
{
  "kind": "chalk-matmul",
  "title": "Chain rule: ∂z/∂x = (∂z/∂y)(∂y/∂x)",
  "aLabel": "∂z/∂y",
  "bLabel": "∂y/∂x",
  "a": [[2, 0], [1, 3]],
  "b": [[1, 4], [0, 2]],
  "rowLabelsA": ["z₁", "z₂"],
  "colLabelsA": ["y₁", "y₂"],
  "rowLabelsB": ["y₁", "y₂"],
  "colLabelsB": ["x₁", "x₂"],
  "precision": 0
}
\`\`\`

- The renderer always computes the result AB itself from \`a\` and \`b\` — **never supply a \`result\`/\`c\` field**, it does not exist in the schema and would be ignored. This avoids the failure mode where hand-multiplying matrices in JSON introduces arithmetic mistakes.
- \`a\`'s column count must equal \`b\`'s row count, or the renderer shows a dimension-mismatch error instead of a diagram — double check shapes before emitting.
- The student hovers (or taps, on touch) any cell of the result matrix to highlight the contributing row of A and column of B, plus see the dot-product arithmetic spelled out below the grids (e.g. \`2×1 + 3×4 = 14\`). This is automatic — you do not control or narrate it.
- \`rowLabelsA\`/\`colLabelsA\`/\`rowLabelsB\`/\`colLabelsB\` are optional; omitted labels fall back to numeric indices.
- \`aLabel\`/\`bLabel\` are short captions shown above each matrix (e.g. a Jacobian's name like "∂y/∂x") — distinct from \`rowLabels\`/\`colLabels\`, which label individual rows/columns.
- \`precision\`: decimal places shown per cell, shared across A, B, and the result — default 2.
- Works best up to roughly 4×4; larger matrices get visually cramped across three side-by-side grids.
- Use \`chalk-matmul\` specifically for teaching **how a product AB is computed** (chain rule, composition of linear maps). Use plain \`chalk-matrix\` instead for single-matrix structure (Gram matrices, regularization, covariance) — \`chalk-matrix\` has no second operand and no multiplication semantics.`,

  'chalk-compute-graph': `## chalk-compute-graph

**Node/edge diagrams**: a generic graph for two related use cases — tensor **shape-flow** pipelines (nodes are operations, edges carry shape labels) and **chain-rule / dependency graphs** (nodes are variables with a formula, edges carry local-derivative labels). Emit a \`chalk-compute-graph\` spec:

Shape-flow example (linear chain — every node in its own layer, slot 0):
\`\`\`chalk-spec
{
  "kind": "chalk-compute-graph",
  "title": "One linear layer, forward pass",
  "direction": "row",
  "nodes": [
    { "id": "x", "label": "x", "shape": ["n", "784"], "layer": 0, "slot": 0 },
    { "id": "matmul", "label": "matmul", "layer": 1, "slot": 0 },
    { "id": "bias", "label": "+ bias", "layer": 2, "slot": 0 },
    { "id": "relu", "label": "ReLU", "layer": 3, "slot": 0 },
    { "id": "h", "label": "h", "shape": ["n", "128"], "layer": 4, "slot": 0 }
  ],
  "edges": [
    { "from": "x", "to": "matmul" },
    { "from": "matmul", "to": "bias", "label": "W: (784, 128)" },
    { "from": "bias", "to": "relu", "label": "b: (128,)" },
    { "from": "relu", "to": "h" }
  ]
}
\`\`\`

Chain-rule example (small branch — z depends on both y1 and y2, which both depend on x):
\`\`\`chalk-spec
{
  "kind": "chalk-compute-graph",
  "title": "Chain rule with a shared input",
  "nodes": [
    { "id": "x", "label": "x", "layer": 0, "slot": 0, "style": "circle" },
    { "id": "y1", "label": "y₁", "formula": "y_1 = x^2", "layer": 1, "slot": 0 },
    { "id": "y2", "label": "y₂", "formula": "y_2 = \\\\sin(x)", "layer": 1, "slot": 1 },
    { "id": "z", "label": "z", "formula": "z = y_1 + y_2", "layer": 2, "slot": 0 }
  ],
  "edges": [
    { "from": "x", "to": "y1", "label": "\\\\partial y_1/\\\\partial x = 2x" },
    { "from": "x", "to": "y2", "label": "\\\\partial y_2/\\\\partial x = \\\\cos x" },
    { "from": "y1", "to": "z", "label": "\\\\partial z/\\\\partial y_1 = 1" },
    { "from": "y2", "to": "z", "label": "\\\\partial z/\\\\partial y_2 = 1" }
  ]
}
\`\`\`

Compute-graph rules:
- \`layer\`/\`slot\` are the ONLY layout controls — there is no auto-layout. Lay nodes out deliberately: increasing \`layer\` in the flow direction, and give anything that should sit side by side (branches, parallel paths) distinct \`slot\` values within the same layer.
- \`direction\`: "row" (default) maps \`layer\` to columns, left to right; "column" maps \`layer\` to rows, top to bottom.
- Each node needs a short \`label\`; add \`formula\` (bare LaTeX, no \`$\`/\`$$\` delimiters needed) for a variable's defining equation, or \`shape\` (array of dimension names/sizes) for a tensor shape caption — use whichever fits the use case, not both.
- \`style: "circle"\` is a small visual variant for leaf/input variables; default is \`"box"\`.
- Edge \`label\` is optional bare LaTeX or plain text (e.g. a local derivative, or a weight-matrix shape note).
- **Hovering (or tapping, on touch) any node highlights its full causal history** — every ancestor reachable by following edges backward — in one accent color, and **everything it affects** — every descendant reachable forward — in a second accent color; unrelated nodes/edges dim. This is automatic — you do not control or narrate it.
- Keep graphs small (roughly 10-12 nodes) — layout is fully manual, so legibility drops fast beyond that.
- Use for: tensor shape-flow pipelines (matmul → bias → activation, etc.) AND chain-rule/dependency graphs showing how one quantity's change propagates through others. Do NOT use for set relationships (\`chalk-sets\`) or concrete numeric matrix values (\`chalk-matrix\`/\`chalk-matmul\`) — this kind is for structure and dependency, not for displaying actual numbers.`,

  layout: `## layout

**Composition and layout**: You can wrap visual blocks in layout containers when it genuinely aids the lesson (side-by-side comparison, callout with a highlighted result, grouped sub-plots). Do not wrap single blocks — reach for these only when composition earns its keep.

Available container and leaf kinds beyond chalk-*:
- \`flex\` — layout container. Fields: \`direction\` ("row" | "column", default "column"), \`gap\` (CSS length), \`align\`, \`justify\`, \`wrap\`, \`children\` (array).
- \`grid\` — layout container. Fields: \`columns\` (int, default 2) or \`columnTemplate\` (CSS grid-template-columns string), \`gap\`, \`children\`.
- \`card\` — visual grouping. Fields: \`header\` (string), \`children\` (array).
- \`text\` — typography. Fields: \`content\` (string), \`variant\` ("body" | "muted" | "small").
- \`stat\` — highlighted labeled values. Fields: \`stats\` (array of \`{label, value, description?}\`). All three fields render markdown and LaTeX — use \`$...$\` for inline math, \`$$...$$\` for display math. Best for: a named result with a short value (computed number, probability, key formula). Each stat is one punchy label+value pair — not a paragraph.
- \`answerbox\` — leaf. Fields: \`identifier\` (string, required, unique within the message), \`label?\` (shown above the input), \`placeholder?\`. Renders a single-line text input the student types into. Use inside \`flex\`/\`grid\` to build fill-in-the-blank layouts (e.g. a table where some cells are given and others are blanks the student fills in). A single "Submit" button is added automatically below the message whenever it contains one or more answer boxes — do NOT emit a button or submit kind yourself. When the student submits, you will receive all \`identifier\` → typed-value pairs as a new user turn; check them and give feedback.

Fill-in-the-blank table — "2" is given, the other three cells are answers:
\`\`\`chalk-spec
{
  "kind": "grid",
  "columns": 2,
  "children": [
    { "kind": "text", "content": "2" },
    { "kind": "answerbox", "identifier": "top-right" },
    { "kind": "answerbox", "identifier": "bottom-left" },
    { "kind": "answerbox", "identifier": "bottom-right" }
  ]
}
\`\`\`

**Nesting depth is capped at 2**: a \`flex\`/\`grid\`/\`card\` at the outer layer may contain leaf blocks (chalk-*, text, stat, another card), but its children must not themselves be flex/grid. Deeper nesting will not render correctly.

Side-by-side graphs for comparison:
\`\`\`chalk-spec
{
  "kind": "flex",
  "direction": "row",
  "gap": "1rem",
  "children": [
    { "kind": "chalk-graph", "graphType": "cartesian", "curves": [{"fn": "x^2"}], "xDomain": [-3, 3], "title": "y = x²", "size": "small" },
    { "kind": "chalk-graph", "graphType": "cartesian", "curves": [{"fn": "x^3"}], "xDomain": [-3, 3], "title": "y = x³", "size": "small" }
  ]
}
\`\`\`

Card highlighting a key result (stat values support LaTeX):
\`\`\`chalk-spec
{
  "kind": "card",
  "header": "Key results",
  "children": [
    { "kind": "stat", "stats": [
      {"label": "Posterior", "value": "$P(A|B) = 0.6$", "description": "updated after observing B"},
      {"label": "Sample size", "value": "120", "description": "draws from $\\\\mathcal{D}$"}
    ]}
  ]
}
\`\`\`

Card for a theorem or definition (use text, not stat — the formula renders in markdown):
\`\`\`chalk-spec
{
  "kind": "card",
  "header": "Bayes' Theorem",
  "children": [
    { "kind": "text", "content": "$$P(A|B) = \\\\frac{P(B|A)\\\\,P(A)}{P(B)}$$", "variant": "body" }
  ]
}
\`\`\``,
};

export function getSkillDocs(kinds: string[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  const unknown: string[] = [];

  for (const kind of kinds) {
    if (seen.has(kind)) continue;
    seen.add(kind);
    const doc = SKILL_DOCS[kind as AdaSkillKind];
    if (doc) {
      parts.push(doc);
    } else {
      unknown.push(kind);
    }
  }

  if (unknown.length > 0) {
    parts.push(`Unknown kind(s): ${unknown.join(', ')}. Valid kinds: ${SKILL_KINDS.join(', ')}.`);
  }

  return parts.join('\n\n');
}
