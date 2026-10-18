import { describe, it, expect } from 'vitest';
import { nextPinned, PIN_THRESHOLD } from './stickToBottom';

const at = (scrollTop: number, scrollHeight = 2000, clientHeight = 500) => ({ scrollTop, scrollHeight, clientHeight });

describe('nextPinned', () => {
  it('pins when the reader is at (or within the threshold of) the bottom', () => {
    expect(nextPinned(false, at(1500), 0)).toBe(true);
    expect(nextPinned(false, at(1500 - PIN_THRESHOLD), 0)).toBe(true);
  });

  it('unpins when the reader moves above where we last auto-scrolled', () => {
    expect(nextPinned(true, at(1200), 1500)).toBe(false);
  });

  it('stays pinned when content grew after our own scroll (scrollTop unchanged, bottom moved away)', () => {
    // We scrolled to 1500; 600px of tokens arrived before the scroll event fired.
    expect(nextPinned(true, at(1500, 2600), 1500)).toBe(true);
  });

  it('stays unpinned while the reader is somewhere in the middle', () => {
    expect(nextPinned(false, at(800), 1500)).toBe(false);
    expect(nextPinned(false, at(1600, 2600), 1500)).toBe(false);
  });
});
