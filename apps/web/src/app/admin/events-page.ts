import { Component } from '@angular/core';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-events-page',
  imports: [PageHeader],
  template: `<app-page-header heading="Events" />`,
})
export class EventsPage {}
