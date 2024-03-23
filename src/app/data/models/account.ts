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
  lastUpdated: Date;

  constructor(incoming: Account) {
    this.id = incoming.id;
    this.institution = incoming.institution;
    this.name = incoming.name;
    this.type = incoming.type;
    this.active = incoming.active;
    this.balance = incoming.balance;
    this.currency = incoming.currency;
    this.accessToken = incoming.accessToken;
    this.itemId = incoming.itemId;
    this.lastUpdated = incoming.lastUpdated;
  }

}

// export type AccountDTO = {
//   "account_id": string,
//   "balances": {
//     "available": number,
//     "current": number,
//     "limit": null,
//     "iso_currency_code": CurrencyType,
//   },
//   "name": string,
//   "official_name": string,
//   "subtype": string,
//   "type": AccountType,
// }
