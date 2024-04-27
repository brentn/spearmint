import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { RxDBStatePlugin } from 'rxdb/plugins/state';
import { Injectable, isDevMode } from '@angular/core';
import { BehaviorSubject, Observable, filter, from, map, switchMap } from 'rxjs';
import { Category, DEFAULT_CATEGORIES } from '../types/category.type';
import { Budget } from '../types/budget.type';
import { Account } from '../models/account';
import { Transaction } from '../models/transaction';
import { Transformation } from '../models/transformation';

addRxPlugin(RxDBStatePlugin);
if (isDevMode()) addRxPlugin(RxDBDevModePlugin)

@Injectable({
  providedIn: 'root'
})
export class DBStateService {
  private _ready$ = new BehaviorSubject<boolean>(false);
  private store: any;

  constructor() {
    createRxDatabase({ name: 'spearmint', storage: getRxStorageDexie() }).then(db => {
      db.addState().then(store => {
        store.set('categories', (categories: Category[]) => categories || DEFAULT_CATEGORIES);
        store.set('budgets', (budgets: Budget[]) => budgets || []);
        store.set('accounts', (accounts: Account[]) => accounts || []);
        store.set('transactions', (transactions: Transaction[]) => transactions || []);
        store.set('transformations', (transformations: Transformation[]) => transformations || []);
        this.store = store;
        this._ready$.next(true);
      })
    });
  }

  //Selectors
  get storeReady$(): Observable<boolean> { return this._ready$.pipe(filter(ready => ready)); }

  categories$: Observable<Category[]> = this._ready$.pipe(
    filter(ready => ready),
    switchMap(() => this.store.get$('categories') as Observable<Category[]>)
  );
  budgets$: Observable<Budget[]> = this._ready$.pipe(
    filter(ready => ready),
    switchMap(() => this.store.get$('budgets') as Observable<Budget[]>)
  );
  accounts$: Observable<Account[]> = this._ready$.pipe(
    filter(ready => ready),
    switchMap(() => this.store.get$('accounts') as Observable<Account[]>)
  );
  transactions$: Observable<Transaction[]> = this._ready$.pipe(
    filter(ready => ready),
    switchMap(() => (this.store.get$('transactions') as Observable<Transaction[]>).pipe(
      map((transactions: Transaction[]) => transactions.map(a => new Transaction(a)).sort((a, b) => b.date - a.date)),
    ))
  );
  transformations$: Observable<Transformation[]> = this._ready$.pipe(
    filter(ready => ready),
    switchMap(() => (this.store.get$('transformations') as Observable<Transformation[]>).pipe(
      map((transformations: Transformation[]) => transformations.map(a => new Transformation(a)))
    ))
  )


  //Actions
  Accounts = {
    add$: (account: Account): Observable<Account> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('accounts', (accounts: Account[]) => [...accounts, account])).pipe(
          map(() => account)
        )),
      );
    },
    update$: (account: Account): Observable<Account> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('accounts', (accounts: Account[]) => accounts.map(a => a.id === account.id ? account : a))).pipe(
          map(() => account)
        )),
      );
    },
    reset$: (): Observable<void> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('accounts', () => [])).pipe(
          map(() => undefined)
        )),
      );
    }
  }

  Transactions = {
    addMany$: (transactions: Transaction[]): Observable<Transaction[]> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('transactions', (existing: Transaction[]) => [...existing, ...transactions])).pipe(
          map(() => transactions)
        )),
      )
    },
    update$: (transaction: Transaction): Observable<Transaction> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('transactions', (transactions: Transaction[]) => transactions.map(t => t.id === transaction.id ? transaction : t))).pipe(
          map(() => transaction)
        )),
      );
    },
    deduplicate$: (): Observable<void> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('transactions', (existing: Transaction[]) => existing.reduce((acc: Transaction[], item) => acc.find(t => t.id === item.id) ? acc : [...acc, item], []))).pipe(
          map(() => void (0))
        )),
      );
    },
    delete$: (transactionId: string): Observable<string> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('transactions', (transactions: Transaction[]) => transactions.filter(t => t.id !== transactionId))).pipe(
          map(() => transactionId)
        )),
      );
    },
    reset$: (): Observable<void> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('transactions', () => [])).pipe(
          map(() => undefined)
        )),
      );
    }
  }

  Budgets = {
    upsert$: (budget: Budget): Observable<Budget> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('budgets', (budgets: Budget[]) => [...budgets.filter(a => a.categoryId !== budget.categoryId), budget])).pipe(
          map(() => budget)
        )),
      );
    },
    delete$: (categoryId: string): Observable<string> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('budgets', (budgets: Budget[]) => budgets.filter(a => a.categoryId !== categoryId))).pipe(
          map(() => categoryId)
        )),
      );
    }
  }

  Transformations = {
    upsert$: (transformation: Transformation): Observable<Transformation> => {
      return this._ready$.pipe(
        filter(ready => ready),
        switchMap(() => from(this.store.set('transformations', (transformations: Transformation[]) => [
          ...transformations.filter(a => !(
            a.accountId === transformation.accountId
            && a.merchantId === transformation.merchantId
            && a.categoryId === transformation.categoryId
            && transformation.name.startsWith(a.name)
          )), transformation
        ])).pipe(
          map(() => transformation)
        ))
      )
    }
  }

}

