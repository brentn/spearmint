import { ConfidenceLevel } from "../types/confidenceLevel.type";

export class Transaction {
  id: string;
  date: number;
  accountId: string;
  merchantId: string;
  merchant: string;
  paymentChannel: string;
  name: string;
  amount: number;
  categoryId?: string;
  notes?: string;
  hideFromBudget?: boolean;

  constructor(incoming: any) {
    if (!incoming?.id) throw new Error('Transaction must have an id');
    if (!incoming.date) throw new Error('Transaction must have a date');
    if (!incoming.accountId) throw new Error('Transaction must have an accountId');
    this.id = incoming.id;
    this.date = new Date(incoming.date).getTime();
    this.accountId = incoming.accountId;
    this.merchantId = incoming.merchantId || '';
    this.merchant = incoming.merchant ?? '';
    this.paymentChannel = incoming.paymentChannel || '';
    this.name = incoming.name ?? '';
    this.amount = incoming.amount ?? 0;
    this.categoryId = incoming.categoryId;
    this.notes = incoming.notes;
    this.hideFromBudget = incoming.hideFromBudget;
  }

  get searchText(): string {
    return [
      this.date.toString().substring(4, 15),
      this.merchant,
      this.name,
      '$' + this.amount.toFixed(2),
      this.categoryId,
      this.notes,
    ].join('|').toLowerCase();
  }
}


