import { Component, inject, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { CategoryType } from '../../../data/models';
import { CategoriesStore } from './categories.store';
import { SettingsHeader } from '../settings-header/settings-header';

@Component({
  selector: 'app-categories',
  imports: [FaIconComponent, SettingsHeader],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
  providers: [CategoriesStore],
})
export class CategoriesScreen {
  protected readonly store = inject(CategoriesStore);
  protected readonly icons = { add: faPlus, delete: faTrash };
  protected readonly categoryTypes: CategoryType[] = ['expense', 'income', 'transfer'];

  protected readonly newTopLevelName = signal('');
  protected readonly newTopLevelType = signal<CategoryType>('expense');

  async addTopLevel(): Promise<void> {
    const name = this.newTopLevelName().trim();
    if (!name) {
      return;
    }
    await this.store.addTopLevel(name, this.newTopLevelType());
    if (!this.store.error()) {
      this.newTopLevelName.set('');
    }
  }

  async addSubcategory(parentId: string, input: HTMLInputElement): Promise<void> {
    const name = input.value.trim();
    if (!name) {
      return;
    }
    await this.store.addSubcategory(parentId, name);
    if (!this.store.error()) {
      input.value = '';
    }
  }

  async rename(id: string, input: EventTarget | null): Promise<void> {
    const value = (input as HTMLInputElement | null)?.value.trim();
    if (!value) {
      return;
    }
    await this.store.rename(id, value);
  }

  async delete(id: string): Promise<void> {
    await this.store.delete(id);
  }
}
