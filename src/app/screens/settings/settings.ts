import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResetDeviceDialog } from '../../data/reset-device-dialog/reset-device-dialog';
import { SettingsHeader } from './settings-header/settings-header';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, SettingsHeader, ResetDeviceDialog],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {}
