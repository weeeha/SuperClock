// Every string the Countdown screen shows, derived from the view model. Kept
// apart from the component so the copy rules are unit-tested without a DOM.
import type { CountdownAppConfig } from '../../shared/schemas/app.countdown';
import { parseDate, type CountdownView } from './countdown-state';

export interface CountdownCopy {
  headline: string;
  line: string;
  caption: string | null;
  muted: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function amount(view: Extract<CountdownView, { kind: 'until' | 'since' }>): string {
  if (view.unit === 'days') return plural(view.value, 'day', 'days');
  const weeks = plural(view.value, 'week', 'weeks');
  if (view.remainderDays === 0) return weeks;
  return `${weeks}, ${view.remainderDays} ${plural(view.remainderDays, 'day', 'days')}`;
}

function caption(view: CountdownView, config: CountdownAppConfig): string | null {
  if (view.kind === 'not-set-up' || !view.ring) return null;
  if ('missingStart' in view.ring) return 'Add a start date to show progress';
  if (view.ring.spent) return null;
  const start = parseDate(config.startDate);
  return start ? `since ${start.d} ${MONTHS[start.m - 1]} ${start.y}` : null;
}

export function countdownCopy(view: CountdownView, config: CountdownAppConfig): CountdownCopy {
  const label = config.label.trim();
  switch (view.kind) {
    case 'not-set-up':
      return { headline: 'No date yet', line: 'Set a target date for this screen in the admin.', caption: null, muted: false };
    case 'today':
      return { headline: 'Today', line: label, caption: caption(view, config), muted: false };
    case 'until':
    case 'since': {
      const joiner = view.kind === 'until' ? 'to' : 'since';
      const line = label ? `${amount(view)} ${joiner} ${label}` : amount(view);
      return { headline: String(view.value), line, caption: caption(view, config), muted: view.kind === 'since' };
    }
  }
}
