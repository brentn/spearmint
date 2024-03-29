import { Component } from '@angular/core';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { PlaidOnSuccessArgs } from 'ngx-plaid-link';
import { AppState } from '../app.module';
import { Subscription } from 'rxjs';
import { configuration } from '../data/state/selectors';
import { reset, updateAccount, updateConfiguration } from '../data/state/actions';
import { Router } from '@angular/router';
import { ENVIRONMENT } from '../app.component';
import { Account } from '../data/models/account';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  backIcon = faArrowLeft;
  accounts: Account[] = [];
  subscriptions: Subscription[] = [];

  form = new FormGroup({
    showGraph: new FormControl<boolean>(true, { updateOn: 'blur' }),
    accountVisibility: new FormArray([]),
  });

  constructor(private store: Store<AppState>, private router: Router) { }

  ngOnInit(): void {
    this.subscriptions = [
      this.store.select(store => store.main).subscribe(store => {
        this.accounts = store.accounts;
        this.accountVisibility.clear();
        store.accounts.forEach(account => {
          this.accountVisibility.push(new FormGroup({
            visible: new FormControl<boolean>(!account.active)
          }))
        })
        this.form.patchValue({
          showGraph: store.configuration.showGraph
        }, { emitEvent: false })
      }),
      this.form.get('showGraph')!.valueChanges.subscribe(value => {
        this.store.dispatch(updateConfiguration({
          showGraph: !!value
        }))
      }),
      this.form.get('accountVisibility')!.valueChanges.subscribe(values => {
        this.accounts.forEach((account, index) => {
          if (account.active !== values[index]) {
            this.store.dispatch(updateAccount(new Account({
              ...account,
              active: !values[index]
            })));
          }
        })
      }),
    ]
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe())
  }

  get accountVisibility(): FormArray { return this.form.get('accountVisibility') as FormArray; }

  onResetAllData(): void {
    if (confirm('Are you sure you want to DELETE all account and transaction data?')) {
      this.store.dispatch(reset());
      this.router.navigate(['/']);
    }
  }

}
