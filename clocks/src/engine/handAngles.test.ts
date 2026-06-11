import {describe, expect, it} from 'vitest';
import {calculateHandAngles, normalizeAngle} from './handAngles';

describe('calculateHandAngles', () => {
  it('sets all hands to zero at noon', () => {
    const date = new Date(2026, 5, 11, 12, 0, 0, 0);

    expect(calculateHandAngles(date)).toEqual({hour: 0, minute: 0, second: 0});
  });

  it('calculates continuous hour, minute, and second angles including milliseconds', () => {
    const date = new Date(2026, 5, 11, 3, 15, 30, 500);

    expect(calculateHandAngles(date).hour).toBeCloseTo(97.754166, 5);
    expect(calculateHandAngles(date).minute).toBeCloseTo(93.05, 5);
    expect(calculateHandAngles(date).second).toBeCloseTo(183, 5);
  });

  it('normalizes negative and overflowing angles into one rotation', () => {
    expect(normalizeAngle(-15)).toBe(345);
    expect(normalizeAngle(725)).toBe(5);
  });
});
