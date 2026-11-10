import { useEffect, useRef } from "react";
import { SCENE_FRAG } from "./shaders/scene";
import { POST_FRAG } from "./shaders/post";
import { SEASONS, seasonAt } from "./seasons";
import { createFlock } from "./pigeons";
import { createPeople } from "./people";
import { createPickup } from "./pickup";
import { createSkaters } from "./skate";
import { createTraffic, staticCars, MOVERS } from "./traffic";
import type { CourtSound } from "./sound/engine";
import type { Layout, Paint } from "./layouts";
import { branchTexture, MARGIN } from "./trees";
import { lightAt } from "./daylight";

/* ══ Top-down court ═══════════════════════════════════════
   A New York park court seen from above, drawn entirely in WebGL2, the
   way the koi pond on shwn.design is: no images. Two passes:

     scene  ground, light, shadows, hoop, fence, crowns, falling things,
            into a texture at ~1.25× CSS size (soft by design)
     post   soft focus toward the edge, film look, grain, and the fade
            into the page

   `season` is a position on the year (0 spring … 3 winter). When it
   changes the scene eases toward it over a few seconds, so seasons turn
   rather than cut. */

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

/* how much finer than CSS pixels the scene is drawn. Not full retina:
   part of the softness is simply not drawing every pixel */
/* the scene renders a little above the page's resolution, more on a
   retina screen, so the smallest leaves stay leaves */
/* the softer drawing of people and pigeons (shaders/people.ts); ?life=0
   for the old flat cut-outs, to compare */
/* (dev: ?sim=N runs the life N sub-steps a frame, so a slow headless
   capture still shows a lived-in street) */
const simSteps = import.meta.env.DEV && typeof window !== "undefined" ? Math.max(1, Math.min(300, Number(new URLSearchParams(window.location.search).get("sim")) || 1)) : 1;
const lifeLook = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("life") === "0" ? 0 : 1;
const SCENE_SCALE = typeof window !== "undefined" && window.devicePixelRatio >= 2 ? 1.6 : 1.3;
/* and if the GPU can't hold 30fps at that, the scene steps down a notch
   at a time (never below 1.0: the page's own pixels), back up when
   there's room again. ?scale=N pins it (dev) */
const SCALE_MIN = 0.7;
/* and never more than this many scene pixels a frame, whatever the
   screen: a full-width canvas on a 5K display at 1.6× would be ten
   million */
const PIXEL_BUDGET = 3.2e6;
const pinnedScale = import.meta.env.DEV && typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("scale")) || 0 : 0;

/* the pointer parting the leaves: off for now, to be revisited */
const HOVER = false;

/* a program in two halves: `start` hands the shaders to the driver and
   comes straight back; `finish` asks how it went (and would wait for it).
   The scene shader is big, and some drivers take seconds over it; between
   the two the page can go on being a page */
type Started = { p: WebGLProgram; v: WebGLShader; f: WebGLShader };
function start(gl: WebGL2RenderingContext, frag: string): Started {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const v = make(gl.VERTEX_SHADER, VERT), f = make(gl.FRAGMENT_SHADER, frag);
  const p = gl.createProgram()!;
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, "a_pos");
  gl.linkProgram(p);
  return { p, v, f };
}
function finish(gl: WebGL2RenderingContext, { p, v, f }: Started) {
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn("[court] link:", gl.getProgramInfoLog(p), gl.getShaderInfoLog(v), gl.getShaderInfoLog(f));
    return null;
  }
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)!;
    u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}
const program = (gl: WebGL2RenderingContext, frag: string) => finish(gl, start(gl, frag));

/* gusts (the same as gustAt in shaders/overhead.ts): mostly a light breeze,
   and every 15-30s a gust that swells for a few seconds and dies away */
const gHash = (i: number) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
const gNoise = (x: number) => { const i = Math.floor(x); let f = x - i; f = f * f * (3 - 2 * f); return gHash(i) + (gHash(i + 1) - gHash(i)) * f; };
const sstep = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const gustAt = (gt: number, t: number) => sstep(0.55, 0.92, gNoise(gt)) * (0.75 + 0.25 * gNoise(t * 0.7 + 4));

