import {describe, expect, it} from 'vitest';
import {angleToTransform, shortestAngleDelta} from './handMotion';

describe('angleToTransform', () => {
  it('rotates around the supplied center point', () => {
    expect(angleToTransform(90, 210, 262)).toBe('rotate(90 210 262)');
  });
});

describe('shortestAngleDelta', () => {
  it('returns the shortest signed path across zero degrees', () => {
    expect(shortestAngleDelta(358, 2)).toBe(4);
    expect(shortestAngleDelta(2, 358)).toBe(-4);
  });
});
