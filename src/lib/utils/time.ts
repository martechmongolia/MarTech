type RelativeTimeLocale = {
  now: string;
  pastMinutes: (n: number) => string;
  pastHours: (n: number) => string;
  pastDays: (n: number) => string;
  futureMinutes: (n: number) => string;
  futureHours: (n: number) => string;
  futureDays: (n: number) => string;
};

const locales: Record<string, RelativeTimeLocale> = {
  en: {
    now: "Just now",
    pastMinutes: (n) => `${n}m ago`,
    pastHours: (n) => `${n}h ago`,
    pastDays: (n) => `${n}d ago`,
    futureMinutes: (n) => `in ${n}m`,
    futureHours: (n) => `in ${n}h`,
    futureDays: (n) => `in ${n}d`,
  },
  mn: {
    now: "Дөнгөж сая",
    pastMinutes: (n) => `${n} минутын өмнө`,
    pastHours: (n) => `${n} цагийн өмнө`,
    pastDays: (n) => `${n} өдрийн өмнө`,
    futureMinutes: (n) => `${n} минутын дараа`,
    futureHours: (n) => `${n} цагийн дараа`,
    futureDays: (n) => `${n} өдрийн дараа`,
  },
};

/**
 * Format a date string as a human-readable relative time (e.g. "3m ago", "in 2d").
 * Handles both past and future dates. Returns "—" for null/invalid inputs.
 */
export function formatRelativeTime(dateStr: string | null | undefined, locale: "en" | "mn" = "en"): string {
  if (!dateStr) return "—";
  try {
    const l = locales[locale];
    const diff = Date.now() - new Date(dateStr).getTime();
    const isPast = diff >= 0;
    const absDiff = Math.abs(diff);
    const mins = Math.floor(absDiff / 60000);
    if (mins < 1) return l.now;
    if (mins < 60) return isPast ? l.pastMinutes(mins) : l.futureMinutes(mins);
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return isPast ? l.pastHours(hrs) : l.futureHours(hrs);
    const days = Math.floor(hrs / 24);
    return isPast ? l.pastDays(days) : l.futureDays(days);
  } catch {
    return "—";
  }
}
