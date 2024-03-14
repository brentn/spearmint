import { ConfidenceLevel } from "../types/confidenceLevel.type";

export class Transaction {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  accountId: string;
  categoryId?: string;
  notes?: string;
  hideFromBudget?: boolean;

  constructor(dto: TransactionDTO) {
    this.id = dto.transaction_id;
    this.date = new Date(dto.datetime);
    this.merchant = dto.merchant_name;
    this.amount = dto.amount;
    this.accountId = dto.account_id;
    this.categoryId = dto.personal_finance_category.detailed;
  }
}

export type TransactionDTO = {
  "account_id": string,
  "amount": number,
  "iso_currency_code": string,
  "check_number": number | null,
  // "counterparties": {
  //   "name":string,
  //   "type":string,
  //   "logo_url":string,
  //   "website":string,
  //   "entity_id":string,
  //   "confidence_level":ConfidenceLevel,
  // }[],
  "datetime": string,
  "authorized_datetime": string,
  "location": {
    "address": string,
    "city": string,
    "region": string,
    "postal_code": string,
    "country": string,
    "lat": number,
    "lon": number,
    "store_number": string
  },
  "name": string,
  "merchant_name": string,
  "logo_url": string,
  "website": string,
  "merchant_entity_id": string,
  "payment_channel": string,
  "pending": boolean,
  "personal_finance_category": {
    "primary": string,
    "detailed": string,
    "confidence_level": ConfidenceLevel
  },
  "personal_finance_category_icon_url": string,
  "transaction_id": string,
  "transaction_type": string
}
