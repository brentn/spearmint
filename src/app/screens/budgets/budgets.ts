import { Component } from '@angular/core';

@Component({
  selector: 'app-budgets',
  template: `
    <div class="empty-state">
      <h1 class="empty-state__title">Budgets</h1>
      <p class="empty-state__body">Your category budgets and rollover status will show up here.</p>
    </div>
  `,
})
export class Budgets {}
