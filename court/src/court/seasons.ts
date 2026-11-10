/* ══ Seasons ══════════════════════════════════════════════
   Each season is a handful of numbers. The scene never switches between
   them: it holds a position on the year (0 spring, 1 summer, 2 autumn,
   3 winter, wrapping round) and every value is blended from the two
   seasons either side, so moving from one to the next is a slow
   cross-fade of light, leaves and weather together.

   The sun's offset is how far a thing one unit tall throws its shadow.
   It's always late in the day, the sun low in the west (left), so
   shadows run long to the right as in the aerial references; longest in
   winter, when the sun never gets high. */

export type Season = {
  name: string;
  density: number;          // how full the crowns are
  leafLo: [number, number, number];
  leafHi: [number, number, number];
  blossom: number;
  autumn: number;           // how far each tree turns its own colour
  litter: number;           // leaves or petals on the ground
  litterCol: [number, number, number];
  snow: number;
  fall: [number, number, number]; // amount, kind (0 petals, 1 leaves, 2 snow), speed
  sun: [number, number];
  sunCol: [number, number, number];
  shadeCol: [number, number, number];
  sunK: number;
  wind: number;             // the steady breeze
  gust: number;             // how hard the gusts come (0 none)
  gustSpeed: number;        // how much faster what's falling blows in a gust
  gustDrop: number;         // how much sooner it comes down in a gust
  gustEvery: number;        // about how many seconds between gusts
  fallLife: number;         // how far a falling leaf blows before it lands (in wind)
  /* how what's falling gathers: the thin scatter everywhere, how much
     more streams from the trees, and how much more lets go in a gust */
  fallTune: [number, number, number];
};

export const SEASONS: Season[] = [
  {
    name: "Spring",
    density: 0.5,
    leafLo: [0.22, 0.34, 0.16], leafHi: [0.7, 0.84, 0.46],
    blossom: 1,
    autumn: 0,
    litter: 0.12, litterCol: [0.96, 0.84, 0.88],
    snow: 0,
    fall: [0.03, 0, 0.05],
    sun: [0.92, 0.42],
    sunCol: [1.12, 1.04, 0.9], shadeCol: [0.54, 0.6, 0.74],
    sunK: 0.8,
    /* (a light trickle; the gusts shake most of them loose) */
    wind: 0.65, gust: 0.8, gustSpeed: 1.4, gustDrop: 1.2, gustEvery: 20, fallLife: 0.45, fallTune: [0.08, 1.5, 2.4],
  },
  {
    name: "Summer",
    density: 1,
    leafLo: [0.1, 0.19, 0.09], leafHi: [0.5, 0.64, 0.32],
    blossom: 0,
    autumn: 0,
    litter: 0.02, litterCol: [0.42, 0.5, 0.25],
    snow: 0,
    fall: [0, 1, 0.05],
    sun: [0.78, 0.38],
    sunCol: [1.2, 1.05, 0.84], shadeCol: [0.48, 0.54, 0.7],
    sunK: 1,
    wind: 0.7, gust: 0,   // no gusts in summer: just the heavy, still air
    gustSpeed: 1.4, gustDrop: 1.2, gustEvery: 20, fallLife: 0.45, fallTune: [0.2, 1.5, 1.3],
  },
  {
    name: "Autumn",
    /* tuned with the season tuner, 2026-11-08 */
    density: 0.55,
    leafLo: [0.38, 0.169, 0.059], leafHi: [0.949, 0.639, 0.239],
    blossom: 0,
    autumn: 1,
    litter: 0.55, litterCol: [0.983, 0.028, 0.147],   // oklch(0.6225 0.2851 26), brought into sRGB
    snow: 0,
    fall: [0.015, 1, 0.03],
    sun: [1.1, 0.48],
    sunCol: [1.22, 1.0, 0.761], shadeCol: [0.502, 0.502, 0.659],
    sunK: 0.85,
    wind: 0.6, gust: 1.5, gustSpeed: 0.2, gustDrop: 1.2, gustEvery: 5, fallLife: 0.22, fallTune: [0.2, 1.5, 1.5],
  },
  {
    name: "Winter",
    density: 0.08,
    leafLo: [0.34, 0.3, 0.27], leafHi: [0.5, 0.46, 0.42],
    blossom: 0,
    autumn: 0.6,
    litter: 0.08, litterCol: [0.45, 0.33, 0.22],
    snow: 0.85,
    fall: [0.1, 2, 0.04],
    sun: [1.38, 0.58],
    sunCol: [1.06, 1.02, 0.98], shadeCol: [0.62, 0.68, 0.86],
    sunK: 0.55,
    wind: 0.5, gust: 1, gustSpeed: 1.4, gustDrop: 1.2, gustEvery: 20, fallLife: 0.45, fallTune: [0.2, 1.5, 1.3],
  },
];

/* the season New York is in today: spring from March, summer from June,
   autumn from September, winter from December */
export function seasonNow(d = new Date()) {
  const m = d.getMonth();
  return m >= 2 && m <= 4 ? 0 : m >= 5 && m <= 7 ? 1 : m >= 8 && m <= 10 ? 2 : 3;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i], t)) as [number, number, number];

/* the blend at position y on the year (any real number; it wraps) */
export function seasonAt(y: number): Season {
  const n = SEASONS.length;
  const w = ((y % n) + n) % n;
  const i = Math.floor(w), t = w - i;
  const a = SEASONS[i], b = SEASONS[(i + 1) % n];
  /* what's falling changes kind halfway, while there's least of it */
  const fallAmt = lerp(a.fall[0], b.fall[0], t) * Math.abs(Math.cos(t * Math.PI)) ** 0.5;
  return {
    name: t < 0.5 ? a.name : b.name,
    density: lerp(a.density, b.density, t),
    leafLo: lerp3(a.leafLo, b.leafLo, t),
    leafHi: lerp3(a.leafHi, b.leafHi, t),
    blossom: lerp(a.blossom, b.blossom, t),
    autumn: lerp(a.autumn, b.autumn, t),
    litter: lerp(a.litter, b.litter, t),
    litterCol: lerp3(a.litterCol, b.litterCol, t),
    snow: lerp(a.snow, b.snow, t),
    fall: [fallAmt, t < 0.5 ? a.fall[1] : b.fall[1], lerp(a.fall[2], b.fall[2], t)],
    sun: [lerp(a.sun[0], b.sun[0], t), lerp(a.sun[1], b.sun[1], t)],
    sunCol: lerp3(a.sunCol, b.sunCol, t),
    shadeCol: lerp3(a.shadeCol, b.shadeCol, t),
    sunK: lerp(a.sunK, b.sunK, t),
    wind: lerp(a.wind, b.wind, t),
    gust: lerp(a.gust, b.gust, t),
    gustSpeed: lerp(a.gustSpeed, b.gustSpeed, t),
    gustDrop: lerp(a.gustDrop, b.gustDrop, t),
    gustEvery: lerp(a.gustEvery, b.gustEvery, t),
    fallLife: lerp(a.fallLife, b.fallLife, t),
    fallTune: lerp3(a.fallTune, b.fallTune, t),
  };
}
