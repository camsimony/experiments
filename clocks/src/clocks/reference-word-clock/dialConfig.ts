import type {DialConfig} from 'dialkit';

import {REFERENCE_CLOCK_THEME_PRESETS} from './themes';

const themeOptions = REFERENCE_CLOCK_THEME_PRESETS.map((theme, index) => ({value: String(index), label: theme.name}));

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
    hourHandWidth: [5.2, 1, 14, 0.1],
    minuteHandWidth: [5.8, 1, 14, 0.1],
    minuteHandBlur: [0.75, 0, 6, 0.05],
    secondHandWidth: [2, 0.5, 8, 0.1],
    centerPinRadius: [4, 1, 14, 0.1],
    artboardScale: [1, 0.7, 1.25, 0.01],
  },
  WordMagnet: {
    previewMagnet: false,
    previewX: [438, 0, 524, 1],
    previewY: [218, 0, 420, 1],
    maxPull: [25, 0, 42, 0.5],
    basePull: [1.5, 0, 8, 0.1],
    falloffDistance: [235, 80, 340, 5],
    maxScaleLift: [0.17, 0, 0.22, 0.005],
    cursorCapture: [0.2, 0.2, 1.2, 0.01],
    activationFeather: [72, 12, 140, 1],
    followSmoothing: [0.19, 0.05, 0.9, 0.01],
    returnSmoothing: [0.22, 0.05, 0.8, 0.01],
  },
} satisfies DialConfig;

export const themeDialConfig = {
  Active: {
    theme: {type: 'select', options: themeOptions, default: '0'},
  },
  Reference: {
    pageBg: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[0].pageBg},
    wordColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[0].wordColor},
    hourHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[0].hourHandColor},
    minuteHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[0].minuteHandColor},
    secondHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[0].secondHandColor},
    centerPinColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[0].centerPinColor},
  },
  Blueprint: {
    pageBg: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[1].pageBg},
    wordColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[1].wordColor},
    hourHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[1].hourHandColor},
    minuteHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[1].minuteHandColor},
    secondHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[1].secondHandColor},
    centerPinColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[1].centerPinColor},
  },
  Licorice: {
    pageBg: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[2].pageBg},
    wordColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[2].wordColor},
    hourHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[2].hourHandColor},
    minuteHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[2].minuteHandColor},
    secondHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[2].secondHandColor},
    centerPinColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[2].centerPinColor},
  },
  Sorbet: {
    pageBg: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[3].pageBg},
    wordColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[3].wordColor},
    hourHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[3].hourHandColor},
    minuteHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[3].minuteHandColor},
    secondHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[3].secondHandColor},
    centerPinColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[3].centerPinColor},
  },
  Moss: {
    pageBg: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[4].pageBg},
    wordColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[4].wordColor},
    hourHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[4].hourHandColor},
    minuteHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[4].minuteHandColor},
    secondHandColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[4].secondHandColor},
    centerPinColor: {type: 'color', default: REFERENCE_CLOCK_THEME_PRESETS[4].centerPinColor},
  },
} satisfies DialConfig;

type ThemeColorDialValues = {
  pageBg: string;
  wordColor: string;
  hourHandColor: string;
  minuteHandColor: string;
  secondHandColor: string;
  centerPinColor: string;
};

export type ThemeDialValues = {
  Active: {
    theme: string;
  };
  Reference: ThemeColorDialValues;
  Blueprint: ThemeColorDialValues;
  Licorice: ThemeColorDialValues;
  Sorbet: ThemeColorDialValues;
  Moss: ThemeColorDialValues;
};

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
    hourHandWidth: number;
    minuteHandWidth: number;
    minuteHandBlur: number;
    secondHandWidth: number;
    centerPinRadius: number;
    artboardScale: number;
  };
  WordMagnet: {
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
