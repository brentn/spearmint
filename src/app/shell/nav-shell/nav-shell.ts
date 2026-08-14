import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faGear, faHouse, faListUl, faWallet } from '@fortawesome/free-solid-svg-icons';
import { NavScrollService } from '../nav-scroll.service';

interface NavTab {
  path: string;
  label: string;
  icon: typeof faHouse;
}

@Component({
  selector: 'app-nav-shell',
  imports: [RouterLink, RouterLinkActive, FaIconComponent],
  templateUrl: './nav-shell.html',
  styleUrl: './nav-shell.scss',
})
export class NavShell {
  private readonly navScrollService = inject(NavScrollService);
  readonly hidden = this.navScrollService.hidden;

  readonly tabs: NavTab[] = [
    { path: '/overview', label: 'Overview', icon: faHouse },
    { path: '/budgets', label: 'Budgets', icon: faWallet },
    { path: '/transactions', label: 'Transactions', icon: faListUl },
    { path: '/settings', label: 'Settings', icon: faGear },
  ];
}
