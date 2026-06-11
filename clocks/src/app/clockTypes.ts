import type {MutableRefObject, RefObject} from 'react';

import type {ScrubTime, ClockMode} from '../engine/time';

export type MotionMode = 'continuous' | 'tick-settle';

export type ClockRuntimeParams = {
  mode: ClockMode;
  motionMode: MotionMode;
  scrubTime: ScrubTime;
  visuals: {
    wordColor: string;
    secondHandColor: string;
    hourHandWidth: number;
    minuteHandWidth: number;
    secondHandWidth: number;
    centerPinRadius: number;
    artboardScale: number;
  };
  motion: {
    settleAmount: number;
    settleDurationMs: number;
  };
};

export type ClockHandRefs = {
  hour: RefObject<SVGGElement | null>;
  minute: RefObject<SVGGElement | null>;
  second: RefObject<SVGGElement | null>;
};

export type ClockProps = {
  clockId: string;
  runtimeParamsRef: MutableRefObject<ClockRuntimeParams>;
  reducedMotion: boolean;
};

export type ClockDefinition = {
  id: string;
  name: string;
  Component: React.ComponentType<ClockProps>;
};

export const DEFAULT_RUNTIME_PARAMS: ClockRuntimeParams = {
  mode: 'live',
  motionMode: 'continuous',
  scrubTime: {hour: 10, minute: 8, second: 34},
  visuals: {
    wordColor: '#2f9e48',
    secondHandColor: '#bf1f39',
    hourHandWidth: 5.2,
    minuteHandWidth: 5.8,
    secondHandWidth: 2,
    centerPinRadius: 4,
    artboardScale: 1,
  },
  motion: {
    settleAmount: 2.4,
    settleDurationMs: 210,
  },
};
