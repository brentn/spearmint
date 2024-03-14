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

  constructor(incoming: Transaction | TransactionDTO) {
    this.id = (incoming as any).id || (incoming as any).transaction_id;
    this.date = (incoming as any).date || new Date((incoming as any).datetime);
    this.merchant = (incoming as any).merchant || (incoming as any).merchant_name;
    this.amount = incoming.amount;
    this.accountId = (incoming as any).accountId || (incoming as any).account_id;
    this.categoryId = (incoming as any).categoryId || (incoming as any).personal_finance_category.detailed;
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
