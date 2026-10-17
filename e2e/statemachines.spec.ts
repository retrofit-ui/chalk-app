import { test, expect, type Page } from '@playwright/test';
import { seedSpec } from './helpers/seed';
import * as F from './fixtures/statemachines';

// The state-machine kinds are interactive, so these tests drive them: step, switch
// algorithm, move sliders, hover — and assert on what the engines computed.

async function open(page: Page, spec: unknown) {
  await seedSpec(page, spec);
  await page.goto('/');
  const node = page.locator(`[data-kind="${(spec as { kind: string }).kind}"]`);
  await expect(node).toHaveCount(1);
  return node;
}

test.describe('chalk-automaton', () => {
  test('draws every state, the start arrow and the accept ring', async ({ page }) => {
    const node = await open(page, F.evenOnes);
    await expect(node).toContainText('Even ones fixture');
    await expect(node.locator('[data-state]')).toHaveCount(2);
    await expect(node.locator('[data-testid="start-arrow"]')).toHaveCount(1);
    await expect(node.locator('[data-testid="accept-ring"]')).toHaveCount(1);
    await expect(node.locator('[data-edge]')).toHaveCount(4);
    await expect(node.getByTestId('automaton-type')).toHaveText('DFA');
  });

  test('steps through the tape and ends with a verdict', async ({ page }) => {
    const node = await open(page, F.evenOnes);
    await expect(node.getByTestId('tape-cell')).toHaveCount(3);
    await expect(node.getByTestId('automaton-status')).toContainText('{even}');
    await node.getByTestId('player-step').click();
    await expect(node.getByTestId('automaton-status')).toContainText('{odd}');
    await expect(node.getByTestId('tape-cell').first()).toHaveAttribute('data-read', 'true');
    await node.getByTestId('player-end').click();
    await expect(node.getByTestId('automaton-status')).toContainText('Accepted'); // 101 has two 1s
  });

  test('example buttons replace the input and restart the run', async ({ page }) => {
    const node = await open(page, F.evenOnes);
    await node.getByTestId('automaton-example').filter({ hasText: '1011' }).click();
    await expect(node.getByTestId('automaton-input')).toHaveValue('1011');
    await expect(node.getByTestId('player-position')).toHaveText('symbol 0 / 4');
    await node.getByTestId('player-end').click();
    await expect(node.getByTestId('automaton-status')).toContainText('Rejected');
    await node.getByTestId('automaton-input').fill('11');
    await node.getByTestId('player-end').click();
    await expect(node.getByTestId('automaton-status')).toContainText('Accepted');
  });

  test('an NFA is labelled as such and tracks several active states', async ({ page }) => {
    const node = await open(page, F.endsAb);
    await expect(node.getByTestId('automaton-type')).toHaveText('NFA');
    await node.getByTestId('player-step').click();
    await expect(node.getByTestId('automaton-status')).toContainText('{q0, q1}');
    await node.getByTestId('player-end').click();
    await expect(node.getByTestId('automaton-status')).toContainText('Accepted');
  });

  test('an invalid spec shows its problems instead of crashing', async ({ page }) => {
    const node = await open(page, F.brokenAutomaton);
    await expect(node.getByTestId('spec-errors')).toContainText('nowhere');
  });
});

