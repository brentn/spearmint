import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetDeviceDialog } from './reset-device-dialog';
import { DatabaseService } from '../database.service';

describe('ResetDeviceDialog', () => {
  let resetDatabase: ReturnType<typeof vi.fn>;
  let reloadMock: ReturnType<typeof vi.fn>;
  const originalLocation = window.location;

  beforeEach(() => {
    resetDatabase = vi.fn().mockResolvedValue(undefined);
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    TestBed.configureTestingModule({
      imports: [ResetDeviceDialog],
      providers: [provideZonelessChangeDetection(), { provide: DatabaseService, useValue: { resetDatabase } }],
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
  });

  function create() {
    const fixture = TestBed.createComponent(ResetDeviceDialog);
    fixture.componentRef.setInput('title', 'Reset this device?');
    fixture.componentRef.setInput('body', 'This deletes everything.');
    fixture.detectChanges();
    return fixture;
  }

  it('resets the database and reloads on confirm', async () => {
    const fixture = create();

    await fixture.componentInstance.confirm();

    expect(resetDatabase).toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalled();
  });

  it('surfaces an error and does not reload when the reset fails', async () => {
    resetDatabase.mockRejectedValue(new Error('storage unavailable'));
    const fixture = create();

    await fixture.componentInstance.confirm();

    expect(fixture.componentInstance.error()).toBe('storage unavailable');
    expect(fixture.componentInstance.resetting()).toBe(false);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('renders the provided title and body', () => {
    const fixture = create();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Reset this device?');
    expect(compiled.textContent).toContain('This deletes everything.');
  });
});
