import {useEffect} from 'react';

import type {ClockHandRefs, ClockRuntimeParams} from '../app/clockTypes';
import {calculateHandAngles} from './handAngles';
import {angleToTransform, settledSecondAngle} from './handMotion';
import {getRuntimeDate} from './time';

type UseClockRuntimeInput = {
  hands: ClockHandRefs;
  runtimeParamsRef: React.MutableRefObject<ClockRuntimeParams>;
  reducedMotion: boolean;
  centerX: number;
  centerY: number;
};

export function useClockRuntime({hands, runtimeParamsRef, reducedMotion, centerX, centerY}: UseClockRuntimeInput): void {
  useEffect(() => {
    let frame = 0;
    let cancelled = false;

    const render = () => {
      if (cancelled) return;

      const params = runtimeParamsRef.current;
      const now = new Date();
      const runtimeDate = getRuntimeDate({mode: params.mode, now, scrubTime: params.scrubTime});
      const angles = calculateHandAngles(runtimeDate);
      const secondAngle = params.motionMode === 'tick-settle' && !reducedMotion
        ? settledSecondAngle(Math.floor(angles.second / 6) * 6, now.getMilliseconds(), params.motion.settleAmount, params.motion.settleDurationMs)
        : angles.second;

      const minuteTransform = angleToTransform(angles.minute, centerX, centerY);

      hands.hour.current?.setAttribute('transform', angleToTransform(angles.hour, centerX, centerY));
      hands.minute.current?.setAttribute('transform', minuteTransform);
      hands.minuteBackdrop?.current?.setAttribute('transform', minuteTransform);
      hands.second.current?.setAttribute('transform', angleToTransform(secondAngle, centerX, centerY));

      frame = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [centerX, centerY, hands.hour, hands.minute, hands.second, reducedMotion, runtimeParamsRef]);
}
