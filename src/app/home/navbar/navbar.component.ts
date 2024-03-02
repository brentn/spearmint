import { Component } from '@angular/core';
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'home-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  showDropdown = false;
  settingsIcon = faCog;
  addIcon = faPlus;

}
