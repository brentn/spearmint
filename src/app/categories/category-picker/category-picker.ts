import { Component, ElementRef, HostListener, computed, inject, input, output, signal, viewChild } from '@angular/core';
import type { Category } from '../../data/models';
import { groupAndSortCategories } from '../category-grouping.util';

/** Matches `.category-picker__panel`'s CSS `max-height: 16rem` (base 16px root font size) — the
 * ceiling this component clamps down from when the viewport doesn't have that much room. */
const PANEL_MAX_HEIGHT_PX = 256;
/** Matches the CSS gap the panel used to sit at via `top: calc(100% + 0.3rem)`. */
const PANEL_GAP_PX = 5;
/** Matches the CSS floor the panel used to sit at via `width: max(14rem, 100%)`. */
const PANEL_MIN_WIDTH_PX = 224;
/** Minimum breathing room kept between the panel and every viewport edge. */
const VIEWPORT_MARGIN_PX = 8;

export interface CategoryPickerPanelPosition {
  left: number;
  width: number;
  top: number | null;
  bottom: number | null;
  /** Clamped to whichever side (above/below the trigger) the panel opened into, so it's always
   * fully on-screen instead of running past the top/bottom edge on a short viewport (issue #16). */
  maxHeight: number;
}

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
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly categories = input.required<Category[]>();
  readonly selectedId = input<string | null>(null);
  readonly disabled = input(false);
  readonly categoryChange = output<string | null>();

  protected readonly open = signal(false);
  protected readonly filterText = signal('');
  /** Screen coordinates for the panel, computed from the trigger's own rect on open. The panel
   * renders `position: fixed` from these instead of being absolutely positioned inside the row,
   * so an ancestor's `overflow: hidden` (the transactions day card) can never clip it — issue #16:
   * the picker was impossible to open on a day with one transaction, or the last one in a day. */
  protected readonly panelPosition = signal<CategoryPickerPanelPosition | null>(null);

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
    if (this.open()) {
      this.close();
      return;
    }
    this.panelPosition.set(this.computePanelPosition());
    this.open.set(true);
  }

  select(categoryId: string | null): void {
    this.categoryChange.emit(categoryId);
    this.close();
  }

  private close(): void {
    this.open.set(false);
    this.filterText.set('');
  }

  private computePanelPosition(): CategoryPickerPanelPosition {
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, PANEL_MIN_WIDTH_PX), window.innerWidth - 2 * VIEWPORT_MARGIN_PX);
    // Clamped so the panel can never run off the right edge — a fixed-position panel escapes the
    // trigger's own `max-width: 100%` entirely, so nothing else constrains it horizontally.
    const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN_PX), window.innerWidth - width - VIEWPORT_MARGIN_PX);

    const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP_PX - VIEWPORT_MARGIN_PX;
    const spaceAbove = rect.top - PANEL_GAP_PX - VIEWPORT_MARGIN_PX;
    const openUpward = spaceBelow < PANEL_MAX_HEIGHT_PX && spaceAbove > spaceBelow;
    // Shrinks the panel to fit whichever side it opened into, instead of letting a short
    // viewport push it past the opposite edge (e.g. flipping "up" with less than 256px above).
    const maxHeight = Math.min(PANEL_MAX_HEIGHT_PX, Math.max(openUpward ? spaceAbove : spaceBelow, 0));

    return {
      left,
      width,
      top: openUpward ? null : rect.bottom + PANEL_GAP_PX,
      bottom: openUpward ? window.innerHeight - rect.top + PANEL_GAP_PX : null,
      maxHeight,
    };
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  // The panel is fixed-positioned from the trigger's rect captured at open time — closing on
  // scroll/resize avoids it drifting away from the trigger it's anchored to (issue #16).
  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.open()) {
      this.close();
    }
  }
}
