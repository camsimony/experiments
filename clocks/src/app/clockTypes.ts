import type {MutableRefObject, RefObject} from 'react';

import type {ScrubTime, ClockMode} from '../engine/time';

export type MotionMode = 'continuous' | 'tick-settle';

export type ClockRuntimeTheme = {
  pageBg: string;
  paperColor: string;
  wordColor: string;
  wordGradientStart: string;
  wordGradientEnd: string;
  hourHandColor: string;
  hourHandEndColor: string;
  hourHandBorderColor: string;
  minuteHandColor: string;
  minuteHandEndColor: string;
  minuteHandSoftColor: string;
  minuteHandBorderColor: string;
  secondHandColor: string;
  secondHandEndColor: string;
  secondHandBorderColor: string;
  centerPinColor: string;
  centerPinEndColor: string;
  centerPinStrokeColor: string;
};

export type ClockRuntimeParams = {
  mode: ClockMode;
  motionMode: MotionMode;
  scrubTime: ScrubTime;
  theme: ClockRuntimeTheme;
  visuals: {
    hourHandWidth: number;
    minuteHandWidth: number;
    minuteHandBlur: number;
    secondHandWidth: number;
    centerPinRadius: number;
    artboardScale: number;
  };
  motion: {
    settleAmount: number;
    settleDurationMs: number;
  };
  themeSwitch: {
    isPressing: boolean;
    releaseToken: number;
    inwardPull: number;
    scaleDip: number;
    maxRotation: number;
    pressSmoothing: number;
    releaseSmoothing: number;
    releaseIgnoreMs: number;
    transitionDurationMs: number;
    transitionEaseIn: number;
  };
  wordMagnet: {
    previewMagnet: boolean;
    previewX: number;
    previewY: number;
    maxPull: number;
    basePull: number;
    falloffDistance: number;
    maxScaleLift: number;
    cursorCapture: number;
    activationFeather: number;
    followSmoothing: number;
    returnSmoothing: number;
  };
  easterEgg: {
    knicksMode: boolean;
    triggerToken: number;
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
  motionMode: 'tick-settle',
  scrubTime: {hour: 10, minute: 8, second: 34},
  theme: {
    pageBg: 'oklch(0.997 0.004 91.445)',
    paperColor: 'oklch(0.997 0.004 91.445)',
    wordColor: 'oklch(0.618 0.159 147.291)',
    wordGradientStart: 'oklch(0.653 0.148 148.486)',
    wordGradientEnd: 'oklch(0.554 0.141 147.45)',
    hourHandColor: 'oklch(0.123 0.007 87.645)',
    hourHandEndColor: 'oklch(0.115 0.008 88.284)',
    hourHandBorderColor: 'oklch(1 0 0 / 0.32)',
    minuteHandColor: 'oklch(0.16 0.009 84.696)',
    minuteHandEndColor: 'oklch(0.155 0.009 85.192)',
    minuteHandSoftColor: 'oklch(0.16 0.009 84.696 / 0.22)',
    minuteHandBorderColor: 'oklch(1 0 0 / 0.28)',
    secondHandColor: 'oklch(0.522 0.192 19.552)',
    secondHandEndColor: 'oklch(0.482 0.176 19.392)',
    secondHandBorderColor: 'oklch(0.28 0.094 17.407 / 0.18)',
    centerPinColor: 'oklch(0.511 0.196 21.199)',
    centerPinEndColor: 'oklch(0.471 0.18 20.942)',
    centerPinStrokeColor: 'oklch(1 0 0 / 0.36)',
  },
  visuals: {
    hourHandWidth: 7,
    minuteHandWidth: 4.5,
    minuteHandBlur: 6,
    secondHandWidth: 1.5,
    centerPinRadius: 4,
    artboardScale: 1,
  },
  motion: {
    settleAmount: 2.4,
    settleDurationMs: 210,
  },
  themeSwitch: {
    isPressing: false,
    releaseToken: 0,
    inwardPull: 18,
    scaleDip: 0.035,
    maxRotation: 5.5,
    pressSmoothing: 0.39,
    releaseSmoothing: 0.25,
    releaseIgnoreMs: 520,
    transitionDurationMs: 80,
    transitionEaseIn: 0.26,
  },
  wordMagnet: {
    previewMagnet: false,
    previewX: 438,
    previewY: 218,
    maxPull: 25,
    basePull: 1.5,
    falloffDistance: 235,
    maxScaleLift: 0.17,
    cursorCapture: 0.2,
    activationFeather: 72,
    followSmoothing: 0.19,
    returnSmoothing: 0.22,
  },
  easterEgg: {
    knicksMode: false,
    triggerToken: 0,
  },
};
