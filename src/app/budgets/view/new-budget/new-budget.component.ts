import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'new-budget',
  templateUrl: './new-budget.component.html',
  styleUrls: ['./new-budget.component.css']
})
export class NewBudgetComponent {
  @Output() close = new EventEmitter();

}
