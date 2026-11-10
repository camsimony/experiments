/* ══ Traffic ══════════════════════════════════════════════
   The side street is one-way, northbound (up the frame, toward the el),
   with parking only on the deli side; the park side is a No Standing
   curb, which leaves a clear lane down it. Now and then a car or a cab
   comes up it and on under the el.

   The cars parked on the deli side come and go: now and then someone
   walks out to one, round its front to the driver's door and in, and it
   signals, waits for a gap and pulls out; now and then a car comes up
   the curb lane and parks in an empty space. Every few minutes a city
   bus comes, but only once the curb's clear (it holds off the parkers
   when it's due), so it can come straight up the curb lane to the stop
   in front of the corner store. It sits there with its doors open while
   people get on and off, then signals and pulls out into the lane once
   it's clear behind.

   Each vehicle is steered like one: its front follows where it's going
   and its back follows its front (so a car pulling out angles out and
   straightens up, rather than sliding sideways), and it speeds up and
   brakes like something heavy, brake lights on as it slows. Anything
   ahead in the same lane is kept a gap behind. Anyone crossing the
   street, or about to step off the curb to, is stopped for, short of
   the crosswalk, unless it's too late to stop (and then they wait).

   Simulated here, drawn by the shader's car code (shaders/row.ts) in
   u_car slots 4 to 9. Positions are in world units. */

import type { Layout } from "./layouts";

export const MOVERS = 6;
const BUS = 9;          // the bus's colour index, as the shader knows it

type Phase = "drive" | "in" | "dwell" | "out" | "parked" | "boarding" | "leave";
type Vehicle = {
  on: boolean;
  kind: "car" | "park" | "bus";
  fx: number; fy: number;   // the front axle
  rx: number; ry: number;   // the back
  v: number; col: number; seed: number;
  len: number;              // half-length, ft
  wb: number;               // wheelbase, ft
  phase: Phase; t: number; signal: number; brake: number;
  wander: number;
  spot: number;             // the parking space it's in, or making for
  stay: number;             // parked: how long before someone comes for it
};
export type Body = [number, number, number, number, number, number];
type Spot = { x: number; y: number; car: number };   // car: which vehicle has it (-1: free)

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/* the parked cars traffic looks after: the ones along the deli curb */
const deliSide = (L: Layout, c: readonly number[]) => !!L.street && c[3] === 2 && c[0] > (L.street[0] + L.street[1]) / 2;
export const staticCars = (L: Layout) => (L.cars ?? []).filter((c) => !deliSide(L, c));

