import { Component, EventEmitter, Input, Output } from '@angular/core';
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons';
import { Account } from 'src/app/data/models/account';

@Component({
  selector: 'home-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @Input() accounts: Account[] | undefined;
  @Output() addBudget = new EventEmitter();

  showDropdown = false;
  settingsIcon = faCog;
  addIcon = faPlus;

  onAddBudget(): void {
    this.addBudget.emit();
  }

}
