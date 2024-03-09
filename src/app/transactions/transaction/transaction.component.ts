import { Component, Input } from '@angular/core';
import { Account } from 'src/app/state/types/account.type';
import { Category } from 'src/app/state/types/category.type';
import { Transaction } from 'src/app/state/types/transaction.type';

@Component({
  selector: 'transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.css']
})
export class TransactionComponent {
  @Input() transaction!: Transaction | null;
  @Input() categories!: Category[] | null;
  @Input() accounts!: Account[] | null;
  editing = false;

  get category(): Category | undefined {
    return this.categories?.find(a => a.id === this.transaction?.categoryId)
  }

  get iconCategoryId(): number | undefined {
    return this.category?.parentId || this.transaction?.categoryId;
  }

  onEdit(): void {
    this.editing = true;
  }

  onEndEdit(): void {
    this.editing = false;
  }

}