export function createTraffic(L: Layout, night: () => number) {
  const ft = L.ft, H = L.world[1];
  const st = L.street ?? [9, 9];
  const lane = st[0] + 9.5 * ft;               // the moving lane's middle, on the park side
  const curb = st[1] - 4.6 * ft;               // a bus at the stop
  const crossY = L.el ? L.el[0] + L.walk![1] + L.walk![0] : 0;   // the crosswalk's near edge
  const stopFront = crossY + 3 * ft;            // where the bus's nose stops
  const V: Vehicle[] = Array.from({ length: MOVERS }, () => ({
    on: false, kind: "car", fx: lane, fy: 9, rx: lane, ry: 9, v: 0, col: 1, seed: 0, len: 7.3, wb: 9,
    phase: "drive", t: 0, signal: 0, brake: 0, wander: 0, spot: -1, stay: 0,
  }));
  let nextCar = rnd(6, 14), nextBus = rnd(25, 50), nextPark = rnd(20, 50);
  let busDue = false;
  let T = 0;
  let boarding: ((door: [number, number]) => void) | null = null;
  let driver: ((door: [number, number], ahead: [number, number], done: () => void) => boolean) | null = null;

  /* the middle of a vehicle, and which way it faces */
  const mid = (v: Vehicle) => {
    const dx = v.fx - v.rx, dy = v.fy - v.ry, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    /* (the body sits a little ahead of the back axle, past the front) */
    const back = v.len * 0.5 * ft;
    return { x: v.rx + ux * (v.wb * ft * 0.5 + back * 0.12), y: v.ry + uy * (v.wb * ft * 0.5 + back * 0.12), ux, uy };
  };
  /* put a vehicle square, facing north, with its middle at (x, y) */
  const place = (v: Vehicle, x: number, y: number) => {
    const off = (v.wb * 0.5 + v.len * 0.06) * ft;
    v.rx = x; v.ry = y + off; v.fx = x; v.fy = v.ry - v.wb * ft;
  };

  /* the deli-side spaces, starting out full */
  const spots: Spot[] = (L.cars ?? []).filter((c) => deliSide(L, c)).map((c, i) => {
    const v = V[i];
    Object.assign(v, { on: true, kind: "park", v: 0, col: c[2], seed: Math.random(), len: 7.3, wb: 9, phase: "parked", t: 0, signal: 0, brake: 0, spot: i, stay: rnd(30, 120) });
    place(v, c[0], c[1]);
    return { x: c[0], y: c[1], car: i };
  });
  const busOn = () => V.some((q) => q.on && q.kind === "bus");
  const free = () => V.find((q) => !q.on);
  /* nothing already coming in at the bottom, in this lane */
  const roomAt = (x: number) => !V.some((q) => q.on && Math.abs(q.rx - x) < 6 * ft && q.ry > H - 0.12);

  const spawn = (bus: boolean) => {
    const v = free();
    if (!v || !L.street) return;
    const x = bus ? curb : lane;
    if (!roomAt(x)) return;
    const len = bus ? 18 : 7.3, wb = bus ? 22 : 9;
    const y = H + (len + 4) * ft;
    Object.assign(v, {
      on: true, kind: bus ? "bus" : "car", fx: x, fy: y - wb * ft, rx: x, ry: y, v: bus ? 17 : rnd(19, 25), t: 0, signal: 0, brake: 0,
      col: bus ? BUS : [0, 0, 1, 1, 2, 3, 4][Math.floor(Math.random() * 7)],
      seed: Math.random(), len, wb, phase: bus ? "in" : "drive", wander: Math.random() * 10, spot: -1,
    });
  };
  /* someone come to park: up the curb lane to the farthest space it can
     get to (past no parked car) */
  const spawnParker = () => {
    if (V.some((q) => q.on && q.kind === "park" && q.phase === "in")) return;
    let target = -1;
    [...spots.keys()].sort((a, b) => spots[b].y - spots[a].y).every((i) => {
      if (spots[i].car >= 0) return false;
      target = i; return true;
    });
    const v = free();
    if (target < 0 || !v) return;
    const s = spots[target];
    if (!roomAt(s.x)) return;
    const y = H + 11 * ft;
    Object.assign(v, {
      on: true, kind: "park", fx: s.x, fy: y - 9 * ft, rx: s.x, ry: y, v: rnd(14, 18), t: 0, signal: 0, brake: 0,
      col: [0, 0, 1, 1, 2, 3, 4][Math.floor(Math.random() * 7)], seed: Math.random(), len: 7.3, wb: 9,
      phase: "in", wander: 0, spot: target,
    });
    s.car = V.indexOf(v);
  };

  /* people: where everyone on foot is, so traffic can stop for anyone
     in its way; crossings: the lines (world y) of anyone crossing the
     side street, or about to */
  function update(dt: number, people: [number, number][], crossings: number[] = [], bikes: [number, number, number][] = []) {
    T += dt;
    const busy = 1 - 0.6 * night();
    nextCar -= dt; nextBus -= dt; nextPark -= dt;
    if (nextCar <= 0) { spawn(false); nextCar = rnd(9, 26) / busy; }
    if (nextBus <= 0) busDue = true;
    /* the bus, once the curb's clear for it */
    if (busDue && !busOn() && spots.every((s) => s.car < 0)) { spawn(true); if (busOn()) { busDue = false; nextBus = rnd(110, 190); } }
    if (nextPark <= 0) { if (!busDue && !busOn()) spawnParker(); nextPark = rnd(25, 70) / busy; }

    const live = V.filter((v) => v.on);
    for (const v of live) {
      v.t += dt;
      const bus = v.kind === "bus";
      const m = mid(v);

      /* parked: until someone comes for it (sooner when the bus is due),
         and only once there's room ahead to pull out */
      if (v.phase === "parked" || v.phase === "boarding") {
        v.v = 0; v.brake = 0; v.signal = 0;
        if (v.phase === "parked") {
          v.stay -= dt * (busDue ? 5 : 1);
          const roomAhead = !live.some((q) => q !== v && (q.phase === "parked" || q.phase === "boarding" || q.phase === "leave")
            && Math.abs(mid(q).x - m.x) < 4 * ft && mid(q).y < m.y && m.y - mid(q).y < (v.len + q.len + 8) * ft);
          if (v.stay <= 0 && roomAhead && !busOn()) {
            const door: [number, number] = [m.x - 3.4 * ft, m.y - 1.2 * ft];
            const ahead: [number, number] = [m.x + 1 * ft, m.y - (v.len + 2.5) * ft];
            const ok = driver?.(door, ahead, () => { v.phase = "leave"; v.t = 0; v.signal = -1; });
            if (ok) v.phase = "boarding"; else v.stay = rnd(4, 10);
          }
        }
        continue;
      }
      /* in, engine on, signalling: away once there's a gap behind */
      if (v.phase === "leave") {
        v.v = 0; v.brake = 1;
        const room = Math.max(25, 70 - Math.max(0, v.t - 8) * 3) * ft;
        const clear = !live.some((q) => q !== v && q.phase !== "parked" && q.phase !== "boarding" && Math.abs(mid(q).x - lane) < 5 * ft
          && mid(q).y > m.y - (v.len + 4) * ft && mid(q).y < m.y + room);
        if (v.t > 1.6 && clear) { v.phase = "out"; v.t = 0; }
        continue;
      }

      let want = bus ? 19 : v.phase === "in" ? 16 : 24 + 2 * Math.sin(v.seed * 20);
      /* anything ahead in the same lane (overlapping it side to side):
         keep a gap, easing down to it. (Someone parking doesn't, for the
         car parked in the space ahead of theirs: they pull up close.) */
      for (const q of live) {
        if (q === v) continue;
        if (v.phase === "in" && v.kind === "park" && (q.phase === "parked" || q.phase === "boarding" || q.phase === "leave")) continue;
        const mq = mid(q);
        if (mq.y >= m.y || Math.abs(mq.x - m.x) > 7.2 * ft) continue;
        const gap = (m.y - mq.y) / ft - v.len - q.len;
        want = Math.min(want, Math.max(0, (gap - 7) * 1.1), q.v + Math.max(0, gap - 12) * 0.6);
      }
      /* a bike up the street ahead: no passing it on this one; hang back
         behind at its pace (and the same anywhere near it on the way
         round the corner) */
      for (const [bx, by, bv] of bikes) {
        if (by >= m.y || Math.abs(bx - m.x) > ((bus ? 4.3 : 3) + 8) * ft) continue;
        const gap = (m.y - by) / ft - v.len - 3;
        if (gap > 60) continue;
        want = Math.min(want, Math.max(0, (gap - 8) * 1.1), bv + Math.max(0, gap - 12) * 0.6);
      }
      const front = m.y - v.len * ft;
      /* coming out onto the el street: give way to a bike riding along
         it (the stop line is the near edge of its lane) */
      if (L.el) {
        const elA = L.el[0] + 12.5 * ft, line = elA + 5 * ft;
        for (const [bx, by] of bikes) {
          if (Math.abs(by - elA) > 5 * ft || Math.abs(bx - m.x) > 45 * ft || front < line - 2 * ft) continue;
          want = Math.min(want, Math.max(0, ((front - line) / ft - 2) * 1.2));
        }
      }
      /* someone right in the way, in the road ahead (not on the
         sidewalk alongside, waiting for the bus): stop short */
      const reach = ((bus ? 4.3 : 3) + 2) * ft;
      for (const [px, py] of people) {
        const inRoad = (px > st[0] + 0.3 * ft && px < st[1] - 0.3 * ft) || (L.el && Math.abs(py - L.el[0]) < L.walk![1] - 2 * ft);
        if (!inRoad) continue;
        if (Math.abs(px - m.x) < reach && py < front + 2 * ft && front - py < 24 * ft) want = Math.min(want, Math.max(0, ((front - py) / ft - 8) * 1.4));
      }
      /* someone crossing ahead: stop before their line, if there's still
         room to (if not, it's too late, and they'll wait for it) */
      const brakeCap = bus ? 8 : 12;
      for (const cy of crossings) {
        const d = (front - cy) / ft - 6;
        if (front - cy < 0 || d > 90) continue;
        if (d >= -2 && v.v * v.v / (2 * brakeCap) < d + 2) want = Math.min(want, Math.max(0, d * 0.9));
      }
      /* and it rolls up to the corner a little slower, as drivers do */
      if (front - crossY < 30 * ft && front > crossY) want = Math.min(want, 14 + (front - crossY) / ft * 0.3);

      /* where the front's steering for */
      let tx = lane + Math.sin(T * 0.25 + v.wander) * 0.35 * ft;
      if (v.kind === "park" && v.phase === "in") {
        /* up the curb lane, slowing into its space */
        const s = spots[v.spot], toSpot = (m.y - s.y) / ft;
        tx = s.x;
        if (toSpot < 45) v.signal = 1;
        want = Math.min(want, Math.max(0, toSpot * 0.45 + 0.4));
        if (toSpot < 0.4 && v.v < 0.7) {
          place(v, s.x, s.y);
          v.phase = "parked"; v.v = 0; v.signal = 0; v.stay = rnd(60, 180);
          continue;
        }
      }
      if (v.kind === "park" && v.phase === "out") {
        tx = lane;
        want = Math.min(want, 3 + v.t * 4);
        if (Math.abs(v.fx - lane) < 0.4 * ft && Math.abs(v.rx - lane) < 0.8 * ft) {
          v.phase = "drive"; v.signal = 0; v.kind = "car";
          if (v.spot >= 0) spots[v.spot].car = -1;
          v.spot = -1;
        }
      }
      if (bus) {
        const toStop = (front - stopFront) / ft;
        if (v.phase === "in") {
          /* up the curb lane, the stop in sight: signal, and in */
          tx = curb;
          if (toStop < 75) v.signal = 1;
          want = Math.min(want, Math.max(0, toStop * 0.4 + 0.5));
          if (toStop < 0.6 && v.v < 0.6) { v.phase = "dwell"; v.t = 0; v.signal = 0; v.v = 0; boarding?.([st[1] + 0.6 * ft, m.y - (v.len - 3.5) * ft]); }
        }
        if (v.phase === "dwell") {
          want = 0; tx = curb;
          /* away when it's been long enough and nothing's alongside or
             coming up behind (the longer it's waited, the less room it
             asks for: a bus doesn't wait all day) */
          const room = Math.max(25, 70 - Math.max(0, v.t - 12) * 3) * ft;
          const clear = !live.some((q) => q !== v && Math.abs(mid(q).x - lane) < 4 * ft && mid(q).y > m.y - (v.len + 4) * ft && mid(q).y < m.y + room);
          if (v.t > 9) v.signal = -1;
          if (v.t > 10 && clear) { v.phase = "out"; v.t = 0; }
        }
        if (v.phase === "out") {
          tx = lane;
          want = Math.min(want, 4 + v.t * 3);
          if (Math.abs(v.fx - lane) < 0.3 * ft && Math.abs(v.rx - lane) < 0.6 * ft) { v.phase = "drive"; v.signal = 0; }
        }
      }
      /* speed: up gently, down firmly; brake lights while slowing */
      const acc = want > v.v ? (bus ? 3.2 : 6) : brakeCap;
      const dv = Math.max(-acc * dt, Math.min(acc * dt, want - v.v));
      v.v += dv;
      v.brake += ((dv < -0.02 || v.v < 0.3 ? 1 : 0) - v.brake) * Math.min(1, dt * 8);
      /* the front steers for its point a little way ahead, its turn
         limited the way a wheel's is; the back follows it */
      const look = Math.max(10, v.v * 1.4) * ft;
      const ang = Math.atan2(tx - v.fx, look);
      const maxA = bus ? 0.22 : 0.3;
      const a = Math.max(-maxA, Math.min(maxA, ang));
      v.fx += Math.sin(a) * v.v * ft * dt; v.fy -= Math.cos(a) * v.v * ft * dt;
      const dx = v.fx - v.rx, dy = v.fy - v.ry, d = Math.hypot(dx, dy) || 1;
      v.rx = v.fx - (dx / d) * v.wb * ft; v.ry = v.fy - (dy / d) * v.wb * ft;
      if (v.ry < -0.35) { v.on = false; if (v.spot >= 0) spots[v.spot].car = -1; v.spot = -1; }
    }
  }

  /* for the shader: (x, y, colour, 4 + heading) — the heading free, in
     radians from north — and (turn signal, blink, doors open / brake,
     a seed for the body) */
  const A = new Float32Array(MOVERS * 4), B = new Float32Array(MOVERS * 4);
  function pack() {
    V.forEach((v, i) => {
      if (!v.on) { A.set([9, 9, 0, 0], i * 4); B.set([0, 0, 0, 0], i * 4); return; }
      const m = mid(v);
      A.set([m.x, m.y, v.col, 4 + Math.atan2(m.ux, -m.uy)], i * 4);
      /* (parked, engine off: no lights; the seed's sign says so) */
      const off = v.phase === "parked" || v.phase === "boarding";
      B.set([v.signal, Math.sin(T * 9.4) > 0 ? 1 : 0, v.col === BUS ? (v.phase === "dwell" ? 1 : 0) : v.brake, off ? -v.seed - 0.01 : v.seed + 0.01], i * 4);
    });
    return { A, B };
  }
  /* for the pedestrians to keep clear of: (x, y, half-length ft, speed
     ft/s, and the way it's facing) */
  const bodies = () => V.filter((v) => v.on).map((v) => { const m = mid(v); return [m.x, m.y, v.len, v.v, m.ux, m.uy] as Body; });
  const onBoard = (fn: (door: [number, number]) => void) => { boarding = fn; };
  /* someone to walk out to a parked car and drive it away: given the
     driver's door and a point in the road ahead of the car, and called
     back once they're in; returns whether anyone's free to */
  const onDriver = (fn: (door: [number, number], ahead: [number, number], done: () => void) => boolean) => { driver = fn; };
  /* (dev: window.__traffic.bus() / .car() / .park() / .leave()) */
  const leave = () => { const v = V.find((q) => q.on && q.phase === "parked"); if (v) v.stay = 0; };
  /* the bus, for the sound: where it is, what it's doing and for how
     long, and how far its nose is from the stop (ft) */
  const busState = () => {
    const v = V.find((q) => q.on && q.kind === "bus");
    if (!v) return null;
    const m = mid(v);
    return { x: m.x, y: m.y, phase: v.phase, t: v.t, toStop: (m.y - v.len * ft - stopFront) / ft, v: v.v };
  };
  return { update, pack, onBoard, onDriver, bodies, busState, bus: () => { busDue = true; nextBus = 0; }, car: () => spawn(false), park: spawnParker, leave };
}
