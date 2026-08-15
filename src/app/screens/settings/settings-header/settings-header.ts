import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

/**
 * Shared header for the settings screens (Settings, Accounts, Categories, Export/Import):
 * back link left, title centered, projected action buttons right.
 */
@Component({
  selector: 'app-settings-header',
  imports: [RouterLink, FaIconComponent],
  templateUrl: './settings-header.html',
  styleUrl: './settings-header.scss',
})
export class SettingsHeader {
  readonly title = input.required<string>();
  readonly backLink = input<string | null>(null);

  protected readonly icons = { back: faArrowLeft };
}
