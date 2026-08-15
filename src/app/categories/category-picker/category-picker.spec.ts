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

/**
 * Regression tests for issue #16: the panel used to be `position: absolute` inside the
 * (`overflow: hidden`) day card, so it was clipped whenever it opened near the card's edge —
 * most visibly for a day with only one transaction, or the last transaction in a day. It now
 * renders `position: fixed`, positioned from the trigger's own screen rect, which no ancestor's
 * `overflow: hidden` can clip.
 */
describe('CategoryPicker', () => {
  function createFixture(categories: Category[] = [category()]) {
    TestBed.configureTestingModule({
      imports: [CategoryPicker],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(CategoryPicker);
    fixture.componentRef.setInput('categories', categories);
    fixture.detectChanges();
    return fixture;
  }

  function stubTriggerRect(fixture: ReturnType<typeof createFixture>, rect: Partial<DOMRect>) {
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.category-picker__trigger');
    trigger.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...rect }) as DOMRect;
    return trigger;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the panel position:fixed so ancestor overflow:hidden cannot clip it', () => {
    const fixture = createFixture();
    stubTriggerRect(fixture, { left: 12, top: 400, bottom: 424, width: 90 });
    fixture.nativeElement.querySelector('.category-picker__trigger').click();
    fixture.detectChanges();

    const panel: HTMLElement = fixture.nativeElement.querySelector('.category-picker__panel');
    expect(panel).toBeTruthy();
    expect(getComputedStyle(panel).position).toBe('fixed');
  });

  it('anchors the panel below the trigger when there is room in the viewport', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const fixture = createFixture();
    stubTriggerRect(fixture, { left: 12, top: 400, bottom: 424, width: 90 });
    fixture.nativeElement.querySelector('.category-picker__trigger').click();
    fixture.detectChanges();

    const panel: HTMLElement = fixture.nativeElement.querySelector('.category-picker__panel');
    expect(panel.style.top).toBe('429px');
    expect(panel.style.bottom).toBe('');
  });

  it('flips the panel above the trigger when opening downward would run off the bottom of the viewport', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    const fixture = createFixture();
    // Last transaction of the day, near the bottom of a short viewport — the case from issue #16.
    stubTriggerRect(fixture, { left: 12, top: 460, bottom: 484, width: 90 });
    fixture.nativeElement.querySelector('.category-picker__trigger').click();
    fixture.detectChanges();

    const panel: HTMLElement = fixture.nativeElement.querySelector('.category-picker__panel');
    expect(panel.style.top).toBe('');
    expect(panel.style.bottom).toBe('45px');
  });

  it('closes the panel when the window scrolls, so it never drifts away from its trigger', () => {
    const fixture = createFixture();
    stubTriggerRect(fixture, { left: 12, top: 400, bottom: 424, width: 90 });
    fixture.nativeElement.querySelector('.category-picker__trigger').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.category-picker__panel')).toBeTruthy();

    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.category-picker__panel')).toBeFalsy();
  });

  it('closes the panel on window resize', () => {
    const fixture = createFixture();
    stubTriggerRect(fixture, { left: 12, top: 400, bottom: 424, width: 90 });
    fixture.nativeElement.querySelector('.category-picker__trigger').click();
    fixture.detectChanges();

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.category-picker__panel')).toBeFalsy();
  });

  it('clamps the panel to the right edge of the viewport instead of running off-screen', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const fixture = createFixture();
    // A trigger hugging the right edge of a narrow (mobile) viewport.
    stubTriggerRect(fixture, { left: 370, top: 400, bottom: 424, width: 20 });
    fixture.nativeElement.querySelector('.category-picker__trigger').click();
    fixture.detectChanges();

    const panel: HTMLElement = fixture.nativeElement.querySelector('.category-picker__panel');
    const left = parseFloat(panel.style.left);
    const width = parseFloat(panel.style.width);
    expect(left + width).toBeLessThanOrEqual(390);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it('shrinks max-height to fit when neither side of a short viewport has the full 16rem of room', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 200 });
    const fixture = createFixture();
    // Trigger roughly centered in a viewport too short to fit the panel's usual 256px above or below.
    stubTriggerRect(fixture, { left: 12, top: 90, bottom: 110, width: 90 });
    fixture.nativeElement.querySelector('.category-picker__trigger').click();
    fixture.detectChanges();

    const panel: HTMLElement = fixture.nativeElement.querySelector('.category-picker__panel');
    const maxHeight = parseFloat(panel.style.maxHeight);
    expect(maxHeight).toBeLessThan(256);
    expect(maxHeight).toBeGreaterThan(0);
  });
});
