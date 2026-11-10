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
  /* on their feet: each foot is somewhere on the court and stays there
     while it's down, the body carried over it; then it's picked up and
     put down ahead (or to the side, or behind: wherever the body's
     going). fl, fr: the feet (court ft); sw: which is in the air (-1
     neither, 0 fl, 1 fr), how far through its step (su), how long the
     step takes, and where it's from and to; last: which stepped last;
     set: standing, settled where they meant to be */
  fl: [number, number]; fr: [number, number];
  sw: number; su: number; sdur: number; sf: [number, number]; st: [number, number]; last: number;
  set: boolean;
  /* what they've got on. hat: 0 nothing, 1 a headband, 2 a fitted cap,
     3 the cap on backwards, 4 a durag, 5 a lot of hair; kit: 0 a tee,
     1 a jersey (bare shoulders, piping); shoe and shorts: which of a few
     colours; hatC: the hat's colour; trim: the jersey's piping (0 orange,
     1 blue, 2 white) */
  guard: number;   // down in a defender's stance, arms out (0..1)
  hat: number; kit: number; shoe: number; shorts: number; hatC: [number, number, number]; trim: number;
};
type Ball = {
  x: number; y: number; h: number;
  mode: "held" | "pass" | "shot" | "loose" | "gone" | "carried";   // carried: under someone's arm, on the way in or out
  holder: number; to: number;
  t: number; dur: number; from: [number, number, number]; aim: [number, number, number];
  vx: number; vy: number; vh: number; make: boolean;
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
/* how far from the body a foot's drawn (ft): as it is up to the first,
   never past the second */
const REACH_NEAR = 0.9, REACH_MAX = 1.7;
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const SPOTS: [number, number][] = [[24, 0], [21, 13], [21, -13], [4, 21], [4, -21], [9, 8], [9, -8], [15, 4], [15, -4]];
/* out beyond the arc (23.75 ft from the rim; 22 in the corners): where
   the open man goes when his defender's left him */
const THREES: [number, number][] = [[32, 0], [24, 18], [24, -18], [4, 24], [4, -24]];
/* (no reds: they'd be lost on the lane) */
/* light, medium and dark */
const SKIN = [[0.93, 0.76, 0.64], [0.86, 0.66, 0.52], [0.74, 0.54, 0.4], [0.62, 0.44, 0.31], [0.44, 0.3, 0.21], [0.32, 0.21, 0.15]];
/* what a New York court's wearing: for the side in white, a home Knicks
   jersey, a white tee, a heather grey one; for the other, the Knicks'
   blue, their orange, a black tee. [top, kit, trim] */
const KITS: [number[], number, number][][] = [
  [[[0.95, 0.95, 0.93], 1, 1], [[0.93, 0.93, 0.9], 0, 0], [[0.74, 0.75, 0.76], 0, 0]],
  [[[0.1, 0.3, 0.72], 1, 0], [[0.95, 0.5, 0.12], 1, 1], [[0.11, 0.11, 0.13], 0, 0]],
];
/* on their heads: [hat, colour]: nothing; a white headband, an orange
   one; a navy fitted (the Yankees'), forwards and back; a black durag, a
   red one; a lot of hair */
const HATS: [number, number[]][] = [[0, [0, 0, 0]], [0, [0, 0, 0]], [1, [0.95, 0.95, 0.93]], [1, [0.95, 0.5, 0.12]], [2, [0.09, 0.12, 0.24]], [3, [0.09, 0.12, 0.24]], [3, [0.1, 0.1, 0.11]], [4, [0.07, 0.07, 0.08]], [4, [0.6, 0.1, 0.1]], [5, [0, 0, 0]]];
const shuffled = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as [number, T]).sort((x, y) => x[0] - y[0]).map((v) => v[1]);
const HAIR = [[0.06, 0.05, 0.05], [0.1, 0.08, 0.07], [0.2, 0.14, 0.09], [0.12, 0.12, 0.14]];

