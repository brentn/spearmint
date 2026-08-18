import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { Category } from '../../data/models';
import { CategoryPicker } from './category-picker';

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Groceries',
    type: 'expense',
    parentCategoryId: null,
    ...overrides,
  };
}

describe('CategoryPicker', () => {
  function createFixture(categories: Category[] = [category(), category({ id: 'cat-2', name: 'Rent' })]) {
    TestBed.configureTestingModule({
      imports: [CategoryPicker],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(CategoryPicker);
    fixture.componentRef.setInput('categories', categories);
    fixture.detectChanges();
    return fixture;
  }

  function openSheet(fixture: ReturnType<typeof createFixture>) {
    fixture.nativeElement.querySelector('.category-picker__trigger').click();
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('does not render the sheet until the trigger is clicked', () => {
    const fixture = createFixture();
    expect(fixture.nativeElement.querySelector('.category-picker__sheet')).toBeFalsy();
  });

  it('opens the sheet when the trigger is clicked', () => {
    const fixture = createFixture();
    openSheet(fixture);
    expect(fixture.nativeElement.querySelector('.category-picker__sheet')).toBeTruthy();
  });

  it('does not open when disabled', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    openSheet(fixture);
    expect(fixture.nativeElement.querySelector('.category-picker__sheet')).toBeFalsy();
  });

  it('closes the sheet when the backdrop is clicked', () => {
    const fixture = createFixture();
    openSheet(fixture);

    fixture.nativeElement.querySelector('.category-picker__backdrop').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.category-picker__sheet')).toBeFalsy();
  });

  it('closes the sheet on Escape', () => {
    const fixture = createFixture();
    openSheet(fixture);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.category-picker__sheet')).toBeFalsy();
  });

  it('narrows the option list to matches of the filter text', () => {
    const fixture = createFixture();
    openSheet(fixture);

    const filter: HTMLInputElement = fixture.nativeElement.querySelector('.category-picker__filter');
    filter.value = 'rent';
    filter.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const spans: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.category-picker__option span:first-child');
    const optionLabels = Array.from(spans).map((el) => el.textContent);
    expect(optionLabels).toEqual(['Uncategorized', 'Rent']);
  });

  it('emits the selected category id and closes on selecting an option', () => {
    const fixture = createFixture();
    openSheet(fixture);
    let emitted: string | null | undefined;
    fixture.componentInstance.categoryChange.subscribe((id: string | null) => (emitted = id));

    const options: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.category-picker__option');
    const rentOption = Array.from(options).find((el) => el.textContent?.includes('Rent'));
    rentOption?.click();
    fixture.detectChanges();

    expect(emitted).toBe('cat-2');
    expect(fixture.nativeElement.querySelector('.category-picker__sheet')).toBeFalsy();
  });

  it('emits null and closes on selecting Uncategorized', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('selectedId', 'cat-1');
    openSheet(fixture);
    let emitted: string | null | undefined = 'not called';
    fixture.componentInstance.categoryChange.subscribe((id: string | null) => (emitted = id));

    const options: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.category-picker__option');
    const uncategorizedOption = Array.from(options).find((el) => el.textContent?.includes('Uncategorized'));
    uncategorizedOption?.click();
    fixture.detectChanges();

    expect(emitted).toBeNull();
  });

  it('marks the currently selected option as selected', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('selectedId', 'cat-2');
    openSheet(fixture);

    const options: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.category-picker__option');
    const rentOption = Array.from(options).find((el) => el.textContent?.includes('Rent'));
    expect(rentOption?.classList.contains('category-picker__option--selected')).toBe(true);
  });

  it('applies the emphasize modifier class to the trigger when the emphasize input is set', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('emphasize', true);
    fixture.detectChanges();

    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.category-picker__trigger');
    expect(trigger.classList.contains('category-picker__trigger--emphasize')).toBe(true);
  });
});
