/** Below this scroll offset the nav always shows, regardless of direction. */
const NEAR_TOP_THRESHOLD = 8;

/**
 * Within this distance of the true scroll end the nav always shows. A plain
 * epsilon (not tied to the nav's own height, unlike the pre-#43 version) is
 * enough because hiding the nav no longer resizes the scroll container — see
 * nav-shell.scss.
 */
const NEAR_BOTTOM_THRESHOLD = 8;

/**
 * Net scroll distance, in the same direction, required before the nav's
 * hidden state actually flips. Absorbs the small back-and-forth deltas that
 * momentum/rubber-band scrolling generates, which is what caused rapid
 * open/close during slow scrolling (issue #43).
 */
const SCROLL_DEAD_ZONE_PX = 24;

export interface NavScrollState {
  hidden: boolean;
  accumulated: number;
}

/**
 * Decides the auto-hiding bottom nav's next hidden/visible state from a
 * scroll sample. Reversing direction resets the accumulator rather than
 * netting against it, so a deliberate scroll in one direction can't be
 * undone by the noise of a few pixels the other way.
 */
export function computeNavScrollState(
  previousY: number,
  currentY: number,
  distanceFromBottom: number,
  previous: NavScrollState,
): NavScrollState {
  if (currentY <= NEAR_TOP_THRESHOLD) {
    return { hidden: false, accumulated: 0 };
  }
  if (distanceFromBottom <= NEAR_BOTTOM_THRESHOLD) {
    return { hidden: false, accumulated: 0 };
  }

  const delta = currentY - previousY;
  if (delta === 0) {
    return previous;
  }

  // Math.sign(0) is 0, never ±1, so a fresh/just-reset accumulator always takes the
  // "reversal" branch below — that's fine, since 0 + delta and delta are the same value.
  const sameDirection = Math.sign(delta) === Math.sign(previous.accumulated);
  const accumulated = sameDirection ? previous.accumulated + delta : delta;

  if (Math.abs(accumulated) >= SCROLL_DEAD_ZONE_PX) {
    return { hidden: accumulated > 0, accumulated: 0 };
  }
  return { hidden: previous.hidden, accumulated };
}
