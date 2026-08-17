import { describe, expect, it } from 'vitest';
import { computeNavHidden } from './nav-scroll';

// Far enough from both page edges that near-top/near-bottom rules never kick in,
// isolating the direction-based cases from the two threshold rules.
const FAR_FROM_BOTTOM = 10_000;
const NAV_HEIGHT = 60;

describe('computeNavHidden', () => {
  it('stays visible near the top of the page even when scrolling down', () => {
    expect(computeNavHidden(0, 5, false, FAR_FROM_BOTTOM, NAV_HEIGHT)).toBe(false);
  });

  it('hides once scrolling down past the near-top threshold', () => {
    expect(computeNavHidden(50, 120, false, FAR_FROM_BOTTOM, NAV_HEIGHT)).toBe(true);
  });

  it('reveals when scrolling back up', () => {
    expect(computeNavHidden(300, 250, true, FAR_FROM_BOTTOM, NAV_HEIGHT)).toBe(false);
  });

  it('reveals immediately when scrolling up back near the top', () => {
    expect(computeNavHidden(100, 4, true, FAR_FROM_BOTTOM, NAV_HEIGHT)).toBe(false);
  });

  it('keeps the current state when the scroll position is unchanged', () => {
    expect(computeNavHidden(150, 150, true, FAR_FROM_BOTTOM, NAV_HEIGHT)).toBe(true);
    expect(computeNavHidden(150, 150, false, FAR_FROM_BOTTOM, NAV_HEIGHT)).toBe(false);
  });

  it('stays visible once within the nav-height-plus-margin band of the true bottom', () => {
    expect(computeNavHidden(500, 560, false, NAV_HEIGHT + 24, NAV_HEIGHT)).toBe(false);
  });

  it('hides normally just outside the near-bottom band', () => {
    expect(computeNavHidden(500, 560, false, NAV_HEIGHT + 25, NAV_HEIGHT)).toBe(true);
  });

  it('does not bounce while scroll noise oscillates inside the near-bottom band', () => {
    // Simulates the nav's own collapse/expand transition perturbing distanceFromBottom
    // and previousY/currentY around the boundary — every call must still resolve to visible.
    expect(computeNavHidden(560, 540, false, 10, NAV_HEIGHT)).toBe(false);
    expect(computeNavHidden(540, 565, false, 30, NAV_HEIGHT)).toBe(false);
    expect(computeNavHidden(565, 550, false, 5, NAV_HEIGHT)).toBe(false);
  });

  it('treats a larger measured nav height as a wider near-bottom band', () => {
    const tallNav = 120;
    expect(computeNavHidden(500, 560, false, tallNav + 24, tallNav)).toBe(false);
  });
});
