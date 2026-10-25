import { test, expect, type Page } from '@playwright/test';
import { seedSpec } from './helpers/seed';
import { routeAnthropic, sseResponse } from './helpers/anthropicSse';
import * as P from './fixtures/polar';

// Polar, cylindrical and spherical coordinates across the four plotting kinds.

const GRID_COLOR = 'rgb(226, 232, 240)'; // #e2e8f0, CartesianGraph's polar grid

async function openSpec(page: Page, spec: unknown) {
  await seedSpec(page, spec);
  await page.goto('/');
  return page.locator(`[data-kind="${(spec as { kind: string }).kind}"]`);
}

/** On-screen bounding boxes of the polar grid's rings. */
async function ringBoxes(page: Page) {
  return page.locator('[data-kind="chalk-graph"] path[data-polar-ring]').evaluateAll((paths) =>
    paths.map((p) => {
      const b = (p as SVGGraphicsElement).getBBox();
      const m = (p as SVGGraphicsElement).getScreenCTM()!;
      return { w: b.width * m.a, h: b.height * m.d };
    }),
  );
}

test.describe('chalk-graph on a polar grid', () => {
  test('draws round rings, the polar curve and the angle labels', async ({ page }) => {
    const node = await openSpec(page, P.polarGraph);
    await expect(node).toContainText('Cardioid fixture');
    await expect(node).toContainText('π/2');
    await expect(node).toContainText('5π/6');

    const rings = await ringBoxes(page);
    expect(rings.length).toBeGreaterThanOrEqual(3);
    for (const ring of rings) expect(ring.w / ring.h).toBeCloseTo(1, 1);

  });

  test('evaluates pi inside a curve, and labels angles in degrees', async ({ page }) => {
    const node = await openSpec(page, P.piCurveGraph);
    await expect(node).toContainText('Rose fixture');
    await expect(node).toContainText('90°');
    await expect(node.getByTestId('spec-errors')).toHaveCount(0);
    // A curve that failed to evaluate draws an empty path ("M0,0" or nothing).
    const d = await node.locator('path.line').evaluateAll((ps, gridColor) =>
      ps.filter((p) => getComputedStyle(p).stroke !== gridColor).map((p) => p.getAttribute('d') ?? ''), GRID_COLOR);
    expect(d.some((path) => path.split('L').length > 50)).toBe(true);
  });

  test('a mismatched expression shows the validation error', async ({ page }) => {
    await seedSpec(page, P.badPolarGraph);
    await page.goto('/');
    const errors = page.getByTestId('spec-errors');
    await expect(errors).toContainText('curves[0]');
    await expect(errors).toContainText('theta');
  });

  test('a click is reported in polar and cartesian', async ({ page }) => {
    await seedSpec(page, P.interactivePolarGraph);
    const api = await routeAnthropic(page, [sseResponse([{ type: 'text', text: 'Nice.' }])]);
    await page.goto('/');
    const svg = page.locator('[data-kind="chalk-graph"] svg').first();
    await svg.click({ position: { x: 300, y: 120 } });
    await page.getByRole('button', { name: 'Submit' }).click();
    await api.waitForRequests(1);
    const text = JSON.stringify(api.requests[0].messages.at(-1));
    const m = text.match(/\(r = ([\d.]+), θ = ([^)]+)\) ≈ \((-?[\d.]+), (-?[\d.]+)\)/);
    expect(m, text).not.toBeNull();
    const [, r, , x, y] = m!;
    expect(Number(r)).toBeCloseTo(Math.hypot(Number(x), Number(y)), 1);
  });
});

test.describe('chalk-vectors in polar', () => {
  test('a polar-basis vector starts at its tail and follows r̂/θ̂ there', async ({ page }) => {
    const node = await openSpec(page, P.polarBasisVectors);
    await expect(node).toContainText('Local basis fixture');
    await expect(node).toContainText('r̂');
    await expect(node).toContainText('θ̂');
    // Domain [-4, 4] over a 360px inner box with a 20px margin: x ↦ 20 + (x + 4) * 45.
    const v = node.locator('[data-vector-id="v"] line[data-arrow]');
    await expect(v).toHaveAttribute('x1', '200');
    await expect(v).toHaveAttribute('y1', '110');
    await expect(v).toHaveAttribute('x2', '110');
    await expect(v).toHaveAttribute('y2', '65');
    await expect(node.locator('circle[data-polar-ring]').first()).toBeAttached();
  });
});

test.describe('chalk-draw on a polar grid', () => {
  test('draws rings into the canvas the student submits', async ({ page }) => {
    const node = await openSpec(page, P.polarDraw);
    await expect(node).toContainText('Polar canvas fixture');
    // Sample the canvas along the +x axis from the centre: a ring at r = 1 crosses it.
    const hits = await node.locator('canvas').evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext('2d')!;
      const data = ctx.getImageData(0, Math.round(c.height / 2) - 20, c.width, 1).data;
      let nonWhite = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 250) nonWhite++;
      return nonWhite;
    });
    // A row 20px above the centre crosses rings (and spokes) several times; a cartesian grid
    // row between integer lines would cross only the vertical lines.
    expect(hits).toBeGreaterThan(8);
    await expect(node).toHaveAttribute('data-grid', 'polar');
  });
});

test.describe('chalk-graph3d curvilinear', () => {
  test('mounts every surface form, cylindrical/spherical points and basis vectors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'warning' || msg.type() === 'error') errors.push(msg.text()); });
    const node = await openSpec(page, P.curvilinearScene);
    await expect(node).toContainText('Curvilinear fixture');
    await expect(node.locator('canvas')).toHaveCount(1);
    for (const label of ['bump', 'vase', 'dipole', 'p', 'v', 'r̂', 'φ̂', 'ẑ']) {
      await expect(node.getByText(label, { exact: true }).first()).toBeAttached();
    }
    await expect(node.getByTestId('spec-errors')).toHaveCount(0);
    expect(errors.filter((e) => e.includes('[Scene3D]'))).toEqual([]);
  });

  test('a surface in the wrong variables shows the validation error', async ({ page }) => {
    await seedSpec(page, P.badScene);
    await page.goto('/');
    await expect(page.getByTestId('spec-errors')).toContainText('surfaces[0]');
    await expect(page.getByTestId('spec-errors')).toContainText('polar, azimuth');
  });
});
