import { Component } from '@angular/core';

@Component({
  selector: 'app-settings',
  template: `
    <div class="empty-state">
      <h1 class="empty-state__title">Settings</h1>
      <p class="empty-state__body">Connected accounts, backup, and app preferences will show up here.</p>
    </div>
  `,
})
export class Settings {}
