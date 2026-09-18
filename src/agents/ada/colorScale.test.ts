import { describe, it, expect } from 'vitest';
import { cellRgb, textColor } from './colorScale';

describe('cellRgb', () => {
  it('maps zero to white under the diverging scale regardless of skewed min/max', () => {
    expect(cellRgb(0, -1, 9, 'diverging')).toEqual([255, 255, 255]);
  });

  it('maps negative values toward blue and positive toward red under the diverging scale', () => {
    const neg = cellRgb(-5, -5, 5, 'diverging');
    const pos = cellRgb(5, -5, 5, 'diverging');
    expect(neg).toEqual([37, 99, 235]);
    expect(pos).toEqual([220, 38, 38]);
  });

  it('maps the low end of the sequential scale to a lighter color than the high end', () => {
    const low = cellRgb(0, 0, 10, 'sequential');
    const high = cellRgb(10, 0, 10, 'sequential');
    // "lighter" here means closer to white -> larger channel values on this blue hue.
    expect(low[2]).toBeGreaterThan(high[2]);
  });

  it('does not divide by zero when min === max for the sequential scale', () => {
    expect(() => cellRgb(3, 3, 3, 'sequential')).not.toThrow();
  });
});

describe('textColor', () => {
  it('picks white text on a dark background and dark text on a light background', () => {
    expect(textColor([10, 10, 10])).toBe('#ffffff');
    expect(textColor([250, 250, 250])).toBe('#1e293b');
  });
});
