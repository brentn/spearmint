import { Component, Input } from '@angular/core';
import { faMoneyBill1 } from '@fortawesome/free-regular-svg-icons';
import { IconDefinition, faArrowsLeftRight, faBoltLightning, faBuilding, faCar, faChildren, faCutlery, faDog, faDollarSign, faFilm, faGift, faGraduationCap, faHeartbeat, faHouse, faIcons, faMoneyBill, faPlane, faSackDollar, faShoppingBag, faUser } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'category-icon',
  templateUrl: './category-icon.component.html',
  styleUrls: ['./category-icon.component.css']
})
export class CategoryIconComponent {
  @Input() categoryId: number | undefined;

  get categoryIcon(): IconDefinition {
    switch (this.categoryId) {
      case 1: return faCar;
      case 2: return faBoltLightning;
      case 3: return faBuilding;
      case 4: return faGraduationCap;
      case 5: return faFilm;
      case 6: return faMoneyBill1;
      case 7: return faDollarSign;
      case 8: return faCutlery;
      case 9: return faGift;
      case 10: return faHeartbeat;
      case 11: return faHouse;
      case 12: return faSackDollar;
      case 13: return faChildren;
      case 14: return faIcons;
      case 15: return faUser;
      case 16: return faDog;
      case 17: return faShoppingBag;
      case 18: return faMoneyBill;
      case 19: return faArrowsLeftRight;
      case 20: return faPlane;
    }
    return faIcons;
  };

}
