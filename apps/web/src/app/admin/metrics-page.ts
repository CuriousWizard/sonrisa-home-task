import { Component } from '@angular/core';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-metrics-page',
  imports: [PageHeader],
  template: `<app-page-header heading="Metrics" />`,
})
export class MetricsPage {}
