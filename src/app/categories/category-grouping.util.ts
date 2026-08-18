import type { Category } from '../data/models';

export interface CategoryOption {
  id: string;
  label: string;
}

/**
 * Flattens categories into a single alphabetized list where each child is labeled with its
 * parent's name as a prefix (e.g. "Transportation: Auto Payment"), skipping the prefix when the
 * child name already contains the parent name (e.g. parent "Auto" + child "Auto Insurance" stays
 * "Auto Insurance"). Sorting by that label clusters a parent's children together and places the
 * parent's own bare option immediately before them, since e.g. "Transportation" is a
 * lexicographic prefix of "Transportation: Auto Payment" — no separate group headers needed. A
 * parent with subcategories is still itself selectable (issue #11), so a one-off expense doesn't
 * force a new subcategory into existence.
 */
export function buildCategoryOptions(categories: Category[]): CategoryOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));

  return categories
    .map((category) => {
      if (category.parentCategoryId === null) {
        return { id: category.id, label: category.name };
      }
      const parentName = byId.get(category.parentCategoryId)?.name ?? '';
      const label = category.name.includes(parentName) ? category.name : `${parentName}: ${category.name}`;
      return { id: category.id, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
