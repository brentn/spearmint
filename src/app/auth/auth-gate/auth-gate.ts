import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-auth-gate',
  templateUrl: './auth-gate.html',
  styleUrl: './auth-gate.scss',
})
export class AuthGate {
  private readonly authService = inject(AuthService);

  readonly credentialStatus = this.authService.credentialStatus;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async register(deviceLabel: string): Promise<void> {
    const label = deviceLabel.trim();
    if (!label) {
      this.error.set('Give this device a name first.');
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.authService.register(label);
    } catch (err) {
      console.error('Registration failed:', err);
      this.error.set("Couldn't register this device. Please try again.");
    } finally {
      this.busy.set(false);
    }
  }

  async unlock(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      const ok = await this.authService.authenticate();
      if (!ok) {
        this.error.set("Couldn't verify — please try again.");
      }
    } finally {
      this.busy.set(false);
    }
  }
}
