import { Component, Input } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/app.module';
import { Account } from 'src/app/data/models/account';
import { Transaction } from 'src/app/data/models/transaction';
import { selectedAccount } from 'src/app/data/state/selectors';
import { Category } from 'src/app/data/types/category.type';

@Component({
  selector: 'transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.css']
})
export class TransactionComponent {
  @Input() transaction!: Transaction | null;
  @Input() categories!: Category[] | null;
  @Input() accounts!: Account[] | null;
  @Input() selectedAccount: Account | undefined;
  editing = false;

  constructor(private store: Store<AppState>) { }

  get category(): Category | undefined {
    return this.categories?.find(a => a.id === this.transaction?.categoryId)
  }

  get accountName(): string {
    return this.accounts?.find(a => a.id === this.transaction?.accountId)?.displayName || '';
  }

  onEdit(): void {
    this.editing = true;
  }

  onEndEdit(): void {
    this.editing = false;
  }

}
