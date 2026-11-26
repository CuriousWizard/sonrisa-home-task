import { z } from 'zod';
import { LIMITS } from './common';
import { EventDto } from './events';

export interface DevEventResult {
  event: EventDto;
  deliveriesCreated: number;
}

export const MockSlackMessage = z.object({
  text: z.string().max(LIMITS.slackText),
});
export type MockSlackMessage = z.infer<typeof MockSlackMessage>;

export const MockSlackMode = z.object({ fail: z.boolean() });
export type MockSlackMode = z.infer<typeof MockSlackMode>;
