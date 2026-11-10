/* ══ Time of day ══════════════════════════════════════════
   The scene follows the visitor's clock. Most of the day it's the late,
   low, golden light the seasons are painted in; toward sunset the light
   goes pink and the shadows stretch, and after it, the blue hour and
   then night: no sun at all, a cool moonlit wash, and the city's own
   lights on. The park lamps and street lights throw warm pools, some
   windows glow, the deli spills light onto the sidewalk.

   tod: 0 day, 0.5 dusk, 1 night. It's eased in the component, so a
   change (the clock, or the picker) is a slow fade, like the seasons. */

import type { Season } from "./seasons";

export const TIMES = [
  { name: "Day", tod: 0 },
  { name: "Dusk", tod: 0.5 },
  { name: "Night", tod: 1 },
];

/* New York's sunset and sunrise, roughly, month by month (local time,
   with daylight saving) */
const SUNSET = [17.0, 17.6, 19.1, 19.6, 20.1, 20.5, 20.5, 20.0, 19.2, 18.4, 16.8, 16.5];
const SUNRISE = [7.2, 6.9, 7.1, 6.5, 5.8, 5.4, 5.5, 6.1, 6.6, 7.1, 6.6, 7.1];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/* where the visitor's clock puts the light */
export function todNow(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  const set = SUNSET[d.getMonth()], rise = SUNRISE[d.getMonth()];
  // evening: dusk builds over the hour before sunset, night an hour after
  if (h >= rise + 1) return h < set ? 0.5 * clamp01((h - (set - 0.9)) / 0.9) : 0.5 + 0.5 * clamp01((h - set) / 1.0);
  // morning: night until dawn, then back to day
  return h < rise - 0.5 ? 1 : 1 - clamp01((h - (rise - 0.5)) / 1.5);
}
export function timeNow(d = new Date()) {
  const t = todNow(d);
  return t < 0.25 ? 0 : t < 0.75 ? 1 : 2;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i], t)) as [number, number, number];

/* the season's light at a time of day */
export function lightAt(s: Season, tod: number) {
  // two steps after sunset: the light fades to moonlight first (tod
  // 0.5 to 0.8), and only once it's dark do the city's lights come on
  const dusk = clamp01(tod * 2), night = clamp01((tod - 0.5) / 0.3);
  // dusk: the sun lower and pinker, the shade bluer and deeper
  // (dimmer than day: the sun's nearly down)
  let sunCol = lerp3(s.sunCol, [0.82, 0.52, 0.48], dusk * 0.9);
  let shadeCol = lerp3(s.shadeCol, [0.3, 0.3, 0.46], dusk * 0.85);
  // night: no sun, a cool moonlit wash
  // (dark, so the lights are what you see; snow still a little paler)
  sunCol = lerp3(sunCol, [0.1, 0.12, 0.2], night);
  shadeCol = lerp3(shadeCol, [0.075, 0.09, 0.155], night);
  return {
    sunCol,
    shadeCol,
    sunK: s.sunK * (1 - 0.3 * dusk) * (1 - night),
    sun: [s.sun[0] * (1 + dusk * 0.5), s.sun[1] * (1 + dusk * 0.5)] as [number, number],
    // the city's lights come on through dusk and are full by night
    night,
    dusk,
  };
}
