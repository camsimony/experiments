import type {DialConfig} from 'dialkit';

export const runtimeDialConfig = {
  Time: {
    mode: {type: 'select', options: ['live', 'scrub'], default: 'live'},
    hour: [10, 0, 23, 1],
    minute: [8, 0, 59, 1],
    second: [34, 0, 59, 1],
  },
  Motion: {
    mode: {type: 'select', options: ['continuous', 'tick-settle'], default: 'continuous'},
    settleAmount: [2.4, 0, 12, 0.1],
    settleDurationMs: [210, 80, 600, 10],
  },
  Visuals: {
    wordColor: {type: 'color', default: '#2f9e48'},
    secondHandColor: {type: 'color', default: '#bf1f39'},
    hourHandWidth: [5.2, 1, 14, 0.1],
    minuteHandWidth: [5.8, 1, 14, 0.1],
    minuteHandBlur: [0.75, 0, 6, 0.05],
    secondHandWidth: [2, 0.5, 8, 0.1],
    centerPinRadius: [4, 1, 14, 0.1],
    artboardScale: [1, 0.7, 1.25, 0.01],
  },
} satisfies DialConfig;

export type RuntimeDialValues = {
  Time: {
    mode: string;
    hour: number;
    minute: number;
    second: number;
  };
  Motion: {
    mode: string;
    settleAmount: number;
    settleDurationMs: number;
  };
  Visuals: {
    wordColor: string;
    secondHandColor: string;
    hourHandWidth: number;
    minuteHandWidth: number;
    minuteHandBlur: number;
    secondHandWidth: number;
    centerPinRadius: number;
    artboardScale: number;
  };
};
