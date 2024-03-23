import { Component, ElementRef, ViewChild } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { NgxPlaidLinkService, PlaidEventMetadata, PlaidLinkHandler, PlaidOnEventArgs, PlaidOnSuccessArgs, PlaidSuccessMetadata } from 'ngx-plaid-link';
import { addAccount, getLinkToken } from '../data/state/actions';
import { Account } from '../data/models/account';
import { AccountType } from '../data/types/accountType';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Router } from '@angular/router';
import { ENVIRONMENT } from '../app.component';
import { linkToken } from '../data/state/selectors';
import { filter, map, take, tap } from 'rxjs';
import { DatabaseService } from '../data/database/database.service';

@Component({
  selector: 'app-new-account',
  templateUrl: './new-account.component.html',
  styleUrls: ['./new-account.component.css']
})
export class NewAccountComponent {
  plaidLinkHandler: PlaidLinkHandler | undefined;

  @ViewChild('plaid') plaid: ElementRef | undefined;
  backIcon = faArrowLeft;
  environment = ENVIRONMENT;

  linkToken$ = this.store.select(linkToken).pipe(
    filter(token => token !== undefined),
    map(token => {
      this.plaidLinkService.createPlaid({
        token: token,
        onSuccess: (publicToken: string, metadata: PlaidSuccessMetadata) => this.onPlaidSuccess(publicToken, metadata),
        onExit: () => this.onClose(),
        onEvent: (publicToken: String, metadata: PlaidEventMetadata) => this.onPlaidEvent(metadata)
      }).then(handler => {
        this.plaidLinkHandler = handler;
        handler.open();
      });
    })
  );

  constructor(private router: Router, private store: Store<AppState>, private plaidLinkService: NgxPlaidLinkService, private db: DatabaseService) { }

  ngOnInit(): void {
    this.store.dispatch(getLinkToken());
  }

  onClose(): void {
    this.router.navigate(['/']);
  }

  onPlaidEvent(metadata: PlaidEventMetadata): void {
  }

  onPlaidSuccess(publicToken: string, metadata: PlaidSuccessMetadata): void {
    console.log('HERE', publicToken, metadata)
    this.db.exchangePublicToken(publicToken).pipe(
      tap((data: { accessToken: string, itemId: string }) => {
        metadata.accounts.forEach(account => {
          this.store.dispatch(addAccount(new Account({
            id: account.id,
            institution: metadata.institution?.name ?? 'Unknown Institution',
            name: account.name,
            type: account.type as AccountType,
            active: true,
            balance: 0,
            currency: 'CAD',
            accessToken: data.accessToken,
            itemId: data.itemId,
            lastUpdated: new Date()
          })))
        })
      })
    ).subscribe();
    this.onClose();
  }

}
