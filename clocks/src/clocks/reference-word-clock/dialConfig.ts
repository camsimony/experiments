import type {DialConfig} from 'dialkit';

import {DEFAULT_RANDOM_SOUND_COLLECTION, SND_KIT_OPTIONS, SND_SOUND_OPTIONS} from '../../engine/themeSwitchSound';
import {REFERENCE_CLOCK_THEME_PRESETS, toHexColorInput} from './themes';

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
    hourHandWidth: [7, 1, 14, 0.1],
    minuteHandWidth: [4.5, 1, 14, 0.1],
    minuteHandBlur: [6, 0, 6, 0.05],
    secondHandWidth: [1.5, 0.5, 8, 0.1],
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
  SwitchMotion: {
    inwardPull: [18, 0, 54, 1],
    scaleDip: [0.035, 0, 0.12, 0.005],
    maxRotation: [5.5, 0, 14, 0.1],
    pressSmoothing: [0.39, 0.05, 0.9, 0.01],
    releaseSmoothing: [0.25, 0.08, 0.95, 0.01],
    releaseIgnoreMs: [520, 80, 520, 10],
    transitionDurationMs: [80, 0, 1200, 10],
    transitionEaseIn: [0.26, 0, 0.9, 0.01],
  },
  Reference: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[0].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[0].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[0].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[0].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[0].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[0].centerPinColor)},
  },
  Blueprint: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[1].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[1].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[1].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[1].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[1].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[1].centerPinColor)},
  },
  Licorice: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[2].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[2].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[2].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[2].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[2].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[2].centerPinColor)},
  },
  Sorbet: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[3].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[3].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[3].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[3].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[3].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[3].centerPinColor)},
  },
  Moss: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[4].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[4].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[4].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[4].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[4].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[4].centerPinColor)},
  },
  Umber: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[5].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[5].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[5].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[5].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[5].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[5].centerPinColor)},
  },
  Indigo: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[6].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[6].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[6].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[6].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[6].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[6].centerPinColor)},
  },
  Mulberry: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[7].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[7].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[7].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[7].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[7].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[7].centerPinColor)},
  },
  Juniper: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[8].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[8].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[8].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[8].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[8].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[8].centerPinColor)},
  },
  Bone: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[9].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[9].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[9].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[9].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[9].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[9].centerPinColor)},
  },
  Slate: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[10].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[10].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[10].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[10].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[10].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[10].centerPinColor)},
  },
  Kelp: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[11].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[11].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[11].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[11].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[11].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[11].centerPinColor)},
  },
  Cinder: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[12].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[12].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[12].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[12].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[12].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[12].centerPinColor)},
  },
  Orchid: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[13].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[13].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[13].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[13].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[13].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[13].centerPinColor)},
  },
  Tobacco: {
    pageBg: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[14].pageBg)},
    wordColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[14].wordColor)},
    hourHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[14].hourHandColor)},
    minuteHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[14].minuteHandColor)},
    secondHandColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[14].secondHandColor)},
    centerPinColor: {type: 'color', default: toHexColorInput(REFERENCE_CLOCK_THEME_PRESETS[14].centerPinColor)},
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

export const soundDialConfig = {
  enabled: true,
  randomize: true,
  kit: {type: 'select', options: SND_KIT_OPTIONS, default: '01'},
  sound: {type: 'select', options: SND_SOUND_OPTIONS, default: 'select'},
  volume: [0.32, 0, 1, 0.01],
  RandomCollection: DEFAULT_RANDOM_SOUND_COLLECTION,
} satisfies DialConfig;

export type ThemeDialValues = {
  Active: {
    theme: string;
  };
  SwitchMotion: {
    inwardPull: number;
    scaleDip: number;
    maxRotation: number;
    pressSmoothing: number;
    releaseSmoothing: number;
    releaseIgnoreMs: number;
    transitionDurationMs: number;
    transitionEaseIn: number;
  };
  Reference: ThemeColorDialValues;
  Blueprint: ThemeColorDialValues;
  Licorice: ThemeColorDialValues;
  Sorbet: ThemeColorDialValues;
  Moss: ThemeColorDialValues;
  Umber: ThemeColorDialValues;
  Indigo: ThemeColorDialValues;
  Mulberry: ThemeColorDialValues;
  Juniper: ThemeColorDialValues;
  Bone: ThemeColorDialValues;
  Slate: ThemeColorDialValues;
  Kelp: ThemeColorDialValues;
  Cinder: ThemeColorDialValues;
  Orchid: ThemeColorDialValues;
  Tobacco: ThemeColorDialValues;
};

export type SoundDialValues = {
  enabled: boolean;
  randomize: boolean;
  kit: string;
  sound: string;
  volume: number;
  RandomCollection: Record<string, boolean>;
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
