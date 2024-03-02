import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from './app.module';
import { user } from './state/selectors';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  user$ = this.store.select(user);

  constructor(private store: Store<AppState>) { }

}
