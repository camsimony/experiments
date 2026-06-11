import {describe, expect, it, vi} from 'vitest';
import {buildScrubDate, getRuntimeDate, shouldReduceMotion} from './time';

describe('buildScrubDate', () => {
  it('builds a stable synthetic date from scrubbed time fields', () => {
    const date = buildScrubDate({hour: 23, minute: 4, second: 9});

    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(4);
    expect(date.getSeconds()).toBe(9);
    expect(date.getMilliseconds()).toBe(0);
  });

  it('wraps overflowing scrub fields into valid time ranges', () => {
    const date = buildScrubDate({hour: 25, minute: 61, second: 62});

    expect(date.getHours()).toBe(1);
    expect(date.getMinutes()).toBe(1);
    expect(date.getSeconds()).toBe(2);
  });
});

describe('getRuntimeDate', () => {
  it('returns live now when mode is live', () => {
    const now = new Date('2026-06-11T10:20:30.000Z');

    expect(getRuntimeDate({mode: 'live', now, scrubTime: {hour: 1, minute: 2, second: 3}})).toBe(now);
  });

  it('returns scrubbed time when mode is scrub', () => {
    const now = new Date('2026-06-11T10:20:30.000Z');
    const date = getRuntimeDate({mode: 'scrub', now, scrubTime: {hour: 7, minute: 8, second: 9}});

    expect(date.getHours()).toBe(7);
    expect(date.getMinutes()).toBe(8);
    expect(date.getSeconds()).toBe(9);
  });
});

describe('shouldReduceMotion', () => {
  it('returns false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(shouldReduceMotion()).toBe(false);

    vi.unstubAllGlobals();
  });

  it('returns the reduced motion media query result', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      media: query,
      matches: query === '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(shouldReduceMotion()).toBe(true);

    vi.unstubAllGlobals();
  });
});
