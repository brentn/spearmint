export type TransactionDTO = {
  transaction_id: string,
  account_id: string,
  date: string,
  merchant_name: string,
  name: string,
  amount: number,
  personal_finance_category: {
    detailed: string
  },
}
