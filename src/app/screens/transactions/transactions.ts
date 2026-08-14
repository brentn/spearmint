import { Component } from '@angular/core';

@Component({
  selector: 'app-transactions',
  template: `
    <div class="empty-state">
      <h1 class="empty-state__title">Transactions</h1>
      <p class="empty-state__body">Your synced transactions will show up here.</p>
    </div>
  `,
})
export class Transactions {}
