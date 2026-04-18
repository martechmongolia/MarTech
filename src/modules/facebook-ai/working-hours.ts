import type { FbReplySettings } from './types';

// Ulaanbaatar is UTC+8 with no DST. If Mongolia reintroduces DST or the app
// expands beyond MN, replace this with a per-org timezone setting + Intl API.
const ULAANBAATAR_UTC_OFFSET_MINUTES = 8 * 60;

/**
 * Returns true if the current wall-clock time in Ulaanbaatar falls inside
 * the configured working window. Supports overnight windows (e.g. 22:00 →
 * 06:00) where `end` is numerically earlier than `start`.
 *
 * `now` is injectable for unit tests so we don't have to timewarp the whole
 * process via vi.useFakeTimers.
 */
export function isWithinWorkingHours(
  settings: Pick<FbReplySettings, 'working_hours_start' | 'working_hours_end'>,
  now: Date = new Date(),
): boolean {
  const localMinutes =
    (now.getUTCHours() * 60 + now.getUTCMinutes() + ULAANBAATAR_UTC_OFFSET_MINUTES) %
    (24 * 60);

  const [startH, startM] = settings.working_hours_start.split(':').map(Number);
  const [endH, endM] = settings.working_hours_end.split(':').map(Number);

  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

  if (startMinutes <= endMinutes) {
    return localMinutes >= startMinutes && localMinutes <= endMinutes;
  }
  return localMinutes >= startMinutes || localMinutes <= endMinutes;
}
