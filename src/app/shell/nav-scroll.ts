/** Below this scroll offset the nav always shows, regardless of direction. */
const NEAR_TOP_THRESHOLD = 8;

/**
 * Pure scroll-direction decision for the auto-hiding bottom nav: hides on
 * scroll-down, reveals on scroll-up or near the top of the page.
 */
export function computeNavHidden(previousY: number, currentY: number, currentlyHidden: boolean): boolean {
  if (currentY <= NEAR_TOP_THRESHOLD) {
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
