import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavScrollService } from '../nav-scroll.service';
import { NavShell } from './nav-shell';

const SETTLE_DEBOUNCE_MS = 50;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  fire(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function setOffsetHeight(element: Element, value: number): void {
  Object.defineProperty(element, 'offsetHeight', { value, configurable: true });
}

describe('NavShell', () => {
  let setNavHeight: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.useFakeTimers();
    setNavHeight = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: NavScrollService, useValue: { hidden: () => false, setNavHeight } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('measures its rendered height immediately on mount, without waiting for a resize event', () => {
    const fixture = TestBed.createComponent(NavShell);
    fixture.detectChanges();

    expect(setNavHeight).toHaveBeenCalledTimes(1);
  });

  it('reports the settled height once resize activity goes quiet', () => {
    const fixture = TestBed.createComponent(NavShell);
    fixture.detectChanges();
    const navElement = fixture.nativeElement.querySelector('.nav-shell');
    setNavHeight.mockClear();

    setOffsetHeight(navElement, 72);
    FakeResizeObserver.instances[0].fire();
    vi.advanceTimersByTime(SETTLE_DEBOUNCE_MS);

    expect(setNavHeight).toHaveBeenCalledWith(72);
  });

  it('does not commit an intermediate height from a mid-reveal-transition frame', () => {
    const fixture = TestBed.createComponent(NavShell);
    fixture.detectChanges();
    const navElement = fixture.nativeElement.querySelector('.nav-shell');
    setNavHeight.mockClear();

    // Simulates the max-height transition growing frame-by-frame toward 72px.
    setOffsetHeight(navElement, 30);
    FakeResizeObserver.instances[0].fire();
    vi.advanceTimersByTime(SETTLE_DEBOUNCE_MS - 10); // still mid-transition, debounce not elapsed

    setOffsetHeight(navElement, 72);
    FakeResizeObserver.instances[0].fire(); // resets the debounce
    vi.advanceTimersByTime(SETTLE_DEBOUNCE_MS);

    expect(setNavHeight).not.toHaveBeenCalledWith(30);
    expect(setNavHeight).toHaveBeenCalledWith(72);
  });

  it('ignores resize reports while the nav is hidden (mid-collapse noise)', () => {
    TestBed.overrideProvider(NavScrollService, {
      useValue: { hidden: () => true, setNavHeight },
    });
    const fixture = TestBed.createComponent(NavShell);
    fixture.detectChanges();
    setNavHeight.mockClear();
    setOffsetHeight(fixture.nativeElement.querySelector('.nav-shell'), 0);

    FakeResizeObserver.instances[0].fire();
    vi.advanceTimersByTime(SETTLE_DEBOUNCE_MS);

    expect(setNavHeight).not.toHaveBeenCalled();
  });

  it('observes its own native nav element', () => {
    const fixture = TestBed.createComponent(NavShell);
    fixture.detectChanges();

    const navElement = fixture.nativeElement.querySelector('.nav-shell');
    expect(FakeResizeObserver.instances[0].observed).toContain(navElement);
  });

  it('disconnects the observer on destroy', () => {
    const fixture = TestBed.createComponent(NavShell);
    fixture.detectChanges();

    fixture.destroy();

    expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
  });

  it('cancels a pending debounced report on destroy', () => {
    const fixture = TestBed.createComponent(NavShell);
    fixture.detectChanges();
    const navElement = fixture.nativeElement.querySelector('.nav-shell');
    setNavHeight.mockClear();

    setOffsetHeight(navElement, 72);
    FakeResizeObserver.instances[0].fire();
    fixture.destroy();
    vi.advanceTimersByTime(SETTLE_DEBOUNCE_MS);

    expect(setNavHeight).not.toHaveBeenCalledWith(72);
  });
});
