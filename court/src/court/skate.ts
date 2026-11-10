/* ══ Skaters ══════════════════════════════════════════════
   Spring days: two friends have a session on the court. Simulated here,
   drawn by the people shader (shaders/people.ts).

   It goes the way a session goes. They hang about by the fence, standing
   on their boards. One takes a go: rolls over to the start of their line,
   pushes two or three times to get some speed, and tries the trick
   they're working on. Mostly it doesn't come off: the board squirts out
   and they run it out, then walk over, pick it up and roll back. Now and
   then it lands, they roll away clean, and carve back round. Then it's
   the other one's turn, the one waiting watching all the while. Sometimes
   they stand and talk for a bit before anyone goes again. Each gets a
   little more likely to land their trick the more they try it, and once
   it's landed, moves on to another.

   They skate in through the gate and out of it when it's no longer a
   spring day. Court coordinates in feet, as in pickup.ts. */

import type { Layout } from "./layouts";

export const SKATERS = 2;

type TrickName = "ollie" | "kickflip" | "shuvit" | "360flip" | "heelflip";
type Phase = "wait" | "toStart" | "push" | "air" | "ride" | "bail" | "fetch" | "back";
type Skater = {
  x: number; y: number; hd: number; v: number;          // the skater, travelling hd at v ft/s
  bx: number; by: number; bhd: number; bv: number;      // the board (with them, or off on its own)
  h: number; yaw: number; flip: number;                  // in the air: height ft, board spin, roll
  phase: Phase; t: number;                               // what they're doing, and for how long
  pushT: number; pushing: boolean; pushes: number;
  home: [number, number];                                // where they wait
  trick: TrickName; tries: number; land: boolean;
  wobble: number;                                        // a little fidget while waiting
  top: [number, number, number]; skin: [number, number, number]; hair: [number, number, number]; hairK: number;
  deck: number;
};
type Line = { s: [number, number]; t: [number, number]; e: [number, number] };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const TRICKS: TrickName[] = ["ollie", "kickflip", "kickflip", "heelflip", "shuvit", "360flip"];
/* how hard each is to land, first go */
const ODDS: Record<TrickName, number> = { ollie: 0.55, shuvit: 0.35, kickflip: 0.22, heelflip: 0.2, "360flip": 0.1 };
/* lines across the court: start, where they pop, where they'd roll out */
const LINES: Line[] = [
  { s: [40, 10], t: [24, 0], e: [10, -9] },
  { s: [40, -12], t: [25, -2], e: [10, 8] },
  { s: [12, 16], t: [26, 6], e: [40, -6] },
];

