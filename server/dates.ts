import { CONFIG } from '../shared/config';

function parts(now: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map: Record<string, string> = {};
  for (const p of f.formatToParts(now)) map[p.type] = p.value;
  return map;
}

/** Calendar date (YYYY-MM-DD) in the usage time zone. */
export function usageDate(now = new Date(), timeZone: string = CONFIG.timeZone): string {
  const p = parts(now, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** The instant of the next local midnight, when the daily count resets. */
export function nextReset(now = new Date(), timeZone: string = CONFIG.timeZone): Date {
  const p = parts(now, timeZone);
  const elapsedMs = ((Number(p.hour) * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - elapsedMs + 24 * 60 * 60 * 1000);
}
