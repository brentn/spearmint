import { Component } from '@angular/core';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { faArrowLeft, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { Subscription } from 'rxjs';
import { configuration } from '../data/state/selectors';
import { refreshAccountsImmediately, reset, updateAccount, updateConfiguration } from '../data/state/actions';
import { Router } from '@angular/router';
import { Account } from '../data/models/account';
import { DBStateService } from '../data/database/dbState.service';
import { BankingConnectorService } from '../data/database/banking-connector.service';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  backIcon = faArrowLeft;
  accounts: Account[] = [];
  subscriptions: Subscription[] = [];
  deleteIcon = faTrashAlt;

  form = new FormGroup({
    showGraph: new FormControl<boolean>(true, { updateOn: 'blur' }),
    accountRows: new FormArray([]),
  });

  constructor(
    private store: Store<AppState>,
    private auth: AuthService,
    private router: Router,
    private dbState: DBStateService
  ) { }

  ngOnInit(): void {
    const groupSubscriptions: Subscription[] = [];
    this.subscriptions = [
      this.store.select(configuration).subscribe(config => {
        this.form.patchValue({
          showGraph: config.showGraph
        }, { emitEvent: false })
      }),
      this.form.get('showGraph')!.valueChanges.subscribe(value => {
        this.store.dispatch(updateConfiguration({
          showGraph: !!value
        }))
      }),
      this.dbState.accounts$.subscribe(accounts => {
        this.accounts = accounts;
        this.accountRows.clear();
        accounts.forEach(account => {
          const formGroup = (new FormGroup({
            accountId: new FormControl<string>(account.id),
            customName: new FormControl<string>(account.displayName, { updateOn: 'blur' }),
            visible: new FormControl<boolean>(account.active)
          }));
          groupSubscriptions.push(formGroup.valueChanges.subscribe(value => {
            const account = accounts.find(a => a.id === value.accountId);
            this.store.dispatch(updateAccount(new Account({
              ...account,
              displayName: value.customName,
              active: value.visible
            })));
          }))
          this.accountRows.push(formGroup);
        })
      }),
    ];
    this.subscriptions = this.subscriptions.concat(groupSubscriptions)
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get accountRows(): FormArray { return this.form.get('accountRows') as FormArray; }

  onDeleteAccount(index: number): void {
    const account = this.accounts[index];
    if (account && confirm('Delete account ' + account.displayName + '?')) {
      this.dbState.Accounts.remove$(account).subscribe();
      this.dbState.Transactions.removeAccount$(account.id).subscribe();
    }
  }

  onRefreshAccounts(): void {
    this.store.dispatch(refreshAccountsImmediately());
  }

  onDeduplicate(): void {
    this.dbState.Transactions.deduplicate$().subscribe();
  }

  onResetAllData(): void {
    if (confirm('Are you sure you want to DELETE all fingerprint, account and transaction data?')) {
      this.store.dispatch(reset());
      localStorage.setItem('user', '');
      this.auth.resetCredentials$().subscribe();
      this.router.navigate(['/']);
    }
  }

}
