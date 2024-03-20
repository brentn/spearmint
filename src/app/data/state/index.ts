import { SocialUser } from "@abacritt/angularx-social-login";
import { Account } from "../models/account";
import { Budget } from "../types/budget.type";
import { Category } from "../types/category.type";
import { Configuration } from "../types/configuration.type";
import { Transaction } from "../models/transaction";


export interface MainState {
  user: SocialUser | undefined;
  configuration: Configuration;
  loading: string[];
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
}
