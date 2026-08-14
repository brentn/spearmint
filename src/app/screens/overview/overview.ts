import { Component } from '@angular/core';

@Component({
  selector: 'app-overview',
  template: `
    <div class="empty-state">
      <h1 class="empty-state__title">Overview</h1>
      <p class="empty-state__body">Your accounts and budget summary will show up here.</p>
    </div>
  `,
})
export class Overview {}
