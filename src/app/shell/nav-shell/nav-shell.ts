import { Component, ElementRef, OnDestroy, OnInit, inject, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faGear, faHouse, faListUl, faWallet } from '@fortawesome/free-solid-svg-icons';
import { NavScrollService } from '../nav-scroll.service';

interface NavTab {
  path: string;
  label: string;
  icon: typeof faHouse;
}

// How long to wait, after the last resize, before trusting the nav's height as
// settled rather than still mid-transition. Debounce-based (not tied to
// nav-shell.scss's 0.25s transition duration) so a lone ResizeObserver firing
// partway through a reveal can't be mistaken for the final size (issue #28).
const HEIGHT_SETTLE_DEBOUNCE_MS = 50;

@Component({
  selector: 'app-nav-shell',
  imports: [RouterLink, RouterLinkActive, FaIconComponent],
  templateUrl: './nav-shell.html',
  styleUrl: './nav-shell.scss',
})
export class NavShell implements OnInit, OnDestroy {
  private readonly navScrollService = inject(NavScrollService);
  private readonly navElement = viewChild.required<ElementRef<HTMLElement>>('nav');
  private resizeObserver?: ResizeObserver;
  private settleTimer?: ReturnType<typeof setTimeout>;

  readonly hidden = this.navScrollService.hidden;

  readonly tabs: NavTab[] = [
    { path: '/overview', label: 'Overview', icon: faHouse },
    { path: '/budgets', label: 'Budgets', icon: faWallet },
    { path: '/transactions', label: 'Transactions', icon: faListUl },
    { path: '/settings', label: 'Settings', icon: faGear },
  ];

  ngOnInit(): void {
    const element = this.navElement().nativeElement;
    // Safe to read immediately: nothing has transitioned yet at initial mount.
    this.reportHeightIfVisible(element);

    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(this.settleTimer);
      // Mid-collapse frames report a transiently shrunk height; skip outright
      // rather than debouncing them, since they'll never "settle" above 0.
      if (this.hidden()) {
        return;
      }
      // Mid-reveal frames are still growing toward their final size — wait for
      // the resize activity to go quiet before trusting the reported height.
      this.settleTimer = setTimeout(() => this.reportHeightIfVisible(element), HEIGHT_SETTLE_DEBOUNCE_MS);
    });
    this.resizeObserver.observe(element);
  }

  ngOnDestroy(): void {
    clearTimeout(this.settleTimer);
    this.resizeObserver?.disconnect();
  }

  private reportHeightIfVisible(element: HTMLElement): void {
    if (!this.hidden()) {
      this.navScrollService.setNavHeight(element.offsetHeight);
    }
  }
}
