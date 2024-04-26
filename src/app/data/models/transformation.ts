import { Transaction } from "./transaction";

export class Transformation {
  accountId: string;
  categoryId: string;
  merchantId: string;
  paymentChannel: string;
  name: string;
  newCategoryId: string | undefined
  newMerchant: string | undefined;
  newHideFromBudget: boolean | undefined;

  constructor(incoming: any) {
    this.accountId = incoming.accountId || '';
    this.categoryId = incoming.categoryId || '';
    this.merchantId = incoming.merchantId || '';
    this.paymentChannel = incoming.paymentChannel || '';
    this.name = (incoming.name || '')
      .split('$')[0]
      .split('Cheque Date')[0]
      .split('Confirmation #')[0]
      .split('Reference Number')[0]
      .substring(0, 25);
    this.newCategoryId = incoming.newCategoryId || undefined;
    this.newMerchant = incoming.newMerchant || undefined;
    this.newHideFromBudget = incoming.newExcludeFromBudget;
  }

  matches(transaction: Transaction): boolean {
    if (this.accountId === transaction.accountId) {
      if (this.categoryId === transaction.categoryId) {
        if (this.merchantId === transaction.merchantId) {
          if (this.name === transaction.name.substring(0, this.name.length)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  transform(transaction: Transaction): Transaction {
    if (this.matches(transaction)) {
      return new Transaction({
        ...transaction,
        merchant: this.newMerchant,
        categoryId: this.newCategoryId,
        hideFromBudget: this.newHideFromBudget,
      })
    } else {
      return transaction;
    }
  }
}
