import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { NavScrollService } from './nav-scroll.service';

/**
 * Marks the element whose scrollTop drives the bottom nav's auto-hide behavior
 * (see NavScrollService). Applied to app.html's `.app-scroll` — the inner scroll
 * container that replaced document-level scrolling (issue #22).
 */
@Directive({
  selector: '[appNavScrollContainer]',
})
export class NavScrollContainerDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly navScrollService = inject(NavScrollService);

  ngOnInit(): void {
    this.navScrollService.attach(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.navScrollService.detach();
  }
}
