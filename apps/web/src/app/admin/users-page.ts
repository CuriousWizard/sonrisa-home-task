import { Component } from '@angular/core';
import { PageHeader } from '../layout/page-header';

@Component({
  selector: 'app-users-page',
  imports: [PageHeader],
  template: `<app-page-header heading="Users" />`,
})
export class UsersPage {}
