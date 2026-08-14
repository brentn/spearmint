import { Injectable, inject, signal } from '@angular/core';
import { CategoriesService } from '../../../categories/categories.service';
import type { Category, CategoryType } from '../../../data/models';

/**
 * Screen-scoped store for Settings -> Categories: loads categories via CategoriesService
 * and re-reads after every mutating action, matching this codebase's existing convention
 * (AccountsStore) of plain signals refreshed imperatively.
 */
@Injectable()
export class CategoriesStore {
  private readonly categoriesService = inject(CategoriesService);

  readonly loading = signal(true);
  readonly categories = signal<Category[]>([]);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.categories.set(await this.categoriesService.list());
    this.loading.set(false);
  }

  topLevel(): Category[] {
    return this.categories().filter((c) => c.parentCategoryId === null);
  }

  childrenOf(parentId: string): Category[] {
    return this.categories().filter((c) => c.parentCategoryId === parentId);
  }

  async addTopLevel(name: string, type: CategoryType): Promise<void> {
    await this.write(() => this.categoriesService.create({ name, parentCategoryId: null, type }));
  }

  async addSubcategory(parentId: string, name: string): Promise<void> {
    const parent = this.categories().find((c) => c.id === parentId);
    if (!parent) {
      return;
    }
    await this.write(() => this.categoriesService.create({ name, parentCategoryId: parentId, type: parent.type }));
  }

  async rename(id: string, name: string): Promise<void> {
    const category = this.categories().find((c) => c.id === id);
    if (!category) {
      return;
    }
    await this.write(() =>
      this.categoriesService.update(id, { name, parentCategoryId: category.parentCategoryId, type: category.type }),
    );
  }

  async delete(id: string): Promise<void> {
    await this.write(() => this.categoriesService.delete(id));
  }

  private async write(action: () => Promise<unknown>): Promise<void> {
    this.error.set(null);
    try {
      await action();
      await this.refresh();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'That change could not be saved.');
    }
  }
}
