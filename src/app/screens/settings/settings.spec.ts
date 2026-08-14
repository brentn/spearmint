import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Settings } from './settings';
import { DatabaseService } from '../../data/database.service';

describe('Settings', () => {
  let resetDatabase: ReturnType<typeof vi.fn>;
  let reloadMock: ReturnType<typeof vi.fn>;
  const originalLocation = window.location;

  beforeEach(() => {
    resetDatabase = vi.fn().mockResolvedValue(undefined);
    // jsdom's window.location.reload is non-configurable, so it can't be
    // vi.spyOn'd directly — replace the whole location object instead.
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: DatabaseService, useValue: { resetDatabase } },
      ],
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
  });

  it('resets the database and reloads the app on confirm', async () => {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();

    await fixture.componentInstance.confirmReset();

    expect(resetDatabase).toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalled();
  });

  it('surfaces an error and does not reload when the reset fails', async () => {
    resetDatabase.mockRejectedValue(new Error('storage unavailable'));
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();

    await fixture.componentInstance.confirmReset();

    expect(fixture.componentInstance.error()).toBe('storage unavailable');
    expect(fixture.componentInstance.resetting()).toBe(false);
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
