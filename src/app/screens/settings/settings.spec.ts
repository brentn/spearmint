import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Settings } from './settings';
import { DatabaseService } from '../../data/database.service';

describe('Settings', () => {
  // ResetDeviceDialog's own open/confirm/error behavior is covered by its own
  // spec — this only checks Settings wires it in with the right copy. Doesn't
  // click the trigger: jsdom doesn't implement HTMLDialogElement.showModal().
  it('renders the reset-device dialog with the Danger Zone copy', () => {
    TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: DatabaseService, useValue: { resetDatabase: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.settings__danger-button')).toBeTruthy();
    expect(compiled.querySelector('app-reset-device-dialog')).toBeTruthy();
    expect(compiled.textContent).toContain('Reset local data?');
  });
});
