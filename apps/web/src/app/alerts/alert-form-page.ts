import { Component, computed, input } from '@angular/core';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-alert-form-page',
  imports: [PageHeader],
  template: `<app-page-header [heading]="heading()" />`,
})
export class AlertFormPage {
  // Bound from the :id route param. Undefined on /alerts/new.
  readonly id = input<string>();
  protected readonly heading = computed(() =>
    this.id() ? 'Edit alert' : 'New alert',
  );
}
