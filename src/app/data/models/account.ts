import { AccountType } from "../types/accountType";
import { CurrencyType } from "../types/currencyType";

export class Account {
  id: string;
  institution: string;
  name: string;
  displayName: string;
  type: AccountType;
  active: boolean;
  balance: number;
  currency: CurrencyType;
  accessToken: string;
  itemId: string;
  cursor: string | undefined;
  failure?: boolean;
  lastUpdated: Date;

  constructor(incoming: any) {
    this.id = incoming.id;
    this.institution = incoming.institution;
    this.name = incoming.name;
    this.displayName = incoming.customName || incoming.name;
    this.type = incoming.type;
    this.active = incoming.active;
    this.balance = incoming.balance;
    this.currency = incoming.currency;
    this.accessToken = incoming.accessToken;
    this.itemId = incoming.itemId;
    this.cursor = incoming.cursor;
    this.failure = incoming.failure;
    this.lastUpdated = incoming.lastUpdated instanceof Date ? incoming.lastUpdated : new Date(incoming.lastUpdated);
  }

}

