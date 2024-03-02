import { Component, Input } from '@angular/core';
import { faIcons } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'category-icon',
  templateUrl: './category-icon.component.html',
  styleUrls: ['./category-icon.component.css']
})
export class CategoryIconComponent {
  @Input() categoryId: number | undefined;

  categoryIcon = faIcons;

}
