import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { PlaidOnSuccessArgs } from 'ngx-plaid-link';
import { AppState } from '../app.module';
import { Subscription } from 'rxjs';
import { configuration } from '../data/state/selectors';
import { reset, updateConfiguration } from '../data/state/actions';
import { Router } from '@angular/router';
import { ENVIRONMENT } from '../app.component';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  backIcon = faArrowLeft;
  subscriptions: Subscription[] = [];

  form = new FormGroup({
    showGraph: new FormControl<boolean>(true, { updateOn: 'blur' }),
  });

  constructor(private store: Store<AppState>, private router: Router) { }

  ngOnInit(): void {
    this.subscriptions = [
      this.store.select(configuration).subscribe(config => {
        this.form.patchValue({
          showGraph: config.showGraph
        }, { emitEvent: false })
      }),
      this.form.valueChanges.subscribe(value => {
        this.store.dispatch(updateConfiguration({
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
      this.router.navigate(['/']);
    }
  }

}
