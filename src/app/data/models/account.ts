import { AccountType } from "../types/accountType";
import { CurrencyType } from "../types/currencyType";

export class Account {
  id: string;
  institution: string;
  name: string;
  type: AccountType;
  active: boolean;
  balance: number;
  currency: CurrencyType;
  accessToken: string;
  itemId: string;
  cursor: string | undefined;
  lastUpdated: Date;

  constructor(incoming: any) {
    this.id = incoming.id;
    this.institution = incoming.institution;
    this.name = incoming.name;
    this.type = incoming.type;
    this.active = incoming.active;
    this.balance = incoming.balance;
    this.currency = incoming.currency;
    this.accessToken = incoming.accessToken;
    this.itemId = incoming.itemId;
    this.cursor = incoming.cursor;
    this.lastUpdated = incoming.lastUpdated;
  }

}

