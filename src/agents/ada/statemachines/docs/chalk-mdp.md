## chalk-mdp

**Markov decision processes and value iteration** — "best path" when actions have random outcomes. Each state has actions; each action has one or more outcomes with a probability and an optional reward. The student steps through value-iteration sweeps (all values start at 0; each sweep applies the Bellman update to every state at once): each state's colour and caption show its value V, the arrows of the currently best action are bold green (the policy), and a γ (discount) slider re-runs everything live. Hovering a state spells out its Bellman update term by term — Q(a) = Σ p·(r + γ·V(next)) for every action, the winner starred. The renderer computes all values and the policy.

Example: take the sure thing or keep collecting
```chalk-spec
{
  "kind": "chalk-mdp",
  "title": "Cash out now, or keep collecting?",
  "states": [
    { "id": "here", "x": 0, "y": 0 },
    { "id": "done", "terminal": true, "x": 2, "y": 0 }
  ],
  "actions": [
    { "from": "here", "name": "cash out", "outcomes": [{ "to": "done", "p": 1, "reward": 1 }] },
    { "from": "here", "name": "collect", "outcomes": [{ "to": "here", "p": 1, "reward": 0.5 }] }
  ],
  "gamma": 0.9
}
```

Example: a risky shortcut versus the long way round
```chalk-spec
{
  "kind": "chalk-mdp",
  "title": "Shortcut over the ice, or the long way round?",
  "states": [
    { "id": "start", "x": 0, "y": 1 },
    { "id": "path", "x": 1, "y": 0 },
    { "id": "goal", "terminal": true, "x": 2, "y": 1 },
    { "id": "pit", "terminal": true, "x": 1, "y": 2 }
  ],
  "actions": [
    { "from": "start", "name": "ice", "outcomes": [{ "to": "goal", "p": 0.7, "reward": 10 }, { "to": "pit", "p": 0.3, "reward": -10 }] },
    { "from": "start", "name": "walk", "outcomes": [{ "to": "path", "p": 1, "reward": -1 }] },
    { "from": "path", "name": "walk", "outcomes": [{ "to": "goal", "p": 1, "reward": 10 }] }
  ],
  "gamma": 0.9
}
```

MDP rules:
- Each action's outcome `p` values must sum to 1. `reward` (default 0) is received on that transition.
- `terminal: true` states have no actions and value 0 (drawn as a double circle). A state with no actions behaves the same way.
- `gamma` is the starting discount (default 0.9, slider range 0–0.99).
- Give each action a short `name` — it labels the arrows (with the outcome probability when there are several, and the reward in parentheses).
- Layout uses `x`/`y` grid positions like chalk-automaton. Keep to roughly 2–7 states and 2–3 actions per state; arrows between the same pair bend apart automatically.

Teaching notes:
- Frame it as the bridge between the other two: a Markov chain where *you* choose the dice at every state, or a shortest-path search where moves can go wrong.
- Value = "how good is it to be here, if I play well from now on". The Bellman equation in words: value now = best over actions of (reward now + γ × expected value of where I land). Hover a state to show exactly that sum.
- Step sweep by sweep and watch the good news ripple backwards from the rewards — the same picture as Dijkstra spreading outward, run in reverse from the goal.
- γ is impatience: drag it towards 0 and the policy turns short-sighted (grab the immediate reward); towards 1 and patience pays. In the first example the policy flips from "cash out" to "collect" once γ gets large enough — ask the student to predict where.
