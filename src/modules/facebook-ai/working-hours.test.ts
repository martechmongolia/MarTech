import { describe, it, expect } from 'vitest';
import { isWithinWorkingHours } from './working-hours';

// Helper: build a UTC date that represents the given Ulaanbaatar HH:MM.
// UB is UTC+8 with no DST, so we subtract 8 hours from the local reading.
function ubLocal(hh: number, mm: number): Date {
  const utcHours = (hh - 8 + 24) % 24;
  const d = new Date(Date.UTC(2026, 3, 18, utcHours, mm, 0));
  // If the subtraction wrapped past midnight the calendar day shifts back;
  // for the "within window" checks we don't care which day we're on, only
  // the clock, so this is fine as long as it's a consistent timestamp.
  return d;
}

describe('isWithinWorkingHours', () => {
  const daytime = { working_hours_start: '08:00', working_hours_end: '22:00' };
  const overnight = { working_hours_start: '22:00', working_hours_end: '06:00' };

  it('returns true at the start boundary', () => {
    expect(isWithinWorkingHours(daytime, ubLocal(8, 0))).toBe(true);
  });

  it('returns true mid-window (14:00 UB = 06:00 UTC)', () => {
    expect(isWithinWorkingHours(daytime, ubLocal(14, 0))).toBe(true);
  });

  it('returns true at the end boundary (inclusive)', () => {
    expect(isWithinWorkingHours(daytime, ubLocal(22, 0))).toBe(true);
  });

  it('returns false before start', () => {
    expect(isWithinWorkingHours(daytime, ubLocal(7, 59))).toBe(false);
  });

  it('returns false after end', () => {
    expect(isWithinWorkingHours(daytime, ubLocal(22, 1))).toBe(false);
  });

  // Regression: the original bug used getUTCHours() directly, which wrongly
  // read UTC 14:00 as "14:00 Ulaanbaatar" and skipped 8:00–15:59 UB traffic.
  it('accepts 14:00 UB (06:00 UTC) that used to be rejected pre-fix', () => {
    const now = new Date(Date.UTC(2026, 3, 18, 6, 0, 0)); // 06:00 UTC = 14:00 UB
    expect(isWithinWorkingHours(daytime, now)).toBe(true);
  });

  it('accepts 20:00 UB (12:00 UTC) that used to be rejected pre-fix', () => {
    const now = new Date(Date.UTC(2026, 3, 18, 12, 0, 0)); // 12:00 UTC = 20:00 UB
    expect(isWithinWorkingHours(daytime, now)).toBe(true);
  });

  describe('overnight window (22:00 → 06:00)', () => {
    it('returns true just after start (22:30)', () => {
      expect(isWithinWorkingHours(overnight, ubLocal(22, 30))).toBe(true);
    });

    it('returns true past midnight (01:00)', () => {
      expect(isWithinWorkingHours(overnight, ubLocal(1, 0))).toBe(true);
    });

    it('returns true at end boundary (06:00)', () => {
      expect(isWithinWorkingHours(overnight, ubLocal(6, 0))).toBe(true);
    });

    it('returns false during the day (13:00)', () => {
      expect(isWithinWorkingHours(overnight, ubLocal(13, 0))).toBe(false);
    });

    it('returns false just after end (06:01)', () => {
      expect(isWithinWorkingHours(overnight, ubLocal(6, 1))).toBe(false);
    });
  });
});
