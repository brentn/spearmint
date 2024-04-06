import { SocialUser } from "@abacritt/angularx-social-login";
import { Configuration } from "../types/configuration.type";


export interface MainState {
  user: SocialUser | undefined;
  linkToken: string | undefined;
  configuration: Configuration;
  loading: string[];
}
