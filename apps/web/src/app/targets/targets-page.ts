import { Component } from '@angular/core';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-targets-page',
  imports: [PageHeader],
  template: `<app-page-header heading="Targets" />`,
})
export class TargetsPage {}
