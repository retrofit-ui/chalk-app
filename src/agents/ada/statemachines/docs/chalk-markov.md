## chalk-markov

**Markov chains**: states with transition probabilities. Two modes the student switches between:
- *Random walk*: a token hops between states; step or play. Visit counts build up live next to the true long-run share of time in each state (a bar per state, with a marker for the long-run value) — the law of large numbers converging in front of them.
- *Distribution after n steps*: a slider for n; each state's fill shows πₙ = π₀Pⁿ, starting with all probability on the start state.

The transition matrix is shown next to the diagram; hovering a row highlights that state's outgoing arrows. Clicking a state makes it the start. If any state is absorbing (P = 1 to itself), a table shows the expected number of steps until absorption from every other state and the probability of ending in each absorbing state. The renderer computes all of this — don't state these numbers yourself, ask the student to estimate and then read them off.

Example: sticky weather
```chalk-spec
{
  "kind": "chalk-markov",
  "title": "Sunny days tend to follow sunny days",
  "states": [
    { "id": "sunny", "x": 0, "y": 0 },
    { "id": "rainy", "x": 2, "y": 0 }
  ],
  "transitions": [
    { "from": "sunny", "to": "sunny", "p": 0.9 },
    { "from": "sunny", "to": "rainy", "p": 0.1 },
    { "from": "rainy", "to": "sunny", "p": 0.5 },
    { "from": "rainy", "to": "rainy", "p": 0.5 }
  ],
  "start": "rainy",
  "editable": true
}
```

Example: gambler's ruin (absorbing states)
```chalk-spec
{
  "kind": "chalk-markov",
  "title": "Bet $1 on a fair coin until you have $0 or $3",
  "states": [
    { "id": "0", "label": "$0", "x": 0, "y": 0 },
    { "id": "1", "label": "$1", "x": 1, "y": 0 },
    { "id": "2", "label": "$2", "x": 2, "y": 0 },
    { "id": "3", "label": "$3", "x": 3, "y": 0 }
  ],
  "transitions": [
    { "from": "0", "to": "0", "p": 1 },
    { "from": "1", "to": "0", "p": 0.5 },
    { "from": "1", "to": "2", "p": 0.5 },
    { "from": "2", "to": "1", "p": 0.5 },
    { "from": "2", "to": "3", "p": 0.5 },
    { "from": "3", "to": "3", "p": 1 }
  ],
  "start": "1"
}
```

Markov rules:
- Every state's outgoing `p` values must sum to exactly 1 (include self-loops explicitly) — otherwise the diagram shows an error instead of rendering.
- `start` defaults to the first state. `seed` (integer) fixes the random walk so it is reproducible; change it for a different walk.
- `editable: true` shows a probability input per transition; changing one rescales the rest of that state's row so it still sums to 1.
- `showMatrix: false` hides the matrix (default shown).
- Layout uses `x`/`y` grid positions like chalk-automaton. Keep to roughly 2–8 states; arrow thickness grows with probability.

Teaching notes:
- Classic hooks: the weather (sticky vs. coin-flip days), a board game (Monopoly squares are states and dice rolls are transitions — which square gets landed on most?), a random web surfer (PageRank is the long-run distribution of a random walk over links), a drunkard's walk (gambler's ruin).
- "Memoryless": the next step depends only on where you are, not how you got there — the same idea as a DFA's state, with dice instead of input symbols.
- Run the walk first and let the visit bars wobble towards the long-run markers; then switch to the n-steps view to show the same limit arriving smoothly. Ask: does it matter where you start? (Not for the weather chain; it does for gambler's ruin.)
- Connect to linear algebra: the long-run distribution is the left eigenvector of P for eigenvalue 1 — pair this with a `chalk-matrix` of P if the student knows eigenvectors.
