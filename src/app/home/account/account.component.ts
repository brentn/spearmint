import { Component, Input } from '@angular/core';
import { Account } from 'src/app/state/types/account.type';
import { Time } from 'src/app/utilities/timeUtilities';

@Component({
  selector: 'home-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css']
})
export class AccountComponent {
  @Input() account!: Account;

  get howRecent(): string { return Time.Ago(this.account.lastUpdated) }
}
