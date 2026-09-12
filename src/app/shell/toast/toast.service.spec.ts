import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no messages queued', () => {
    expect(service.messages()).toEqual([]);
  });

  it('queues a message when shown', () => {
    service.show('4 transactions updated');

    expect(service.messages().map((m) => m.text)).toEqual(['4 transactions updated']);
  });

  it('queues multiple messages independently, each with its own id', () => {
    service.show('First');
    service.show('Second');

    const ids = service.messages().map((m) => m.id);
    expect(service.messages().map((m) => m.text)).toEqual(['First', 'Second']);
    expect(new Set(ids).size).toBe(2);
  });

  it('auto-dismisses a message after the timeout', () => {
    service.show('4 transactions updated');

    vi.advanceTimersByTime(4000);

    expect(service.messages()).toEqual([]);
  });

  it('does not dismiss a message before its timeout elapses', () => {
    service.show('4 transactions updated');

    vi.advanceTimersByTime(3000);

    expect(service.messages()).toHaveLength(1);
  });

  it('dismiss removes only the targeted message', () => {
    service.show('First');
    service.show('Second');
    const [first] = service.messages();

    service.dismiss(first.id);

    expect(service.messages().map((m) => m.text)).toEqual(['Second']);
  });
});
