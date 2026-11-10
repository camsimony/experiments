/* ══ People ═══════════════════════════════════════════════
   Passers-by, simulated here and drawn by the shader (shaders/people.ts).

   People come into the frame along the sidewalks and go through: along
   under the el, round the corner, across at the crosswalk. Each keeps
   their own line and pace. Among them:

     walkers     on their own, or a couple side by side
     a dog walker, the dog trotting ahead on its lead
     a mom (or dad) pushing a stroller
     someone home from the shops, a bag in each hand
     a jogger
     the mail carrier, in the blue-grey, a satchel on the hip, working
                 the row: up to each stoop, a moment there, and on
     a Citi Bike, on the road: along under the el, or down the side street

   And someone on a bench by the court. Foot traffic follows the year:
   busiest in summer, thinning through autumn, sparse in winter (and
   they're in coats and hats then), and quiet at night.

   Positions are in world units. */

import type { Layout } from "./layouts";
import type { Body } from "./traffic";

export const PEOPLE = 12;

/* kinds, as the shader knows them */
export const K = { walk: 0, sit: 1, dog: 2, run: 3, mail: 7, stroller: 8, bike: 9, bags: 11 } as const;

type Pt = [number, number, number?];   // x, y, and a pause there (s)
type Person = {
  on: boolean;
  route: Pt[]; seg: number; s: number; wait: number;
  side: number; speed: number;
  x: number; y: number; hd: number; phase: number;
  shirt: [number, number, number]; hair: [number, number, number];
  skin: [number, number, number]; bare: number;
  kind: number; look: number;
  /* what makes them move like people and not on rails: their own
     cadence and arm swing, a wander about their line, the odd glance or
     stop, a sidestep round someone coming the other way */
  seed: number; cad: number; armK: number; phone: number;
  v: number; pause: number; glanceT: number; avoid: number;
  waiting?: boolean; appear?: Pt | null;
  /* off to their car: kept to their line (no wander round it), and in
     at the end of it */
  tight?: boolean; done?: (() => void) | null;
};
type Dog = { x: number; y: number; hd: number; phase: number; wob: number; owner: number; col: [number, number, number] };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
type C3 = [number, number, number];
const c3 = (c: readonly number[]) => [c[0], c[1], c[2]] as C3;

const TOPS = {
  warm: [[0.82, 0.8, 0.76], [0.2, 0.3, 0.5], [0.7, 0.25, 0.22], [0.92, 0.9, 0.86], [0.35, 0.45, 0.32], [0.85, 0.65, 0.3], [0.45, 0.55, 0.7], [0.2, 0.2, 0.22], [0.86, 0.55, 0.6]],
  cool: [[0.42, 0.4, 0.36], [0.25, 0.3, 0.38], [0.55, 0.42, 0.3], [0.3, 0.34, 0.28], [0.6, 0.58, 0.54], [0.5, 0.2, 0.18]],
  cold: [[0.16, 0.17, 0.2], [0.3, 0.24, 0.2], [0.22, 0.26, 0.33], [0.5, 0.18, 0.16], [0.42, 0.4, 0.36], [0.12, 0.12, 0.13]],
} as const;
const HAIR = [[0.1, 0.08, 0.07], [0.22, 0.14, 0.08], [0.4, 0.28, 0.16], [0.72, 0.6, 0.4], [0.6, 0.6, 0.6], [0.06, 0.06, 0.06]] as const;
const HATS = [[0.14, 0.15, 0.18], [0.55, 0.15, 0.14], [0.8, 0.78, 0.72], [0.2, 0.3, 0.4]] as const;
const SKIN = [[0.93, 0.76, 0.64], [0.86, 0.66, 0.52], [0.74, 0.54, 0.4], [0.62, 0.44, 0.31], [0.44, 0.3, 0.21], [0.32, 0.21, 0.15]] as const;
const DOGS = [[0.85, 0.7, 0.45], [0.15, 0.13, 0.12], [0.55, 0.4, 0.28], [0.92, 0.9, 0.86]] as const;
const RUN = [[0.9, 0.3, 0.25], [0.2, 0.5, 0.85], [0.95, 0.85, 0.2], [0.3, 0.75, 0.55], [0.12, 0.12, 0.14]] as const;

