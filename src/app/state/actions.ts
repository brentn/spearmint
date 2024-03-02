import { createAction } from "@ngrx/store";
import { Configuration } from "./types/configuration.type";

export const loadConfiguration = createAction('[App] Load Configuration');
export const configurationLoaded = createAction('[App] Configuration Loaded', (config: Configuration) => ({ config }));
