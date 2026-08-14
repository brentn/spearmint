import { Injectable, OnDestroy, signal } from '@angular/core';
import { computeNavHidden } from './nav-scroll';

@Injectable({ providedIn: 'root' })
export class NavScrollService implements OnDestroy {
  readonly hidden = signal(false);

  private previousY = 0;
  private readonly listener = () => this.onScroll();

  constructor() {
    window.addEventListener('scroll', this.listener, { passive: true });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.listener);
  }

  private onScroll(): void {
    const currentY = window.scrollY;
    this.hidden.set(computeNavHidden(this.previousY, currentY, this.hidden()));
    this.previousY = currentY;
  }
}
