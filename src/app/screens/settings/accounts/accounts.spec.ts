import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BackupService } from '../../../data/backup.service';
import type { DiscoveredSimplefinAccount } from '../../../simplefin/simplefin-ingest-plan.util';
import { SimplefinSyncService } from '../../../simplefin/simplefin-sync.service';
import { stubDialogMethods } from '../../../testing/stub-dialog-methods';
import { AccountsScreen } from './accounts';
import type { Account, IgnoredExternalAccount } from '../../../data/models';
import { AccountsStore } from './accounts.store';

/**
 * Covers only the back-link wiring (the `from` query param -> back arrow target). Store/sync
 * fakes stub every signal AccountsScreen's template reads (its dialogs render outside the
 * `loading` gate) but no mutation logic — that's covered by AccountsStore's own spec.
 */
class FakeAccountsStore {
  readonly loading = signal(true);
  readonly accounts = signal<Account[]>([]);
  readonly ignoredExternalAccounts = signal<IgnoredExternalAccount[]>([]);
  readonly connecting = signal(false);
  readonly connectError = signal<string | null>(null);
  readonly discoveredActionPending = signal(false);
  readonly deletingAccountId = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly importingAccountId = signal<string | null>(null);
  readonly lastImportAccountId = signal<string | null>(null);
  readonly importError = signal<string | null>(null);
  readonly importResultMessage = signal<string | null>(null);
  readonly syncNow = vi.fn(async () => {});
  readonly unignore = vi.fn(async () => {});
  institutionName(_institutionId: string): string {
    return 'Institution';
  }
}

class FakeSimplefinSyncService {
  readonly syncing = signal(false);
  readonly lastSyncError = signal<string | null>(null);
  readonly discoveredAccounts = signal<DiscoveredSimplefinAccount[]>([]);
}

@Component({ selector: 'app-stub-overview', template: '' })
class StubOverview {}

@Component({ selector: 'app-stub-settings', template: '' })
class StubSettings {}

describe('AccountsScreen back navigation (Overview bell vs. Settings menu)', () => {
  beforeAll(stubDialogMethods);

  function createFixture(from?: string) {
    TestBed.configureTestingModule({
      imports: [AccountsScreen],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'overview', component: StubOverview },
          { path: 'settings', component: StubSettings },
        ]),
        { provide: SimplefinSyncService, useValue: new FakeSimplefinSyncService() },
        { provide: BackupService, useValue: {} as BackupService },
      ],
    });
    TestBed.overrideComponent(AccountsScreen, {
      set: {
        providers: [{ provide: AccountsStore, useValue: new FakeAccountsStore() }],
      },
    });
    const fixture = TestBed.createComponent(AccountsScreen);
    if (from !== undefined) {
      fixture.componentRef.setInput('from', from);
    }
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function backHref(fixture: ReturnType<typeof createFixture>): string | null {
    return (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLAnchorElement>('.settings-header__back')
      ?.getAttribute('href') ?? null;
  }

  it('routes back to Overview when opened via the notification bell (?from=overview)', () => {
    expect(backHref(createFixture('overview'))).toBe('/overview');
  });

  it('routes back to Settings when opened via the Settings menu (?from=settings)', () => {
    expect(backHref(createFixture('settings'))).toBe('/settings');
  });

  it('falls back to Settings when no ?from= is present (direct URL entry, bookmark)', () => {
    expect(backHref(createFixture())).toBe('/settings');
  });

  it('falls back to Settings for an unrecognized ?from= value', () => {
    expect(backHref(createFixture('bogus'))).toBe('/settings');
  });
});
