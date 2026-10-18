import { onCleanup } from 'solid-js';

/** How close to the bottom (px) counts as "at the bottom" and re-pins the view. */
export const PIN_THRESHOLD = 40;

export type ScrollMetrics = { scrollTop: number; scrollHeight: number; clientHeight: number };

/**
 * Whether the view should stay pinned to the bottom after a scroll event.
 *
 * Reaching the bottom pins it. Moving above `lastAutoTop`, the position this
 * code last scrolled to, unpins it: that can only be the reader. Merely being
 * far from the bottom does not unpin it, because content that arrives between
 * our own scroll and its (async) scroll event also leaves us far from the
 * bottom, and that must not count as the reader scrolling up.
 */
export function nextPinned(pinned: boolean, m: ScrollMetrics, lastAutoTop: number): boolean {
  if (m.scrollHeight - m.scrollTop - m.clientHeight <= PIN_THRESHOLD) return true;
  if (m.scrollTop < lastAutoTop - 1) return false;
  return pinned;
}

/**
 * Keeps `scroller` pinned to the bottom as `content` grows, until the reader
 * scrolls up. Then the view stays put (new content extends below it) until
 * they scroll back to the bottom. Returns `pin()` to re-pin explicitly, e.g.
 * when the reader sends a message or switches conversations.
 */
export function createStickToBottom(scroller: HTMLElement, content: HTMLElement): { pin: () => void } {
  let pinned = true;
  let lastAutoTop = 0;

  const toBottom = () => {
    scroller.scrollTop = scroller.scrollHeight;
    lastAutoTop = scroller.scrollTop;
  };
  const onScroll = () => {
    pinned = nextPinned(pinned, scroller, lastAutoTop);
  };
  // Content grows by streamed tokens and by components that size themselves
  // after mounting (3D canvases, KaTeX), so watch its size, not the messages.
  const observer = new ResizeObserver(() => {
    if (pinned) toBottom();
  });

  scroller.addEventListener('scroll', onScroll, { passive: true });
  observer.observe(content);
  onCleanup(() => {
    scroller.removeEventListener('scroll', onScroll);
    observer.disconnect();
  });

  return {
    pin: () => {
      pinned = true;
      toBottom();
    },
  };
}
