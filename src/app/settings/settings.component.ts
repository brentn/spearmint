import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { PlaidOnSuccessArgs } from 'ngx-plaid-link';
import { AppState } from '../app.module';
import { Subscription } from 'rxjs';
import { configuration } from '../data/state/selectors';
import { reset, updateConfiguration } from '../data/state/actions';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  backIcon = faArrowLeft;
  subscriptions: Subscription[] = [];

  form = new FormGroup({
    linkToken: new FormControl<string>('', { updateOn: 'blur' }),
    showGraph: new FormControl<boolean>(true, { updateOn: 'blur' }),
  });

  constructor(private store: Store<AppState>) { }

  ngOnInit(): void {
    this.subscriptions = [
      this.store.select(configuration).subscribe(config => {
        this.form.patchValue({
          linkToken: config.plaid.linkToken,
          showGraph: config.showGraph
        }, { emitEvent: false })
      }),
      this.form.valueChanges.subscribe(value => {
        this.store.dispatch(updateConfiguration({
          plaid: {
            environment: 'sandbox',
            linkToken: value.linkToken || ''
          },
          showGraph: !!value.showGraph
        }))
      })
    ]
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe())
  }

  onResetAllData(): void {
    if (confirm('Are you sure you want to DELETE all account and transaction data?')) {
      this.store.dispatch(reset());
    }
  }

}