export function createPickup(L: Layout) {
  const ft = L.ft, [cx, cy] = L.center;
  /* court ft -> world (half court: x runs back from the baseline) */
  const W = (x: number, y: number): [number, number] => [cx - x * ft, cy + y * ft];
  const GATE: [number, number] = [(cx - L.fence[0]) / ft + 1, (L.gate[1] - cy) / ft];
  const OUT: [number, number] = [GATE[0] + 14, GATE[1] - 6];

  /* (no two alike: the kits dealt out within a side, the hats across
     everyone, the shoes and shorts too) */
  const kits = [shuffled(KITS[0]), shuffled(KITS[1])], hats = shuffled(HATS), shoes = shuffled([0, 1, 1, 2, 3, 4]), shorts_ = shuffled([0, 0, 1, 2, 3, 4]);
  const players: Player[] = Array.from({ length: PLAYERS }, (_, i) => {
    const team = i < 3 ? 0 : 1, kit = kits[team][i % 3], hat = hats[i];
    return {
      x: OUT[0], y: OUT[1], hd: 0, phase: Math.random() * 6, tx: OUT[0], ty: OUT[1],
      team, man: team === 1 ? i - 3 : -1,
      /* white tees against the bright ones */
      top: [...kit[0]] as [number, number, number], kit: kit[1], trim: kit[2],
      guard: 0, hat: hat[0], hatC: [...hat[1]] as [number, number, number], shoe: shoes[i], shorts: shorts_[i],
      hair: [...pick(HAIR)] as [number, number, number], pose: 0,
      /* everyone their own skin: spread across light, medium and dark */
      skin: [...SKIN[(i * 2 + (i < 3 ? 0 : 1) + Math.floor(Math.random() * 2)) % SKIN.length]] as [number, number, number],
      hairK: hat[0] === 5 ? 1 : pick([0.15, 0.6, 0.9, 1]), speed: rnd(11, 14),
      vx: 0, vy: 0, sx: OUT[0], sy: OUT[1], cad: rnd(0.9, 1.08),
      fl: [OUT[0], OUT[1] + 0.5], fr: [OUT[0], OUT[1] - 0.5], sw: -1, su: 0, sdur: 0.3, sf: [0, 0], st: [0, 0], last: 0, set: false,
    };
  });
  const ball: Ball = { x: 0, y: 0, h: 0, mode: "gone", holder: -1, to: -1, t: 0, dur: 1, from: [0, 0, 0], aim: [0, 0, 0], vx: 0, vy: 0, vh: 0, make: false };
  let offence = 0;            // which team has it
  let cleared = true;         // taken it back out past the arc since the change
  let nextMove = 2;           // the ball handler's next decision
  let carrySnap = false;      // the ball's just appeared with its carrier (off-stage)
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
      /* (whoever's ball it is brings it: under his arm, in through the gate) */
      const fresh = ball.mode === "gone";
      ball.mode = "carried"; if (fresh) { ball.holder = 0; carrySnap = true; }
      if (present < 0.01) players.forEach((p) => { p.x = OUT[0] + rnd(-3, 3); p.y = OUT[1] + rnd(-3, 3); p.fl = [p.x, p.y + 0.5]; p.fr = [p.x, p.y - 0.5]; p.sw = -1; });
    }
    if (!wanted && (state === "playing" || state === "arriving")) {
      /* (and someone takes it home: whoever has it, or whoever's nearest
         goes and gets it) */
      state = "leaving";
      if (ball.mode !== "carried") {
        if (ball.mode !== "held") ball.holder = players.map((p, i) => [Math.hypot(p.x - ball.x, p.y - ball.y), i]).sort((a, b) => a[0] - b[0])[0][1];
        ball.mode = "carried";
      }
    }
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
      /* (the one fetching the ball goes to it first) */
      const c = players[ball.holder];
      if (c && Math.hypot(ball.x - c.x, ball.y - c.y) > 2.5) { c.tx = ball.x; c.ty = ball.y; }
      if (players.every((p) => p.x > GATE[0])) present = Math.max(0, present - dt * 0.8);
      if (present <= 0) { state = "off"; ball.mode = "gone"; players.forEach((p) => { p.x = OUT[0]; p.y = OUT[1]; }); }
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

    /* everyone moves toward where they're heading, the way someone on
       their feet does. Not gliding into place: once they're about where
       they meant to be they stand, and stay standing until it's moved a
       step or two off (then they go, and stop again), so a defender's
       adjusting in steps, not sliding after his man. They jog to a spot
       that's near and run to one that's far, pull up over the last few
       feet as hard as a body can, and ease apart from anyone close */
    const playing = state === "playing";
    players.forEach((p) => {
      p.sx += (p.tx - p.sx) * Math.min(1, dt * 5); p.sy += (p.ty - p.sy) * Math.min(1, dt * 5);
      const dx = p.sx - p.x, dy = p.sy - p.y, d = Math.hypot(dx, dy);
      const mine_ = ball.holder === idx(p) && ball.mode === "held";
      const tight = mine_ || (p.team !== offence && ball.holder === p.man) || ball.mode === "loose";
      if (p.set && d > (tight ? 1.1 : 2.2)) p.set = false;
      if (!p.set && d < 0.45) p.set = true;
      const top = p.speed * (playing ? (d > 9 || tight ? 1 : 0.68) : 0.4);
      /* (what can still be stopped from, in the room there is) */
      const want = p.set ? 0 : Math.min(top, Math.sqrt(2 * 20 * Math.max(0, d - 0.2)));
      let wx = d > 0.05 ? (dx / d) * want : 0, wy = d > 0.05 ? (dy / d) * want : 0;
      for (const q of players) {
        if (q === p) continue;
        const ox = p.x - q.x, oy = p.y - q.y, od = Math.hypot(ox, oy);
        if (od < 3 && od > 0.01) { const k = (3 - od) * 2.2; wx += (ox / od) * k; wy += (oy / od) * k; }
      }
      /* (quicker to stop than to get going) */
      const ax = wx - p.vx, ay = wy - p.vy, am = Math.hypot(ax, ay);
      const acc = Math.hypot(wx, wy) < Math.hypot(p.vx, p.vy) ? 34 : 24, step = Math.min(am, acc * dt);
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
      /* (in a game they watch the ball; walking in or out, where they're going) */
      const w = playing ? run * Math.min(1, 0.3 + 0.7 * toward) * (p.team === offence ? 0.9 : 0.55) : sp > 0.5 ? 1 : 0;
      const fx = vx * w + (bx / bd) * (1 - w), fy = vy * w + (by / bd) * (1 - w);
      const turn = wrapPi(Math.atan2(fy, fx) - p.hd);
      /* (the body can't turn far over feet that are planted: standing or
         nearly, it turns as far as the hips allow and waits for a foot
         to be picked up and put down round where it now belongs) */
      const skew = (k: number) => {
        const f = k === 0 ? p.fl : p.fr, ex = f[0] - p.x, ey = f[1] - p.y;
        if (Math.hypot(ex, ey) < 0.25) return 0;
        return wrapPi(Math.atan2(ey, ex) - (p.hd + (k === 0 ? Math.PI / 2 : -Math.PI / 2)));
      };
      if (Math.abs(turn) > 0.12) {
        let by_ = Math.max(-dt * 4.5, Math.min(dt * 4.5, turn * Math.min(1, dt * 4)));
        if (sp < 3) for (const k of [0, 1]) {
          if (p.sw === k) continue;
          const now = skew(k), then = wrapPi(now - by_);
          if (Math.abs(then) > 0.8 && Math.abs(then) > Math.abs(now)) by_ = 0;
        }
        p.hd += by_;
      }
      /* ── the feet. Each has its place under the body (a little apart;
         wider, down in a stance, for a defender), and is picked up once
         the body's left it behind by half a step: put down again half a
         step ahead of where its place will be when it lands. Which way
         "ahead" is is just the way the body's going, whichever way it's
         facing: so facing the ball and going sideways is a shuffle, and
         going backwards a backpedal, without anyone being told. The
         faster they go the longer the step and the quicker it's taken.
         Standing, a foot's only moved if it's ended up well out of place
         (a turn, a lean) */
      /* (a defender who's on his man and not running after him is down
         in a stance, arms out: most of all on the ball) */
      const onBall = ball.holder === p.man && ball.mode === "held";
      const stance = p.team !== offence && playing && ball.mode !== "loose" ? (onBall ? 1 : 0.55) * Math.max(0, 1 - sp / 9) : 0;
      p.guard += (stance - p.guard) * Math.min(1, dt * 5);
      const fwd: [number, number] = [Math.cos(p.hd), Math.sin(p.hd)];
      const wdt = (p.team !== offence && playing ? 0.78 : 0.55);
      const vh: [number, number] = sp > 0.01 ? [p.vx / sp, p.vy / sp] : [0, 0];
      const stepLen = (1.3 + 0.12 * sp) * p.cad;
      const home = (k: number, lead: number): [number, number] => {
        const sgn = k === 0 ? 1 : -1;
        return [p.x + p.vx * lead - fwd[1] * wdt * sgn, p.y + p.vy * lead + fwd[0] * wdt * sgn];
      };
      if (p.sw >= 0) {
        const foot = p.sw === 0 ? p.fl : p.fr;
        /* (hurried, if the foot that's down is being left behind: a
           sudden cut, a shove) */
        const down = p.sw === 0 ? p.fr : p.fl, reach = Math.hypot(down[0] - p.x, down[1] - p.y);
        p.su = Math.min(1, p.su + dt / p.sdur * (1 + Math.max(0, reach - 1.2) * 2));
        /* (where it'll come down is kept up to date as the body changes its mind) */
        const h = home(p.sw, (1 - p.su) * p.sdur);
        p.st = [h[0] + vh[0] * stepLen * 0.5 * Math.min(1, sp / 2), h[1] + vh[1] * stepLen * 0.5 * Math.min(1, sp / 2)];
        const e = p.su * p.su * (3 - 2 * p.su);
        foot[0] = p.sf[0] + (p.st[0] - p.sf[0]) * e; foot[1] = p.sf[1] + (p.st[1] - p.sf[1]) * e;
        if (p.su >= 1) { p.last = p.sw; p.sw = -1; }
      }
      if (p.sw < 0) {
        let pickF = -1, best = 0;
        for (const k of [1 - p.last, p.last]) {
          const foot = k === 0 ? p.fl : p.fr, h = home(k, 0);
          const ex = h[0] - foot[0], ey = h[1] - foot[1];
          const behind = ex * vh[0] + ey * vh[1], err = Math.hypot(ex, ey);
          /* moving: once it's half a step behind (a little sooner, for
             the one whose turn it is); standing: only if it's well out */
          const due = sp > 1 ? behind / (stepLen * (k === p.last ? 0.5 : 0.36)) : 0;
          const out = sp > 1 ? err / 1.6 : Math.max(err / 0.6, Math.abs(skew(k)) / 0.5);
          const score = Math.max(due, out);
          if (score >= 1 && score > best) { best = score; pickF = k; }
        }
        if (pickF >= 0) {
          const foot = pickF === 0 ? p.fl : p.fr;
          p.sw = pickF; p.su = 0; p.sf = [foot[0], foot[1]];
          p.sdur = (sp < 1 ? 0.24 : 0.38 - 0.11 * Math.min(1, sp / 10)) / Math.sqrt(p.cad);
        }
      }
      /* (for the arms, which swing against the feet: how far the one
         foot's ahead of the other, along the way they face) */
      const lead = ((p.fl[0] - p.fr[0]) * fwd[0] + (p.fl[1] - p.fr[1]) * fwd[1]) / 2.6;
      p.phase = Math.asin(Math.max(-1, Math.min(1, lead)));
      if (ball.mode !== "shot") p.pose = Math.max(0, p.pose - dt * 2);
    });

    /* ── the ball */
    if (ball.mode === "held") {
      const h = players[ball.holder];
      /* dribbled at the side, bouncing; up at the chest when standing */
      const side = 0.9, f = Math.cos(h.hd), s = Math.sin(h.hd);
      ball.x = h.x + f * 0.9 - s * side; ball.y = h.y + s * 0.9 + f * side;
      /* (its own beat: a dribble doesn't stop when they do) */
      const beat = Math.floor(dribble / Math.PI);
      dribble += dt * 4.2;
      ball.h = 0.4 + Math.abs(Math.sin(dribble)) * 2.6;
      if (Math.floor(dribble / Math.PI) !== beat) hear("bounce", 0.75);
    } else if (ball.mode === "carried") {
      /* under the arm, at the hip. Left lying somewhere, it stays there
         (rolling to a stop, dropping to the ground) until whoever's
         fetching it gets to it, and then comes up into his hands */
      const h = players[ball.holder], f = Math.cos(h.hd), s = Math.sin(h.hd);
      const ax = h.x + f * 0.35 - s * 0.85, ay = h.y + s * 0.35 + f * 0.85;
      if (carrySnap) { ball.x = ax; ball.y = ay; ball.h = 3.2; carrySnap = false; }
      const got = Math.hypot(ball.x - h.x, ball.y - h.y) < 3;
      if (got) {
        const k = Math.min(1, dt * 9);
        ball.x += (ax - ball.x) * k; ball.y += (ay - ball.y) * k; ball.h += (3.2 - ball.h) * k;
      } else ball.h = Math.max(0.4, ball.h - dt * 14);
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
          hear("net");
        } else {
          /* off the rim */
          const a = rnd(-1.4, 1.4) + Math.PI * 0;
          Object.assign(ball, { mode: "loose", vx: Math.cos(a) * rnd(8, 14), vy: Math.sin(a) * rnd(8, 14), vh: rnd(4, 8), make: false });
          hear("rim");
        }
      }
    } else if (ball.mode === "loose") {
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.h += ball.vh * dt; ball.vh -= 32 * dt;
      if (ball.h < 0.4) { if (ball.vh < -4) hear("bounce", Math.min(1, -ball.vh / 22)); ball.h = 0.4; ball.vh = Math.abs(ball.vh) * 0.55; ball.vx *= 0.8; ball.vy *= 0.8; if (ball.vh < 1.5) ball.vh = 0; }
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

  /* what there is to hear of it, since last asked: the ball on the court
     (and how hard, 0..1), off the rim, through the net; each with where
     across the scene it was */
  const heard: { k: "bounce" | "rim" | "net"; x: number; s: number }[] = [];
  function hear(k: "bounce" | "rim" | "net", s = 1) { if (heard.length < 6) heard.push({ k, x: W(ball.x, ball.y)[0], s: s * present }); }
  const sounds = () => heard.splice(0);

  /* where they are, for the pigeons */
  const threats = (): [number, number, number][] => present > 0.1 ? players.map((p) => [...W(p.x, p.y), 6] as [number, number, number]) : [];
  const busy = () => state !== "off";

  /* for the shader, like the passers-by: (x, y, heading, phase),
     (top rgb, kind 3 running / 4 arms up), (hair rgb, presence); and the
     ball (x, y, height ft, on) */
  const A = new Float32Array(PLAYERS * 4), B = new Float32Array(PLAYERS * 4), C = new Float32Array(PLAYERS * 4), D = new Float32Array(PLAYERS * 4), Ft = new Float32Array(PLAYERS * 4), G = new Float32Array(PLAYERS * 4), H = new Float32Array(PLAYERS * 4), Bl = new Float32Array(4);
  function pack() {
    players.forEach((p, i) => {
      const [wx, wy] = W(p.x, p.y);
      /* (court x runs back from the baseline: headings flip with it) */
      /* the stride's sway and the shoulders' turn, as the passers-by,
         fading as they slow; standing, the feet settle */
      /* the shoulders turn a little against the legs; and the feet, each
         where it is on the court, given in the body's own frame (ahead,
         to its left; in the figure's drawn feet) so they stay put on the
         ground while the body goes over them */
      const hd = Math.PI - p.hd + p.phase * 0.09;
      const F: [number, number] = [Math.cos(hd), Math.sin(hd)];
      const loc = (f: [number, number]): [number, number] => {
        let ddx = -(f[0] - p.x), ddy = f[1] - p.y;
        /* (a foot a long way out isn't drawn as far out as it is: seen
           from above, a leg at full stretch has its knee bent and its
           heel coming up, and the foot's nearer the body than the
           stride is long. Past REACH_NEAR it gains only part of the
           distance, and never passes REACH_MAX) */
        const r = Math.hypot(ddx, ddy);
        if (r > REACH_NEAR) { const k = (REACH_NEAR + (REACH_MAX - REACH_NEAR) * (1 - Math.exp(-(r - REACH_NEAR) / (REACH_MAX - REACH_NEAR)))) / r; ddx *= k; ddy *= k; }
        return [(ddx * F[0] + ddy * F[1]) / 1.5, (-ddx * F[1] + ddy * F[0]) / 1.5];
      };
      const a = loc(p.fl), b = loc(p.fr);
      /* (the court's drawn mirrored, so their right foot is the figure's
         left: each foot always on its own hip, never swapped) */
      Ft.set([...b, ...a], i * 4);
      G.set([p.hat, p.kit + 0.24 * p.guard, p.shoe, p.shorts], i * 4);
      H.set([...p.hatC, p.trim], i * 4);
      A.set(state === "off" ? [9, 9, 0, 0] : [wx, wy, hd, p.phase], i * 4);
      B.set([...p.top, p.pose > 0.5 ? 4 : 3], i * 4);
      C.set([...p.hair, present], i * 4);
      D.set([...p.skin, p.hairK], i * 4);
    });
    const [bx, by] = W(ball.x, ball.y);
    Bl.set(state !== "off" && ball.mode !== "gone" && present > 0.5 ? [bx, by, ball.h, 1] : [9, 9, 0, 0]);
    return { A, B, C, D, Ft, G, H, Bl };
  }
  /* (for checking: everyone's body, feet and speed) */
  const debug = () => players.map((p) => ({ x: p.x, y: p.y, v: Math.hypot(p.vx, p.vy), fl: [...p.fl], fr: [...p.fr], sw: p.sw, team: p.team }));
  return { update, pack, threats, busy, sounds, debug };
}
