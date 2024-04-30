import { Component, ElementRef, ViewChild } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../../../app.module';
import { NgxPlaidLinkService, PlaidEventMetadata, PlaidLinkHandler, PlaidSuccessMetadata } from 'ngx-plaid-link';
import { addAccount, getLinkToken, refreshAccounts } from '../../../data/state/actions';
import { Account } from '../../../data/models/account';
import { AccountType } from '../../../data/types/accountType';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Router } from '@angular/router';
import { linkToken } from '../../../data/state/selectors';
import { filter, map, take, tap } from 'rxjs';
import { BankingConnectorService } from '../../../data/database/banking-connector.service';
import { DBStateService } from 'src/app/data/database/dbState.service';

@Component({
  selector: 'app-new-account',
  templateUrl: './new-account.component.html',
  styleUrls: ['./new-account.component.css']
})
export class NewAccountComponent {
  plaidLinkHandler: PlaidLinkHandler | undefined;

  @ViewChild('plaid') plaid: ElementRef | undefined;
  backIcon = faArrowLeft;

  linkToken$ = this.store.select(linkToken).pipe(
    filter(token => token !== undefined),
    take(1),
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
  ).subscribe();

  constructor(
    private router: Router,
    private store: Store<AppState>,
    private db: DBStateService,
    private plaidLinkService: NgxPlaidLinkService,
    private bank: BankingConnectorService
  ) { }

  ngOnInit(): void {
    this.store.dispatch(getLinkToken());
  }

  onClose(): void {
    this.router.navigate(['/']);
  }

  onPlaidEvent(metadata: PlaidEventMetadata): void {
  }

  onPlaidSuccess(publicToken: string, metadata: PlaidSuccessMetadata): void {
    console.debug('METADATA:', metadata);
    this.bank.exchangePublicToken$(publicToken).pipe(
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
            lastUpdated: new Date(new Date().getFullYear(), new Date().getMonth(), -1),
          })))
        });
      })
    ).subscribe();
    this.onClose();
  }

}
