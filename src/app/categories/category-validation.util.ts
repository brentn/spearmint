import type { Category, CategoryType } from '../data/models';

/** Peppermint's hierarchy validation rules (spec §1/§7), reused unchanged. */

export interface CategoryDraft {
  name: string;
  parentCategoryId: string | null;
  type: CategoryType;
}

export function wouldCreateCycle(
  categories: Category[],
  categoryId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) {
    return false;
  }
  if (newParentId === categoryId) {
    return true;
  }
  const visited = new Set<string>();
  let currentId: string | null = newParentId;
  while (currentId !== null) {
    if (currentId === categoryId || visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);
    currentId = categories.find((c) => c.id === currentId)?.parentCategoryId ?? null;
  }
  return false;
}

export function hasSiblingDuplicateName(
  categories: Category[],
  draft: CategoryDraft,
  excludeId?: string,
): boolean {
  const name = draft.name.trim().toLowerCase();
  return categories.some(
    (c) =>
      c.id !== excludeId &&
      c.parentCategoryId === draft.parentCategoryId &&
      c.name.trim().toLowerCase() === name,
  );
}

export function hasSubcategories(categories: Category[], categoryId: string): boolean {
  return categories.some((c) => c.parentCategoryId === categoryId);
}

/** Validates a create (no `existingId`) or update (`existingId` set) against every rule at once. */
export function validateCategoryWrite(
  categories: Category[],
  draft: CategoryDraft,
  existingId?: string,
): string | null {
  if (draft.parentCategoryId !== null) {
    const parent = categories.find((c) => c.id === draft.parentCategoryId);
    if (!parent) {
      return 'Parent category not found.';
    }
    if (parent.type !== draft.type) {
      return "A category's type must match its parent's type.";
    }
  }
  if (existingId !== undefined && wouldCreateCycle(categories, existingId, draft.parentCategoryId)) {
    return 'Moving this category here would create a cycle.';
  }
  if (hasSiblingDuplicateName(categories, draft, existingId)) {
    return `A category named "${draft.name}" already exists under this parent.`;
  }
  return null;
}

export function validateCategoryDelete(categories: Category[], categoryId: string): string | null {
  if (hasSubcategories(categories, categoryId)) {
    return 'This category has subcategories — delete or move them first.';
  }
  return null;
}
