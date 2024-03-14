import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Category } from 'src/app/data/types/category.type';

@Component({
  selector: 'category-item',
  templateUrl: './category.component.html',
  styleUrls: ['./category.component.css']
})
export class CategoryItemComponent {
  @Input() category: Category | undefined;
  @Input() isSelected = false;
  @Output() select = new EventEmitter();

  get group(): string | undefined { return this.category?.group.replace(/_/g, ' ') };
  get label(): string | undefined { return this.category?.id.replace(/_/g, ' ').substring(this.group?.length ?? 0 + 1) };

  onSelect(): void {
    this.select.emit();
  }

}
