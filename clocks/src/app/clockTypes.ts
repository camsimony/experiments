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
    pressSmoothing: number;
    releaseSmoothing: number;
    releaseIgnoreMs: number;
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
  theme: {
    pageBg: '#fffefb',
    paperColor: '#fffefb',
    wordColor: '#2f9e48',
    wordGradientStart: '#42a85a',
    wordGradientEnd: '#28883e',
    hourHandColor: '#070604',
    hourHandEndColor: '#060503',
    hourHandBorderColor: 'rgba(255, 255, 255, 0.32)',
    minuteHandColor: '#0f0d09',
    minuteHandEndColor: '#0e0c08',
    minuteHandSoftColor: 'rgba(15, 13, 9, 0.22)',
    minuteHandBorderColor: 'rgba(255, 255, 255, 0.28)',
    secondHandColor: '#bf1f39',
    secondHandEndColor: '#ab1c33',
    secondHandBorderColor: 'rgba(77, 13, 23, 0.18)',
    centerPinColor: '#bd1430',
    centerPinEndColor: '#a9122b',
    centerPinStrokeColor: 'rgba(255, 255, 255, 0.36)',
  },
  visuals: {
    hourHandWidth: 5.2,
    minuteHandWidth: 5.8,
    minuteHandBlur: 0.75,
    secondHandWidth: 2,
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
    pressSmoothing: 0.24,
    releaseSmoothing: 0.58,
    releaseIgnoreMs: 220,
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
};
