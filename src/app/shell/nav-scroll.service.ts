import { Injectable, signal } from '@angular/core';
import { computeNavHidden } from './nav-scroll';

@Injectable({ providedIn: 'root' })
export class NavScrollService {
  readonly hidden = signal(false);
  readonly navHeightPx = signal(0);

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

  /** NavShell reports its own live-rendered height here — see NavShell's ResizeObserver. */
  setNavHeight(px: number): void {
    this.navHeightPx.set(px);
  }

  private onScroll(): void {
    if (!this.element) {
      return;
    }
    const currentY = this.element.scrollTop;
    const distanceFromBottom = this.element.scrollHeight - this.element.clientHeight - currentY;
    this.hidden.set(
      computeNavHidden(this.previousY, currentY, this.hidden(), distanceFromBottom, this.navHeightPx()),
    );
    this.previousY = currentY;
  }
}
