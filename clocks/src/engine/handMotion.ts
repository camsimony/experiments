import {normalizeAngle} from './handAngles';

export function angleToTransform(angle: number, centerX: number, centerY: number): string {
  const normalized = Number(normalizeAngle(angle).toFixed(4));
  return `rotate(${normalized} ${centerX} ${centerY})`;
}

export function shortestAngleDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function settledSecondAngle(rawAngle: number, nowMs: number, settleAmount: number, settleDurationMs: number): number {
  if (settleDurationMs <= 0 || settleAmount === 0) return rawAngle;

  const elapsed = nowMs % 1000;
  if (elapsed > settleDurationMs) return rawAngle;

  const progress = elapsed / settleDurationMs;
  const decay = Math.pow(1 - progress, 3);
  const wobble = Math.sin(progress * Math.PI * 2.2) * decay;

  return rawAngle + wobble * settleAmount;
}
