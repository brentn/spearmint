import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { NavScrollService } from './nav-scroll.service';

function makeElement(scrollTop: number, scrollHeight: number, clientHeight: number): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'scrollTop', { value: scrollTop, configurable: true });
  Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true });
  return element;
}

function scrollTo(element: HTMLElement, scrollTop: number): void {
  Object.defineProperty(element, 'scrollTop', { value: scrollTop, configurable: true });
  element.dispatchEvent(new Event('scroll'));
}

describe('NavScrollService', () => {
  function create(): NavScrollService {
    TestBed.configureTestingModule({ providers: [NavScrollService] });
    return TestBed.inject(NavScrollService);
  }

  it('hides once scrolling down away from both page edges crosses the dead zone', () => {
    const service = create();
    const element = makeElement(0, 2000, 800);
    service.attach(element);

    scrollTo(element, 400);

    expect(service.hidden()).toBe(true);
  });

  it('does not hide on a single small scroll delta', () => {
    const service = create();
    const element = makeElement(0, 2000, 800);
    service.attach(element);

    scrollTo(element, 10);

    expect(service.hidden()).toBe(false);
  });

  it('stays visible once scrolled within the near-bottom threshold of the true end', () => {
    // scrollHeight - clientHeight = 1200, so scrollTop 1200 is the true end.
    const element = makeElement(0, 2000, 800);
    const service = create();
    service.attach(element);

    scrollTo(element, 400);
    expect(service.hidden()).toBe(true);

    scrollTo(element, 1195); // distanceFromBottom = 5
    expect(service.hidden()).toBe(false);
  });

  it('stops reacting to scroll events after detach', () => {
    const service = create();
    const element = makeElement(0, 2000, 800);
    service.attach(element);
    scrollTo(element, 400);
    expect(service.hidden()).toBe(true);

    service.detach();
    scrollTo(element, 0);

    expect(service.hidden()).toBe(true);
  });
});
