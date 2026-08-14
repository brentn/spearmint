import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { AuthGate } from './auth/auth-gate/auth-gate';
import { NavShell } from './shell/nav-shell/nav-shell';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AuthGate, NavShell],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly authService = inject(AuthService);
}
