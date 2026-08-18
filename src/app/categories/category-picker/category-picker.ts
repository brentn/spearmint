import { Component, HostListener, computed, input, output, signal } from '@angular/core';
import type { Category } from '../../data/models';
import { buildCategoryOptions } from '../category-grouping.util';

/**
 * Replaces a native `<select>` for category assignment: a native select can't host a filter
 * textbox, and on-device comparison against a real native select showed iOS's own wheel picker
 * renders about as few visible rows as this used to as an anchored popover, while also dropping
 * filtering entirely — so this stays a custom control, now presented as a near-full-screen sheet
 * instead of a small anchored popover for more browsing room.
 */
@Component({
  selector: 'app-category-picker',
  imports: [],
  templateUrl: './category-picker.html',
  styleUrl: './category-picker.scss',
})
export class CategoryPicker {
  readonly categories = input.required<Category[]>();
  readonly selectedId = input<string | null>(null);
  readonly disabled = input(false);
  /** Solid-color trigger treatment for contexts that want the control to stand out — e.g. a
   * quick-categorize affordance in a list (issue #24) — vs. the default muted/outlined look. */
  readonly emphasize = input(false);
  readonly categoryChange = output<string | null>();

  protected readonly open = signal(false);
  protected readonly animateIn = signal(false);
  protected readonly filterText = signal('');

  protected readonly allOptions = computed(() => buildCategoryOptions(this.categories()));

  protected readonly selectedLabel = computed(() => {
    const id = this.selectedId();
    if (!id) {
      return 'Uncategorized';
    }
    return this.allOptions().find((o) => o.id === id)?.label ?? 'Uncategorized';
  });

  protected readonly filteredOptions = computed(() => {
    const filter = this.filterText().trim().toLowerCase();
    if (!filter) {
      return this.allOptions();
    }
    return this.allOptions().filter((o) => o.label.toLowerCase().includes(filter));
  });

  openSheet(): void {
    if (this.disabled()) {
      return;
    }
    this.open.set(true);
    // Renders at its off/small starting transform first, then flips a frame later so the CSS
    // transition actually animates instead of the sheet appearing already at rest.
    requestAnimationFrame(() => requestAnimationFrame(() => this.animateIn.set(true)));
  }

  select(categoryId: string | null): void {
    this.categoryChange.emit(categoryId);
    this.close();
  }

  close(): void {
    this.animateIn.set(false);
    this.open.set(false);
    this.filterText.set('');
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }
}
