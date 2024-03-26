import { TransactionDTO } from "./transactionDTO"

export type TransactionsDTO = {
  added: TransactionDTO[],
  modified: TransactionDTO[],
  removed: { transaction_id: string }[],
  next_cursor: string
}
