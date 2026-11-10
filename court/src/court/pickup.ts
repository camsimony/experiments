/* ══ Pickup game ══════════════════════════════════════════
   Summer days: a game of three on three on the half court, white tees
   against bright colours. Simulated here; the players are drawn by the people shader and
   the ball by its own (shaders/people.ts).

   The offence spreads round the arc and moves: a cut, a drift to the
   corner, a step up to the top. It's man to man: each defender stays
   between their man and the rim, tighter on the ball, and stays home.
   Now and then, on a drive, the nearest helper leaves his man to double
   the ball; the man he left drifts out beyond the arc, the ball's kicked
   out to him, and he lets a three go while the helper scrambles back.
   Off a miss, only the nearest of each side goes for the rebound (and a
   second if it's come right to them); the rest hold their spots. The one with the ball dribbles, and
   every couple of seconds passes, drives or shoots. A shot arcs up to
   the rim; it drops through, or comes off and everyone near crashes for
   it. The other team gets the ball after a make, or a defensive
   rebound, and takes it back out past the arc before they can score.

   When it's no longer a summer day they drift off through the gate, and
   come back next time. Court coordinates are in feet from the middle of
   the baseline (x out into the court, y across it), as in the shader. */

import type { Layout } from "./layouts";

export const PLAYERS = 6;
const RIM: [number, number] = [5.25, 0];

