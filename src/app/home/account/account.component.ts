import { Component, Input } from '@angular/core';
import { Account } from 'src/app/state/types/account.type';

@Component({
  selector: 'home-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css']
})
export class AccountComponent {
  @Input() account!: Account;

}