/* how busy the streets are at this point in the year: 0 spring .. 3 winter */
function busyness(y: number) {
  const k = [0.75, 1.35, 0.6, 0.28];
  const w = ((y % 4) + 4) % 4, i = Math.floor(w), t = w - i;
  return k[i] + (k[(i + 1) % 4] - k[i]) * t;
}

export function createPeople(L: Layout, season: () => number, night: () => number) {
  const ft = L.ft, W = L.world[0], H = L.world[1];
  const walks: Pt[][] = [], roads: Pt[][] = [];
  let mailRoute: Pt[] | null = null;
  if (L.el && L.walk && L.street && L.rowX && L.lots) {
    const ye = L.el[0] + L.walk[1] + L.walk[0] * 0.5;   // the walk under the el
    const xw = L.street[0] - L.walk[0] * 0.5, xe = L.street[1] + L.walk[0] * 0.5;
    walks.push([[-0.08, ye], [W + 0.08, ye]]);                          // all along under the el
    walks.push([[-0.08, ye], [xw, ye], [xw, H + 0.08]]);                // round the corner, down the side street
    walks.push([[xe, H + 0.08], [xe, ye], [W + 0.08, ye]]);             // up the far side and off along the el
    walks.push([[xw, H + 0.08], [xw, ye + 2 * ft], [xe, ye + 2 * ft], [xe, H + 0.08]]); // up, across, back down
    walks.push([[xw, H + 0.08], [xw, ye], [-0.08, ye]]);
    /* the road: a bike rides along the el street, on the near side
       (the far one's under the deck), or up or down the side street,
       turning onto it */
    const elA = L.el[0] + 12.5 * ft, mid = (L.street[0] + L.street[1]) / 2;
    /* (the side street's one-way, northbound: bikes go up it, keeping
       to the park side of the lane, clear of the parked cars) */
    const bx = L.street[0] + 4 * ft;
    void mid;
    roads.push([[-0.1, elA], [W + 0.1, elA]]);
    roads.push([[bx, H + 0.1], [bx, elA + 4 * ft], [bx + 4 * ft, elA], [W + 0.1, elA]]);
    roads.push([[bx, H + 0.1], [bx, elA + 4 * ft], [bx - 4 * ft, elA], [-0.1, elA]]);
    roads.push([[bx, H + 0.1], [bx, -0.1]]);
    /* the mail carrier: down the row's walk, up to each house's door and
       a moment there (the brownstones' stoops; the others' doors) */
    const r: Pt[] = [[xe, ye]];
    /* (not the deli: it gets its mail through the shop) */
    L.lots.filter((l) => l[0] < 5 && (l[3] < 0.5 || l[3] > 1.5)).forEach((l) => {
      const dy = l[0] + (l[1] - l[0]) * (l[3] < 0.5 ? 0.83 : 0.5);
      const door = L.rowX! - (l[3] < 0.5 ? 5.4 : 0.8) * ft;
      if (dy > H) return;
      r.push([xe, dy], [door, dy, rnd(2.5, 4)], [xe, dy + 1.5 * ft]);
    });
    r.push([xe, H + 0.08]);
    mailRoute = r;
  } else {
    const x = L.fence[0] - 13 * ft;
    walks.push([[x, -0.08], [x, H + 0.08]]);
  }

  const people: Person[] = Array.from({ length: PEOPLE }, () => ({
    on: false, route: [], seg: 0, s: 0, wait: 0, side: 0, speed: 4, x: 9, y: 9, hd: 0, phase: 0,
    shirt: [0.5, 0.5, 0.5], hair: [0.1, 0.1, 0.1], skin: [0.7, 0.5, 0.4], bare: 0, kind: 0, look: 0,
    seed: 0, cad: 1, armK: 1, phone: 0, v: 0, pause: 0, glanceT: 3, avoid: 0,
  }));
  const dog: Dog = { x: 9, y: 9, hd: 0, phase: 0, wob: 0, owner: -1, col: [0.8, 0.7, 0.5] };
  let nextIn = rnd(1, 3), nextMail = rnd(20, 60), nextRider = rnd(5, 25);
  /* the bus stop: where people wait, along the shelter, and how they come
     to it (up or down the row's walk) */
  const stop = L.stop;
  const xe = L.street ? L.street[1] + L.walk![0] * 0.5 : 9;

  const dress = (p: Person) => {
    const y = season(), w = ((y % 4) + 4) % 4;
    const cold = w > 2.6 || w < 0.15, cool = !cold && (w < 0.5 || w > 1.9);
    const tops: readonly (readonly number[])[] = cold ? TOPS.cold : cool ? TOPS.cool : TOPS.warm;
    p.shirt = c3(pick(tops));
    p.hair = c3(cold && Math.random() < 0.7 ? pick(HATS) : pick(HAIR));
    p.skin = c3(pick(SKIN));
    p.bare = Math.random() < (cold ? 0 : cool ? 0.25 : 0.85) ? 1 : 0;
  };

  /* someone on the bench nearest the middle, there from the start */
  if (L.benches.length > 1) {
    const b = L.benches[1], p = people[PEOPLE - 1];
    const toCourt = Math.sign(L.center[0] - b[0]) || 1;
    p.on = true; p.kind = K.sit; p.x = b[0] + toCourt * 0.2 * ft; p.y = b[1] + 0.8 * ft;
    p.hd = toCourt > 0 ? 0 : Math.PI; dress(p);
  }

  const free = () => people.find((q, i) => !q.on && i < PEOPLE - 1);
  const start = (p: Person, route: Pt[], kind: number, speed: number, side: number) => {
    Object.assign(p, {
      on: true, route, seg: 0, s: 0, wait: 0, side, speed, phase: Math.random() * 6, kind, look: 0, waiting: false, appear: null, tight: false, done: null,
      seed: Math.random() * 100, cad: rnd(0.85, 1.08), armK: rnd(0.45, 1.1), phone: 0, v: speed, pause: 0, glanceT: rnd(2, 6), avoid: 0,
    });
    /* some on their phones (slower, an arm up, stopping now and then);
       some with their hands in their pockets */
    if (kind === K.walk) {
      const r = Math.random();
      if (r < 0.14) { p.phone = 1; p.speed *= 0.85; p.armK = 0.2; }
      else if (r < 0.24) p.armK = 0.08;
    }
    dress(p);
    p.x = route[0][0]; p.y = route[0][1];
    p.hd = Math.atan2(route[1][1] - route[0][1], route[1][0] - route[0][0]);
  };
  const spawn = (force?: string) => {
    const p = free();
    if (!p) return;
    const w = ((season() % 4) + 4) % 4;
    const summer = w > 0.6 && w < 1.6, winter = w > 2.6 || w < 0.1;
    /* what kind of passer-by: weighted by the season */
    const opts: [string, number][] = [
      ["walk", 5], ["couple", 1.4], ["dog", dog.owner < 0 ? 1.2 : 0], ["stroller", winter ? 0.3 : 1],
      ["bags", 1], ["run", summer ? 1.2 : winter ? 0.15 : 0.6], ["bike", roads.length ? (summer ? 1.6 : winter ? 0.2 : 0.9) : 0],
    ];
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0), kind = "walk";
    for (const [k, wt] of opts) { if ((r -= wt) <= 0) { kind = k; break; } }
    if (force) kind = force;
    let route = kind === "bike" ? pick(roads) : pick(walks);
    if (kind !== "bike" && Math.random() < 0.5) route = [...route].reverse();
    if (kind === "bike") { start(p, route, K.bike, rnd(13, 17), 0); p.bare = 0; return; }
    if (kind === "run") { start(p, route, K.run, rnd(8, 10), rnd(-2.5, 2.5)); p.shirt = c3(pick(RUN)); return; }
    if (kind === "stroller") { start(p, route, K.stroller, rnd(3.0, 3.6), rnd(-2, 2)); return; }
    if (kind === "bags") { start(p, route, K.bags, rnd(3.2, 4.0), rnd(-2.4, 2.4)); return; }
    if (kind === "dog") {
      start(p, route, K.dog, rnd(3.2, 4.0), rnd(-2.2, 2.2));
      dog.owner = people.indexOf(p); dog.x = p.x; dog.y = p.y; dog.col = c3(pick(DOGS));
      return;
    }
    const side = rnd(-2.6, 2.6), speed = rnd(3.6, 4.8);
    start(p, route, K.walk, speed, side);
    if (kind === "couple") {
      /* a second, side by side, in step */
      const q = free();
      if (q) {
        start(q, route, K.walk, speed, side + (side > 0 ? -2.1 : 2.1));
        /* (walking together: the same wander, the same pace) */
        q.seed = p.seed; q.phone = 0; p.phone = 0; q.speed = p.speed = speed; q.cad = p.cad;
      }
    }
  };
  const mail = () => {
    const p = free();
    if (!p || !mailRoute || people.some((q) => q.on && q.kind === K.mail)) return;
    start(p, mailRoute, K.mail, rnd(3.4, 3.9), 0);
    p.shirt = [0.56, 0.63, 0.72]; p.hair = [0.18, 0.22, 0.34]; p.bare = 0.5;
  };

  let T = 0;
  /* someone off to catch the bus: along the walk to the shelter, and
     waiting there */
  const rider = () => {
    if (!stop) return;
    const p = free();
    if (!p || people.filter((q) => q.on && q.waiting).length >= 3) return;
    const n = people.filter((q) => q.on && q.waiting).length;
    const wx = stop[0] - 0.6 * ft + (n % 2) * 0.4 * ft, wy = stop[1] + (2.5 + n * 3.2) * ft;
    const fromBelow = Math.random() < 0.6;
    const ye = L.el![0] + L.walk![1] + L.walk![0] * 0.5;
    const route: Pt[] = fromBelow ? [[xe, H + 0.08], [xe, wy + 3 * ft], [wx, wy, 1e9], [wx, wy + 0.1 * ft]]
                                  : [[W + 0.08, ye], [xe, ye], [xe, wy - 3 * ft], [wx, wy, 1e9], [wx, wy + 0.1 * ft]];
    start(p, route, K.walk, rnd(3.4, 4.2), 0);
    /* (kept to their line: waiting at the curb, not out in the road) */
    p.waiting = true; p.tight = true; p.phone = Math.random() < 0.4 ? 1 : 0;
  };
  /* the bus is in: everyone waiting gets on (walks to the door and is
     gone), and one or two get off and go on their way */
  const board = (door: [number, number]) => {
    people.filter((q) => q.on && q.waiting).forEach((q, k) => {
      q.route = [[q.x, q.y], [door[0] + 1.6 * ft, door[1] + k * 1.2 * ft], [door[0], door[1]]];
      q.seg = 0; q.s = 0; q.wait = k * 0.9; q.waiting = false; q.pause = 0;
    });
    const off = Math.random() < 0.8 ? Math.floor(rnd(1, 3)) : 0;
    for (let k = 0; k < off; k++) {
      const p = free();
      if (!p) break;
      const down = Math.random() < 0.5;
      const ye = L.el![0] + L.walk![1] + L.walk![0] * 0.5;
      const route: Pt[] = down ? [[door[0], door[1]], [xe, door[1] + 2 * ft], [xe, H + 0.08]] : [[door[0], door[1]], [xe, door[1] - 1 * ft], [xe, ye], [W + 0.08, ye]];
      start(p, route, K.walk, rnd(3.6, 4.6), 0);
      p.wait = 1.2 + k * 1.1;
      p.x = 9; p.y = 9;   // (appear at the door when their wait's up)
      p.appear = route[0];
    }
  };

  /* someone out to their car, parked at the deli curb: along the walk
     to it, across to the curb ahead of it, round its front to the
     driver's door, and in */
  const driver = (door: [number, number], ahead: [number, number], done: () => void) => {
    const p = free();
    if (!p || !L.walk || !L.el || !L.street) return false;
    const ye = L.el[0] + L.walk[1] + L.walk[0] * 0.5;
    const fromBelow = Math.random() < 0.6;
    const route: Pt[] = [
      ...(fromBelow ? [[xe, H + 0.08], [xe, ahead[1] + 1 * ft]] as Pt[] : [[W + 0.08, ye], [xe, ye], [xe, ahead[1] - 1 * ft]] as Pt[]),
      [L.street[1] - 0.8 * ft, ahead[1]], [door[0], ahead[1]], [door[0], door[1]],
    ];
    start(p, route, Math.random() < 0.25 ? K.bags : K.walk, rnd(3.6, 4.4), 0);
    p.phone = 0; p.tight = true; p.done = done;
    return true;
  };

  /* the traffic, for anyone about to step off the curb to keep clear of:
     (x, y, half-length ft, speed ft/s, facing) */
  let cars: () => Body[] = () => [];
  /* whether (x, y) is in the way of something moving: in the road ahead
     of it, within its width, as far as it'll go in the next second or so */
  const inPath = (x: number, y: number, margin: number, ahead = 1.3) => cars().some(([cx, cy, l, v, ux, uy]) => {
    if (v < 1) return false;
    const dx = (x - cx) / ft, dy = (y - cy) / ft;
    const along = dx * ux + dy * uy, acr = dx * uy - dy * ux;
    return Math.abs(acr) < (l > 10 ? 4.3 : 3) + margin && along > -l - 1 && along < l + 2 + v * ahead;
  });
  /* whether this stretch of their route takes them across the side street */
  const across = (a: Pt, b: Pt) => !!L.street && Math.min(a[0], b[0]) < L.street[0] + ft && Math.max(a[0], b[0]) > L.street[1] - ft;

  function update(dt: number) {
    T += dt;
    nextRider -= dt;
    if (nextRider <= 0) { if (night() < 0.8) rider(); nextRider = rnd(25, 60) / Math.max(0.3, busyness(season())); }
    const busy = busyness(season()) * (1 - night() * 0.8);
    /* (no more out at once than the season would have about) */
    const out = people.filter((p) => p.on).length;
    nextIn -= dt;
    if (nextIn <= 0) {
      if (out < 2 + Math.round(8 * busy)) spawn();
      nextIn = rnd(3, 8) / Math.max(0.15, busy);
    }
    nextMail -= dt;
    if (nextMail <= 0) { if (night() < 0.3) mail(); nextMail = rnd(120, 200); }

    sidestep(dt);
    people.forEach((p, i) => {
      if (!p.on) return;
      if (p.kind === K.sit) {
        p.phase += dt;
        if (Math.random() < dt * 0.15) p.look = rnd(-0.9, 0.9);
        if (Math.random() < dt * 0.1) p.look = 0;
        return;
      }
      /* a pause at a point (the mail carrier at a door, someone at the
         bus stop): stand, facing it */
      if (p.wait > 0) { p.wait -= dt; p.v = 0; return; }
      if (p.appear) { p.x = p.appear[0]; p.y = p.appear[1]; p.appear = null; p.hd = Math.atan2(p.route[1][1] - p.y, p.route[1][0] - p.x); }
      /* (waiting: now and then a look up the street for the bus) */
      if (p.waiting && p.seg >= p.route.length - 2) {
        p.v = 0; if (Math.random() < dt * 0.2) p.look = p.look ? 0 : 0.9;
        /* (settling onto their spot) */
        const w = p.route[p.route.length - 2];
        p.x += (w[0] - p.x) * Math.min(1, dt * 2); p.y += (w[1] - p.y) * Math.min(1, dt * 2);
        return;
      }
      const bike = p.kind === K.bike;
      /* their pace: their own, wandering a little, easing to a stop and
         off again when they pause (a phone, a corner, a look round) */
      p.pause = Math.max(0, p.pause - dt);
      if (!bike && p.phone && p.pause <= 0 && Math.random() < dt * 0.04) p.pause = rnd(2, 5);
      const want = p.pause > 0 ? 0 : p.speed * (1 + 0.08 * Math.sin(T * 0.31 + p.seed));
      p.v += (want - p.v) * Math.min(1, dt * (want < p.v ? 2.5 : 1.5));
      p.s += p.v * ft * dt;
      let a = p.route[p.seg], b = p.route[p.seg + 1];
      let len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
      while (p.s > len && p.seg < p.route.length - 2) {
        p.s -= len; p.seg++;
        a = p.route[p.seg]; b = p.route[p.seg + 1]; len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
        if (a[2] && a[2] < 1e8) { p.wait = a[2]; p.s = 0; }
        else if (a[2]) { p.s = 0; }
        /* at a corner, now and then a moment to look both ways */
        else if (!bike && Math.random() < 0.3) { p.pause = rnd(0.5, 1.4); p.glanceT = 0; p.look = rnd(0.6, 1.0) * (Math.random() < 0.5 ? -1 : 1); }
      }
      if (p.s > len) { p.on = false; p.x = 9; p.y = 9; p.done?.(); p.done = null; if (dog.owner === i) { dog.owner = -1; dog.x = 9; dog.y = 9; } return; }
      /* in the road, something coming: stop, and let it by */
      if (L.street && L.el && p.pause <= 0 && p.x > L.street[0] - 2 * ft && p.x < L.street[1] + 2 * ft && p.y > L.el[0] + 8 * ft
        && (p.y < L.el[0] + L.walk![1] + L.walk![0] + 2 * ft || across(a, b)) && inPath(p.x, p.y, bike ? 5 : 1.5, bike ? 2 : 1.3)) { p.pause = 0.3; p.v = Math.min(p.v, 0.4); }
      else if (L.street && L.el && p.pause <= 0 && Math.abs(p.y - L.el[0]) < L.walk![1] && Math.abs(p.x - (L.street[0] + L.street[1]) / 2) < 30 * ft && inPath(p.x, p.y, bike ? 5 : 1.5, bike ? 2 : 1.3)) { p.pause = 0.3; p.v = Math.min(p.v, 0.4); }
      /* at the curb, about to cross: wait for anything too near to stop
         for them (a car close to the crossing, or still across it) */
      if (L.street && across(a, b) && p.pause <= 0) {
        const dir = Math.sign(b[0] - a[0]);
        const toRoad = dir > 0 ? (L.street[0] - p.x) / ft : (p.x - L.street[1]) / ft;
        /* (on a bike, the look comes further back: it takes longer to stop) */
        if (toRoad > -0.5 && toRoad < (bike ? 14 : 2.5)) {
          const near = cars().some(([, cy, l, v]) => {
            const d = (cy - p.y) / ft;                     // how far short of their line it is (+ south)
            return Math.abs(d) < l + 3 || (d > 0 && d - l < (bike ? 10 + v * v / 10 : 6 + v * v / 16) && v > 2);
          });
          if (near) { p.pause = 0.4; p.v = Math.min(p.v, 0.5); }
        }
      }
      /* where they're heading: a little way ahead along their line, which
         wanders about the route rather than running dead straight; and a
         sidestep for anyone coming the other way */
      const ahead = bike ? 4 : 3;
      let sa = p.s + ahead * ft, sg = p.seg;
      let A0 = a, B0 = b, l0 = len;
      while (sa > l0 && sg < p.route.length - 2) { sa -= l0; sg++; A0 = p.route[sg]; B0 = p.route[sg + 1]; l0 = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]) || 1e-6; }
      sa = Math.min(sa, l0);
      const ux = (B0[0] - A0[0]) / l0, uy = (B0[1] - A0[1]) / l0;
      const wander = bike || p.tight ? 0 : 1.1 * Math.sin(T * 0.11 + p.seed) + 0.5 * Math.sin(T * 0.29 + p.seed * 1.7);
      const side = p.side + wander + p.avoid;
      const tx = A0[0] + ux * sa - uy * side * ft, ty = A0[1] + uy * sa + ux * side * ft;
      /* steer toward it (so corners are rounded and lines curve), and go */
      const want_hd = Math.atan2(ty - p.y, tx - p.x);
      if (p.v > 0.2) p.hd += wrapPi(want_hd - p.hd) * Math.min(1, dt * (bike ? 3 : 2.6));
      p.x += Math.cos(p.hd) * p.v * ft * dt; p.y += Math.sin(p.hd) * p.v * ft * dt;
      /* (and never far from their line: a gentle pull back) */
      const cx_ = a[0] + (b[0] - a[0]) / len * p.s - (b[1] - a[1]) / len * side * ft, cy_ = a[1] + (b[1] - a[1]) / len * p.s + (b[0] - a[0]) / len * side * ft;
      p.x += (cx_ - p.x) * Math.min(1, dt * 0.6); p.y += (cy_ - p.y) * Math.min(1, dt * 0.6);
      p.phase += dt * (bike ? 5 * p.v / 15 : p.v * 0.95 * p.cad);
      /* (slowing to a stop, the feet come together: eased, not snapped) */
      if (!bike && p.v < 1.5) p.phase += (Math.round(p.phase / Math.PI) * Math.PI - p.phase) * Math.min(1, dt * 3 * (1 - p.v / 1.5));
      /* glances: now and then a look to one side, held a moment */
      if (!bike) {
        p.glanceT -= dt;
        if (p.glanceT <= 0) {
          p.look = p.look !== 0 ? 0 : rnd(0.4, 1.0) * (Math.random() < 0.5 ? -1 : 1);
          p.glanceT = p.look !== 0 ? rnd(0.8, 2) : rnd(3, 9);
        }
      }
      if (dog.owner === i) {
        dog.wob += dt * rnd(0.3, 1.2);
        const off = Math.sin(dog.wob) * 2.2;
        const gx = p.x + Math.cos(p.hd) * 3.6 * ft - Math.sin(p.hd) * off * ft, gy = p.y + Math.sin(p.hd) * 3.6 * ft + Math.cos(p.hd) * off * ft;
        const ddx = gx - dog.x, ddy = gy - dog.y;
        dog.x += ddx * Math.min(1, dt * 2.5); dog.y += ddy * Math.min(1, dt * 2.5);
        if (Math.hypot(ddx, ddy) > 0.05 * ft) dog.hd += wrapPi(Math.atan2(ddy, ddx) - dog.hd) * Math.min(1, dt * 5);
        dog.phase += dt * 9;
      }
    });
  }

  /* a sidestep: two coming at each other on the walk each edge over a
     little, and drift back once they've passed */
  function sidestep(dt: number) {
    const W_ = people.filter((p) => p.on && p.kind !== K.sit && p.kind !== K.bike);
    W_.forEach((p) => { p.avoid *= Math.max(0, 1 - dt * (p.tight ? 4 : 0.8)); });
    for (let i = 0; i < W_.length; i++) for (let j = i + 1; j < W_.length; j++) {
      const p = W_[i], q = W_[j];
      const d = Math.hypot(p.x - q.x, p.y - q.y) / ft;
      if (d > 7 || p.seed === q.seed) continue;
      const head = Math.cos(p.hd) * Math.cos(q.hd) + Math.sin(p.hd) * Math.sin(q.hd);
      if (head > -0.3) continue;
      const k = (1 - d / 7) * dt * 3;
      p.avoid = Math.min(2.5, p.avoid + k); q.avoid = Math.min(2.5, q.avoid + k);
    }
  }

  /* where they all are, for the pigeons to keep clear of */
  const threats = (): [number, number, number][] => {
    const out: [number, number, number][] = people.filter((p) => p.on && p.kind !== K.sit && p.kind !== K.bike).map((p) => [p.x, p.y, 4]);
    if (dog.owner >= 0) out.push([dog.x, dog.y, 9]);
    return out;
  };

  /* for the shader: (x, y, heading, phase), (top rgb, kind), (hair rgb,
     glance), (skin rgb, bare arms); the dog (x, y, heading, phase) and
     (rgb, owner) */
  const A = new Float32Array(PEOPLE * 4), B = new Float32Array(PEOPLE * 4), C = new Float32Array(PEOPLE * 4), Sk = new Float32Array(PEOPLE * 4), Ex = new Float32Array(PEOPLE * 4);
  const D = new Float32Array(4), E = new Float32Array(4);
  function pack() {
    people.forEach((p, i) => {
      /* (standing at a door, the walk cycle rests) */
      /* the body's own motion in a stride: the weight shifting side to
         side, the shoulders turning against the legs, the bob up and
         down (from above, a touch bigger and smaller); all of it fading
         as they slow to a stop */
      const still = p.wait > 0 || p.kind === K.sit || p.kind === K.bike;
      const go = still ? 0 : Math.min(1, p.v / Math.max(1, p.speed));
      const sway = Math.sin(p.phase) * 0.07 * go * ft, twist = Math.sin(p.phase) * 0.08 * go;
      const ph = p.wait > 0 ? Math.round(p.phase / Math.PI) * Math.PI : p.phase;
      A.set(p.on ? [p.x - Math.sin(p.hd) * sway, p.y + Math.cos(p.hd) * sway, p.hd + twist, ph] : [9, 9, 0, 0], i * 4);
      Ex.set([p.armK * go, p.phone, Math.cos(p.phase * 2) * go, 0], i * 4);
      B.set([...p.shirt, p.kind], i * 4);
      C.set([...p.hair, p.look], i * 4);
      Sk.set([...p.skin, p.bare], i * 4);
    });
    D.set(dog.owner >= 0 ? [dog.x, dog.y, dog.hd, dog.phase] : [9, 9, 0, 0]);
    E.set([...dog.col, dog.owner]);
    return { A, B, C, D, E, Sk, Ex };
  }
  /* (dev: window.__people.spawn('bike'), or 'mail', 'stroller', ...) */
  const spawnDev = (k: string) => (k === "mail" ? mail() : spawn(k));
  /* where everyone is (on foot, or on a bike), for traffic to stop for */
  /* (a stroller's out in front of whoever's pushing it) */
  const positions = (): [number, number][] => people.filter((p) => p.on && p.kind !== K.sit && p.x < 8).flatMap((p) =>
    p.kind === K.stroller ? [[p.x, p.y], [p.x + Math.cos(p.hd) * 3 * ft, p.y + Math.sin(p.hd) * 3 * ft]] as [number, number][] : [[p.x, p.y]]);
  /* the lines (world y) of anyone crossing the side street, or a few
     steps from it, still to get across */
  const crossings = (): number[] => {
    if (!L.street) return [];
    const [x0, x1] = L.street, out: number[] = [];
    people.forEach((p) => {
      if (!p.on || p.kind === K.sit || p.wait > 0 || p.x > 8) return;
      for (let k = p.seg; k < Math.min(p.route.length - 1, p.seg + 2); k++) {
        const a = p.route[k], b = p.route[k + 1];
        if (!across(a, b)) continue;
        if (k > p.seg) {
          /* the next stretch: only once they're nearly at its start */
          const c = p.route[p.seg + 1];
          if (Math.hypot(c[0] - p.x, c[1] - p.y) > 8 * ft) continue;
        } else {
          const dir = Math.sign(b[0] - a[0]);
          if (dir > 0 ? p.x > x1 + 0.5 * ft : p.x < x0 - 0.5 * ft) continue;   // across already
          if ((dir > 0 ? x0 - p.x : p.x - x1) > (p.kind === K.bike ? 30 : 8) * ft) continue;   // not near it yet
        }
        out.push(p.y); return;
      }
    });
    return out;
  };
  /* the bikes on the road, for traffic to hang back behind: (x, y, speed ft/s) */
  const bikes = (): [number, number, number][] => people.filter((p) => p.on && p.kind === K.bike && p.x < 8).map((p) => [p.x, p.y, p.v]);
  return { update, pack, threats, positions, crossings, bikes, board, driver, watch: (fn: typeof cars) => { cars = fn; }, spawn: (k: string) => (k === "rider" ? rider() : spawnDev(k)) };
}
