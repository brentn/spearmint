import { SocialUser } from "@abacritt/angularx-social-login";
import { Account } from "./types/account.type";
import { Budget } from "./types/budget.type";
import { Category } from "./types/category.type";
import { Configuration } from "./types/configuration.type";
import { Transaction } from "./types/transaction.type";

export interface MainState {
  user: SocialUser | undefined;
  configuration: Configuration;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
}