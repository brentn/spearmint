import { SocialUser } from "@abacritt/angularx-social-login";
import { Configuration } from "../types/configuration.type";
import { Account } from "../models/account";


export interface MainState {
  user: { idToken: string } | undefined;
  linkToken: string | undefined;
  configuration: Configuration;
  loading: string[];
  selectedAccount: Account | undefined;
  selectedBudget: string | 'other' | undefined;
}
