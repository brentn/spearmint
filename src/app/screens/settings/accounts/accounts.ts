import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faArrowUpRightFromSquare,
  faArrowsRotate,
  faCircleExclamation,
  faDownload,
  faFileArrowUp,
  faPenToSquare,
  faPlus,
  faTrash,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { MIN_PASSWORD_LENGTH } from '../../../auth/password-policy';
import { BackupService } from '../../../data/backup.service';
import { downloadBlob } from '../../../data/download-blob.util';
import type { Account, AccountType } from '../../../data/models';
import type { DiscoveredSimplefinAccount } from '../../../simplefin/simplefin-ingest-plan.util';
import { SimplefinSyncService } from '../../../simplefin/simplefin-sync.service';
import { AccountsStore } from './accounts.store';
import { SettingsHeader } from '../settings-header/settings-header';

/** No documented hosted reauth URL exists for SimpleFIN Bridge specifically — the Bridge
 * host itself (parsed from the access URL at claim time isn't stored per-account, so this
 * uses the well-known Bridge dashboard) is where a user manages and re-authenticates
 * connections. Also used as the "don't have a token yet" link-out on the connect form. */
const SIMPLEFIN_BRIDGE_URL = 'https://beta-bridge.simplefin.org/auth/login';

@Component({
  selector: 'app-accounts',
  imports: [FaIconComponent, DecimalPipe, DatePipe, SettingsHeader],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
  providers: [AccountsStore],
})
export class AccountsScreen {
  protected readonly store = inject(AccountsStore);
  protected readonly syncService = inject(SimplefinSyncService);
  private readonly backupService = inject(BackupService);

  protected readonly bridgeUrl = SIMPLEFIN_BRIDGE_URL;
  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly icons = {
    external: faArrowUpRightFromSquare,
    sync: faArrowsRotate,
    error: faCircleExclamation,
    warning: faTriangleExclamation,
    add: faPlus,
    manual: faPenToSquare,
    import: faFileArrowUp,
    export: faDownload,
    delete: faTrash,
  };

  protected readonly setupToken = signal('');
  protected readonly addAccountMode = signal<'simplefin' | 'manual'>('simplefin');
  private readonly addAccountDialog = viewChild<ElementRef<HTMLDialogElement>>('addAccountDialog');
  private readonly discoveredDialog = viewChild<ElementRef<HTMLDialogElement>>('discoveredDialog');
  private readonly deleteAccountDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteAccountDialog');
  private readonly statementFileInput = viewChild<ElementRef<HTMLInputElement>>('statementFileInput');
  private previousDiscoveredCount = 0;
  private statementImportTargetId: string | null = null;

  protected readonly accountPendingDelete = signal<Account | null>(null);
  protected readonly exportingBackup = signal(false);
  protected readonly exportBackupError = signal<string | null>(null);
  protected readonly exportEncryptionDefault = signal(false);
  protected readonly exportPassword = signal('');
  protected readonly exportPasswordConfirm = signal('');

  protected readonly manualBankName = signal('');
  protected readonly manualAccountName = signal('');
  protected readonly manualAccountType = signal<AccountType>('bank');
  protected readonly manualAccountPending = signal(false);

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

  /** One dialog covers both ways to add an account, switched via addAccountMode — SimpleFIN
   * connect is the default panel, with a small toggle to the manual-account panel and back. */
  openAddAccountDialog(mode: 'simplefin' | 'manual' = 'simplefin'): void {
    this.store.connectError.set(null);
    this.setupToken.set('');
    this.manualBankName.set('');
    this.manualAccountName.set('');
    this.manualAccountType.set('bank');
    this.addAccountMode.set(mode);
    this.addAccountDialog()?.nativeElement.showModal();
  }

  closeAddAccountDialog(): void {
    this.addAccountDialog()?.nativeElement.close();
  }

  switchAddAccountMode(mode: 'simplefin' | 'manual'): void {
    this.addAccountMode.set(mode);
  }

  async createManualAccount(): Promise<void> {
    const bankName = this.manualBankName().trim();
    const accountName = this.manualAccountName().trim();
    if (!bankName || !accountName) {
      return;
    }
    this.manualAccountPending.set(true);
    try {
      await this.store.createManualAccount(bankName, accountName, this.manualAccountType());
      this.closeAddAccountDialog();
    } finally {
      this.manualAccountPending.set(false);
    }
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
      this.closeAddAccountDialog();
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

  /** Opens the (shared, hidden) file picker for a specific account's card — the target id is
   * stashed here rather than passed through the change event, since the native <input> only
   * reports the chosen File. */
  triggerImportStatement(accountId: string): void {
    this.statementImportTargetId = accountId;
    this.statementFileInput()?.nativeElement.click();
  }

  async onStatementFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const accountId = this.statementImportTargetId;
    input.value = ''; // allow re-selecting the same file (e.g. after fixing it)
    if (!file || !accountId) {
      return;
    }
    const fileText = await this.readFileText(file);
    await this.store.importStatement(accountId, fileText);
  }

  private readFileText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  openDeleteDialog(account: Account): void {
    this.accountPendingDelete.set(account);
    this.store.deleteError.set(null);
    this.exportBackupError.set(null);
    this.exportPassword.set('');
    this.exportPasswordConfirm.set('');
    void this.loadExportEncryptionDefault();
    this.deleteAccountDialog()?.nativeElement.showModal();
  }

  private async loadExportEncryptionDefault(): Promise<void> {
    this.exportEncryptionDefault.set(await this.backupService.getExportEncryptionDefault());
  }

  closeDeleteDialog(): void {
    this.deleteAccountDialog()?.nativeElement.close();
    this.accountPendingDelete.set(null);
  }

  async confirmDeleteAccount(): Promise<void> {
    const account = this.accountPendingDelete();
    if (!account) {
      return;
    }
    await this.store.deleteAccount(account.id);
    if (!this.store.deleteError()) {
      this.closeDeleteDialog();
    }
  }

  /** One-way safety net (ADR-0017) before deleting a real account — reuses the same
   * whole-database backup as Settings -> Export/Import, including the user's saved
   * encryption preference (and, when it's on, the password entered in this dialog),
   * rather than a new scoped export. */
  async exportBeforeDelete(): Promise<void> {
    this.exportingBackup.set(true);
    this.exportBackupError.set(null);
    try {
      const blob = await this.backupService.exportBackup(this.exportEncryptionDefault(), this.exportPassword());
      downloadBlob(blob, `spearmint-backup-${new Date().toISOString().slice(0, 10)}.json`);
      this.exportPassword.set('');
      this.exportPasswordConfirm.set('');
    } catch (err) {
      this.exportBackupError.set(err instanceof Error ? err.message : 'Could not export a backup.');
    } finally {
      this.exportingBackup.set(false);
    }
  }
}
