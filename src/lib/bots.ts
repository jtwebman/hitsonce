import { isbot } from 'isbot';

// Known crawlers/bots by User-Agent. Events are still stored (with is_bot = true)
// so the dashboard can separate real humans from bots rather than dropping data.
export function isBot(ua: string): boolean {
  return isbot(ua);
}
