import { Component, Input } from '@angular/core';
import { Account } from 'src/app/data/models/account';
import { Time } from 'src/app/utilities/timeUtilities';

@Component({
  selector: 'home-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css']
})
export class AccountComponent {
  @Input() account: Account | undefined;

  get howRecent(): string { return Time.Ago(this.account?.lastUpdated) }
}
