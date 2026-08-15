import type { Category } from '../data/models';

export interface CategoryOptionGroup {
  label: string;
  options: Category[];
}

/** Parents sorted alphabetically, then children sorted alphabetically within each parent. */
export function groupAndSortCategories(categories: Category[]): CategoryOptionGroup[] {
  const topLevels = categories.filter((c) => c.parentCategoryId === null).sort((a, b) => a.name.localeCompare(b.name));

  return topLevels.map((top) => {
    const children = categories
      .filter((c) => c.parentCategoryId === top.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { label: top.name, options: children.length > 0 ? children : [top] };
  });
}