export function createSkaters(L: Layout) {
  const ft = L.ft, [cx, cy] = L.center;
  const W = (x: number, y: number): [number, number] => [cx - x * ft, cy + y * ft];
  const GATE: [number, number] = [(cx - L.fence[0]) / ft + 1, (L.gate[1] - cy) / ft];
  const OUT: [number, number] = [GATE[0] + 14, GATE[1] - 6];
  const tops: [number, number, number][] = [[0.32, 0.46, 0.62], [0.55, 0.62, 0.5], [0.85, 0.82, 0.74], [0.6, 0.3, 0.2]];
  const skins: [number, number, number][] = [[0.9, 0.72, 0.6], [0.48, 0.33, 0.24], [0.72, 0.53, 0.4]];
  const HOMES: [number, number][] = [[41, 19], [37.5, 21.5]];
  const S: Skater[] = Array.from({ length: SKATERS }, (_, i) => ({
    x: OUT[0], y: OUT[1], hd: Math.PI, v: 0, bx: OUT[0], by: OUT[1], bhd: Math.PI, bv: 0,
    h: 0, yaw: 0, flip: 0, phase: "back", t: 0, pushT: 0, pushing: false, pushes: 0,
    home: HOMES[i], trick: pick(TRICKS), tries: 0, land: false, wobble: Math.random() * 6,
    top: [...tops[(i * 2 + Math.floor(Math.random() * 2)) % tops.length]] as [number, number, number],
    skin: [...skins[(i + Math.floor(Math.random() * 2)) % skins.length]] as [number, number, number],
    hair: [...pick([[0.08, 0.06, 0.05], [0.3, 0.2, 0.12], [0.15, 0.15, 0.17]])] as [number, number, number],
    hairK: pick([0.9, 1]), deck: i,
  }));
  let state: "off" | "arriving" | "on" | "leaving" = "off";
  let present = 0;
  let turn = 0, nextGo = rnd(2, 4);
  let line: Line = LINES[0];

  /* steer toward a point, at a pace; returns the distance left */
  const steer = (s: Skater, tx: number, ty: number, speed: number, dt: number, turnRate = 2.5) => {
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    if (d > 0.05) s.hd += wrapPi(Math.atan2(dy, dx) - s.hd) * Math.min(1, dt * turnRate);
    s.v += (Math.min(speed, d * 1.5) - s.v) * Math.min(1, dt * 2);
    s.x += Math.cos(s.hd) * s.v * dt; s.y += Math.sin(s.hd) * s.v * dt;
    return d;
  };
  const boardWith = (s: Skater) => { s.bx = s.x; s.by = s.y; s.bhd = s.hd; s.bv = 0; };

  function update(dt: number, wanted: boolean) {
    if (wanted && (state === "off" || state === "leaving")) {
      if (present < 0.01) S.forEach((s) => { s.x = s.bx = OUT[0] + rnd(-2, 2); s.y = s.by = OUT[1] + rnd(-2, 2); s.phase = "back"; s.h = 0; });
      state = "arriving";
    }
    if (!wanted && (state === "on" || state === "arriving")) state = "leaving";
    if (state === "off") return;
    if (state === "arriving") present = Math.min(1, present + dt * 0.6);

    for (const s of S) {
      s.t += dt;
      s.wobble += dt;
      if (state === "leaving") {
        /* home time: roll out through the gate */
        const pastGate = s.x > GATE[0] - 1;
        const [tx, ty] = pastGate ? OUT : GATE;
        if (s.phase !== "fetch") { steer(s, tx, ty, 6, dt); boardWith(s); s.h = 0; s.yaw = s.flip = 0; }
        else { s.phase = "back"; }
        continue;
      }
      switch (s.phase) {
        case "back": {
          /* roll back over to where they hang about */
          const d = steer(s, s.home[0], s.home[1], 6, dt);
          boardWith(s);
          if (d < 1.2) { s.phase = "wait"; s.t = 0; s.v = 0; }
          break;
        }
        case "wait": {
          /* stood on the board, side-on, watching the line */
          s.v = 0;
          const o = S.find((q) => q !== s)!;
          /* (they face the other one: chatting, or watching their go;
             riding stance faces a quarter turn off the board) */
          const look = Math.atan2(o.y - s.y, o.x - s.x);
          s.hd += wrapPi(look - Math.PI / 2 - s.hd) * Math.min(1, dt * 1.5);
          s.x += Math.sin(s.wobble * 0.7) * 0.02 * dt;
          boardWith(s);
          break;
        }
        case "toStart": {
          const d = steer(s, line.s[0], line.s[1], 5, dt);
          boardWith(s);
          if (d < 1.5) { s.phase = "push"; s.t = 0; s.pushes = Math.floor(rnd(2, 4)); s.pushing = true; s.pushT = 0; }
          break;
        }
        case "push": {
          /* a few pushes along the line, then set the feet and go */
          const target = s.pushes > 0 ? 11 : s.v;
          if (s.pushing) {
            s.pushT += dt * 5;
            s.v += dt * 5;
            if (s.pushT > Math.PI * 2) { s.pushT = 0; s.pushes--; if (s.pushes <= 0) s.pushing = false; }
          }
          s.v = Math.min(target + 1, s.v);
          const dx = line.t[0] - s.x, dy = line.t[1] - s.y, d = Math.hypot(dx, dy);
          s.hd += wrapPi(Math.atan2(dy, dx) - s.hd) * Math.min(1, dt * 3);
          s.x += Math.cos(s.hd) * s.v * dt; s.y += Math.sin(s.hd) * s.v * dt;
          boardWith(s);
          if (d < 1.5 || (d < s.v * 0.3 && !s.pushing)) {
            s.phase = "air"; s.t = 0;
            s.land = Math.random() < Math.min(0.85, ODDS[s.trick] + s.tries * 0.05);
          }
          break;
        }
        case "air": {
          const dur = s.trick === "ollie" ? 0.5 : 0.58;
          const u = Math.min(1, s.t / dur);
          s.h = 4 * 1.9 * u * (1 - u);
          const spin = s.trick === "shuvit" ? Math.PI : s.trick === "360flip" ? Math.PI * 2 : 0;
          const roll = s.trick === "kickflip" || s.trick === "360flip" ? Math.PI * 2 : s.trick === "heelflip" ? -Math.PI * 2 : 0;
          s.x += Math.cos(s.hd) * s.v * dt; s.y += Math.sin(s.hd) * s.v * dt;
          /* (a miss: the board doesn't come all the way round) */
          const k = s.land ? 1 : rnd(0.5, 0.8);
          s.yaw = spin * Math.min(1, u * 1.1) * k; s.flip = roll * u * k;
          boardWith(s);
          if (u >= 1) {
            s.h = 0; s.t = 0; s.tries++;
            if (s.land) { s.phase = "ride"; s.yaw = 0; s.flip = 0; }
            else {
              /* off it goes, on its own; they run it out */
              s.phase = "bail";
              s.bv = s.v * rnd(0.8, 1.2); s.bhd = s.hd + rnd(-0.9, 0.9);
              s.flip = Math.random() < 0.3 ? Math.PI : 0;   // sometimes it lands upside down
            }
          }
          break;
        }
        case "ride": {
          /* landed: roll away clean, then carve round and back */
          const d = steer(s, line.e[0], line.e[1], s.v, dt, 1.2);
          boardWith(s);
          if (d < 4 || s.t > 4) {
            s.phase = "back"; s.t = 0;
            s.trick = pick(TRICKS.filter((q) => q !== s.trick)); s.tries = 0;
            endTurn(s, true);
          }
          break;
        }
        case "bail": {
          /* the run-out: a few quick steps, slowing */
          s.v = Math.max(0, s.v - dt * 14);
          s.x += Math.cos(s.hd) * s.v * dt; s.y += Math.sin(s.hd) * s.v * dt;
          s.pushT += dt * 10;
          if (s.v < 0.5 && s.t > 0.6) { s.phase = "fetch"; s.t = 0; }
          break;
        }
        case "fetch": {
          /* a walk over to the board, a moment to flip it back, and on */
          const dx = s.bx - s.x, dy = s.by - s.y, d = Math.hypot(dx, dy);
          if (s.bv < 0.3) {
            s.hd += wrapPi(Math.atan2(dy, dx) - s.hd) * Math.min(1, dt * 5);
            const sp = Math.min(4, d * 2);
            s.x += (dx / (d || 1)) * sp * dt; s.y += (dy / (d || 1)) * sp * dt;
            s.pushT += dt * 6;
          }
          if (d < 1.1 && s.bv < 0.3) {
            s.flip = 0; s.yaw = 0; s.hd = s.bhd; s.v = 1.5;
            s.phase = "back"; s.t = 0;
            endTurn(s, false);
          }
          break;
        }
      }
      if (s.phase === "bail" || s.phase === "fetch") {
        /* the board rolls off and slows */
        s.bv = Math.max(0, s.bv - dt * 5);
        s.bx += Math.cos(s.bhd) * s.bv * dt; s.by += Math.sin(s.bhd) * s.bv * dt;
        s.yaw += dt * s.bv * 0.15;
        if (s.bx < 1 || s.bx > 44 || Math.abs(s.by) > 24) { s.bv *= 0.3; s.bhd += Math.PI; }
        s.bx = Math.max(1, Math.min(44, s.bx)); s.by = Math.max(-24, Math.min(24, s.by));
      }
      s.x = Math.max(1, Math.min(70, s.x)); s.y = Math.max(-24, Math.min(24, s.y));
    }

    /* whose go: when both are waiting, after a moment (or a natter) */
    if (state === "arriving" && S.every((s) => s.phase === "wait")) state = "on";
    if (state === "on" && S.every((s) => s.phase === "wait")) {
      nextGo -= dt;
      if (nextGo <= 0) {
        const s = S[turn];
        line = pick(LINES);
        s.phase = "toStart"; s.t = 0;
      }
    }
    if (state === "leaving" && S.every((s) => s.x > GATE[0] + 2)) present = Math.max(0, present - dt * 0.8);
    if (state === "leaving" && present <= 0) state = "off";
  }
  /* the next go: the other one, usually; one more for the stubborn, after
     a near thing; now and then a break to talk */
  const endTurn = (s: Skater, landed: boolean) => {
    const me = S.indexOf(s);
    turn = !landed && Math.random() < 0.3 ? me : 1 - me;
    nextGo = Math.random() < 0.25 ? rnd(8, 16) : rnd(1.5, 4);
  };

  const threats = (): [number, number, number][] => present > 0.1 ? S.map((s) => [...W(s.x, s.y), 7] as [number, number, number]) : [];
  const busy = () => state !== "off";

  /* for the shader: the skater (x, y, facing, kick phase), (top rgb,
     kind: 5 riding / 6 pushing / 3 on foot), (hair rgb, presence), (skin
     rgb, hair cover); the board (x, y, heading, height) and (spin, roll,
     deck, on) */
  const A = new Float32Array(SKATERS * 4), B = new Float32Array(SKATERS * 4), C = new Float32Array(SKATERS * 4), D = new Float32Array(SKATERS * 4);
  const Bd = new Float32Array(SKATERS * 4), Bd2 = new Float32Array(SKATERS * 4);
  function pack() {
    S.forEach((s, i) => {
      const [x, y] = W(s.x, s.y), [bx, by] = W(s.bx, s.by);
      const off = state === "off";
      /* on the board they stand side-on: facing a quarter turn from it
         (court headings flip into the world) */
      const trav = Math.PI - s.hd;
      const onFoot = s.phase === "bail" || s.phase === "fetch";
      const kind = onFoot ? (s.phase === "bail" ? 3 : 0) : s.phase === "push" && s.pushing ? 6 : 5;
      A.set(off ? [9, 9, 0, 0] : [x, y, onFoot ? trav : trav - Math.PI / 2, onFoot || kind === 6 ? s.pushT : 0], i * 4);
      B.set([...s.top, kind], i * 4);
      C.set([...s.hair, present], i * 4);
      D.set([...s.skin, s.hairK], i * 4);
      Bd.set(off ? [9, 9, 0, 0] : [bx, by, Math.PI - s.bhd, onFoot ? 0 : s.h], i * 4);
      Bd2.set([s.yaw, s.flip, s.deck, off ? 0 : 1], i * 4);
    });
    return { A, B, C, D, Bd, Bd2 };
  }
  return { update, pack, threats, busy };
}
