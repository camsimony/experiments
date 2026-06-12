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

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export const REFERENCE_CLOCK_THEME_PRESETS = [
  {
    name: 'Reference',
    pageBg: 'oklch(0.997 0.004 91.445)',
    wordColor: 'oklch(0.618 0.159 147.291)',
    hourHandColor: 'oklch(0.123 0.007 87.645)',
    minuteHandColor: 'oklch(0.16 0.009 84.696)',
    secondHandColor: 'oklch(0.522 0.192 19.552)',
    centerPinColor: 'oklch(0.511 0.196 21.199)',
  },
  {
    name: 'Blueprint',
    pageBg: 'oklch(0.978 0.01 261.789)',
    wordColor: 'oklch(0.505 0.203 263.881)',
    hourHandColor: 'oklch(0.223 0.051 265.973)',
    minuteHandColor: 'oklch(0.376 0.087 261.939)',
    secondHandColor: 'oklch(0.704 0.192 37.126)',
    centerPinColor: 'oklch(0.704 0.192 37.126)',
  },
  {
    name: 'Licorice',
    pageBg: 'oklch(0.186 0.009 59.061)',
    wordColor: 'oklch(0.846 0.134 87.909)',
    hourHandColor: 'oklch(0.968 0.04 89.685)',
    minuteHandColor: 'oklch(0.757 0.128 83.223)',
    secondHandColor: 'oklch(0.663 0.185 28.8)',
    centerPinColor: 'oklch(0.663 0.185 28.8)',
  },
  {
    name: 'Sorbet',
    pageBg: 'oklch(0.967 0.018 48.531)',
    wordColor: 'oklch(0.658 0.17 5.363)',
    hourHandColor: 'oklch(0.322 0.057 1.789)',
    minuteHandColor: 'oklch(0.488 0.098 6.18)',
    secondHandColor: 'oklch(0.62 0.104 185.665)',
    centerPinColor: 'oklch(0.62 0.104 185.665)',
  },
  {
    name: 'Moss',
    pageBg: 'oklch(0.956 0.024 99.108)',
    wordColor: 'oklch(0.545 0.105 123.61)',
    hourHandColor: 'oklch(0.257 0.03 125.136)',
    minuteHandColor: 'oklch(0.472 0.059 122.937)',
    secondHandColor: 'oklch(0.595 0.156 39.946)',
    centerPinColor: 'oklch(0.595 0.156 39.946)',
  },
  {
    name: 'Umber',
    pageBg: 'oklch(0.294 0.045 54)',
    wordColor: 'oklch(0.807 0.07 70)',
    hourHandColor: 'oklch(0.89 0.045 72)',
    minuteHandColor: 'oklch(0.68 0.055 63)',
    secondHandColor: 'oklch(0.71 0.12 39)',
    centerPinColor: 'oklch(0.71 0.12 39)',
  },
  {
    name: 'Indigo',
    pageBg: 'oklch(0.245 0.061 282)',
    wordColor: 'oklch(0.795 0.052 288)',
    hourHandColor: 'oklch(0.9 0.035 286)',
    minuteHandColor: 'oklch(0.635 0.06 283)',
    secondHandColor: 'oklch(0.79 0.114 197)',
    centerPinColor: 'oklch(0.79 0.114 197)',
  },
  {
    name: 'Mulberry',
    pageBg: 'oklch(0.31 0.075 345)',
    wordColor: 'oklch(0.81 0.078 352)',
    hourHandColor: 'oklch(0.9 0.042 2)',
    minuteHandColor: 'oklch(0.66 0.075 350)',
    secondHandColor: 'oklch(0.77 0.132 28)',
    centerPinColor: 'oklch(0.77 0.132 28)',
  },
  {
    name: 'Juniper',
    pageBg: 'oklch(0.28 0.047 160)',
    wordColor: 'oklch(0.79 0.066 147)',
    hourHandColor: 'oklch(0.88 0.042 139)',
    minuteHandColor: 'oklch(0.62 0.052 151)',
    secondHandColor: 'oklch(0.73 0.115 78)',
    centerPinColor: 'oklch(0.73 0.115 78)',
  },
  {
    name: 'Bone',
    pageBg: 'oklch(0.914 0.024 83)',
    wordColor: 'oklch(0.43 0.055 67)',
    hourHandColor: 'oklch(0.235 0.025 63)',
    minuteHandColor: 'oklch(0.54 0.042 70)',
    secondHandColor: 'oklch(0.58 0.105 32)',
    centerPinColor: 'oklch(0.58 0.105 32)',
  },
] satisfies ReferenceClockThemePreset[];

const WHITE = 'oklch(1 0 0)';
const BLACK = 'oklch(0 0 0)';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value: number) {
  const formatted = value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return formatted === '-0' ? '0' : formatted;
}

