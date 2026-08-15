import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faArrowUpRightFromSquare,
  faArrowsRotate,
  faCircleExclamation,
  faPlus,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type { AccountType } from '../../../data/models';
import type { DiscoveredSimplefinAccount } from '../../../simplefin/simplefin-ingest-plan.util';
import { SimplefinSyncService } from '../../../simplefin/simplefin-sync.service';
import { AccountsStore } from './accounts.store';
import { SettingsHeader } from '../settings-header/settings-header';

/** No documented hosted reauth URL exists for SimpleFIN Bridge specifically — the Bridge
 * host itself (parsed from the access URL at claim time isn't stored per-account, so this
 * uses the well-known Bridge dashboard) is where a user manages and re-authenticates
 * connections. Also used as the "don't have a token yet" link-out on the connect form. */
const SIMPLEFIN_BRIDGE_URL = 'https://bridge.simplefin.org';

@Component({
  selector: 'app-accounts',
  imports: [FaIconComponent, DecimalPipe, SettingsHeader],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
  providers: [AccountsStore],
})
export class AccountsScreen {
  protected readonly store = inject(AccountsStore);
  protected readonly syncService = inject(SimplefinSyncService);

  protected readonly bridgeUrl = SIMPLEFIN_BRIDGE_URL;
  protected readonly icons = {
    external: faArrowUpRightFromSquare,
    sync: faArrowsRotate,
    error: faCircleExclamation,
    warning: faTriangleExclamation,
    add: faPlus,
  };

  protected readonly setupToken = signal('');
  private readonly connectDialog = viewChild<ElementRef<HTMLDialogElement>>('connectDialog');
  private readonly discoveredDialog = viewChild<ElementRef<HTMLDialogElement>>('discoveredDialog');
  private previousDiscoveredCount = 0;

  constructor() {
    // Surfacing new discoveries as a dialog (rather than an inline list) only helps if it
    // actually opens itself when a sync finds something — otherwise it's just as easy to
    // miss as the inline section it replaced. Closes itself once nothing's left to review.
    effect(() => {
      const count = this.syncService.discoveredAccounts().length;
      const dialog = this.discoveredDialog()?.nativeElement;
      if (dialog && count > 0 && this.previousDiscoveredCount === 0 && !dialog.open) {
        dialog.showModal();
      } else if (dialog?.open && count === 0) {
        dialog.close();
      }
      this.previousDiscoveredCount = count;
    });
  }

  openConnectDialog(): void {
    this.store.connectError.set(null);
    this.connectDialog()?.nativeElement.showModal();
  }

  closeConnectDialog(): void {
    this.connectDialog()?.nativeElement.close();
  }

  openDiscoveredDialog(): void {
    this.discoveredDialog()?.nativeElement.showModal();
  }

  closeDiscoveredDialog(): void {
    this.discoveredDialog()?.nativeElement.close();
  }

  async connect(): Promise<void> {
    const token = this.setupToken().trim();
    if (!token) {
      return;
    }
    await this.store.connectBank(token);
    if (!this.store.connectError()) {
      this.setupToken.set('');
      this.closeConnectDialog();
    }
  }

  async addDiscovered(discovered: DiscoveredSimplefinAccount, type: AccountType): Promise<void> {
    await this.store.addDiscovered(discovered, type);
  }

  async ignoreDiscovered(discovered: DiscoveredSimplefinAccount): Promise<void> {
    await this.store.ignoreDiscovered(discovered);
  }

  async renameAccount(accountId: string, input: EventTarget | null): Promise<void> {
    const value = (input as HTMLInputElement | null)?.value.trim();
    if (!value) {
      return;
    }
    await this.store.renameAccount(accountId, value);
  }

  async changeType(accountId: string, input: EventTarget | null): Promise<void> {
    const value = (input as HTMLSelectElement | null)?.value as AccountType | undefined;
    if (!value) {
      return;
    }
    await this.store.setAccountType(accountId, value);
  }
}
