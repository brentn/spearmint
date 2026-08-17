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

  it('hides on scroll-down away from both page edges', () => {
    const service = create();
    service.setNavHeight(60);
    const element = makeElement(0, 2000, 800);
    service.attach(element);

    scrollTo(element, 400);

    expect(service.hidden()).toBe(true);
  });

  it('stays visible once scrolled within the measured nav height of the true bottom', () => {
    const service = create();
    service.setNavHeight(60);
    // scrollHeight - clientHeight = 1200, so scrollTop 1200 is the true end.
    const element = makeElement(0, 2000, 800);
    service.attach(element);

    scrollTo(element, 400);
    expect(service.hidden()).toBe(true);

    scrollTo(element, 1150); // distanceFromBottom = 50, within 60 + 24 margin
    expect(service.hidden()).toBe(false);
  });

  it('reacts to a larger measured nav height with a wider near-bottom band', () => {
    const service = create();
    service.setNavHeight(200);
    const element = makeElement(0, 2000, 800);
    service.attach(element);

    scrollTo(element, 400);
    expect(service.hidden()).toBe(true);

    scrollTo(element, 990); // distanceFromBottom = 210, within 200 + 24 margin
    expect(service.hidden()).toBe(false);
  });

  it('stops reacting to scroll events after detach', () => {
    const service = create();
    service.setNavHeight(60);
    const element = makeElement(0, 2000, 800);
    service.attach(element);
    scrollTo(element, 400);
    expect(service.hidden()).toBe(true);

    service.detach();
    scrollTo(element, 0);

    expect(service.hidden()).toBe(true);
  });
});
