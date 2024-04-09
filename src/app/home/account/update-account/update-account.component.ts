import { Component, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { PlaidLinkHandler, PlaidSuccessMetadata, PlaidEventMetadata, NgxPlaidLinkService } from 'ngx-plaid-link';
import { filter, take, map, tap } from 'rxjs';
import { AppState } from 'src/app/app.module';
import { BankingConnectorService } from 'src/app/data/database/banking-connector.service';
import { Account } from 'src/app/data/models/account';
import { addAccount, getLinkToken, getUpdateLinkToken, refreshAccounts } from 'src/app/data/state/actions';
import { linkToken } from 'src/app/data/state/selectors';
import { AccountType } from 'src/app/data/types/accountType';

@Component({
  selector: 'app-update-account',
  templateUrl: './update-account.component.html',
  styleUrls: ['./update-account.component.css']
})
export class UpdateAccountComponent {
  plaidLinkHandler: PlaidLinkHandler | undefined;
  accessToken: string;

  linkToken$ = this.store.select(linkToken).pipe(
    filter(token => token !== undefined),
    take(1),
    map(token => {
      this.plaidLinkService.createPlaid({
        token: token,
        onSuccess: (publicToken: string, metadata: PlaidSuccessMetadata) => this.onPlaidSuccess(publicToken, metadata),
        onExit: () => this.onClose(),
      }).then(handler => {
        this.plaidLinkHandler = handler;
        handler.open();
      });
    })
  ).subscribe();

  constructor(
    private router: Router,
    private store: Store<AppState>,
    private plaidLinkService: NgxPlaidLinkService,
    private route: ActivatedRoute
  ) {
    this.accessToken = this.route.snapshot.queryParamMap.get('accessToken') as string;
    console.log('Access token', this.accessToken)
  }

  ngOnInit(): void {
    this.store.dispatch(getUpdateLinkToken(this.accessToken));
  }

  onClose(): void {
    this.router.navigate(['/']);
  }

  onPlaidSuccess(publicToken: string, metadata: PlaidSuccessMetadata): void {
    console.debug('METADATA:', metadata);
    this.onClose();
  }
}
