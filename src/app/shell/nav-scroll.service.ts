import { Injectable, signal } from '@angular/core';
import { computeNavHidden } from './nav-scroll';

@Injectable({ providedIn: 'root' })
export class NavScrollService {
  readonly hidden = signal(false);

  private previousY = 0;
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
    this.hidden.set(computeNavHidden(this.previousY, currentY, this.hidden()));
    this.previousY = currentY;
  }
}
