import { Component, HostListener } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from './app.module';
import { filter, take, tap } from 'rxjs';
import { saveState } from './data/state/actions';
import { user } from './data/state/selectors';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  user$ = this.store.select(user);

  constructor(private store: Store<AppState>) { }

  @HostListener('window:beforeunload')
  saveState(): void {
    this.store.select(state => state).pipe(
      take(1),
      filter(state => state.main.accounts.length > 0),
      tap(() => this.store.dispatch(saveState()))
    ).subscribe()
  }

}
