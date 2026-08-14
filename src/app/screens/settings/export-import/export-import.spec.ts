import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportImportScreen } from './export-import';
import { BackupService } from '../../../data/backup.service';

describe('ExportImportScreen', () => {
  let exportBackup: ReturnType<typeof vi.fn>;
  let importBackup: ReturnType<typeof vi.fn>;
  let getExportEncryptionDefault: ReturnType<typeof vi.fn>;
  let reloadMock: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  const originalLocation = window.location;

  beforeEach(() => {
    exportBackup = vi.fn().mockResolvedValue(new Blob(['{}'], { type: 'application/json' }));
    importBackup = vi.fn().mockResolvedValue(undefined);
    getExportEncryptionDefault = vi.fn().mockResolvedValue(false);

    // jsdom's window.location.reload is non-configurable, so it can't be
    // vi.spyOn'd directly — replace the whole location object instead.
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    // The download anchor's href is a blob: URL jsdom doesn't know how to
    // navigate to; stub click() so the test never triggers real navigation.
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    TestBed.configureTestingModule({
      imports: [ExportImportScreen],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: BackupService, useValue: { exportBackup, importBackup, getExportEncryptionDefault } },
      ],
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
    clickSpy.mockRestore();
  });

  function makeFile(contents: string): File {
    return new File([contents], 'backup.json', { type: 'application/json' });
  }

  it('loads the stored export-encryption default on init', async () => {
    getExportEncryptionDefault.mockResolvedValue(true);
    const fixture = TestBed.createComponent(ExportImportScreen);
    fixture.detectChanges();

    await vi.waitFor(() => expect(fixture.componentInstance.encryptExport()).toBe(true));
  });

  it('exports a backup, triggers a download, and clears the password fields', async () => {
    const fixture = TestBed.createComponent(ExportImportScreen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.encryptExport.set(true);
    component.exportPassword.set('a good password');
    component.exportPasswordConfirm.set('a good password');

    await component.exportBackup();

    expect(exportBackup).toHaveBeenCalledWith(true, 'a good password');
    expect(clickSpy).toHaveBeenCalled();
    expect(component.exportPassword()).toBe('');
    expect(component.exportPasswordConfirm()).toBe('');
    expect(component.exportDone()).toBe(true);
    expect(component.exportError()).toBeNull();
  });

  it('surfaces an export error without downloading anything', async () => {
    exportBackup.mockRejectedValue(new Error('storage unavailable'));
    const fixture = TestBed.createComponent(ExportImportScreen);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    await component.exportBackup();

    expect(component.exportError()).toBe('storage unavailable');
    expect(component.exporting()).toBe(false);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('onFileSelected stores the chosen file and clears any prior error', () => {
    const fixture = TestBed.createComponent(ExportImportScreen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.importError.set('previous failure');
    const file = makeFile('{}');
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    component.onFileSelected({ target: input } as unknown as Event);

    expect(component.importFile()).toBe(file);
    expect(component.importError()).toBeNull();
  });

  it('imports the selected file and reloads the app on success', async () => {
    const fixture = TestBed.createComponent(ExportImportScreen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const file = makeFile('{"format":"spearmint-backup"}');
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    component.onFileSelected({ target: input } as unknown as Event);
    component.importPassword.set('a password');

    await component.confirmImport();

    expect(importBackup).toHaveBeenCalledWith('{"format":"spearmint-backup"}', 'a password');
    expect(reloadMock).toHaveBeenCalled();
  });

  it('passes null when no import password was entered', async () => {
    const fixture = TestBed.createComponent(ExportImportScreen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const file = makeFile('{}');
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    component.onFileSelected({ target: input } as unknown as Event);

    await component.confirmImport();

    expect(importBackup).toHaveBeenCalledWith('{}', null);
  });

  it('surfaces an import error and does not reload when the import fails', async () => {
    importBackup.mockRejectedValue(new Error('Incorrect password, or the backup file is corrupted.'));
    const fixture = TestBed.createComponent(ExportImportScreen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const file = makeFile('{}');
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    component.onFileSelected({ target: input } as unknown as Event);

    await component.confirmImport();

    expect(component.importError()).toBe('Incorrect password, or the backup file is corrupted.');
    expect(component.importing()).toBe(false);
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
