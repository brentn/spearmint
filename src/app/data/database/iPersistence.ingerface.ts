import { AppState } from "src/app/app.module";

export interface IPersistence {
  saveState(state: AppState): void;
  restoreState(): AppState;
}