function formatOklch(lightness: number, chroma: number, hue: number, alpha = 1) {
  const channels = `${formatNumber(lightness)} ${formatNumber(chroma)} ${formatNumber(hue)}`;
  return alpha < 1 ? `oklch(${channels} / ${formatNumber(alpha)})` : `oklch(${channels})`;
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

function parseHexColor(hex: string): RgbColor {
  const expanded = expandHex(hex);
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function parseOklchColor(color: string) {
  const match = color.match(/oklch\(\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.-]+))?\s*\)/i);
  if (!match) return null;

  return {
    lightness: Number.parseFloat(match[1]),
    chroma: Number.parseFloat(match[2]),
    hue: Number.parseFloat(match[3]),
    alpha: match[4] ? Number.parseFloat(match[4]) : 1,
  };
}

function linearToSrgb(value: number) {
  const clamped = clamp(value, 0, 1);
  if (clamped <= 0.0031308) return clamped * 12.92;
  return 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function srgbToLinear(value: number) {
  const channel = value / 255;
  if (channel <= 0.04045) return channel / 12.92;
  return ((channel + 0.055) / 1.055) ** 2.4;
}

function oklchToRgb(color: string): RgbColor {
  const parsed = parseOklchColor(color);
  if (!parsed) return parseHexColor(color);

  const hueRadians = (parsed.hue * Math.PI) / 180;
  const a = parsed.chroma * Math.cos(hueRadians);
  const b = parsed.chroma * Math.sin(hueRadians);
  const lPrime = parsed.lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = parsed.lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = parsed.lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  return {
    r: Math.round(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * 255),
    g: Math.round(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) * 255),
    b: Math.round(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) * 255),
  };
}

function rgbToOklch({r, g, b}: RgbColor, alpha = 1) {
  const red = srgbToLinear(r);
  const green = srgbToLinear(g);
  const blue = srgbToLinear(b);
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lPrime = Math.cbrt(l);
  const mPrime = Math.cbrt(m);
  const sPrime = Math.cbrt(s);
  const lightness = 0.2104542553 * lPrime + 0.793617785 * mPrime - 0.0040720468 * sPrime;
  const a = 1.9779984951 * lPrime - 2.428592205 * mPrime + 0.4505937099 * sPrime;
  const oklabB = 0.0259040371 * lPrime + 0.7827717662 * mPrime - 0.808675766 * sPrime;
  const chroma = Math.sqrt(a * a + oklabB * oklabB);
  const hue = chroma < 0.0005 ? 0 : (Math.atan2(oklabB, a) * 180) / Math.PI;

  return formatOklch(lightness, chroma, hue < 0 ? hue + 360 : hue, alpha);
}

function toRgb(color: string): RgbColor {
  return color.trim().startsWith('oklch(') ? oklchToRgb(color) : parseHexColor(color);
}

function toHexChannel(value: number) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

export function toHexColorInput(color: string) {
  const {r, g, b} = toRgb(color);
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;
}

function toOklch(color: string, alpha = 1) {
  const parsed = parseOklchColor(color);
  if (parsed) return formatOklch(parsed.lightness, parsed.chroma, parsed.hue, alpha < 1 ? alpha : parsed.alpha);
  return rgbToOklch(parseHexColor(color), alpha);
}

function mix(color: string, target: string, amount: number) {
  const sourceColor = toRgb(color);
  const targetColor = toRgb(target);
  return rgbToOklch({
    r: sourceColor.r + (targetColor.r - sourceColor.r) * amount,
    g: sourceColor.g + (targetColor.g - sourceColor.g) * amount,
    b: sourceColor.b + (targetColor.b - sourceColor.b) * amount,
  });
}

function withAlpha(color: string, alpha: number) {
  return toOklch(color, alpha);
}

export function buildClockThemeRuntime(theme: ReferenceClockThemePreset): ClockRuntimeTheme {
  return {
    pageBg: toOklch(theme.pageBg),
    paperColor: toOklch(theme.pageBg),
    wordColor: toOklch(theme.wordColor),
    wordGradientStart: mix(theme.wordColor, WHITE, 0.08),
    wordGradientEnd: mix(theme.wordColor, BLACK, 0.14),
    hourHandColor: toOklch(theme.hourHandColor),
    hourHandEndColor: mix(theme.hourHandColor, BLACK, 0.16),
    hourHandBorderColor: withAlpha(mix(theme.pageBg, WHITE, 0.38), 0.32),
    minuteHandColor: toOklch(theme.minuteHandColor),
    minuteHandEndColor: mix(theme.minuteHandColor, BLACK, 0.1),
    minuteHandSoftColor: withAlpha(theme.minuteHandColor, 0.22),
    minuteHandBorderColor: withAlpha(mix(theme.pageBg, WHITE, 0.42), 0.28),
    secondHandColor: toOklch(theme.secondHandColor),
    secondHandEndColor: mix(theme.secondHandColor, BLACK, 0.1),
    secondHandBorderColor: withAlpha(mix(theme.secondHandColor, BLACK, 0.35), 0.18),
    centerPinColor: toOklch(theme.centerPinColor),
    centerPinEndColor: mix(theme.centerPinColor, BLACK, 0.12),
    centerPinStrokeColor: withAlpha(mix(theme.pageBg, WHITE, 0.5), 0.36),
  };
}
