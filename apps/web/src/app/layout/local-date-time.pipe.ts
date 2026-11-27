import { Pipe, type PipeTransform } from '@angular/core';

// An undefined locale means the browser's locale.
const format = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

@Pipe({ name: 'localDateTime' })
export class LocalDateTimePipe implements PipeTransform {
  transform(iso: string): string {
    return format.format(new Date(iso));
  }
}
