export type AdaSkillKind =
  | 'chalk-graph'
  | 'chalk-draw'
  | 'chalk-sets'
  | 'chalk-graph3d'
  | 'chalk-vectors'
  | 'chalk-matrix'
  | 'layout';

export const SKILL_KINDS: AdaSkillKind[] = [
  'chalk-graph',
  'chalk-draw',
  'chalk-sets',
  'chalk-graph3d',
  'chalk-vectors',
  'chalk-matrix',
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
- Use for: column space / row space, orthogonal projection, residuals, basis and span in R³ — not for 2D functions (\`chalk-graph\`) or flat set diagrams (\`chalk-sets\`).`,

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
- Use for: XᵀX / Gram matrix structure, regularization (λI), covariance/correlation matrices, diagonal dominance and eigenvalue-adjacent structure — not for plain tables of unrelated numbers (use \`grid\`/\`text\` layout instead).`,

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
