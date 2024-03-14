import { Component, Input } from '@angular/core';
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons';
import { Account } from 'src/app/data/models/account';

@Component({
  selector: 'home-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @Input() accounts: Account[] | null = null;;

  showDropdown = false;
  settingsIcon = faCog;
  addIcon = faPlus;

}
