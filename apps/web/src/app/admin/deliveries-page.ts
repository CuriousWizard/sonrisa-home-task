import { Component } from '@angular/core';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-deliveries-page',
  imports: [PageHeader],
  template: `<app-page-header heading="Deliveries" />`,
})
export class DeliveriesPage {}
