import type {ClockRuntimeTheme} from '../../app/clockTypes';

export type ReferenceClockThemePreset = {
  name: string;
  pageBg: string;
  wordColor: string;
  hourHandColor: string;
  minuteHandColor: string;
  secondHandColor: string;
  centerPinColor: string;
};

export const REFERENCE_CLOCK_THEME_PRESETS = [
  {
    name: 'Reference',
    pageBg: '#fffefb',
    wordColor: '#2f9e48',
    hourHandColor: '#070604',
    minuteHandColor: '#0f0d09',
    secondHandColor: '#bf1f39',
    centerPinColor: '#bd1430',
  },
  {
    name: 'Blueprint',
    pageBg: '#f4f8ff',
    wordColor: '#2457d6',
    hourHandColor: '#101a33',
    minuteHandColor: '#27406f',
    secondHandColor: '#ff6a3d',
    centerPinColor: '#ff6a3d',
  },
  {
    name: 'Licorice',
    pageBg: '#16120f',
    wordColor: '#f1c75b',
    hourHandColor: '#fff4d7',
    minuteHandColor: '#d7a844',
    secondHandColor: '#ef5b4c',
    centerPinColor: '#ef5b4c',
  },
  {
    name: 'Sorbet',
    pageBg: '#fff1ea',
    wordColor: '#e35d83',
    hourHandColor: '#4b2631',
    minuteHandColor: '#8d4657',
    secondHandColor: '#1b9a8f',
    centerPinColor: '#1b9a8f',
  },
  {
    name: 'Moss',
    pageBg: '#f4f1df',
    wordColor: '#647a2f',
    hourHandColor: '#202616',
    minuteHandColor: '#55613b',
    secondHandColor: '#c9572c',
    centerPinColor: '#c9572c',
  },
] satisfies ReferenceClockThemePreset[];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function expandHex(hex: string) {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return clean
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }
  return clean.padEnd(6, '0').slice(0, 6);
}

function toRgb(hex: string) {
  const expanded = expandHex(hex);
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function toHexChannel(value: number) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

function mix(hex: string, target: string, amount: number) {
  const color = toRgb(hex);
  const targetColor = toRgb(target);
  return `#${toHexChannel(color.r + (targetColor.r - color.r) * amount)}${toHexChannel(color.g + (targetColor.g - color.g) * amount)}${toHexChannel(color.b + (targetColor.b - color.b) * amount)}`;
}

function rgba(hex: string, alpha: number) {
  const {r, g, b} = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildClockThemeRuntime(theme: ReferenceClockThemePreset): ClockRuntimeTheme {
  return {
    pageBg: theme.pageBg,
    paperColor: theme.pageBg,
    wordColor: theme.wordColor,
    wordGradientStart: mix(theme.wordColor, '#ffffff', 0.08),
    wordGradientEnd: mix(theme.wordColor, '#000000', 0.14),
    hourHandColor: theme.hourHandColor,
    hourHandEndColor: mix(theme.hourHandColor, '#000000', 0.16),
    hourHandBorderColor: rgba(mix(theme.pageBg, '#ffffff', 0.38), 0.32),
    minuteHandColor: theme.minuteHandColor,
    minuteHandEndColor: mix(theme.minuteHandColor, '#000000', 0.1),
    minuteHandSoftColor: rgba(theme.minuteHandColor, 0.22),
    minuteHandBorderColor: rgba(mix(theme.pageBg, '#ffffff', 0.42), 0.28),
    secondHandColor: theme.secondHandColor,
    secondHandEndColor: mix(theme.secondHandColor, '#000000', 0.1),
    secondHandBorderColor: rgba(mix(theme.secondHandColor, '#000000', 0.35), 0.18),
    centerPinColor: theme.centerPinColor,
    centerPinEndColor: mix(theme.centerPinColor, '#000000', 0.12),
    centerPinStrokeColor: rgba(mix(theme.pageBg, '#ffffff', 0.5), 0.36),
  };
}
