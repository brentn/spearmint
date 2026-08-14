import { describe, expect, it } from 'vitest';
import { computeNavHidden } from './nav-scroll';

describe('computeNavHidden', () => {
  it('stays visible near the top of the page even when scrolling down', () => {
    expect(computeNavHidden(0, 5, false)).toBe(false);
  });

  it('hides once scrolling down past the near-top threshold', () => {
    expect(computeNavHidden(50, 120, false)).toBe(true);
  });

  it('reveals when scrolling back up', () => {
    expect(computeNavHidden(300, 250, true)).toBe(false);
  });

  it('reveals immediately when scrolling up back near the top', () => {
    expect(computeNavHidden(100, 4, true)).toBe(false);
  });

  it('keeps the current state when the scroll position is unchanged', () => {
    expect(computeNavHidden(150, 150, true)).toBe(true);
    expect(computeNavHidden(150, 150, false)).toBe(false);
  });
});
