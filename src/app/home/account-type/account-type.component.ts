import { Component, Input } from '@angular/core';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { Account } from 'src/app/data/models/account';
import { MainState } from 'src/app/data/state';

@Component({
  selector: 'home-account-type',
  templateUrl: './account-type.component.html',
  styleUrls: ['./account-type.component.css']
})
export class AccountTypeComponent {
  @Input() accountType: string | undefined;
  @Input() accounts: Account[] = [];
  isCollapsed = true;
  addIcon = faPlus;

  constructor(private store: Store<MainState>) { }

  get totalBalance(): number { return this.accounts.reduce((acc, account) => acc + account.balance, 0); }

  onToggle(): void { this.isCollapsed = !this.isCollapsed; }

}
