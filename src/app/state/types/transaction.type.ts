export type Transaction = {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  accountId: string;
  categoryId?: number;
  notes?: string;
}
