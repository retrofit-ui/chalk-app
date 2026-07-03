import { DEFAULT_MODEL } from '../anthropic';
import type { Conversation } from '../conversations';

// Timestamps are display-only — examples live in their own sidebar section,
// not grouped by date. Values are relative to 2026-07-02.
const T_A = 1782820800000; // 2026-07-01 12:00 UTC
const T_B = 1782604800000; // 2026-06-29 08:00 UTC
const T_C = 1781654400000; // 2026-06-17 08:00 UTC
const T_D = 1777766400000; // 2026-05-03 08:00 UTC

// Each example carries only the user's opening question.
// When selected, that question is loaded into the composer and the user sends
// it to Claude — turning the example into a real conversation from the start.

export const EXAMPLES: Conversation[] = [
  {
    id: 'example-basel-problem',
    title: 'Basel problem: π hiding in 1/n²',
    createdAt: T_A,
    updatedAt: T_A,
    model: DEFAULT_MODEL,
    plans: [],
    messages: [
      {
        id: 'example-basel-msg-0',
        role: 'user',
        content:
          "I've heard that the sum 1 + 1/4 + 1/9 + 1/16 + ⋯ — the reciprocals of all perfect squares — equals π²/6. That seems completely unhinged. How does π show up in a sum that has nothing geometrically to do with circles? Walk me through why this is true and what it actually means.",
      },
    ],
  },

  {
    id: 'example-cantor-set',
    title: 'Cantor set: uncountable, yet measure zero',
    createdAt: T_B,
    updatedAt: T_B,
    model: DEFAULT_MODEL,
    plans: [],
    messages: [
      {
        id: 'example-cantor-msg-0',
        role: 'user',
        content:
          "The Cantor set is described as 'uncountably infinite yet having measure zero.' I can't reconcile those two things. How can a set be the same cardinality as the real numbers while taking up literally no length on the number line? What's actually happening when you remove the middle thirds, and why does the result have zero measure but uncountably many points?",
      },
    ],
  },

  {
    id: 'example-non-euclidean-geometry',
    title: 'Non-Euclidean geometry and curved space',
    createdAt: T_C,
    updatedAt: T_C,
    model: DEFAULT_MODEL,
    plans: [],
    messages: [
      {
        id: 'example-non-euclidean-msg-0',
        role: 'user',
        content:
          "On a sphere, the angles of a triangle sum to more than 180°. On a hyperbolic surface they sum to less. I want to understand this not just as a fact but geometrically — why does curvature change the angle sum? What exactly is the parallel postulate, why did it take two thousand years to question it, and why did Einstein need non-Euclidean geometry to describe gravity?",
      },
    ],
  },

  {
    id: 'example-gabriels-horn',
    title: "Gabriel's Horn: finite volume, infinite surface",
    createdAt: T_D,
    updatedAt: T_D,
    model: DEFAULT_MODEL,
    plans: [],
    messages: [
      {
        id: 'example-gabriels-horn-msg-0',
        role: 'user',
        content:
          "Explain Gabriel's Horn to me. The claim is that you can fill it with a finite amount of paint, but you couldn't paint its inner surface even with an infinite amount. That sounds like a flat contradiction — if paint fills the interior, it coats the surface by contact. Where does the argument break down, and what does this paradox actually reveal about how we measure length, area, and volume in calculus?",
      },
    ],
  },
];
