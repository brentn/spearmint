import { Component, Input } from '@angular/core';
import { Account } from 'src/app/data/models/account';
import { Transaction } from 'src/app/data/models/transaction';
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
  editing = false;

  get category(): Category | undefined {
    return this.categories?.find(a => a.id === this.transaction?.categoryId)
  }


  onEdit(): void {
    this.editing = true;
  }

  onEndEdit(): void {
    this.editing = false;
  }

}
