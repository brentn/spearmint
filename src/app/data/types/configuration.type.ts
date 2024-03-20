import { PlaidConfiguration } from "./plaidConfiguration.type";

export type Configuration = {
  showGraph: boolean;
  plaid: PlaidConfiguration;
}

export const DEFAULT_CONFIGURATION: Configuration = {
  showGraph: true,
  plaid: {
    clientId: '',
    secret: '',
    linkToken: '',
  }
};
