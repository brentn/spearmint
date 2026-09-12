import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  readonly id: number;
  readonly text: string;
}

const AUTO_DISMISS_MS = 4000;

/**
 * Small ambient in-app toast queue (no push infrastructure — see ADR 0007). Messages
 * auto-dismiss and are never interactive, so callers just fire-and-forget via show().
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _messages = signal<ToastMessage[]>([]);
  readonly messages = this._messages.asReadonly();

  private nextId = 0;

  show(text: string): void {
    const id = this.nextId++;
    this._messages.update((list) => [...list, { id, text }]);
    setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS);
  }

  dismiss(id: number): void {
    this._messages.update((list) => list.filter((message) => message.id !== id));
  }
}
