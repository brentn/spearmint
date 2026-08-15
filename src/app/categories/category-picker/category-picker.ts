import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import type { Category } from '../../data/models';
import { groupAndSortCategories } from '../category-grouping.util';

/**
 * Replaces a native `<select>` for category assignment: a native select can't host a
 * filter textbox, and the picker needs alphabetical parent/child grouping (issue #12).
 */
@Component({
  selector: 'app-category-picker',
  imports: [],
  templateUrl: './category-picker.html',
  styleUrl: './category-picker.scss',
})
export class CategoryPicker {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly categories = input.required<Category[]>();
  readonly selectedId = input<string | null>(null);
  readonly disabled = input(false);
  readonly categoryChange = output<string | null>();

  protected readonly open = signal(false);
  protected readonly filterText = signal('');

  protected readonly selectedName = computed(() => {
    const id = this.selectedId();
    if (!id) {
      return 'Uncategorized';
    }
    return this.categories().find((c) => c.id === id)?.name ?? 'Uncategorized';
  });

  protected readonly filteredGroups = computed(() => {
    const groups = groupAndSortCategories(this.categories());
    const filter = this.filterText().trim().toLowerCase();
    if (!filter) {
      return groups;
    }
    return groups
      .map((group) => {
        if (group.label.toLowerCase().includes(filter)) {
          return group;
        }
        return { label: group.label, options: group.options.filter((o) => o.name.toLowerCase().includes(filter)) };
      })
      .filter((group) => group.options.length > 0);
  });

  toggle(): void {
    if (this.disabled()) {
      return;
    }
    this.open.update((v) => !v);
    if (!this.open()) {
      this.filterText.set('');
    }
  }

  select(categoryId: string | null): void {
    this.categoryChange.emit(categoryId);
    this.open.set(false);
    this.filterText.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
      this.filterText.set('');
    }
  }
}
