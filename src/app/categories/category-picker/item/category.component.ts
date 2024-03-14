import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Category } from 'src/app/data/types/category.type';

@Component({
  selector: 'category-item',
  templateUrl: './category.component.html',
  styleUrls: ['./category.component.css']
})
export class CategoryItemComponent {
  @Input() category: Category | undefined;
  @Input() parentName: string | null | undefined;
  @Input() isSelected = false;
  @Output() select = new EventEmitter();

  onSelect(): void {
    this.select.emit();
  }

}
