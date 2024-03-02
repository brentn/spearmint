import { AccountType } from "./accountType.type";

export type Account = {
  id: string;
  institution: string;
  name: string;
  type: AccountType;
  active: boolean;
  balance: number;
  lastUpdated: Date;
}
