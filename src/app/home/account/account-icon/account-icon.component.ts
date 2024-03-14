import { Component, Input } from '@angular/core';
import { faBuildingColumns, faCreditCard } from '@fortawesome/free-solid-svg-icons';
import { AccountType } from 'src/app/data/types/accountType';

@Component({
  selector: 'account-icon',
  templateUrl: './account-icon.component.html',
  styleUrls: ['./account-icon.component.css']
})
export class AccountIconComponent {
  @Input() type: AccountType = 'bank';


  bankIcon = faBuildingColumns;
  creditCardIcon = faCreditCard;

}
