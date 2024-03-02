import { Component, Input } from '@angular/core';
import { Category } from 'src/app/state/types/category.type';
import { Transaction } from 'src/app/state/types/transaction.type';

@Component({
  selector: 'transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.css']
})
export class TransactionComponent {
  @Input() transaction!: Transaction;
  @Input() categories!: Category[];

  get category(): Category | undefined { return this.categories?.find(a => a.id === this.transaction.categoryId) }

}
