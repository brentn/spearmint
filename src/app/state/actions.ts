import { createAction } from "@ngrx/store";
import { Configuration } from "./types/configuration.type";

export const loadConfiguration = createAction('[Main] Load Configuration');
export const configurationLoaded = createAction('[Main] Configuration Loaded', (config: Configuration) => ({ config }));
