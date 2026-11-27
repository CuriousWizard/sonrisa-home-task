import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AdminUserDto, AlertDto } from '@alerts/shared';
import { UsersPage } from './users-page';

const users: AdminUserDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'admin@example.local',
    role: 'admin',
    createdAt: '2026-11-27T09:00:00.000Z',
    alertCount: 0,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'user@example.local',
    role: 'user',
    createdAt: '2026-11-27T10:00:00.000Z',
    alertCount: 1,
  },
];

const alert: AlertDto = {
  id: '00000000-0000-4000-8000-0000000000a1',
  name: 'Tech news',
  category: 'news',
  filters: { keywords: ['chip', 'AI'] },
  minSeverity: 2,
  targetIds: ['00000000-0000-4000-8000-0000000000b1'],
  enabled: false,
  createdAt: '2026-11-27T10:00:00.000Z',
  updatedAt: '2026-11-27T10:00:00.000Z',
};

// Test HTTP requests do not count toward stability, so whenStable alone can return before an async handler resumes.
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

describe('UsersPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UsersPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the alerts of the selected user and shows them below the table', async () => {
    const fixture = TestBed.createComponent(UsersPage);
    http.expectOne('/api/admin/users?limit=200').flush(users);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    const rows = Array.from(root.querySelectorAll('tbody tr'));
    const row = rows.find((element) =>
      element.textContent?.includes('user@example.local'),
    );
    const show = row?.querySelector('button');
    if (!show) throw new Error('missing Show alerts button');
    show.click();

    const request = http.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === '/api/admin/alerts' &&
        req.params.get('userId') === users[1].id,
    );
    request.flush([alert]);
    await settle(fixture);

    const section = root.querySelector('section');
    expect(section?.querySelector('h2')?.textContent).toContain(
      'user@example.local',
    );
    const cells = Array.from(
      section?.querySelectorAll('tbody tr td') ?? [],
      (cell) => cell.textContent?.trim(),
    );
    expect(cells).toEqual([
      'Tech news',
      'News',
      'Keywords: chip, AI',
      '2',
      'No',
    ]);
  });

  it('keeps the alerts of the user clicked last when an older response arrives last', async () => {
    const fixture = TestBed.createComponent(UsersPage);
    http.expectOne('/api/admin/users?limit=200').flush(users);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const show = (email: string): HTMLButtonElement => {
      const button = root.querySelector<HTMLButtonElement>(
        `button[aria-label="Show alerts of ${email}"]`,
      );
      if (!button) throw new Error(`missing Show alerts button for ${email}`);
      return button;
    };
    const alertsOf = (userId: string) =>
      http.expectOne(
        (req) =>
          req.url === '/api/admin/alerts' &&
          req.params.get('userId') === userId,
      );

    show('admin@example.local').click();
    const older = alertsOf(users[0].id);
    show('user@example.local').click();
    const newer = alertsOf(users[1].id);
    newer.flush([alert]);
    await settle(fixture);
    older.flush([{ ...alert, id: 'other', name: 'Admin alert' }]);
    await settle(fixture);

    const section = root.querySelector('section');
    expect(section?.querySelector('h2')?.textContent).toContain(
      'user@example.local',
    );
    expect(
      Array.from(
        section?.querySelectorAll('tbody tr td:first-child') ?? [],
        (cell) => cell.textContent?.trim(),
      ),
    ).toEqual(['Tech news']);
  });
});
