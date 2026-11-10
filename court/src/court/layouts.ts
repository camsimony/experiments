/* ══ Layouts ══════════════════════════════════════════════
   Where everything stands, in world units (the frame is 1.5 × 1.0, y
   down). The shader draws whatever it's given; the two layouts only
   differ here.

   world   the frame's size in world units: 1.5 × 1 landscape, 1 × 1.5 tall
   vertical  the court runs top to bottom (full court) rather than across
   ft      world units per foot, so the court's lines are to regulation
   center  half: the middle of the baseline. full: centre court
   fence   the chain-link box around the court: x0, y0, x1, y1
   gate    which side of the fence the gate is in (0 left, 1 top,
           2 right, 3 bottom), where along it, and how wide (half-width)
   benches x, y, and whether they run vertically (0) or across (1);
           the back is on the side away from the court
   lamps   park lamps, x, y
   crowns  plane trees: x, y, radius */

export type Layout = {
  name: string;
  world: [number, number];
  vertical: boolean;
  ft: number;
  center: [number, number];
  full: boolean;
  fence: [number, number, number, number];
  gate: [number, number, number];
  benches: [number, number, number][];
  lamps: [number, number][];
  crowns: [number, number, number][];
  /* the city: the el (centre y, width), the side street (kerb x0, x1),
     sidewalk width and the el street's half-width, where the building
     fronts are, the row's lots (y0, y1, storeys, kind: 0 brownstone,
     1 tenement with water tower, 2 brick rowhouse), and parked cars
     (x, y, colour: 0 cab, 1 grey, 2 navy, 3 white, 4 maroon; across: 0
     along the side street, 1 along the el street) */
  el?: [number, number];
  street?: [number, number];
  walk?: [number, number];
  rowX?: number;
  lots?: [number, number, number, number][];
  cars?: [number, number, number, number][];
  /* the bus stop: its shelter (x0, y0, x1, y1), and how far up the curb
     its zone runs (y) */
  stop?: [number, number, number, number];
  zone?: number;
};

const half = (() => {
  const ft = 1 / 125;
  const cx = 0.83, cy = 0.545;
  const fx0 = cx - 52 * ft, bx = fx0 - 5 * ft;
  const elY = 0.085, elHalf = 13 * ft;
  const walk = 10 * ft;
  const st0 = cx + 7 * ft + walk, st1 = st0 + 24 * ft;
  const yard = 5 * ft;   // stoops and areaways, between the walk and the houses
  const rowX = st1 + walk + yard;
  const farKerb = st1 - 4 * ft, elPark = elY + elHalf - 2 * ft;
  return {
    name: "Half court",
    world: [1.5, 1],
    vertical: false,
    ft,
    center: [cx, cy],
    full: false,
    fence: [fx0, cy - 31 * ft, cx + 7 * ft, cy + 31 * ft],
    gate: [0, cy, 4 * ft],
    benches: [-22, -12, 12, 22].map((y) => [bx, cy + y * ft, 0]),
    lamps: [[fx0 - 10 * ft, cy - 29 * ft], [fx0 - 10 * ft, cy + 29 * ft]],
    crowns: [
      [0.2, 0.5, 0.3],
      [0.14, 0.97, 0.28],
      [-0.04, 0.72, 0.24],
      [0.55, elY + elHalf + 2 * ft + walk * 0.5, 0.095],
      [st0 - walk * 0.5, 0.4, 0.1],
      [st0 - walk * 0.5, 0.72, 0.1],
      [rowX - walk * 0.5, 0.56, 0.095],
      [rowX - walk * 0.5, 0.9, 0.095],
    ],
    el: [elY, elHalf * 2],
    street: [st0, st1],
    walk: [walk, elHalf + 2 * ft],
    rowX,
    lots: [
      [elY + elHalf + 2 * ft + walk, 0.44, 5, 1],
      [0.44, 0.62, 4, 0],
      [0.62, 0.8, 4, 0],
      [0.8, 0.96, 4, 0],
      [0.96, 1.13, 3, 2],
      [9, 9, 0, 0],
    ],
    /* the side street is one-way, northbound: the park side is a No
       Standing curb (a clear lane), cars park along the deli side, past
       the bus stop (2026-11-08; the two-way version with parking both
       sides is tagged court-before-bus-stop) */
    stop: [st1 + 2.6 * ft, 0.335, st1 + 7 * ft, 0.435],
    zone: 0.8,
    cars: [
      [farKerb, 0.865, 0, 2],
      [farKerb, 0.99, 2, 2],
      [0.3, elPark, 4, 1],
      [0.66, elPark, 1, 1],
    ],
  } satisfies Layout;
})();

/* the full court, running top to bottom as in the first aerial
   reference: a big plane leaning in over the top left, benches down the
   left side by the gate, more trees at the foot */
const full = (() => {
  const ft = 1 / 104;
  const cx = 0.58, cy = 0.76;
  const fx0 = cx - 31 * ft, bx = fx0 - 5 * ft;
  return {
    name: "Full court",
    world: [1, 1.5],
    vertical: true,
    ft,
    center: [cx, cy],
    full: true,
    fence: [fx0, cy - 54 * ft, cx + 31 * ft, cy + 54 * ft],
    gate: [0, cy, 4 * ft],
    benches: [-26, -14, 14, 26].map((y) => [bx, cy + y * ft, 0]),
    lamps: [[fx0 - 9 * ft, cy - 38 * ft], [fx0 - 9 * ft, cy + 38 * ft]],
    crowns: [
      [0.2, 0.24, 0.44],
      [0.04, 1.16, 0.32],
      [0.98, 1.5, 0.3],
      [1.1, 0.72, 0.2],
      [0.92, -0.04, 0.22],
      [0.36, 1.62, 0.24],
    ],
  } satisfies Layout;
})();

export const LAYOUTS: Layout[] = [half as Layout];
export const FULL_COURT = full as Layout;

/* ══ Court colours ════════════════════════════════════════
   Two NYC Parks paint schemes from the references: green-grey with a
   terracotta lane, and tan with a blue lane and a blue centre circle. */
export type Paint = { name: string; court: [number, number, number]; lane: [number, number, number]; circle: boolean };
export const PAINTS: Paint[] = [
  { name: "Green", court: [0.25, 0.36, 0.31], lane: [0.62, 0.3, 0.21], circle: false },
  { name: "Tan", court: [0.68, 0.52, 0.39], lane: [0.24, 0.35, 0.47], circle: true },
];
