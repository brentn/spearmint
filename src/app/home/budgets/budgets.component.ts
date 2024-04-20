import { Component, Input, SimpleChanges } from '@angular/core';
import { faCaretUp } from '@fortawesome/free-solid-svg-icons';
import { Transaction } from 'src/app/data/models/transaction';
import { Budget } from 'src/app/data/types/budget.type';
import { Category } from 'src/app/data/types/category.type';
import { Currency } from 'src/app/utilities/currencyUtils';

@Component({
  selector: 'home-budgets',
  templateUrl: './budgets.component.html',
  styleUrls: ['./budgets.component.css']
})
export class HomeBudgetsComponent {
  @Input() budgets: Budget[] | undefined;
  @Input() categories: Category[] | undefined;
  @Input() transactions: Transaction[] | undefined;
  incomeCategories: (string | undefined)[] | undefined;
  transactionsForMonth: Transaction[] = [];
  todayIcon = faCaretUp;
  initialized = false;

  ngAfterViewInit(): void {
    this.initialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories']) {
      this.incomeCategories = this.categories?.filter(a => a.group === 'INCOME' || a.group === 'TRANSFER_IN').map(a => a.id) ?? [];
    }
    if (changes['transactions']) {
      const earliest = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const latest = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).getTime();
      console.log('earliest', new Date(earliest), 'latest', new Date(latest))
      this.transactionsForMonth = (this.transactions || []).filter(a => a.date >= earliest && a.date <= latest);
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
    return Currency.sum(this.transactionsForMonth.filter(a => (this.incomeCategories || []).includes(a.categoryId)).map(a => a.amount));
  }
  get totalExpenses(): number {
    return Currency.sum(this.transactionsForMonth.filter(a => !(this.incomeCategories || []).includes(a.categoryId)).map(a => a.amount));
  }
  get incomeProgress(): number {
    if (this.incomeBudget === 0) return 0;
    return Math.round((this.totalIncome / this.incomeBudget) * 100);
  }
  get expenseProgress(): number {
    if (this.expenseBudget === 0) return 0;
    return Math.round((this.totalExpenses / this.expenseBudget) * 100);
  }
  get monthProgress(): number {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    return Math.round(new Date().getDate() / daysInMonth * 100);
  }

  get net(): number {
    return (-this.totalIncome - this.incomeBudget) - (this.totalExpenses - this.expenseBudget)
  }

}
