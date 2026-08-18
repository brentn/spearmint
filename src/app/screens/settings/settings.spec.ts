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
  it('hides the danger zone behind an Advanced button until clicked', () => {
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

    const advancedButton = compiled.querySelector<HTMLButtonElement>('.settings__advanced-toggle');
    expect(advancedButton).toBeTruthy();
    expect(compiled.querySelector('.settings__danger-button')).toBeFalsy();

    advancedButton!.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.settings__advanced-toggle')).toBeFalsy();
    expect(compiled.querySelector('.settings__danger-button')).toBeTruthy();
    expect(compiled.querySelector('app-reset-device-dialog')).toBeTruthy();
    expect(compiled.textContent).toContain('Reset local data?');
  });

  it('lists Security above Export / Import backup', () => {
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

    const links = Array.from(compiled.querySelectorAll('.settings__link')).map((el) => el.textContent?.trim());
    expect(links.indexOf('Security')).toBeLessThan(links.indexOf('Export / Import backup'));
  });
});
