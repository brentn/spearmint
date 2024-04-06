import { ConfidenceLevel } from "../types/confidenceLevel.type";

export class Transaction {
  id: string;
  date: number;
  accountId: string;
  merchant: string;
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
    this.merchant = incoming.merchant ?? '';
    this.name = incoming.name ?? '';
    this.amount = incoming.amount ?? 0;
    this.categoryId = incoming.categoryId;
    this.notes = incoming.notes;
    this.hideFromBudget = incoming.hideFromBudget;
  }
}


