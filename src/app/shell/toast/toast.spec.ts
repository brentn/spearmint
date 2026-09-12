import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Toast } from './toast';
import { ToastService, type ToastMessage } from './toast.service';

function create(messages: ToastMessage[]) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: ToastService, useValue: { messages: signal(messages) } },
    ],
  });
  const fixture = TestBed.createComponent(Toast);
  fixture.detectChanges();
  return fixture;
}

describe('Toast', () => {
  it('renders nothing when there are no queued messages', () => {
    const fixture = create([]);

    expect(fixture.nativeElement.querySelectorAll('.app-toast__message').length).toBe(0);
  });

  it('renders one element per queued message, in order', () => {
    const fixture = create([
      { id: 1, text: 'First' },
      { id: 2, text: 'Second' },
    ]);

    const nodes = fixture.nativeElement.querySelectorAll('.app-toast__message');
    expect(nodes.length).toBe(2);
    expect(nodes[0].textContent.trim()).toBe('First');
    expect(nodes[1].textContent.trim()).toBe('Second');
  });
});
