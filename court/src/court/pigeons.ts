/* ══ Pigeons ══════════════════════════════════════════════
   A small flock, simulated here and drawn by the shader (shaders/birds.ts).

   On the ground each bird goes about its own business near the flock's
   spot: it pecks (a few quick bobs), takes a few steps somewhere close
   by, turns. The steps are steps, not a slide: quick, discrete, each a
   little off the line of the last, in bursts of a few with a dead stop
   between; and the head does what a pigeon's does, holding still in the
   air while the body walks up under it, then thrusting forward. Every minute or so, or when the
   pointer comes close, or a train goes over while they're under the el,
   the flock goes up: one after another, a few flaps, a long sweeping
   glide round in an arc, and down again somewhere else, flaring as they
   land. At dusk they leave for the night, and come back in the morning.

   Positions are in world units, heights in feet. */

import type { Layout } from "./layouts";

export const BIRDS = 9;

type Bird = {
  x: number; y: number; hd: number; h: number;
  /* on the ground: where it's walking to, when it next does something,
     and how far through a peck it is */
  tx: number; ty: number; next: number; peck: number; step: number;
  /* a step underway: from where, to where, how far through (0..1), and
     the wait to the next one; a turn in place */
  s0x: number; s0y: number; s1x: number; s1y: number; su: number; sw: number; turn: number;
  /* in the air: where it sits in the flock, and how late it goes up */
  ox: number; oy: number; delay: number; sx: number; sy: number; sh: number;
  /* the wings: 0 folded .. 1 spread, and the flap's phase */
  wing: number; flap: number;
  variant: number;
};

type Flight = { t0: number; dur: number; p0: [number, number]; c1: [number, number]; c2: [number, number]; p3: [number, number] };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/* where pigeons like to be: open paving, in and around the park */
function spots(L: Layout): [number, number][] {
  const ft = L.ft, [cx, cy] = L.center, f = L.fence;
  const out: [number, number][] = [
    [cx - 30 * ft, cy + 9 * ft],                 // on the court, out past the arc
    [f[0] - 13 * ft, cy - 6 * ft],               // the path by the benches
    [(f[0] + f[2]) / 2 - 8 * ft, f[3] + 9 * ft], // the paving below the court
  ];
  if (L.el && L.walk) out.push([0.68, L.el[0] + L.el[1] / 2 + 2 * ft + L.walk[0] * 0.5]); // under the el
  if (L.rowX && L.walk) out.push([L.rowX - L.walk[0] * 0.55, 0.74]);                     // by the stoops
  return out;
}
const underEl = (L: Layout, s: [number, number]) => !!L.el && s[1] < L.el[0] + L.el[1] / 2 + 20 * L.ft;

