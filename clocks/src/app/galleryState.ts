export const DEFAULT_CLOCK_ID = 'reference-word-clock';

export function getInitialClockId(availableIds: string[], hash = window.location.hash): string {
  const candidate = hash.replace(/^#/, '');
  if (candidate && availableIds.includes(candidate)) return candidate;
  return DEFAULT_CLOCK_ID;
}
