// Shared 16-color palette across all chalk-spec diagram components — Tailwind 600 level,
// chosen for contrast on white.
export const PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#be185d', // pink
  '#65a30d', // lime
  '#7c3aed', // violet
  '#0f766e', // teal
  '#d97706', // amber
  '#4f46e5', // indigo
  '#059669', // emerald
  '#e11d48', // rose
  '#0284c7', // sky
  '#c026d3', // fuchsia
];

export const color = (index: number) => PALETTE[index % PALETTE.length];
