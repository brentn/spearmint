import { Component } from '@angular/core';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { Subscription } from 'rxjs';
import { accounts, configuration } from '../data/state/selectors';
import { reset, updateAccount, updateConfiguration } from '../data/state/actions';
import { Router } from '@angular/router';
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
    accountRows: new FormArray([]),
  });

  constructor(private store: Store<AppState>, private router: Router) { }

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
      this.store.select(accounts).subscribe(accounts => {
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

  onResetAllData(): void {
    if (confirm('Are you sure you want to DELETE all account and transaction data?')) {
      this.store.dispatch(reset());
      this.router.navigate(['/']);
    }
  }

}
