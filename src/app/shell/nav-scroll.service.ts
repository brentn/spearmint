import { Injectable, signal } from '@angular/core';
import { computeNavScrollState } from './nav-scroll';

@Injectable({ providedIn: 'root' })
export class NavScrollService {
  readonly hidden = signal(false);

  private previousY = 0;
  private accumulated = 0;
  private element: HTMLElement | null = null;
  private readonly listener = () => this.onScroll();

  attach(element: HTMLElement): void {
    this.element = element;
    this.previousY = element.scrollTop;
    element.addEventListener('scroll', this.listener, { passive: true });
  }

  detach(): void {
    this.element?.removeEventListener('scroll', this.listener);
    this.element = null;
  }

  private onScroll(): void {
    if (!this.element) {
      return;
    }
    const currentY = this.element.scrollTop;
    const distanceFromBottom = this.element.scrollHeight - this.element.clientHeight - currentY;
    const next = computeNavScrollState(this.previousY, currentY, distanceFromBottom, {
      hidden: this.hidden(),
      accumulated: this.accumulated,
    });
    this.hidden.set(next.hidden);
    this.accumulated = next.accumulated;
    this.previousY = currentY;
  }
}
