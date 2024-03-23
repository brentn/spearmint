import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { PlaidOnEventArgs, PlaidOnSuccessArgs } from 'ngx-plaid-link';
import { addAccount } from '../data/state/actions';
import { Account } from '../data/models/account';
import { AccountType } from '../data/types/accountType';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Router } from '@angular/router';
import { ENVIRONMENT } from '../app.component';
import { plaidConfig } from '../data/state/selectors';
import { map } from 'rxjs';
import { DatabaseService } from '../data/database/database.service';

@Component({
  selector: 'app-new-account',
  templateUrl: './new-account.component.html',
  styleUrls: ['./new-account.component.css']
})
export class NewAccountComponent {
  @ViewChild('plaid') plaid: ElementRef | undefined;
  backIcon = faArrowLeft;
  linkToken$ = this.store.select(plaidConfig).pipe(map(config => config.linkToken));
  environment = ENVIRONMENT;

  constructor(private router: Router, private store: Store<AppState>, private db: DatabaseService) { }

  ngAfterViewInit(): void {
    const startTime = Date.now();
    while (!this.plaid && (Date.now() - startTime < 1000)) { }
    if (this.plaid) {
      const button = this.plaid.nativeElement;
      setTimeout(() => button.click(), 1000);
    } else {
      console.log('BUTTON NOT FOUND')
    }
  }

  onClose(): void {
    this.router.navigate(['/']);
  }

  onPlaidEvent(args: PlaidOnEventArgs): void {
    console.log('EVENT', args)
  }

  onPlaidSuccess(args: PlaidOnSuccessArgs): void {
    console.log('HERE', args)
    args.metadata.accounts.forEach(account => {
      this.store.dispatch(addAccount(new Account({
        id: account.id,
        institution: args.metadata.institution?.name ?? 'Unknown Institution',
        name: account.name,
        type: account.type as AccountType,
        active: true,
        balance: 0,
        currency: 'CAD',
        public_token: args.metadata.public_token,
        lastUpdated: new Date()
      })))
    });
    // this.db.exchangePublicToken$(args.metadata.public_token).subscribe(accessToken => {
    //   console.log('ACCESS TOKEN', accessToken)
    // });
    this.onClose();
  }

}
