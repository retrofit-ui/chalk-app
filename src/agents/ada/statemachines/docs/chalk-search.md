## chalk-search

**Graph search, step by step**: BFS, Dijkstra, greedy best-first and A* on one weighted graph. The student switches algorithm with buttons and steps through expansions. It shows the frontier (amber, listed in pop order with its priority), expanded states (grey), the state just expanded (blue), `g` (cost so far) and `h` (heuristic) under each state, the final path (green) with its cost and whether it is optimal, and a table comparing all algorithms (states expanded, path cost). If any `h` overestimates the true remaining cost, or drops by more than an edge's cost, a warning box says so and the offending edges turn red and dashed — the renderer computes the true costs itself.

Example: why BFS, greedy and A* disagree
```chalk-spec
{
  "kind": "chalk-search",
  "title": "Cheapest route from S to G",
  "start": "S",
  "goal": "G",
  "states": [
    { "id": "S", "h": 3, "x": 0, "y": 1 },
    { "id": "A", "h": 2, "x": 1, "y": 0 },
    { "id": "B", "h": 1, "x": 1, "y": 2 },
    { "id": "G", "h": 0, "x": 2, "y": 1 }
  ],
  "edges": [
    { "from": "S", "to": "A", "cost": 1 },
    { "from": "S", "to": "B", "cost": 4 },
    { "from": "A", "to": "B", "cost": 2 },
    { "from": "A", "to": "G", "cost": 5 },
    { "from": "B", "to": "G", "cost": 1 }
  ],
  "algorithm": "bfs",
  "editable": true
}
```

Example: reconciling a system to a desired state (how controllers such as Kubernetes' plan their moves). Each state is the *whole system's* configuration — extract job X and transform job T, both running in zone E, must end up running in zone W; T may never run without X, and jobs can only move while stopped ("move" moves both, "move T"/"move X" one at a time). A live migration exists but is expensive. `h` = (1 if not yet in W) + (number of stopped jobs):
```chalk-spec
{
  "kind": "chalk-search",
  "title": "Move X and T from zone E to zone W",
  "size": "small",
  "start": "onE",
  "goal": "onW",
  "states": [
    { "id": "onE", "label": "on E", "h": 1, "x": 0, "y": 1 },
    { "id": "Toff", "label": "T off", "h": 2, "x": 1, "y": 1 },
    { "id": "offE", "label": "off E", "h": 3, "x": 2, "y": 1 },
    { "id": "offW", "label": "off W", "h": 2, "x": 3, "y": 1 },
    { "id": "Xon", "label": "X on", "h": 1, "x": 4, "y": 1 },
    { "id": "onW", "label": "on W", "h": 0, "x": 5, "y": 2 },
    { "id": "TW", "label": "T@W", "h": 2, "x": 2, "y": 0 },
    { "id": "XoffTW", "label": "X off", "h": 3, "x": 3, "y": 0 }
  ],
  "edges": [
    { "from": "onE", "to": "Toff", "label": "stop T" },
    { "from": "Toff", "to": "offE", "label": "stop X" },
    { "from": "offE", "to": "offW", "label": "move" },
    { "from": "offW", "to": "Xon", "label": "start X" },
    { "from": "Xon", "to": "onW", "label": "start T" },
    { "from": "Toff", "to": "TW", "label": "move T" },
    { "from": "TW", "to": "XoffTW", "label": "stop X" },
    { "from": "XoffTW", "to": "offW", "label": "move X" },
    { "from": "onE", "to": "onW", "cost": 8, "label": "live migrate (8)" }
  ],
  "algorithms": ["bfs", "dijkstra", "astar"]
}
```
BFS takes the one-hop live migration (cost 8). Dijkstra and A* both find the five cheap steps (cost 5), but Dijkstra also explores the move-one-job-at-a-time detour, which A*'s heuristic lets it skip.

Search rules:
- `start` and `goal` must be state ids. The goal gets a double circle, the start an entry arrow from the left.
- Edge `cost` defaults to 1 and must be ≥ 0. `label` replaces the cost on the drawing (the cost is still used).
- `directed` defaults to true; set `false` for a road-map style graph where every edge goes both ways.
- `h` on a state is the heuristic estimate of remaining cost; omitted means 0. If no state has `h`, the default algorithm is Dijkstra, otherwise A*. Set `algorithm` to choose the starting one, and `algorithms` to limit the buttons (e.g. `["dijkstra", "astar"]`).
- `editable: true` lets the student change every edge cost and `h` value and see everything re-run — use it for "what if this road were shorter?" and "what if h lied?" questions.
- Layout uses `x`/`y` grid positions like chalk-automaton. Keep it to roughly 4–10 states; parallel or two-way edges between the same pair bend apart automatically.

Teaching notes:
- Teach the Red Blob Games progression on one graph: BFS (the frontier spreads like a ripple in a pond, by hop count) → Dijkstra (the ripple spreads by cost, so expensive edges slow it down) → greedy (only looks at h, heads straight for the goal, can be fooled) → A* (f = g + h, both at once).
- The big idea: **it is one loop and only the ordering of the frontier changes** — FIFO queue for BFS, priority g for Dijkstra, h for greedy, g + h for A*. Point at the frontier list while stepping.
- h is "as the crow flies": a guess that must never overestimate (admissible). To show why, set `editable` and have the student raise one `h` until A* returns a worse path — the warning box and the comparison table make the failure visible.
- For "best sequence of actions" problems (reconciling a system to a desired state, puzzles, planning), the states are *whole configurations* — draw the configuration graph, not the components.
