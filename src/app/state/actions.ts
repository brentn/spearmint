import { createAction } from "@ngrx/store";
import { Configuration } from "./types/configuration.type";
import { SocialUser } from "@abacritt/angularx-social-login";

export const loggedIn = createAction('[Main] Logged in', (user: SocialUser) => user);
export const loadConfiguration = createAction('[Main] Load Configuration');
export const configurationLoaded = createAction('[Main] Configuration Loaded', (config: Configuration) => ({ config }));
