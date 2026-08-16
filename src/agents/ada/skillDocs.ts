export type AdaSkillKind = 'chalk-graph' | 'chalk-draw' | 'chalk-sets' | 'layout';

export const SKILL_KINDS: AdaSkillKind[] = ['chalk-graph', 'chalk-draw', 'chalk-sets', 'layout'];

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

**Interactive graphs**: You can ask the student to click on a region of the graph to check their understanding. Add \`"interactive": true\` to the chalk-spec to enable this. Clicks accumulate and are submitted together, so you can ask for multiple points at once (e.g., "mark all three roots"). When the student submits, you will receive all clicked points — validate their answers and give feedback. Example usage: identify a root, a maximum, an inflection point, or where two curves intersect. Only set interactive on one graph at a time.`,

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
