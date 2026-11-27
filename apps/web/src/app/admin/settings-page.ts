import { Component } from '@angular/core';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-settings-page',
  imports: [PageHeader],
  template: `<app-page-header heading="Settings" />`,
})
export class SettingsPage {}
