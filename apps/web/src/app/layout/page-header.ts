import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">{{ heading() }}</h1>
    @if (description(); as text) {
      <p class="text-muted-foreground mt-1 text-sm">{{ text }}</p>
    }
  `,
  host: { class: 'mb-6 block' },
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly description = input<string>();
}
