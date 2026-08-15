/**
 * Token-set Jaccard similarity over two whitespace-tokenized strings — the primary name-
 * similarity signal for CategorizationRule matching (spec §3.1). Preferred over raw Levenshtein
 * for merchant strings because it's robust to word-order and single-token insertion noise (e.g.
 * "AMZN MKTP US*2K3L4" vs "AMAZON MKTP US" still shares the "MKTP"/"US" tokens).
 */
export function tokenSetJaccard(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));

  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}
