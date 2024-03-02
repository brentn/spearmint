import { Component } from '@angular/core';
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'home-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  settingsIcon = faCog;
  addIcon = faPlus;

}
