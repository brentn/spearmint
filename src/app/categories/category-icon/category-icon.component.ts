import { Component, Input } from '@angular/core';
import { faMoneyBill1 } from '@fortawesome/free-regular-svg-icons';
import { IconDefinition, faArrowLeft, faArrowRight, faArrowsLeftRight, faBoltLightning, faBuilding, faCar, faChildren, faCutlery, faDog, faDollarSign, faFilm, faGift, faGraduationCap, faHeartbeat, faHouse, faIcons, faMoneyBill, faPlane, faSackDollar, faShoppingBag, faUser } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'category-icon',
  templateUrl: './category-icon.component.html',
  styleUrls: ['./category-icon.component.css']
})
export class CategoryIconComponent {
  @Input() categoryId: string | undefined;

  get categoryIcon(): IconDefinition {
    switch (this.categoryId) {
      case "TRANSPORTATION": return faCar;
      case "RENT_AND_UTILITIES": return faBoltLightning;
      case "ENTERTAINMENT": return faFilm;
      case "BANK_FEES": return faMoneyBill1;
      case "LOAN_PAYMENTS": return faDollarSign;
      case "FOOD_AND_DRINK": return faCutlery;
      case "GOVERNMENT_AND_NON_PROFIT": return faGift;
      case "MEDICAL": return faHeartbeat;
      case "HOME_IMPROVEMENT": return faHouse;
      case "INCOME": return faSackDollar;
      case "GENERAL_SERVICES": return faIcons;
      case "PERSONAL_CARE": return faUser;
      case "GENERAL_MERCHANDISE": return faShoppingBag;
      case "TRANSFER_OUT": return faArrowRight;
      case "TRANSFER_IN": return faArrowLeft;
      case "TRAVEL": return faPlane;
    }
    return faIcons;
  };

}
