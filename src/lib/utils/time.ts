type RelativeTimeLocale = {
  now: string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  days: (n: number) => string;
};

const locales: Record<string, RelativeTimeLocale> = {
  en: {
    now: "Just now",
    minutes: (n) => `${n}m ago`,
    hours: (n) => `${n}h ago`,
    days: (n) => `${n}d ago`,
  },
  mn: {
    now: "Дөнгөж сая",
    minutes: (n) => `${n}м өмнө`,
    hours: (n) => `${n}ц өмнө`,
    days: (n) => `${n}ө өмнө`,
  },
};

/**
 * Format a date string as a human-readable relative time (e.g. "3m ago", "2h ago").
 * Returns "—" for null/invalid inputs.
 */
export function formatRelativeTime(dateStr: string | null | undefined, locale: "en" | "mn" = "en"): string {
  if (!dateStr) return "—";
  try {
    const l = locales[locale];
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return l.now;
    if (mins < 60) return l.minutes(mins);
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return l.hours(hrs);
    const days = Math.floor(hrs / 24);
    return l.days(days);
  } catch {
    return "—";
  }
}
