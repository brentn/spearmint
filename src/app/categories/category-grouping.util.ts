import type { Category } from '../data/models';

export interface CategoryOption {
  id: string;
  name: string;
  displayName: string;
}

export interface CategoryOptionGroup {
  label: string;
  options: CategoryOption[];
}

/**
 * Parents sorted alphabetically, then children sorted alphabetically within each parent.
 * A parent with subcategories is itself selectable as the group's first, unprefixed option
 * (issue #11), so one-off expenses don't force a new subcategory into existence.
 */
export function groupAndSortCategories(categories: Category[]): CategoryOptionGroup[] {
  const topLevels = categories.filter((c) => c.parentCategoryId === null).sort((a, b) => a.name.localeCompare(b.name));

  return topLevels.map((top) => {
    const children = categories
      .filter((c) => c.parentCategoryId === top.id)
      .sort((a, b) => a.name.localeCompare(b.name));

    const topOption: CategoryOption = { id: top.id, name: top.name, displayName: top.name };
    const options: CategoryOption[] =
      children.length === 0
        ? [topOption]
        : [topOption, ...children.map((c) => ({ id: c.id, name: c.name, displayName: ` | ${c.name}` }))];
    return { label: top.name, options };
  });
}
