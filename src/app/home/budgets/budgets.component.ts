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
  @Input() budgets: Budget[] | null = null;
  @Input() categories: Category[] | null = null;
  @Input() transactions: Transaction[] | null = null;
  incomeCategories: (number | undefined)[] | null = null;
  todayIcon = faCaretUp;
  initialized = false;

  ngAfterViewInit(): void {
    this.initialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories']) {
      this.incomeCategories = this.categories?.filter(a => a.isIncome).map(a => a.id) ?? [];
    }
  }

  get today(): Date { return new Date(); }
  get incomeBudget(): number {
    return Currency.sum((this.budgets || []).filter(a => (this.incomeCategories || []).includes(a.categoryId)).map(a => a.amount));
  }
  get expenseBudget(): number {
    return Currency.sum((this.budgets || []).filter(a => !(this.incomeCategories || []).includes(a.categoryId)).map(a => a.amount));
  }
  get totalIncome(): number {
    return Currency.sum((this.transactions || []).filter(a => (this.incomeCategories || []).includes(a.categoryId)).map(a => a.amount));
  }
  get totalExpenses(): number {
    return Currency.sum((this.transactions || []).filter(a => !(this.incomeCategories || []).includes(a.categoryId)).map(a => a.amount));
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
