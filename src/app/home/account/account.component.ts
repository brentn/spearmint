import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/app.module';
import { Account } from 'src/app/data/models/account';
import { selectAccount } from 'src/app/data/state/actions';
import { Time } from 'src/app/utilities/timeUtilities';

@Component({
  selector: 'home-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css']
})
export class AccountComponent {
  @Input() account: Account | undefined;
  failureIcon = faExclamationCircle;

  constructor(private store: Store<AppState>, private router: Router) { }

  get howRecent(): string { return Time.Ago(this.account?.lastUpdated) }

  onSelectAccount(): void {
    this.store.dispatch(selectAccount(this.account));
    this.router.navigate(['/transactions']);
  }
}