type Player = {
  x: number; y: number; hd: number; phase: number;  // court ft
  tx: number; ty: number;                           // where they're heading
  team: number; man: number;                        // defender: who they guard
  top: [number, number, number]; hair: [number, number, number];
  skin: [number, number, number]; hairK: number;   // how much of the head is hair (shaved .. full)
  pose: number;                                     // 0 running, 1 shooting / contesting
  speed: number;
  /* moving like a player, not a cursor: a velocity that builds and
     bleeds off, a target that's followed smoothly, a stride of their own */
  vx: number; vy: number; sx: number; sy: number; cad: number;
};
type Ball = {
  x: number; y: number; h: number;
  mode: "held" | "pass" | "shot" | "loose" | "gone";
  holder: number; to: number;
  t: number; dur: number; from: [number, number, number]; aim: [number, number, number];
  vx: number; vy: number; vh: number; make: boolean;
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const SPOTS: [number, number][] = [[24, 0], [21, 13], [21, -13], [4, 21], [4, -21], [9, 8], [9, -8], [15, 4], [15, -4]];
/* out beyond the arc (23.75 ft from the rim; 22 in the corners): where
   the open man goes when his defender's left him */
const THREES: [number, number][] = [[32, 0], [24, 18], [24, -18], [4, 24], [4, -24]];
/* (no reds: they'd be lost on the lane) */
const BRIGHT = [[0.2, 0.36, 0.72], [0.16, 0.3, 0.62], [0.92, 0.7, 0.18], [0.12, 0.12, 0.14]];
const SHIRTS = [[0.93, 0.93, 0.9], [0.9, 0.9, 0.88], [0.85, 0.86, 0.84]];
/* light, medium and dark */
const SKIN = [[0.93, 0.76, 0.64], [0.86, 0.66, 0.52], [0.74, 0.54, 0.4], [0.62, 0.44, 0.31], [0.44, 0.3, 0.21], [0.32, 0.21, 0.15]];
const HAIR = [[0.06, 0.05, 0.05], [0.1, 0.08, 0.07], [0.2, 0.14, 0.09], [0.12, 0.12, 0.14]];

export function createPickup(L: Layout) {
  const ft = L.ft, [cx, cy] = L.center;
  /* court ft -> world (half court: x runs back from the baseline) */
  const W = (x: number, y: number): [number, number] => [cx - x * ft, cy + y * ft];
  const GATE: [number, number] = [(cx - L.fence[0]) / ft + 1, (L.gate[1] - cy) / ft];
  const OUT: [number, number] = [GATE[0] + 14, GATE[1] - 6];

  const players: Player[] = Array.from({ length: PLAYERS }, (_, i) => {
    const team = i < 3 ? 0 : 1;
    return {
      x: OUT[0], y: OUT[1], hd: 0, phase: Math.random() * 6, tx: OUT[0], ty: OUT[1],
      team, man: team === 1 ? i - 3 : -1,
      /* white tees against the bright ones */
      top: [...(team === 0 ? pick(SHIRTS) : pick(BRIGHT))] as [number, number, number],
      hair: [...pick(HAIR)] as [number, number, number], pose: 0,
      /* everyone their own skin: spread across light, medium and dark */
      skin: [...SKIN[(i * 2 + (i < 3 ? 0 : 1) + Math.floor(Math.random() * 2)) % SKIN.length]] as [number, number, number],
      hairK: pick([0.15, 0.6, 0.9, 1]), speed: rnd(12, 16),
      vx: 0, vy: 0, sx: OUT[0], sy: OUT[1], cad: rnd(0.9, 1.08),
    };
  });
  const ball: Ball = { x: 0, y: 0, h: 0, mode: "gone", holder: -1, to: -1, t: 0, dur: 1, from: [0, 0, 0], aim: [0, 0, 0], vx: 0, vy: 0, vh: 0, make: false };
  let offence = 0;            // which team has it
  let cleared = true;         // taken it back out past the arc since the change
  let nextMove = 2;           // the ball handler's next decision
  let state: "off" | "arriving" | "playing" | "leaving" = "off";
  let present = 0;            // how much of them shows (fades at the gate)
  let dribble = 0;
  const spot: number[] = [0, 1, 2];
  /* a double team: the helper who's left his man, the man he left, and
     where that man's gone to wait for it; then the kick-out to him */
  let dbl: { helper: number; open: number; at: [number, number]; t: number; trapped: boolean } | null = null;
  let openShooter = -1;       // caught the kick-out: shoots it, straight away
  let openAt: [number, number] | null = null;   // and where he's set up for it
  let forceShot = false;

  const off = () => players.filter((p) => p.team === offence);
  const idx = (p: Player) => players.indexOf(p);
  const distRim = (p: Player) => Math.hypot(p.x - RIM[0], p.y - RIM[1]);

  const giveTo = (i: number) => {
    ball.mode = "held"; ball.holder = i; nextMove = rnd(1.2, 2.6); forceShot = false;
    if (i === openShooter) { nextMove = rnd(0.3, 0.55); forceShot = true; }
    else openAt = null;
    openShooter = -1;
  };
  /* the nearest helper comes off his man to trap the ball; his man
     slides out to the open spot beyond the arc farthest from everyone */
  const startDouble = () => {
    const h = players[ball.holder];
    const helper = players.filter((p) => p.team !== offence && p.man !== ball.holder)
      .sort((p, q) => Math.hypot(p.x - h.x, p.y - h.y) - Math.hypot(q.x - h.x, q.y - h.y))[0];
    if (!helper) return;
    const open = helper.man;
    const others = players.filter((p) => idx(p) !== open);
    const at = [...THREES].sort((a, b) =>
      Math.min(...others.map((q) => Math.hypot(q.x - b[0], q.y - b[1]))) - Math.min(...others.map((q) => Math.hypot(q.x - a[0], q.y - a[1]))))[0];
    dbl = { helper: idx(helper), open, at, t: 0, trapped: false };
  };
  const startGame = () => {
    offence = 0; cleared = true;
    off().forEach((p, k) => { spot[k] = k; });
    giveTo(0);
  };
  const changePossession = (to: number) => {
    offence = players[to].team; cleared = false; dbl = null; openShooter = -1; openAt = null;
    players.forEach((p) => { p.man = p.team !== offence ? (idx(p) + 3) % 6 : -1; });
    giveTo(to);
  };

  const pass = (from: number, target?: number) => {
    const mates = off().filter((p) => idx(p) !== from);
    const to = target ?? idx(pick(mates));
    const a = players[from], b = players[to];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    Object.assign(ball, { mode: "pass", holder: -1, to, t: 0, dur: Math.max(0.35, d / 34), from: [a.x, a.y, 4], aim: [b.x, b.y, 4] });
  };
  const shoot = (from: number) => {
    const a = players[from], d = distRim(a);
    a.pose = 1;
    const def = players.filter((p) => p.team !== offence).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
    const contested = !!def && Math.hypot(def.x - a.x, def.y - a.y) < 6;
    const make = Math.random() < (d < 7 ? 0.62 : d < 16 ? 0.45 : 0.35) + (contested ? 0 : 0.08);
    dbl = null; openAt = null; forceShot = false;
    Object.assign(ball, { mode: "shot", holder: -1, to: -1, t: 0, dur: 0.75 + d * 0.025, from: [a.x, a.y, 7], aim: [RIM[0], RIM[1], 10], make });
    /* the nearest defender goes up to contest */
    if (contested) def.pose = 1;
  };

  function update(dt: number, wanted: boolean) {
    /* coming and going */
    if (wanted && (state === "off" || state === "leaving")) {
      state = "arriving";
      if (present < 0.01) players.forEach((p) => { p.x = OUT[0] + rnd(-3, 3); p.y = OUT[1] + rnd(-3, 3); });
    }
    if (!wanted && (state === "playing" || state === "arriving")) { state = "leaving"; ball.mode = "gone"; }
    if (state === "off") return;

    if (state === "arriving") {
      present = Math.min(1, present + dt * 0.6);
      players.forEach((p, i) => { const s = SPOTS[i % 3 + (p.team ? 5 : 0)] ?? SPOTS[i]; p.tx = s[0]; p.ty = s[1]; });
      if (players.every((p) => Math.hypot(p.x - p.tx, p.y - p.ty) < 3)) { state = "playing"; startGame(); }
    } else if (state === "leaving") {
      players.forEach((p, i) => {
        const pastGate = p.x > GATE[0] - 1;
        p.tx = pastGate ? OUT[0] : GATE[0]; p.ty = (pastGate ? OUT[1] : GATE[1]) + (i - 2.5) * 0.8;
      });
      if (players.every((p) => p.x > GATE[0])) present = Math.max(0, present - dt * 0.8);
      if (present <= 0) { state = "off"; players.forEach((p) => { p.x = OUT[0]; p.y = OUT[1]; }); }
    } else {
      /* ── the play */
      const O = off();
      O.forEach((p, k) => {
        if (idx(p) === ball.holder) return;
        /* now and then a new spot: one that keeps the floor spread (not
           near where a teammate is, or is going) */
        if (Math.random() < dt * 0.35) {
          const free = SPOTS.map((_, j) => j).filter((j) => O.every((q, m) => m === k
            || (Math.hypot(SPOTS[j][0] - q.x, SPOTS[j][1] - q.y) > 11 && j !== spot[m])));
          if (free.length) spot[k] = pick(free);
        }
        const s = dbl && idx(p) === dbl.open ? dbl.at : openAt && idx(p) === openShooter ? openAt : SPOTS[spot[k]];
        p.tx = s[0]; p.ty = s[1];
      });
      players.filter((p) => p.team !== offence).forEach((p) => {
        /* the helper in a double: up on the ball, from the side he came */
        if (dbl && idx(p) === dbl.helper && ball.mode === "held") {
          const h = players[ball.holder], d = Math.hypot(p.x - h.x, p.y - h.y) || 1;
          p.tx = h.x + (p.x - h.x) / d * 2.4; p.ty = h.y + (p.y - h.y) / d * 2.4;
          return;
        }
        const m = players[p.man];
        if (!m) return;
        const onBall = ball.holder === p.man;
        /* (off the ball, sagging a little more toward the rim) */
        const k = onBall ? 0.18 : 0.32;
        p.tx = m.x + (RIM[0] - m.x) * k; p.ty = m.y + (RIM[1] - m.y) * k;
      });
      if (ball.mode === "loose") {
        const byBall = (team: number) => players.filter((p) => p.team === team)
          .sort((p, q) => Math.hypot(p.x - ball.x, p.y - ball.y) - Math.hypot(q.x - ball.x, q.y - ball.y));
        if (ball.make) {
          /* after a make: the scorers jog back to pick up their men; the
             nearest of the others goes and gets it, the rest spread */
          players.filter((p) => p.team === offence).forEach((p) => {
            const m = players[(idx(p) + 3) % 6];
            /* (and out of the way of whoever's fetching it: back past
               the foul line) */
            p.tx = Math.max(16, m.x + (RIM[0] - m.x) * 0.32); p.ty = m.y + (RIM[1] - m.y) * 0.32;
          });
          byBall(1 - offence).forEach((p, k) => {
            if (k === 0) { p.tx = ball.x; p.ty = ball.y; return; }
            const s = SPOTS[k]; p.tx = s[0]; p.ty = s[1];
          });
        } else {
          /* a miss: the nearest of each side goes for it (and a second, if
             it's come right to them); everyone else holds */
          for (const team of [0, 1]) byBall(team).forEach((p, k) => {
            const d = Math.hypot(p.x - ball.x, p.y - ball.y);
            if (k === 0 || (k === 1 && d < 6)) { p.tx = ball.x; p.ty = ball.y; }
          });
        }
      }
      if (ball.mode === "held") {
        const h = players[ball.holder];
        nextMove -= dt;
        if (dbl) dbl.t += dt;
        if (!cleared) {
          /* take it back out past the arc */
          h.tx = 25; h.ty = h.y * 0.6;
          if (h.x > 23) { cleared = true; nextMove = rnd(0.8, 1.6); }
        } else if (dbl && !dbl.trapped) {
          /* the trap coming: keep the dribble alive until it's on him (or
             it doesn't come in time) */
          const hp = players[dbl.helper];
          if (Math.hypot(hp.x - h.x, hp.y - h.y) < 3.6) { dbl.trapped = true; nextMove = rnd(0.35, 0.7); h.tx = h.x; h.ty = h.y; }
          else if (dbl.t > 3) { dbl = null; nextMove = 0.6; }
        } else if (nextMove <= 0) {
          const d = distRim(h), r = Math.random();
          if (forceShot) { forceShot = false; shoot(ball.holder); }
          else if (dbl) {
            /* doubled: find the man who's been left, once he's out beyond
               the arc (holding the dribble a beat longer if he isn't) */
            const o = players[dbl.open];
            if (Math.hypot(o.x - dbl.at[0], o.y - dbl.at[1]) > 2 && dbl.t < 4) nextMove = 0.15;
            else { openShooter = dbl.open; openAt = dbl.at; pass(ball.holder, dbl.open); dbl = null; }
          }
          else if (d < 6) shoot(ball.holder);
          else if (r < 0.55) pass(ball.holder);
          else if (r < 0.75 && d < 25) shoot(ball.holder);
          else {
            /* drive: and sometimes the help comes */
            h.tx = RIM[0] + 3; h.ty = h.y * 0.2; nextMove = 1.1;
            if (Math.random() < 0.45) startDouble();
          }
          if (ball.mode === "held" && !dbl) nextMove = Math.max(nextMove, 0.8);
        } else if (!forceShot && Math.hypot(h.x - h.tx, h.y - h.ty) < 1) {
          h.tx = h.x + rnd(-4, 4); h.ty = h.y + rnd(-4, 4);
        }
        /* (set for the kick-out three: feet set, right where he is) */
        if (forceShot && openAt) { h.tx = openAt[0]; h.ty = openAt[1]; }
      }
    }

    /* everyone moves toward where they're heading. Not straight at it:
       where they're heading is followed smoothly (so a defender tracks
       their man without twitching), and they speed up and slow down the
       way a body does, cutting hard but never stopping dead. Close to
       someone, they ease apart rather than being shoved */
    const playing = state === "playing";
    players.forEach((p) => {
      p.sx += (p.tx - p.sx) * Math.min(1, dt * 4); p.sy += (p.ty - p.sy) * Math.min(1, dt * 4);
      const dx = p.sx - p.x, dy = p.sy - p.y, d = Math.hypot(dx, dy);
      const top = p.speed * (playing ? 1 : 0.45);
      /* (arriving: slow down over the last few feet) */
      const want = Math.min(top, d * 1.6);
      let wx = d > 0.05 ? (dx / d) * want : 0, wy = d > 0.05 ? (dy / d) * want : 0;
      for (const q of players) {
        if (q === p) continue;
        const ox = p.x - q.x, oy = p.y - q.y, od = Math.hypot(ox, oy);
        if (od < 3 && od > 0.01) { const k = (3 - od) * 2.2; wx += (ox / od) * k; wy += (oy / od) * k; }
      }
      const acc = 26;
      const ax = wx - p.vx, ay = wy - p.vy, am = Math.hypot(ax, ay), step = Math.min(am, acc * dt);
      if (am > 1e-4) { p.vx += (ax / am) * step; p.vy += (ay / am) * step; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.x = Math.max(0.5, Math.min(playing ? 44 : 70, p.x)); p.y = Math.max(-24, Math.min(24, p.y));
      /* where they face: the ball, mostly. A player keeps the ball in
         view: a defender shuffles sideways and back without turning
         round, someone off the ball drifts facing it. Only a real run,
         and one not straight away from the ball, turns them the way
         they're going (and even then not all the way). Turned toward at
         a body's pace, and small differences let be, so no one twitches */
      const sp = Math.hypot(p.vx, p.vy);
      /* (the one with the ball can't face it: he faces the basket, or
         the way he's driving; and anyone the ball's about to reach, the
         same, so no one whips round as it lands in their hands) */
      const mine = ball.holder === idx(p) && ball.mode === "held" || ball.to === idx(p) && ball.mode === "pass" && ball.t > ball.dur * 0.7;
      let bx = ball.x - p.x, by = ball.y - p.y;
      if (mine || Math.hypot(bx, by) < 2.5) { bx = RIM[0] - p.x; by = RIM[1] - p.y; }
      const bd = Math.hypot(bx, by) || 1;
      const vx = sp > 0.01 ? p.vx / sp : 0, vy = sp > 0.01 ? p.vy / sp : 0;
      const run = Math.max(0, Math.min(1, (sp - 5) / 5));
      const toward = Math.max(0, (vx * bx + vy * by) / bd + 0.35);
      const w = run * Math.min(1, 0.3 + 0.7 * toward) * (p.team === offence ? 0.9 : 0.55);
      const fx = vx * w + (bx / bd) * (1 - w), fy = vy * w + (by / bd) * (1 - w);
      const turn = wrapPi(Math.atan2(fy, fx) - p.hd);
      if (Math.abs(turn) > 0.12) p.hd += Math.max(-dt * 4.5, Math.min(dt * 4.5, turn * Math.min(1, dt * 4)));
      p.phase += dt * (0.4 + sp * 0.55) * p.cad;
      /* (slowing to a stand, the feet come together: eased, not snapped) */
      if (sp < 2) p.phase += (Math.round(p.phase / Math.PI) * Math.PI - p.phase) * Math.min(1, dt * 3 * (1 - sp / 2));
      if (ball.mode !== "shot") p.pose = Math.max(0, p.pose - dt * 2);
    });

    /* ── the ball */
    if (ball.mode === "held") {
      const h = players[ball.holder];
      /* dribbled at the side, bouncing; up at the chest when standing */
      const side = 0.9, f = Math.cos(h.hd), s = Math.sin(h.hd);
      ball.x = h.x + f * 0.9 - s * side; ball.y = h.y + s * 0.9 + f * side;
      /* (its own beat: a dribble doesn't stop when they do) */
      dribble += dt * 4.2;
      ball.h = 0.4 + Math.abs(Math.sin(dribble)) * 2.6;
    } else if (ball.mode === "pass" || ball.mode === "shot") {
      ball.t += dt;
      if (ball.mode === "pass") { const b = players[ball.to]; ball.aim = [b.x, b.y, 4]; }
      const u = Math.min(1, ball.t / ball.dur);
      ball.x = ball.from[0] + (ball.aim[0] - ball.from[0]) * u;
      ball.y = ball.from[1] + (ball.aim[1] - ball.from[1]) * u;
      const peak = ball.mode === "shot" ? 15 + Math.hypot(ball.from[0] - RIM[0], ball.from[1]) * 0.2 : 5;
      ball.h = ball.from[2] + (ball.aim[2] - ball.from[2]) * u + 4 * (peak - Math.max(ball.from[2], ball.aim[2])) * u * (1 - u);
      if (u >= 1) {
        if (ball.mode === "pass") giveTo(ball.to);
        else if (ball.make) {
          /* through the net: dropped to the court under the rim, and the
             other team takes it out */
          Object.assign(ball, { mode: "loose", vx: rnd(-1, 1), vy: rnd(-1, 1), vh: -2, make: true });
        } else {
          /* off the rim */
          const a = rnd(-1.4, 1.4) + Math.PI * 0;
          Object.assign(ball, { mode: "loose", vx: Math.cos(a) * rnd(8, 14), vy: Math.sin(a) * rnd(8, 14), vh: rnd(4, 8), make: false });
        }
      }
    } else if (ball.mode === "loose") {
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.h += ball.vh * dt; ball.vh -= 32 * dt;
      if (ball.h < 0.4) { ball.h = 0.4; ball.vh = Math.abs(ball.vh) * 0.55; ball.vx *= 0.8; ball.vy *= 0.8; if (ball.vh < 1.5) ball.vh = 0; }
      ball.x = Math.max(0.5, Math.min(44, ball.x)); ball.y = Math.max(-24, Math.min(24, ball.y));
      /* whoever gets to it first; after a make, the other team */
      const grab = players
        .filter((p) => !ball.make || p.team !== offence)
        .find((p) => Math.hypot(p.x - ball.x, p.y - ball.y) < 2.2 && ball.h < 6);
      if (grab) {
        if (grab.team !== offence) changePossession(idx(grab));
        else giveTo(idx(grab));
      } else if (ball.make) {
        /* the new offence's nearest goes and gets it */
        const n = players.filter((p) => p.team !== offence).sort((p, q) => Math.hypot(p.x - ball.x, p.y - ball.y) - Math.hypot(q.x - ball.x, q.y - ball.y))[0];
        n.tx = ball.x; n.ty = ball.y;
      }
    }
  }

  /* where they are, for the pigeons */
  const threats = (): [number, number, number][] => present > 0.1 ? players.map((p) => [...W(p.x, p.y), 6] as [number, number, number]) : [];
  const busy = () => state !== "off";

  /* for the shader, like the passers-by: (x, y, heading, phase),
     (top rgb, kind 3 running / 4 arms up), (hair rgb, presence); and the
     ball (x, y, height ft, on) */
  const A = new Float32Array(PLAYERS * 4), B = new Float32Array(PLAYERS * 4), C = new Float32Array(PLAYERS * 4), D = new Float32Array(PLAYERS * 4), Bl = new Float32Array(4);
  function pack() {
    players.forEach((p, i) => {
      const [wx, wy] = W(p.x, p.y);
      /* (court x runs back from the baseline: headings flip with it) */
      /* the stride's sway and the shoulders' turn, as the passers-by,
         fading as they slow; standing, the feet settle */
      const go = Math.min(1, Math.hypot(p.vx, p.vy) / 8);
      const sway = Math.sin(p.phase) * 0.09 * go * ft, twist = Math.sin(p.phase) * 0.1 * go;
      const hd = Math.PI - p.hd;
      A.set(state === "off" ? [9, 9, 0, 0] : [wx - Math.sin(hd) * sway, wy + Math.cos(hd) * sway, hd + twist, p.phase], i * 4);
      B.set([...p.top, p.pose > 0.5 ? 4 : 3], i * 4);
      C.set([...p.hair, present], i * 4);
      D.set([...p.skin, p.hairK], i * 4);
    });
    const [bx, by] = W(ball.x, ball.y);
    Bl.set(state === "playing" && ball.mode !== "gone" ? [bx, by, ball.h, 1] : [9, 9, 0, 0]);
    return { A, B, C, D, Bl };
  }
  return { update, pack, threats, busy };
}
