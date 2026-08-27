import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { NavScrollService } from '../nav-scroll.service';
import { NavShell } from './nav-shell';

function create(hidden: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: NavScrollService, useValue: { hidden: signal(hidden) } },
    ],
  });
  const fixture = TestBed.createComponent(NavShell);
  fixture.detectChanges();
  return fixture;
}

describe('NavShell', () => {
  it('renders a tab for each nav destination', () => {
    const fixture = create(false);

    const tabs = fixture.nativeElement.querySelectorAll('.nav-shell__tab');

    expect(tabs.length).toBe(4);
  });

  it('does not apply the hidden class while the service reports visible', () => {
    const fixture = create(false);

    const nav = fixture.nativeElement.querySelector('.nav-shell');

    expect(nav.classList.contains('nav-shell--hidden')).toBe(false);
  });

  it('applies the hidden class while the service reports hidden', () => {
    const fixture = create(true);

    const nav = fixture.nativeElement.querySelector('.nav-shell');

    expect(nav.classList.contains('nav-shell--hidden')).toBe(true);
  });
});
