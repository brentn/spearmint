import { Component, ElementRef, ViewChild } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { linkToken } from '../data/state/selectors';
import { PlaidOnSuccessArgs } from 'ngx-plaid-link';

@Component({
  selector: 'app-new-account',
  templateUrl: './new-account.component.html',
  styleUrls: ['./new-account.component.css']
})
export class NewAccountComponent {
  @ViewChild('plaid') plaid: ElementRef | undefined;
  linkToken$ = this.store.select(linkToken);

  constructor(private store: Store<AppState>) { }

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

  onPlaidSuccess(evt: PlaidOnSuccessArgs): void {
    console.log('HERE', evt)
  }

}
