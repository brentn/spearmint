import { describe, expect, it } from 'vitest';
import { computeNavScrollState, type NavScrollState } from './nav-scroll';

// Far enough from both page edges that near-top/near-bottom rules never kick in,
// isolating the dead-zone/direction cases from the two threshold rules.
const FAR_FROM_BOTTOM = 10_000;

function state(hidden: boolean, accumulated: number): NavScrollState {
  return { hidden, accumulated };
}

describe('computeNavScrollState', () => {
  it('stays visible near the top of the page even when scrolling down', () => {
    expect(computeNavScrollState(0, 5, FAR_FROM_BOTTOM, state(false, 0))).toEqual(state(false, 0));
  });

  it('stays visible once within the near-bottom threshold of the true bottom', () => {
    expect(computeNavScrollState(500, 560, 8, state(true, 20))).toEqual(state(false, 0));
  });

  it('hides normally just outside the near-bottom threshold', () => {
    expect(computeNavScrollState(500, 560, 9, state(false, 0))).toEqual(state(true, 0));
  });

  it('does not hide on a small scroll-down delta below the dead zone', () => {
    expect(computeNavScrollState(50, 60, FAR_FROM_BOTTOM, state(false, 0))).toEqual(state(false, 10));
  });

  it('hides once accumulated downward scrolling crosses the dead zone', () => {
    expect(computeNavScrollState(50, 120, FAR_FROM_BOTTOM, state(false, 0))).toEqual(state(true, 0));
  });

  it('accumulates across multiple small deltas in the same direction before hiding', () => {
    const afterFirst = computeNavScrollState(50, 60, FAR_FROM_BOTTOM, state(false, 0));
    expect(afterFirst).toEqual(state(false, 10));

    const afterSecond = computeNavScrollState(60, 75, FAR_FROM_BOTTOM, afterFirst);
    expect(afterSecond).toEqual(state(true, 0));
  });

  it('resets the accumulator on a direction reversal instead of hiding/revealing', () => {
    // 10px down, then 5px up: the reversal restarts the count rather than netting to 5.
    const afterDown = computeNavScrollState(50, 60, FAR_FROM_BOTTOM, state(false, 0));
    expect(afterDown).toEqual(state(false, 10));

    const afterUp = computeNavScrollState(60, 55, FAR_FROM_BOTTOM, afterDown);
    expect(afterUp).toEqual(state(false, -5));
  });

  it('reveals once accumulated upward scrolling crosses the dead zone', () => {
    expect(computeNavScrollState(300, 250, FAR_FROM_BOTTOM, state(true, 0))).toEqual(state(false, 0));
  });

  it('keeps the current state when the scroll position is unchanged', () => {
    expect(computeNavScrollState(150, 150, FAR_FROM_BOTTOM, state(true, 15))).toEqual(state(true, 15));
    expect(computeNavScrollState(150, 150, FAR_FROM_BOTTOM, state(false, -3))).toEqual(state(false, -3));
  });

  it('does not bounce while scroll noise oscillates near the bottom', () => {
    // Simulates rubber-band overshoot perturbing distanceFromBottom around the boundary —
    // every call must still resolve to visible with a cleared accumulator.
    expect(computeNavScrollState(560, 540, 3, state(false, 0))).toEqual(state(false, 0));
    expect(computeNavScrollState(540, 565, 1, state(false, 0))).toEqual(state(false, 0));
    expect(computeNavScrollState(565, 550, 5, state(false, 0))).toEqual(state(false, 0));
  });

  it('lets the dead zone absorb jitter just outside the near-bottom threshold', () => {
    // distanceFromBottom stays in the 8-32px band, just past the always-visible zone but
    // still close to the true end — small oscillating deltas here must not toggle the nav.
    const afterDown = computeNavScrollState(560, 565, 20, state(false, 0));
    expect(afterDown).toEqual(state(false, 5));

    const afterUp = computeNavScrollState(565, 561, 24, afterDown);
    expect(afterUp).toEqual(state(false, -4));

    const afterDownAgain = computeNavScrollState(561, 566, 19, afterUp);
    expect(afterDownAgain).toEqual(state(false, 5));
  });
});