export function createFlock(L: Layout, night: boolean) {
  const S = spots(L);
  let spot = S[Math.floor(Math.random() * S.length)];
  const away: [number, number] = [-0.35, -0.25];
  const birds: Bird[] = Array.from({ length: BIRDS }, (_, i) => {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 6 * L.ft;
    const x = spot[0] + Math.cos(a) * r, y = spot[1] + Math.sin(a) * r;
    return {
      x, y, hd: Math.random() * Math.PI * 2, h: 0,
      tx: x, ty: y, next: rnd(0, 3), peck: 0, step: 0,
      s0x: x, s0y: y, s1x: x, s1y: y, su: 1, sw: 0, turn: 0,
      ox: rnd(-1, 1), oy: rnd(-1, 1), delay: rnd(0, 0.6), sx: x, sy: y, sh: 0,
      wing: 0, flap: Math.random() * 6,
      /* mostly the blue-grey with two black bars; a dark checker or two,
         a white one, a red-brown one */
      variant: i === 0 ? 2 : i === 1 ? 3 : i < 4 ? 1 : 0,
    };
  });
  let state: "ground" | "fly" | "away" = night ? "away" : "ground";
  let flight: Flight | null = null;
  let landAt: [number, number] = spot;
  let nextGo = rnd(40, 75);
  let t = 0, busyNow = false;

  const go = (to: [number, number]) => {
    const from: [number, number] = state === "away" ? away : [
      birds.reduce((s, b) => s + b.x, 0) / BIRDS, birds.reduce((s, b) => s + b.y, 0) / BIRDS,
    ];
    const dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy) || 0.01;
    /* a sweeping arc: out to one side and round */
    const side = Math.random() < 0.5 ? 1 : -1, nx = -dy / d * side, ny = dx / d * side;
    const bow = Math.max(0.12, d * 0.6);
    flight = {
      /* (leaving for the night, in a hurry: gone in a couple of seconds) */
      t0: t, dur: to === away ? Math.max(2.2, (d + bow) / (24 * L.ft) * 0.4) : Math.max(4.5, (d + bow) / (24 * L.ft) * 0.9),
      p0: from,
      c1: [from[0] + dx * 0.1 + nx * bow, from[1] + dy * 0.1 + ny * bow],
      c2: [from[0] + dx * 0.9 + nx * bow * 0.7, from[1] + dy * 0.9 + ny * bow * 0.7],
      p3: to,
    };
    landAt = to;
    birds.forEach((b) => { b.delay = state === "ground" ? rnd(0, 0.7) : rnd(0, 0.3); b.ox = rnd(-1, 1); b.oy = rnd(-1, 1); b.sx = b.x; b.sy = b.y; b.sh = b.h; });
    state = "fly";
  };
  const elsewhere = () => {
    /* (not the court while there's a game on) */
    const opts = S.filter((s) => s !== spot && !(busyNow && s === S[0]));
    return opts[Math.floor(Math.random() * opts.length)] ?? spot;
  };

  /* step the flock on by dt seconds. night: 0 day .. 1 night; pointer:
     where the pointer is (world), or null; train: whether one's going over */
  function update(dt: number, night: number, pointer: [number, number] | null, train: boolean, threats: [number, number, number][] = [], courtBusy = false) {
    t += dt;
    busyNow = courtBusy;
    /* they go as soon as the dark starts coming down (after dusk, as the
       moonlight takes over), quickly, so none are still about once it's
       night; and only come back once it's light again. Going from the
       air too: a flight between spots turns for home */
    const leave = night > 0.02, back = night < 0.01;
    if (leave && state === "fly" && landAt !== away) go(away);
    if (state === "ground") {
      nextGo -= dt;
      /* the pointer, or someone walking right through them (a dog, from further off) */
      const scared = (pointer && birds.some((b) => Math.hypot(b.x - pointer[0], b.y - pointer[1]) < 7 * L.ft))
        || threats.some(([x, y, r]) => birds.some((b) => Math.hypot(b.x - x, b.y - y) < r * L.ft));
      const rumble = train && underEl(L, spot) && Math.random() < dt * 0.8;
      if (leave) go(away);
      else if (nextGo <= 0 || scared || rumble) { spot = elsewhere(); go(spot); }
    } else if (state === "away" && back) {
      spot = S[Math.floor(Math.random() * S.length)];
      go(spot);
    }

    const F = flight;
    let allDown = true;
    for (const b of birds) {
      if (state === "fly" && F) {
        /* along the path, a little behind or ahead of the others, spread
           out sideways across it; a slow climb out, a long glide, down */
        const u = Math.min(1, Math.max(0, (t - F.t0 - b.delay) / F.dur));
        const k = u * u * (3 - 2 * u) * 0.25 + u * 0.75;
        const bz = (a: number, c1: number, c2: number, d: number) => {
          const m = 1 - k;
          return m * m * m * a + 3 * m * m * k * c1 + 3 * m * k * k * c2 + k * k * k * d;
        };
        const spread = Math.sin(Math.PI * u) * 9 * L.ft;
        const px = bz(F.p0[0], F.c1[0], F.c2[0], F.p3[0]) + b.ox * spread;
        const py = bz(F.p0[1], F.c1[1], F.c2[1], F.p3[1]) + b.oy * spread;
        /* (on landing each comes down at its own place in the flock) */
        const land = Math.max(0, (u - 0.85) / 0.15);
        /* (and goes up from where it was standing, joining the flock) */
        const join = Math.min(1, u / 0.2), jk = join * join * (3 - 2 * join);
        const lx = b.sx + (px + (b.ox * 5 * L.ft) * land - b.sx) * jk, ly = b.sy + (py + (b.oy * 5 * L.ft) * land - b.sy) * jk;
        if (u > 0 && u < 1) {
          const vx = lx - b.x, vy = ly - b.y;
          if (Math.hypot(vx, vy) > 1e-5) b.hd += wrapPi(Math.atan2(vy, vx) - b.hd) * Math.min(1, dt * 8);
        }
        b.x = lx; b.y = ly;
        /* (turned in the air, it doesn't drop to climb again: it keeps
           the height it had while it joins the new flight) */
        b.h = Math.max(Math.pow(Math.sin(Math.PI * u), 0.6) * 22, b.sh * (1 - jk));
        /* wings: beating hard going up and coming in, a glide between with
           now and then a few beats */
        const beat = (u <= 0 && b.h > 0.5) || u < 0.25 || u > 0.85 || Math.sin(t * 0.9 + b.ox * 5) > 0.75;
        const flying = (u > 0 && u < 1) || b.h > 0.5;
        b.wing += ((flying ? 1 : 0) - b.wing) * Math.min(1, dt * 10);
        b.flap += dt * (beat ? 22 : 0);
        /* (gliding, the wings held out flat: mid-stroke) */
        if (!beat) b.flap += (Math.round((b.flap - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2 - b.flap) * Math.min(1, dt * 6);
        if (u < 1) allDown = false;
        b.tx = b.x; b.ty = b.y;
      } else if (state === "ground") {
        /* about its business: peck, step somewhere near, turn */
        b.h = 0;
        b.wing += (0 - b.wing) * Math.min(1, dt * 10);
        b.next -= dt;
        b.peck = Math.max(0, b.peck - dt);
        /* a step underway: the body moves over about a tenth of a second,
           eased, then stands until the next */
        if (b.su < 1) {
          b.su = Math.min(1, b.su + dt / 0.11);
          const e = b.su * b.su * (3 - 2 * b.su);
          b.x = b.s0x + (b.s1x - b.s0x) * e; b.y = b.s0y + (b.s1y - b.s0y) * e;
        }
        /* a turn in place: in two or three small shuffles */
        if (Math.abs(b.turn) > 0.02 && b.su >= 1) {
          b.sw -= dt;
          if (b.sw <= 0) { const k = Math.sign(b.turn) * Math.min(Math.abs(b.turn), rnd(0.35, 0.6)); b.hd += k; b.turn -= k; b.sw = rnd(0.12, 0.2); }
        }
        const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
        if (d > 0.2 * L.ft && Math.abs(b.turn) <= 0.02) {
          b.sw -= dt;
          if (b.su >= 1 && b.sw <= 0) {
            /* the next step: about a third of a foot, quick, a little off
               the line (the zigzag of a walking pigeon); first turning to
               face roughly where it's going */
            const want = Math.atan2(dy, dx), off = wrapPi(want - b.hd);
            if (Math.abs(off) > 0.9) { b.turn = off; b.sw = 0; }
            else {
              const a = want + rnd(-0.3, 0.3), len = Math.min(d, rnd(0.26, 0.38) * L.ft);
              b.hd += wrapPi(a - b.hd) * 0.6;
              b.s0x = b.x; b.s0y = b.y; b.s1x = b.x + Math.cos(a) * len; b.s1y = b.y + Math.sin(a) * len;
              b.su = 0; b.sw = rnd(0.24, 0.34); b.step += 1;
            }
          }
        } else if (b.next <= 0 && b.su >= 1 && Math.abs(b.turn) <= 0.02) {
          const r = Math.random();
          if (r < 0.45) b.peck = rnd(0.5, 0.9);
          else if (r < 0.85) {
            /* a few steps, staying near the others and the spot (and
               leaning toward where the others are) */
            const mx = birds.reduce((q, o) => q + o.x, 0) / BIRDS, my = birds.reduce((q, o) => q + o.y, 0) / BIRDS;
            const a = b.hd + rnd(-1.4, 1.4), s = rnd(0.8, 2.6) * L.ft;
            let nx = b.x + Math.cos(a) * s, ny = b.y + Math.sin(a) * s;
            nx += (mx - nx) * 0.12; ny += (my - ny) * 0.12;
            const ds = Math.hypot(nx - landAt[0], ny - landAt[1]);
            if (ds > 8 * L.ft) { nx = landAt[0] + (nx - landAt[0]) * 0.6; ny = landAt[1] + (ny - landAt[1]) * 0.6; }
            /* (not right on top of another) */
            if (birds.some((o) => o !== b && Math.hypot(o.x - nx, o.y - ny) < 0.9 * L.ft)) { nx = b.x; ny = b.y; }
            b.tx = nx; b.ty = ny;
          } else b.turn = rnd(-1.2, 1.2);
          b.next = rnd(0.6, 3.0);
        }
      }
    }
    if (state === "fly" && allDown) {
      if (landAt === away) state = "away";
      else { state = "ground"; nextGo = rnd(45, 90); birds.forEach((b) => { b.next = rnd(0.3, 2); b.tx = b.x; b.ty = b.y; }); }
    }
  }

  /* for the shader: (x, y, heading, height ft) and (wing, flap, head bob,
     variant); off-screen birds are simply far away */
  const A = new Float32Array(BIRDS * 4), B = new Float32Array(BIRDS * 4);
  function pack() {
    birds.forEach((b, i) => {
      const hidden = state === "away";
      /* the head: held still in the air while the body steps up under it
         (so, back, in the body's frame), then thrust forward before the
         next step; down and up pecking; in the air, forward */
      let bob = b.h > 0.5 ? 0.3 : 0.1;
      if (b.peck > 0) bob = -Math.abs(Math.sin(b.peck * 11));
      else if (b.su < 1) bob = 0.6 - 1.3 * b.su * b.su * (3 - 2 * b.su);
      else if (b.sw > 0 && b.sw < 0.4 && Math.abs(b.turn) <= 0.02) { const k = Math.min(1, (0.3 - b.sw) / 0.12); bob = -0.7 + 1.3 * (k < 0 ? 0 : k * k * (3 - 2 * k)); }
      A.set(hidden ? [9, 9, 0, 0] : [b.x, b.y, b.hd, b.h], i * 4);
      B.set([b.wing, b.wing > 0.05 ? Math.cos(b.flap) : 1, bob, b.variant], i * 4);
    });
    return { A, B };
  }
  /* send them up now (dev: window.__scare()) */
  const scare = () => { if (state === "ground") { spot = elsewhere(); go(spot); } };
  /* for the sound: whether they're down, and where */
  const info = () => ({
    down: state === "ground",
    x: birds.reduce((s, b) => s + b.x, 0) / BIRDS,
    away: state === "away",
  });
  return { update, pack, scare, info };
}
