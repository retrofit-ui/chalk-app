## chalk-automaton

**Finite automata (DFA / NFA)** with a live simulator: the student types an input (or picks one of your `examples`), then steps through it symbol by symbol. The tape shows the read head, the current state(s) light up, the transitions just taken are highlighted, and the last step shows ✓ Accepted / ✗ Rejected. The renderer does the simulation, so never narrate a run's outcome as if you computed it — ask the student to predict it, then let them step. It labels the machine DFA or NFA automatically; an NFA lights every state it could be in at once.

Example: even number of 1s
```chalk-spec
{
  "kind": "chalk-automaton",
  "title": "Even number of 1s",
  "start": "even",
  "states": [
    { "id": "even", "accept": true, "x": 0, "y": 0 },
    { "id": "odd", "x": 2, "y": 0 }
  ],
  "transitions": [
    { "from": "even", "to": "even", "symbols": ["0"] },
    { "from": "even", "to": "odd", "symbols": ["1"] },
    { "from": "odd", "to": "odd", "symbols": ["0"] },
    { "from": "odd", "to": "even", "symbols": ["1"] }
  ],
  "input": "1011",
  "examples": ["", "11", "1011", "100001"]
}
```

Example: an NFA, and word symbols (a turnstile)
```chalk-spec
{
  "kind": "chalk-automaton",
  "title": "Strings ending in ab (NFA)",
  "start": "q0",
  "states": [
    { "id": "q0", "x": 0, "y": 0 },
    { "id": "q1", "x": 1.5, "y": 0 },
    { "id": "q2", "accept": true, "x": 3, "y": 0 }
  ],
  "transitions": [
    { "from": "q0", "to": "q0", "symbols": ["a", "b"] },
    { "from": "q0", "to": "q1", "symbols": ["a"] },
    { "from": "q1", "to": "q2", "symbols": ["b"] }
  ],
  "examples": ["aab", "aba", "bab"]
}
```
```chalk-spec
{
  "kind": "chalk-automaton",
  "title": "Coin-operated turnstile",
  "start": "locked",
  "states": [
    { "id": "locked", "accept": true, "x": 0, "y": 0 },
    { "id": "unlocked", "x": 2, "y": 0 }
  ],
  "transitions": [
    { "from": "locked", "to": "unlocked", "symbols": ["coin"] },
    { "from": "locked", "to": "locked", "symbols": ["push"] },
    { "from": "unlocked", "to": "locked", "symbols": ["push"] },
    { "from": "unlocked", "to": "unlocked", "symbols": ["coin"] }
  ],
  "examples": ["coin push", "push push", "coin coin push"]
}
```

Automaton rules:
- `states[].id` is what transitions refer to; `label` (optional) is what's drawn. Keep labels short (≤ 4 characters fit the circle).
- Each state's `accept: true` draws a double circle. `start` gets an entry arrow from the left — leave room left of it.
- `symbols` lists every input symbol that fires that edge — list several on one edge rather than drawing parallel edges. `""` or `"ε"` is an epsilon move (makes it an NFA).
- If every symbol is one character, inputs are typed as plain strings (`"abba"`); if any symbol is longer, inputs are space-separated words (`"coin push"`).
- A missing move means the machine gets stuck and rejects — you don't need to draw a dead/trap state unless that's the lesson.
- Layout: `x` (column) and `y` (row) grid positions, fractions allowed, ~1 unit = one state's spacing. Give every state a position or none (none = arranged on a circle). Lay out the "happy path" left to right.
- Keep it to roughly 2–7 states.

Teaching notes:
- Start from a physical machine the student already knows — a turnstile, a vending machine, a traffic light, a door — then strip it down to circles and arrows. "A state is everything the machine needs to remember; it has no other memory."
- Let them predict before they step: "Will 1011 be accepted? Step through and see." Then give a string that breaks their guess.
- For NFAs, the key image is "a finger on every state you could be in". Show the same language as an NFA and a DFA and compare state counts.
