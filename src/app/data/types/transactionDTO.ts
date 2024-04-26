export type TransactionDTO = {
  transaction_id: string,
  account_id: string,
  date: string,
  merchant_name: string,
  merchant_entity_id: string | null,
  payment_channel: string | null,
  name: string,
  amount: number,
  personal_finance_category: {
    detailed: string
  },
}
