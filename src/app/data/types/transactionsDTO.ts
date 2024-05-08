import { TransactionDTO } from "./transactionDTO"

export type TransactionsDTO = {
  accounts: { account_id: string, balances: { current: number } }[],
  added: TransactionDTO[],
  modified: TransactionDTO[],
  removed: { transaction_id: string }[],
  hasMore: boolean;
  next_cursor: string
}
