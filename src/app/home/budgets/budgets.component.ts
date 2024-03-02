import { Component, Input, SimpleChanges } from '@angular/core';
import { faCaretUp } from '@fortawesome/free-solid-svg-icons';
import { Budget } from 'src/app/state/types/budget.type';
import { Category } from 'src/app/state/types/category.type';
import { Transaction } from 'src/app/state/types/transaction.type';
import { Currency } from 'src/app/utilities/currencyUtils';

@Component({
  selector: 'home-budgets',
  templateUrl: './budgets.component.html',
  styleUrls: ['./budgets.component.css']
})
export class HomeBudgetsComponent {
  @Input() budgets!: Budget[];
  @Input() categories!: Category[];
  @Input() transactions!: Transaction[];
  incomeCategories: (number | undefined)[] = [];
  todayIcon = faCaretUp;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories']) {
      this.incomeCategories = this.categories?.filter(a => a.isIncome).map(a => a.id) ?? [];
    }
  }

  get currentMonth(): string { return new Date().toLocaleString('default', { month: 'long' }); }
  get incomeBudget(): number {
    return Currency.sum(this.budgets.filter(a => this.incomeCategories.includes(a.categoryId)).map(a => a.amount));
  }
  get expenseBudget(): number {
    return Currency.sum(this.budgets.filter(a => !this.incomeCategories.includes(a.categoryId)).map(a => a.amount));
  }
  get totalIncome(): number {
    return Currency.sum(this.transactions.filter(a => this.incomeCategories.includes(a.categoryId)).map(a => a.amount));
  }
  get totalExpenses(): number {
    return Currency.sum(this.transactions.filter(a => !this.incomeCategories.includes(a.categoryId)).map(a => a.amount));
  }
  get incomeProgress(): number {
    return Math.round((this.totalIncome / this.incomeBudget) * 100);
  }
  get expenseProgress(): number {
    return Math.round((this.totalExpenses / this.expenseBudget) * 100);
  }
  get monthProgress(): number {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    return Math.round(new Date().getDate() / daysInMonth * 100);
  }

}
