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
  lastUpdated: Date;

  constructor(dto: AccountDTO) {
    this.id = dto.account_id;
    this.institution = (dto as any).institution || 'Unknown Institution';
    this.name = dto.name;
    this.type = dto.type;
    this.active = true;
    this.balance = dto.balances.current;
    this.currency = dto.balances.iso_currency_code;
    this.lastUpdated = new Date();
  }

}

export type AccountDTO = {
  "account_id": string,
  "balances": {
    "available": number,
    "current": number,
    "limit": null,
    "iso_currency_code": CurrencyType,
  },
  "name": string,
  "official_name": string,
  "subtype": string,
  "type": AccountType,
}