export default function TopDownCourt({ season, tod = 0, trainCall = 0, layout, paint, label, sound, onReady, onFail }: { season: number; tod?: number; trainCall?: number; layout: Layout; paint: Paint; label: string; sound?: CourtSound | null; onReady?: () => void; onFail?: () => void }) {
  /* told once when the first frame's drawn, and if it can't be: no
     WebGL2, a shader that won't build, or the context lost */
  const readyRef = useRef(onReady); readyRef.current = onReady;
  const failRef = useRef(onFail); failRef.current = onFail;
  /* a test hook: each change of trainCall sends a train now */
  const called = useRef(trainCall);
  called.current = trainCall;
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const todTarget = useRef(tod);
  todTarget.current = tod;
  const target = useRef(season);
  target.current = season;
  const plan = useRef(layout);
  plan.current = layout;
  const colours = useRef(paint);
  colours.current = paint;
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    /* (no software renderer: it would draw this on the CPU, at a frame or
       two a second with every core lit. Left open in dev, where the
       headless captures rely on one) */
    const gl = cv.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false, failIfMajorPerformanceCaveat: import.meta.env.PROD });
    if (!gl) { failRef.current?.(); return; }
    const onLost = (e: Event) => { e.preventDefault(); failRef.current?.(); };
    cv.addEventListener("webglcontextlost", onLost);
    /* dev: ?skip=LITTER,TREES,… drops sections of the scene shader, to
       weigh them; window.__court.bench(n) times n frames */
    const skip = import.meta.env.DEV ? (new URLSearchParams(window.location.search).get("skip") ?? "").split(",").filter(Boolean) : [];
    const source = (sk: string[]) => SCENE_FRAG.replace("//DEFINES", [...sk.map((k) => `#define SKIP_${k}`), ...(lifeLook ? [] : ["#define FLAT_LIFE"])].join("\n"));
    const build = (sk: string[]) => program(gl, source(sk));
    /* the two programs compile off the main thread where the browser can
       (most can); the scene starts when they're done */
    const par = gl.getExtension("KHR_parallel_shader_compile");
    const sceneS = start(gl, source(skip)), postS = start(gl, POST_FRAG);
    let gone = false, waiting = 0, stop: (() => void) | void;
    const whenBuilt = () => {
      if (gone) return;
      if (par && !(gl.getProgramParameter(sceneS.p, par.COMPLETION_STATUS_KHR) && gl.getProgramParameter(postS.p, par.COMPLETION_STATUS_KHR))) {
        waiting = requestAnimationFrame(whenBuilt);
        return;
      }
      stop = run();
    };
    const run = (): (() => void) | void => {
    const scene0 = finish(gl, sceneS);
    const post = finish(gl, postS);
    if (!scene0 || !post) { failRef.current?.(); return; }
    let scene = scene0;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    /* the trees, grown once for this layout (trees.ts) */
    const branchTex = gl.createTexture()!;
    const bt = branchTexture(plan.current.crowns, plan.current.world, plan.current.ft);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, branchTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, bt.W, bt.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, bt.data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);

    const tex = gl.createTexture()!;
    const fbo = gl.createFramebuffer()!;
    let sw = 1, sh = 1;
    let sceneScale = pinnedScale || SCENE_SCALE;

    const fit = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      const budget = Math.min(1, Math.sqrt(PIXEL_BUDGET / Math.max(1, r.width * r.height * sceneScale * sceneScale)));
      sw = Math.max(1, Math.round(r.width * sceneScale * budget));
      sh = Math.max(1, Math.round(r.height * sceneScale * budget));
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* the pointer's recent path through the scene, in world units. A new
       point is dropped every ~70ms while it moves, stronger the faster it
       goes; each one ages and fades as the leaves settle behind it */
    const TRAIL = 8;
    const trail: { x: number; y: number; s: number; t0: number }[] = [];
    let lastDrop = 0, lastX = 0, lastY = 0, lastT = 0;
    const onMove = (e: PointerEvent) => {
      if (still || !HOVER) return;
      const r = cv.getBoundingClientRect();
      const W = plan.current.world;
      const x = ((e.clientX - r.left) / r.width) * W[0], y = ((e.clientY - r.top) / r.height) * W[1];
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      const speed = Math.hypot(x - lastX, y - lastY) / (dt / 1000); // world units per second
      lastX = x; lastY = y; lastT = now;
      if (now - lastDrop < 70) return;
      lastDrop = now;
      trail.push({ x, y, s: Math.min(1, 0.25 + speed * 0.9), t0: now });
      if (trail.length > TRAIL) trail.shift();
    };
    cv.addEventListener("pointermove", onMove);
    const trailData = new Float32Array(TRAIL * 4);

    /* the pigeons: the pointer coming near sends them up */
    const flock = createFlock(plan.current, todTarget.current > 0.9);
    let pointerAt: [number, number] | null = null;
    /* the passers-by (season and night read live from the scene) */
    let seasonNowY = target.current, nightNow = todTarget.current > 0.9 ? 1 : 0;
    const people = createPeople(plan.current, () => ((seasonNowY % 4) + 4) % 4, () => nightNow);
    if (import.meta.env.DEV) (window as unknown as { __people?: unknown }).__people = people;
    /* summer days: a pickup game on the court */
    const pickup = createPickup(plan.current);
    /* traffic up the side street, and the bus */
    let nightNow2 = 0;
    const traffic = createTraffic(plan.current, () => nightNow2);
    if (import.meta.env.DEV) (window as unknown as { __traffic?: unknown }).__traffic = traffic;
    traffic.onBoard((door) => people.board(door));
    traffic.onDriver((door, ahead, done) => people.driver(door, ahead, done));
    people.watch(traffic.bodies);
    /* spring days: skaters */
    const skaters = createSkaters(plan.current);
    if (import.meta.env.DEV) (window as unknown as { __skate?: unknown }).__skate = skaters;
    if (import.meta.env.DEV) (window as unknown as { __pickup?: unknown }).__pickup = pickup;
    const onPointer = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect(), W = plan.current.world;
      pointerAt = [((e.clientX - r.left) / r.width) * W[0], ((e.clientY - r.top) / r.height) * W[1]];
    };
    const offPointer = () => { pointerAt = null; };
    if (import.meta.env.DEV) (window as unknown as { __scare?: () => void }).__scare = flock.scare;
    if (import.meta.env.DEV) (window as unknown as { __flock?: unknown }).__flock = flock;
    cv.addEventListener("pointermove", onPointer);
    cv.addEventListener("pointerdown", onPointer);
    cv.addEventListener("pointerleave", offPointer);

    /* the train: one every 90 seconds or so (±10%), the first about 25s
       after the page opens. It runs on the near track, alternating
       direction, at about 40 mph */
    const CAR_FT = 51, CARS = 8, SPEED = 0.55; // world units per second
    const train = { on: false, x: 0, track: 1, dir: -1, at: performance.now() + 25000, last: 0 };
    let lastCall = called.current;
    const runTrain = (now: number) => {
      const L = plan.current;
      if (called.current !== lastCall) { lastCall = called.current; if (!train.on) train.at = now; }
      if (!L.el || still) { train.on = false; return; }
      const len = CAR_FT * CARS * L.ft, W = L.world[0];
      if (!train.on && now >= train.at) {
        train.on = true;
        /* always the near track: the far one sits in the frame's soft top
           edge, where a train can't be seen. Each one the other way */
        train.track = 1;
        train.dir = -train.dir;
        train.x = train.dir > 0 ? -0.2 : W + 0.2;
        train.last = now;
      }
      if (train.on) {
        train.x += train.dir * SPEED * ((now - train.last) / 1000);
        train.last = now;
        const gone = train.dir > 0 ? train.x - len > W + 0.2 : train.x + len < -0.2;
        if (gone) { train.on = false; train.at = now + 90000 * (0.9 + Math.random() * 0.2); }
      }
    };
    let y = target.current;
    let td = todTarget.current;
    /* the lights run on their own clock: they only start coming on once
       it's fully dark, taking ~3s to all be on, one by one; they go off
       the same way, quicker, before the dark lifts */
    let lightsK = todTarget.current > 0.9 ? 1 : 0;
    let raf = 0, last = 0, visible = true, alive = true;
    const t0 = performance.now();

    /* wind time: runs on at the breeze's pace, faster in a gust, so what's
       blowing about speeds up and slows down smoothly */
    let windT = 0, fallT = 0, lifeT = 0, gustT = 0, tPrev = 0;
    let gust = { k: 1, speed: 1, every: 20 };
    /* the gust over the last fallLife of wind, newest first, so a leaf
       can know whether a gust was blowing when it let go */
    const hist = new Float32Array(32);   // (fallT, gust) pairs
    let histAt = 0;
    const draw = (now: number) => {
      const t = still ? 12 : (now - t0) / 1000;
      const dt = Math.min(0.1, Math.max(0, t - tPrev));
      tPrev = t;
      /* the gust clock: about one gust each `every` seconds */
      gustT = still ? 1.3 : gustT + dt * 0.11 * (20 / Math.max(2, gust.every));
      const wr = 0.55 + gust.speed * gustAt(gustT, t) * gust.k;
      windT = still ? 12 : windT + dt * wr;
      /* ease toward the chosen season, the short way round the year */
      let d = target.current - y;
      d = ((d % 4) + 6) % 4 - 2;
      /* (dev: window.__instant jumps straight to the chosen season and light, for testing) */
      const instant = import.meta.env.DEV && !!(window as unknown as { __instant?: boolean }).__instant;
      y += d * Math.min(1, still || instant ? 1 : 0.025);
      const s = seasonAt(y);
      gust = { k: s.gust, speed: s.gustSpeed, every: s.gustEvery };
      /* how far what's falling has drifted: integrated, so a change in its
         speed (summer into autumn) slows or quickens it rather than
         jumping everything along */
      fallT = still ? 12 * s.fall[2] : fallT + dt * wr * s.fall[2];
      {
        const step = s.fallLife / 15;
        /* (dev: window.__gust forces the gust, for testing) */
        if (import.meta.env.DEV) (window as unknown as { __SEASONS?: unknown }).__SEASONS = SEASONS;
        const forced = import.meta.env.DEV ? (window as unknown as { __gust?: number }).__gust : undefined;
        const gNow = (forced ?? gustAt(gustT, t)) * s.gust;
        /* the life clock: as the wind clock, but a gust brings them down
           sooner (gustDrop) rather than carrying them further */
        lifeT = still ? fallT : lifeT + dt * (0.55 + s.gustDrop * gNow) * s.fall[2];
        if (lifeT - histAt > step * 8 || lifeT < histAt) {
          for (let k = 0; k < 16; k++) { hist[k * 2] = fallT; hist[k * 2 + 1] = gNow; }
          histAt = lifeT;
        }
        while (lifeT - histAt >= step) { histAt += step; hist.copyWithin(2, 0, 30); hist[2] = fallT; hist[3] = gNow; }
        hist[0] = fallT; hist[1] = gNow;
      }
      /* at a steady pace (about 8s from day to night), easing in at the end,
         so the light has gone before the lamps come on */
      const dd = todTarget.current - td;
      /* leaving night, the light holds until the lamps are off */
      const holding = !still && dd < 0 && lightsK > 0;
      if (instant) { td += dd; lightsK = td > 0.9 ? 1 : 0; }
      else if (!holding) td += still ? dd : Math.sign(dd) * Math.min(Math.abs(dd), 0.004 + Math.abs(dd) * 0.02);
      const lt = lightAt(s, td);

      // scene → texture
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, sw, sh);
      gl.useProgram(scene.p);
      const u = scene.u;
      gl.uniform2f(u.u_res, sw, sh);
      gl.uniform1f(u.u_time, t);
      gl.uniform1f(u.u_windT, windT);
      gl.uniform1f(u.u_fallT, fallT);
      gl.uniform2f(u.u_sun, lt.sun[0], lt.sun[1]);
      /* on: one by one over ~3s once it's dark. Off: one by one too, in
         reverse and quicker (~1.2s), as soon as night's over; the sky
         waits for them before it starts to lighten */
      lightsK = still ? (td > 0.9 ? 1 : 0)
        : todTarget.current < 0.9 ? Math.max(0, lightsK - 0.033 / 1.2)
        : lt.night > 0.98 ? Math.min(1, lightsK + 0.033 / 3) : 0;
      gl.uniform1f(u.u_lights, lightsK);
      gl.uniform1f(u.u_night, lt.night);
      gl.uniform1f(u.u_dusk, lt.dusk);
      gl.uniform1f(u.u_density, s.density);
      gl.uniform3fv(u.u_leafLo, s.leafLo);
      gl.uniform3fv(u.u_leafHi, s.leafHi);
      gl.uniform1f(u.u_blossom, s.blossom);
      gl.uniform1f(u.u_autumn, s.autumn);
      gl.uniform1f(u.u_branchMargin, MARGIN);
      runTrain(now);
      seasonNowY = y; nightNow = lt.night;
      /* (only on a summer day: from late spring to the end of summer) */
      const yr = ((y % 4) + 4) % 4;
      nightNow2 = lt.night;
      for (let k = 0; k < simSteps && !still; k++) {
        const sdt = simSteps > 1 ? 1 / 30 : dt;
        people.update(sdt);
        pickup.update(sdt, yr > 0.6 && yr < 1.6 && lt.night < 0.4);
        skaters.update(sdt, (yr < 0.6 || yr > 3.75) && lt.night < 0.4);
        flock.update(sdt, lt.night, pointerAt, train.on, [...people.threats(), ...pickup.threats(), ...skaters.threats()], pickup.busy() || skaters.busy());
        traffic.update(sdt, people.positions(), people.crossings(), people.bikes());
      }
      /* the sound: what it needs to know of the scene */
      if (soundRef.current?.enabled) {
        const Lw = plan.current.world[0], len = CAR_FT * CARS * plan.current.ft;
        const tc = train.x - train.dir * len / 2;
        const fi = flock.info();
        soundRef.current.frame({
          season: y, night: lt.night, wind: s.wind, gust: gustAt(gustT, t) * s.gust, snow: s.snow, density: s.density,
          train: {
            on: train.on,
            pan: Math.max(-1, Math.min(1, (tc - Lw / 2) / (Lw / 2))) * 0.8,
            near: Math.max(0, Math.min(1, 1 - (Math.max(0, Math.abs(tc - Lw / 2) - Lw * 0.3)) / (Lw * 0.9))),
          },
          flock: { down: fi.down, pan: Math.max(-1, Math.min(1, (fi.x - Lw / 2) / (Lw / 2))) * 0.8 },
          bus: (() => { const b = traffic.busState(); return b ? { pan: Math.max(-1, Math.min(1, (b.x - Lw / 2) / (Lw / 2))) * 0.8, phase: b.phase, t: b.t, toStop: b.toStop } : null; })(),
        });
      }
      const sk = skaters.pack();
      gl.uniform4fv(u.u_skater, sk.A);
      gl.uniform4fv(u.u_skaterB, sk.B);
      gl.uniform4fv(u.u_skaterC, sk.C);
      gl.uniform4fv(u.u_skaterD, sk.D);
      gl.uniform4fv(u.u_board, sk.Bd);
      gl.uniform4fv(u.u_boardB, sk.Bd2);
      const pk = pickup.pack();
      gl.uniform4fv(u.u_player, pk.A);
      gl.uniform4fv(u.u_playerB, pk.B);
      gl.uniform4fv(u.u_playerC, pk.C);
      gl.uniform4fv(u.u_playerD, pk.D);
      gl.uniform4fv(u.u_ball, pk.Bl);
      const pe = people.pack();
      gl.uniform4fv(u.u_person, pe.A);
      gl.uniform4fv(u.u_personB, pe.B);
      gl.uniform4fv(u.u_personC, pe.C);
      gl.uniform4fv(u.u_personD, pe.Sk);
      gl.uniform4fv(u.u_personE, pe.Ex);
      gl.uniform4fv(u.u_dog, pe.D);
      gl.uniform4fv(u.u_dogB, pe.E);
      const fl = flock.pack();
      gl.uniform4fv(u.u_bird, fl.A);
      gl.uniform4fv(u.u_birdB, fl.B);
      gl.uniform4f(u.u_train, train.x, train.track, train.dir, train.on ? 1 : 0);
      gl.uniform2f(u.u_el, ...(plan.current.el ?? [-9, 0]));
      const C = plan.current;
      const none4 = [9, 9, 0, 0];
      gl.uniform2f(u.u_street, ...(C.street ?? [9, 9]));
      gl.uniform2f(u.u_walk, ...(C.walk ?? [0, 0]));
      gl.uniform1f(u.u_rowX, C.rowX ?? 9);
      gl.uniform4fv(u.u_lots, Array.from({ length: 6 }, (_, i) => C.lots?.[i] ?? none4).flat());
      const tr = traffic.pack();
      const cars = new Float32Array(40);
      /* (the deli-side ones come and go: traffic has those) */
      const parked = staticCars(C);
      cars.set(Array.from({ length: 10 - MOVERS }, (_, i) => parked[i] ?? none4).flat());
      cars.set(tr.A, (10 - MOVERS) * 4);
      gl.uniform4fv(u.u_car, cars);
      const carB = new Float32Array(40); carB.set(tr.B, (10 - MOVERS) * 4);
      gl.uniform4fv(u.u_carB, carB);
      gl.uniform4fv(u.u_stop, C.stop ?? none4);
      gl.uniform1f(u.u_zone, C.zone ?? -9);
      trailData.fill(0);
      for (let i = 0; i < trail.length; i++) {
        const age = (now - trail[i].t0) / 1000;
        trailData.set([trail[i].x, trail[i].y, age < 2.5 ? trail[i].s : 0, age], i * 4);
      }
      gl.uniform4fv(u.u_trail, trailData);
      gl.uniform1i(u.u_branch, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, branchTex);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(u.u_wind, s.wind);
      gl.uniform1f(u.u_gustK, s.gust);
      gl.uniform1f(u.u_gustT, gustT);
      gl.uniform3fv(u.u_fallTune, s.fallTune);
      gl.uniform1f(u.u_fallLife, s.fallLife);
      gl.uniform2fv(u.u_hist, hist);
      gl.uniform1f(u.u_lifeT, lifeT);
      gl.uniform1f(u.u_histOff, Math.max(0, lifeT - histAt));
      gl.uniform1f(u.u_snow, s.snow);
      gl.uniform1f(u.u_litter, s.litter);
      gl.uniform3fv(u.u_litterCol, s.litterCol);
      gl.uniform4f(u.u_fall, s.fall[0], s.fall[1], s.fall[2], 0);
      gl.uniform3fv(u.u_sunCol, lt.sunCol);
      gl.uniform3fv(u.u_shadeCol, lt.shadeCol);
      gl.uniform1f(u.u_sunK, lt.sunK);
      const L = plan.current;
      gl.uniform1f(u.u_ft, L.ft);
      gl.uniform2f(u.u_center, L.center[0], L.center[1]);
      gl.uniform1f(u.u_full, L.full ? 1 : 0);
      gl.uniform1f(u.u_vertical, L.vertical ? 1 : 0);
      gl.uniform2f(u.u_world, L.world[0], L.world[1]);
      gl.uniform4f(u.u_fence, ...L.fence);
      gl.uniform3f(u.u_gate, ...L.gate);
      gl.uniform3fv(u.u_bench, L.benches.flat());
      gl.uniform2fv(u.u_lamp, L.lamps.flat());
      gl.uniform3fv(u.u_crown, L.crowns.flat());
      gl.uniform3fv(u.u_courtCol, colours.current.court);
      gl.uniform3fv(u.u_laneCol, colours.current.lane);
      gl.uniform1f(u.u_circleFill, colours.current.circle ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // texture → screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(post.p);
      const v = post.u;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(v.u_scene, 0);
      gl.uniform2f(v.u_size, cv.width, cv.height);
      gl.uniform1f(v.u_grainFrame, still ? 0 : Math.floor(t * 12));
      const short = Math.min(cv.width, cv.height);
      gl.uniform1f(v.u_feather, short * 0.11);
      gl.uniform1f(v.u_blur, short * 0.022);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    /* 30fps: trees in a breeze don't need more */
    /* (and the pace is watched: when the GPU falls behind, frames come
       late, and the scene's drawn a little smaller until they don't.
       Judged over 2s windows of the gaps between draws: the median, so a
       stall or a tab switch doesn't count) */
    const gaps: number[] = [];
    let judgedAt = 0, roomSince = 0;
    /* the frame interval: 30fps, or 20 if even the smallest scene is
       too much for this machine */
    let interval = still ? 500 : 30, hopeless = 0;
    const judge = (now: number) => {
      if (pinnedScale || still || now - judgedAt < 2000) return;
      judgedAt = now;
      // (a handful will do: a machine in real trouble only manages a few
      // frames in the two seconds)
      if (gaps.length < 3) { gaps.length = 0; return; }
      const med = gaps.sort((a, b) => a - b)[gaps.length >> 1];
      gaps.length = 0;
      // (the pace it should be at: every other or every third 60Hz
      // frame, 33 or 50ms)
      const nominal = interval > 30 ? 50 : 33.4;
      const late = med > nominal * 1.2;
      if (late && sceneScale > SCALE_MIN + 1e-3) {
        // (in one go, by how far behind it is: the cost goes with the
        // pixels, so with the square of the scale)
        sceneScale = Math.max(SCALE_MIN, Math.min(sceneScale - 0.1, sceneScale * Math.sqrt(nominal / med)));
        roomSince = now;
        fit();
        if (import.meta.env.DEV) console.info(`[court] frames ${med.toFixed(0)}ms apart: scene scale down to ${sceneScale.toFixed(2)}`);
      } else if (late && interval > 30 && med > 150 && ++hopeless >= 3) {
        /* at the smallest and the slowest and still not seven frames a
           second, three times over: this machine can't run it. Stop,
           and let the still stand in */
        alive = false;
        cancelAnimationFrame(raf);
        failRef.current?.();
      } else if (late && interval < 45) {
        // (45, not 50: lands on every third frame at 60Hz and every
        // sixth at 120Hz, 20fps either way)
        interval = 45;
        if (import.meta.env.DEV) console.info(`[court] still ${med.toFixed(0)}ms apart at the smallest: 20fps`);
      } else if (!late && med < nominal * 1.06 && (sceneScale < SCENE_SCALE - 1e-3 || interval > 30)) {
        // (back up only after 10s of room, so it doesn't seesaw)
        if (!roomSince) roomSince = now;
        else if (now - roomSince > 10000) {
          if (interval > 30) interval = 30;
          else { sceneScale = Math.min(SCENE_SCALE, sceneScale + 0.15); fit(); }
          roomSince = now;
          if (import.meta.env.DEV) console.info(`[court] room again: scene scale ${sceneScale.toFixed(2)}, ${interval}ms`);
        }
      } else roomSince = 0;
    };
    let away = true;
    const begun = performance.now();
    const onHide = () => { away = true; };
    document.addEventListener("visibilitychange", onHide);
    const tick = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      // (under 30, not 33: on a 120Hz display 33 would skip to every
      // fifth frame, 24fps; this lands on every fourth, and every second
      // at 60Hz)
      if (!visible || now - last < interval) return;
      // (not the first frames, while the page is still settling, nor the
      // one after the tab's been away)
      if (!away && now - begun > 1500) gaps.push(Math.min(now - last, 1000));
      away = false;
      last = now;
      draw(now);
      judge(now);
    };

    fit();
    draw(performance.now());
    // (the first frame's up: the still behind it can go)
    readyRef.current?.();
    raf = requestAnimationFrame(tick);
    if (import.meta.env.DEV) {
      const px = new Uint8Array(4);
      const variants: Record<string, { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }> = { [skip.join(",")]: scene0 };
      (window as unknown as { __court?: unknown }).__court = {
        size: () => ({ scene: [sw, sh], out: [cv.width, cv.height], scale: sceneScale }),
        /* ms a frame, the best of `reps` runs of `n` frames, with the
           named sections left out (compiled on the spot) */
        bench: (n = 30, sk: string[] = [], reps = 3) => {
          const key = sk.join(",");
          variants[key] ??= build(sk)!;
          const was = scene;
          scene = variants[key];
          let best = 1e9;
          for (let r = 0; r < reps; r++) {
            // (a readback after each frame, so the GPU has to finish it)
            draw(performance.now()); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            const t0 = performance.now();
            for (let i = 0; i < n; i++) { draw(performance.now()); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
            best = Math.min(best, (performance.now() - t0) / n);
          }
          scene = was;
          return best;
        },
      };
    }
    const ro = new ResizeObserver(() => { fit(); draw(performance.now()); });
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; away = true; });
    io.observe(cv);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onHide); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointermove", onPointer); cv.removeEventListener("pointerdown", onPointer); cv.removeEventListener("pointerleave", offPointer); };
    };
    whenBuilt();
    return () => { gone = true; cancelAnimationFrame(waiting); cv.removeEventListener("webglcontextlost", onLost); if (stop) stop(); };
  }, []);

  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" role="img" aria-label={label} />;
}
