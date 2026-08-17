/** Below this scroll offset the nav always shows, regardless of direction. */
const NEAR_TOP_THRESHOLD = 8;

/**
 * Extra slack added on top of the nav's own measured height when deciding
 * "near the bottom": the nav's box-collapse transition alone can shift the
 * scroll container's clientHeight by up to its own height (issue #28), and
 * iOS rubber-band scrolling can overshoot the true scroll end a bit further
 * on top of that.
 */
const NEAR_BOTTOM_SAFETY_MARGIN_PX = 24;

/**
 * Pure scroll-direction decision for the auto-hiding bottom nav: hides on
 * scroll-down, reveals on scroll-up or near the top or bottom of the page.
 *
 * Near-bottom uses an unconditional reveal (like near-top) rather than a
 * direction check because the nav's own collapse/expand transition changes
 * the scroll container's clientHeight mid-animation, generating synthetic
 * scroll events that a direction check misreads as bouncing (issue #28).
 */
export function computeNavHidden(
  previousY: number,
  currentY: number,
  currentlyHidden: boolean,
  distanceFromBottom: number,
  navHeightPx: number,
): boolean {
  if (currentY <= NEAR_TOP_THRESHOLD) {
    return false;
  }
  if (distanceFromBottom <= navHeightPx + NEAR_BOTTOM_SAFETY_MARGIN_PX) {
    return false;
  }
  if (currentY > previousY) {
    return true;
  }
  if (currentY < previousY) {
    return false;
  }
  return currentlyHidden;
}
