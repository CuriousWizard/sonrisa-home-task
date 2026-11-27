import { Component } from '@angular/core';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-alerts-page',
  imports: [PageHeader],
  template: `<app-page-header heading="Alerts" />`,
})
export class AlertsPage {}