test.describe('chalk-search', () => {
  test('BFS starts with only the start on the frontier, then finds the fewest-hops path', async ({ page }) => {
    const node = await open(page, F.search);
    await expect(node.getByTestId('algorithm-bfs')).toHaveAttribute('aria-pressed', 'true');
    await expect(node.getByTestId('frontier-entry')).toHaveCount(1);
    await node.getByTestId('player-step').click();
    await expect(node.getByTestId('frontier-entry')).toHaveCount(2);
    await node.getByTestId('player-end').click();
    await expect(node.getByTestId('search-path')).toContainText('S → A → G');
    await expect(node.getByTestId('search-path')).toContainText('not optimal');
  });

  test('switching to A* restarts and finds the optimal path', async ({ page }) => {
    const node = await open(page, F.search);
    await node.getByTestId('player-end').click();
    await node.getByTestId('algorithm-astar').click();
    await expect(node.getByTestId('player-position')).toHaveText('expansion 0 / 4');
    await node.getByTestId('player-end').click();
    await expect(node.getByTestId('search-path')).toContainText('S → A → B → G');
    await expect(node.getByTestId('search-path')).toContainText('(optimal)');
  });

  test('the comparison table covers every algorithm', async ({ page }) => {
    const node = await open(page, F.search);
    const rows = node.getByTestId('algorithm-compare').locator('tbody tr');
    await expect(rows).toHaveCount(4);
    await expect(rows.filter({ hasText: 'Dijkstra' })).toContainText('4');
    await expect(rows.filter({ hasText: 'BFS' })).toContainText('6');
  });

  test('raising h above the true cost triggers the heuristic warning', async ({ page }) => {
    const node = await open(page, F.search);
    await expect(node.getByTestId('heuristic-warning')).toHaveCount(0);
    await node.getByTestId('search-edit').locator('summary').click();
    await node.getByTestId('edit-h').nth(2).fill('5'); // h(B)
    await expect(node.getByTestId('heuristic-warning')).toContainText('B (h=5, true cost 1)');
  });
});

test.describe('chalk-markov', () => {
  test('shows the transition matrix and walks the token', async ({ page }) => {
    const node = await open(page, F.weather);
    await expect(node.getByTestId('markov-matrix').locator('tbody tr')).toHaveCount(2);
    await expect(node.getByTestId('walk-token')).toHaveCount(1);
    await node.getByTestId('player-step').click();
    await expect(node.getByTestId('player-position')).toHaveText('hop 1 / 400');
    await expect(node.getByTestId('markov-visits')).toContainText('83%'); // long-run sunny share
  });

  test('the n-steps view multiplies by P', async ({ page }) => {
    const node = await open(page, F.weather);
    await node.getByTestId('markov-mode-flow').click();
    await expect(node.getByTestId('markov-distribution')).toContainText('1.000, 0.000');
    await node.getByTestId('markov-n').fill('2');
    await expect(node.getByTestId('markov-distribution')).toContainText('0.860, 0.140');
  });

  test('editing a probability rescales the row', async ({ page }) => {
    const node = await open(page, F.weather);
    await node.getByTestId('markov-edit').locator('summary').click();
    const sunnyRainy = node.getByTestId('edit-p').nth(1);
    await sunnyRainy.fill('0.3');
    await sunnyRainy.press('Enter');
    await expect(node.getByTestId('markov-matrix').locator('tbody tr').first()).toContainText('.70');
  });

  test('absorbing chains show expected steps to absorption', async ({ page }) => {
    const node = await open(page, F.ruin);
    await expect(node.getByTestId('markov-absorption')).toContainText('Absorbing: 0, 3');
    await expect(node.getByTestId('expected-steps')).toHaveText(['2.00', '2.00']);
  });
});

test.describe('chalk-mdp', () => {
  test('value iteration converges to the patient policy at γ = 0.9', async ({ page }) => {
    const node = await open(page, F.cashOut);
    await expect(node.getByTestId('mdp-policy')).toContainText('none yet');
    await node.getByTestId('player-step').click();
    await expect(node.getByTestId('mdp-policy')).toContainText('cash out');
    await node.getByTestId('player-end').click();
    await expect(node.getByTestId('mdp-policy')).toContainText('collect');
    await expect(node.getByTestId('mdp-status')).toContainText('converged');
    await expect(node.locator('[data-state="here"] [data-testid="state-caption"]')).toHaveText('V=5.00');
  });

  test('lowering γ makes the policy short-sighted', async ({ page }) => {
    const node = await open(page, F.cashOut);
    await node.getByTestId('mdp-gamma').fill('0.2');
    await node.getByTestId('player-end').click();
    await expect(node.getByTestId('mdp-policy')).toContainText('cash out');
  });

  test('hovering a state spells out its Bellman update', async ({ page }) => {
    const node = await open(page, F.cashOut);
    await node.getByTestId('player-step').click();
    await node.getByTestId('player-step').click();
    await node.locator('[data-state="here"]').hover();
    const backup = node.getByTestId('mdp-backup');
    await expect(backup).toContainText('Q(cash out)');
    await expect(backup).toContainText('Q(collect) = 1·(0.5 + 0.90·1.00) = 1.40');
  });
});
