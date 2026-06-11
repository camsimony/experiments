export type ClockMode = 'live' | 'scrub';

export type ScrubTime = {
  hour: number;
  minute: number;
  second: number;
};

type RuntimeDateInput = {
  mode: ClockMode;
  now: Date;
  scrubTime: ScrubTime;
};

function wrap(value: number, max: number): number {
  return ((Math.trunc(value) % max) + max) % max;
}

export function buildScrubDate(scrubTime: ScrubTime, baseDate = new Date()): Date {
  const date = new Date(baseDate);
  date.setHours(wrap(scrubTime.hour, 24), wrap(scrubTime.minute, 60), wrap(scrubTime.second, 60), 0);
  return date;
}

export function getRuntimeDate({mode, now, scrubTime}: RuntimeDateInput): Date {
  if (mode === 'live') return now;
  return buildScrubDate(scrubTime, now);
}

export function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
