export type Transaction = {
  id: string;
  date: Date;
  description: string;
  amount: number;
  accountId: string;
  categoryId: number | undefined;
}
