/* ══ Court sound ══════════════════════════════════════════
   The scene's sound, mixed live with the Web Audio API and driven by the
   same simulation as the picture.

     soundscape  a real New York field recording, looping: the city as
                 the bed everything else sits on. One for the day, one for
                 the night, crossfading with the light
     events      recordings tied to what's on screen, panned to where it
                 is: the el train going over, the pigeons cooing while
                 they're down and their wings when they go up
     air         the wind, swelling with each gust, and the leaves in it
                 while the trees have them (synthesised: it has to follow
                 the scene's own gusts)
     seasons     birds, cicadas, crickets (synthesised placeholders, to be
                 swapped for recordings)

   The recordings are CC0, from Freesound (see public/sounds/court/
   CREDITS.md). Nothing loads or plays until the visitor turns the sound
   on; it starts muted. */

export type SoundFrame = {
  season: number;       // position on the year: 0 spring .. 4 (wraps)
  night: number;        // 0 day .. 1 night
  wind: number;         // the season's breeze
  gust: number;         // the gust right now, 0..1+
  snow: number;         // snow lying
  density: number;      // how full the crowns are (leaves to rustle)
  train: { on: boolean; pan: number; near: number };     // pan -1..1, near 0..1 (how much of it's in earshot)
  flock: { down: boolean; pan: number };
  /* the bus, while there is one: where it is (pan), what it's doing
     ("in" coming up the street, "dwell" at the stop, "out" pulling away,
     "drive" gone on), how long it's been at it, and how far from the
     stop (ft) */
  bus: { pan: number; phase: string; t: number; toStop: number; v: number } | null;
  /* the court: what's just happened on it (the ball bounced, off the rim
     or through the net; a board popped, landed, or come down on its
     own), where and how hard; and the fastest board rolling (ft/s) */
  court: { heard: { k: string; pan: number; s: number }[]; roll: { v: number; pan: number } | null };
};

const BASE = `${import.meta.env.BASE_URL}sounds/court/`;
export const SCAPES: Record<string, string> = {
  "Backyard, NYC": "scape-backyard",
  "Brooklyn street": "scape-brooklyn",
  "Brooklyn, wet streets": "scape-wet-street",
  "Utica Ave, Sunday morning": "scape-utica-sunday",
  "Bushwick rooftop, night": "scape-rooftop-night",
  "Astoria el station, winter": "scape-astoria-winter",
};
export const TRAINS: Record<string, string> = {
  "Astoria el, overhead": "train-astoria",
  "Manhattan Bridge, overhead": "train-bridge",
};

/* the voices, for the mixer */
export type VoiceInfo = { key: string; label: string; group: string; shot?: boolean; hold?: boolean };
export const VOICE_LIST: VoiceInfo[] = [
  { key: "scape", label: "Soundscape", group: "City" },
  { key: "train", label: "El train", group: "Events", shot: true },
  { key: "bus", label: "Bus at the stop", group: "Events", shot: true },
  { key: "ball", label: "Basketball", group: "Events", shot: true },
  { key: "skate", label: "Skateboards", group: "Events", shot: true },
  { key: "wings", label: "Pigeon wings", group: "Events", shot: true },
  { key: "coo", label: "Pigeons cooing", group: "Events", hold: true },
  { key: "wind", label: "Wind", group: "Air", hold: true },
  { key: "leaves", label: "Leaves rustling", group: "Air", hold: true },
  { key: "birds", label: "Birds", group: "Seasons", shot: true, hold: true },
  { key: "cicada", label: "Cicadas", group: "Seasons", hold: true },
  { key: "crickets", label: "Crickets", group: "Seasons", shot: true, hold: true },
];
export type MixerState = {
  master: number;
  level: Record<string, number>; mute: Record<string, boolean>; solo: Record<string, boolean>; hold: Record<string, boolean>;
  scapeDay: string; scapeNight: string; train: string;
};
export const DEFAULT_MIX: MixerState = {
  master: 0.7,
  level: { scape: 0.39, train: 0.3, bus: 0.23, ball: 0.36, skate: 0.24, wings: 0.13, coo: 0.73, wind: 0.33, leaves: 0.29, birds: 0.58, cicada: 0, crickets: 0.2 },
  mute: {}, solo: {}, hold: {},
  scapeDay: "Brooklyn street", scapeNight: "Bushwick rooftop, night", train: "Astoria el, overhead",
};

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const seasonK = (y: number, s: number) => {
  const w = ((y % 4) + 4) % 4;
  const d = Math.abs(((w - s + 6) % 4) - 2);
  return clamp(1 - d);
};

type Loop = { g: GainNode; p?: StereoPannerNode; f?: BiquadFilterNode; src?: AudioBufferSourceNode; file?: string };

/* how the bus sounds from where it is. Far off it's quiet and dull, the
   top of it lost to the distance; it opens up and comes on as it nears
   the stop, and closes again as it goes. Its pitch sits a little high
   while it's coming at speed and settles as it brakes, then sags as it
   pulls away (the Doppler shift, leaned on a little: at a bus's pace
   the real one is under two percent) */
const BUS_FAR = 180, BUS_GONE = 110, BUS_PACE = 19;   // ft down the street when it sets out; ft up it when it's gone; ft/s
function busHeard(name: string, b: SoundFrame["bus"]) {
  /* at the stop: the air let go as it settles (and again, lower and
     softer, at the doors), over the engine ticking while it waits */
  if (name === "air") return { gain: 0.5, cut: 16000, rate: 1 };
  if (name === "doors") return { gain: 0.32, cut: 9000, rate: 0.8 };
  if (name === "idle") return { gain: b && (b.phase === "dwell" || (b.phase === "in" && b.toStop < 2)) ? 0.45 : 0, cut: 16000, rate: 1 };
  const level = 0.9;
  if (!b) return { gain: level, cut: 16000, rate: 1 };
  const coming = name === "arrive";
  // (the arrival's still ringing once it's stopped, and the pull-away's
  // idling before it moves: both right here)
  const near = coming ? (b.phase === "in" ? 1 - clamp(b.toStop / BUS_FAR, 0, 1) : 1)
                      : 1 - 0.5 * clamp(-b.toStop / BUS_GONE, 0, 1);
  const pace = clamp(b.v / BUS_PACE, 0, 1) * (coming ? (b.phase === "in" ? 1 : 0) : -1);
  return {
    gain: level * (0.05 + 0.95 * Math.pow(near, 1.6)),
    cut: 500 * Math.pow(32, Math.pow(near, 0.8)),   // 500Hz → 16kHz
    rate: 1 + 0.03 * pace,
  };
}

export class CourtSound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private out!: GainNode;
  private noise!: AudioBuffer;
  private buffers: Record<string, Promise<AudioBuffer | null>> = {};
  private loops: Record<string, Loop> = {};
  private timers: number[] = [];
  private last: SoundFrame | null = null;
  private wasDown = true;
  private trainWas = false;
  private trainSrc: { src: AudioBufferSourceNode; g: GainNode; p: StereoPannerNode } | null = null;
  /* the bus: which of its three sounds have played for this one, and
     the ones still sounding (panned with it) */
  private busDone = { arrive: false, air: false, doors: false, leave: false };
  private busSrcs: { name: string; src: AudioBufferSourceNode; g: GainNode; lp: BiquadFilterNode; p: StereoPannerNode }[] = [];
  private on = false;
  mix: MixerState = JSON.parse(JSON.stringify(DEFAULT_MIX));

  get enabled() { return this.on; }
  get state() { return this.last; }

  async setEnabled(on: boolean) {
    this.on = on;
    if (on && !this.ctx) this.build();
    if (!this.ctx) return;
    if (on && this.ctx.state === "suspended") await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.8 : 0.15);
    if (!on) window.setTimeout(() => { if (!this.on) this.ctx?.suspend(); }, 800);
  }
  setMix(m: MixerState) {
    this.mix = m;
    if (this.ctx) this.out.gain.setTargetAtTime(m.master, this.ctx.currentTime, 0.1);
  }
  /* how loud a voice is in the mixer right now: its level, unless it's
     muted, or something else is soloed */
  private k(key: string) {
    const m = this.mix;
    if (m.mute[key]) return 0;
    if (Object.entries(m.solo).some(([, v]) => v) && !m.solo[key]) return 0;
    return m.level[key] ?? 1;
  }
  private held(key: string) { return !!this.mix.hold[key]; }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.out = ctx.createGain(); this.out.gain.value = this.mix.master;
    this.out.connect(this.master).connect(comp).connect(ctx.destination);
    this.noise = this.makeNoise();
    /* the recordings, all fetched now (they're small) */
    [...Object.values(SCAPES), ...Object.values(TRAINS), "wings-1", "wings-2", "coo-1", "bus-arrive", "bus-air", "bus-idle", "bus-leave",
      "ball-bounce-1", "ball-bounce-2", "ball-bounce-3", "ball-bounce-4", "ball-rim-1", "ball-rim-2", "ball-rim-3", "ball-net", "skate-pop", "skate-land", "skate-roll"].forEach((f) => this.buffer(f));
    /* the soundscape: two loops, day and night, crossfaded */
    this.loops.scapeDay = this.loop();
    this.loops.scapeNight = this.loop();
    this.loops.coo = this.loop(true);
    /* a board's wheels on the court: always turning, heard when one rolls
       (the recording repeats between these two points, clear of its ends) */
    this.loops.roll = this.loop(true);
    this.playLoop(this.loops.roll, "skate-roll", [0.25, 10.25]);
    /* the air */
    this.loops.wind = this.noiseLoop("bandpass", 500, 0.6);
    this.loops.leaves = this.noiseLoop("highpass", 2600, 0.5);
    this.loops.cicada = this.noiseLoop("bandpass", 5200, 6);
    this.every(0.7, 1.6, () => this.crickets(false));
    this.every(0.4, 2.2, () => this.birds(false));
  }

  /* ── building blocks ───────────────────────────────────── */
  private buffer(file: string) {
    this.buffers[file] ??= fetch(BASE + file + ".mp3")
      .then((r) => r.arrayBuffer())
      .then((b) => this.ctx!.decodeAudioData(b))
      .catch(() => null);
    return this.buffers[file];
  }
  private makeNoise() {
    const ctx = this.ctx!, n = ctx.sampleRate * 4, b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      for (let i = 0; i < 2000; i++) { const k = i / 2000; d[n - 2000 + i] = d[n - 2000 + i] * (1 - k) + d[i] * k; }
    }
    return b;
  }
  /* a loop of a recording; which file plays is set later (and can change) */
  private loop(pan = false): Loop {
    const ctx = this.ctx!, g = ctx.createGain(); g.gain.value = 0;
    let p: StereoPannerNode | undefined;
    if (pan) { p = ctx.createStereoPanner(); g.connect(p).connect(this.out); } else g.connect(this.out);
    return { g, p };
  }
  /* point a loop at a file: the new one fades in over the old */
  private playLoop(L: Loop, file: string, span?: [number, number]) {
    if (L.file === file) return;
    L.file = file;
    this.buffer(file).then((buf) => {
      if (!buf || !this.ctx || L.file !== file) return;
      const ctx = this.ctx, old = L.src;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const fade = ctx.createGain(); fade.gain.value = 0;
      src.connect(fade).connect(L.g);
      if (span) { src.loopStart = span[0]; src.loopEnd = span[1]; }
      src.start(0, span ? span[0] + Math.random() * (span[1] - span[0]) : Math.random() * buf.duration * 0.8);
      fade.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
      if (old) { const og = (old as unknown as { _fade: GainNode })._fade; og?.gain.setTargetAtTime(0, ctx.currentTime, 0.8); old.stop(ctx.currentTime + 5); }
      (src as unknown as { _fade: GainNode })._fade = fade;
      L.src = src;
    });
  }
  private noiseLoop(type: BiquadFilterType, freq: number, q: number): Loop {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(0, Math.random() * 3);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(this.out);
    return { g, f, src: s };
  }
  private set(L: Loop | undefined, v: number, tc = 0.4) { if (L && this.ctx) L.g.gain.setTargetAtTime(v, this.ctx.currentTime, tc); }
  /* a recording, once, panned */
  private async shot(file: string, gain: number, pan: number, rate = 1) {
    const buf = await this.buffer(file);
    if (!buf || !this.ctx) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    src.connect(g).connect(p).connect(this.out);
    src.start();
  }
  /* a synthesised blip (the placeholder birds and crickets) */
  private blip(o: { f0: number; f1?: number; dur: number; gain: number; pan?: number; attack?: number; at?: number }) {
    const ctx = this.ctx!, t = ctx.currentTime + (o.at ?? 0);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    const g = ctx.createGain(), a = o.attack ?? 0.01;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.gain, t + a); g.gain.setTargetAtTime(0, t + a, o.dur / 4);
    const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan ?? 0, -1, 1);
    osc.connect(g).connect(p).connect(this.out);
    osc.start(t); osc.stop(t + o.dur * 2 + 0.2);
  }
  private every(a: number, b: number, fn: () => void) {
    const tick = () => {
      if (this.on && this.ctx?.state === "running") fn();
      this.timers.push(window.setTimeout(tick, rnd(a, b) * 1000));
    };
    this.timers.push(window.setTimeout(tick, rnd(a, b) * 1000));
  }

  /* ── the voices ────────────────────────────────────────── */
  private crickets(force: boolean) {
    const f = this.last; if (!f) return;
    const k = (force || this.held("crickets") ? 1 : (seasonK(f.season, 0) * 0.5 + seasonK(f.season, 1) + seasonK(f.season, 2) * 0.6) * f.night) * this.k("crickets");
    if (k < 0.03) return;
    const pan = rnd(-0.9, 0.9), hz = rnd(4300, 4800);
    for (let i = 0; i < 3; i++) this.blip({ f0: hz, dur: 0.05, gain: 0.01 * k, pan, attack: 0.005, at: i * 0.07 });
  }
  private birds(force: boolean) {
    const f = this.last; if (!f) return;
    const pk = force || this.held("birds") ? 1 : (seasonK(f.season, 0) + seasonK(f.season, 1) * 0.7 + seasonK(f.season, 2) * 0.25) * (1 - f.night);
    if (!force && Math.random() > pk) return;
    const k = this.k("birds");
    if (k <= 0) return;
    const pan = rnd(-0.9, 0.9), n = Math.floor(rnd(1, 5)), base = rnd(2800, 4200);
    for (let i = 0; i < n; i++) {
      const f0 = base * rnd(0.9, 1.15);
      this.blip({ f0, f1: f0 * rnd(0.7, 1.4), dur: rnd(0.04, 0.11), gain: 0.012 * k, pan, attack: 0.004, at: i * rnd(0.08, 0.16) });
    }
  }
  private wings(pan: number) {
    const k = this.k("wings");
    if (k <= 0) return;
    this.shot(Math.random() < 0.5 ? "wings-1" : "wings-2", 0.9 * k, pan, rnd(0.92, 1.08));
  }
  /* the court: a ball on the asphalt, off the board, through a chain
     net; a board's tail popped and its wheels come down. Small sounds,
     each a little different every time */
  private courtHit(kind: string, pan: number, s: number) {
    const pick = (n: number) => 1 + Math.floor(Math.random() * n), r = rnd(0.94, 1.07);
    if (kind === "bounce" || kind === "rim" || kind === "net") {
      const k = this.k("ball") * s;
      if (k <= 0) return;
      if (kind === "bounce") this.shot("ball-bounce-" + pick(4), 0.55 * k, pan, r);
      else if (kind === "rim") this.shot("ball-rim-" + pick(3), 0.6 * k, pan, r);
      else this.shot("ball-net", 0.4 * k, pan, rnd(0.97, 1.04));
    } else {
      const k = this.k("skate") * s;
      if (k <= 0) return;
      if (kind === "pop") this.shot("skate-pop", 0.5 * k, pan, r);
      else if (kind === "land") this.shot("skate-land", 0.6 * k, pan, r);
      else {
        /* come down without them: it clatters, two or three knocks */
        this.shot("skate-land", 0.5 * k, pan, rnd(0.8, 0.9));
        this.timers.push(window.setTimeout(() => this.shot("skate-land", 0.35 * k, pan, rnd(1.05, 1.2)), rnd(90, 150)));
        if (Math.random() < 0.6) this.timers.push(window.setTimeout(() => this.shot("skate-land", 0.2 * k, pan, rnd(0.9, 1.1)), rnd(230, 330)));
      }
    }
  }
  /* the bus (a real MTA bus at a stop on 8th Avenue for its coming and
     going; its kneeling alarm, a loud beeping at the stop, is left out):
     the approach, from well down the street; the air let go as it
     settles, and again at the doors, over the engine ticking while it
     waits (a brake's hiss and a coach idling, from elsewhere); the
     pull-away, fading up the street. Each follows the bus across the
     stereo field, and like the el it's heard coming and going: */
  private busCue(name: "arrive" | "air" | "idle" | "doors" | "leave", pan: number) {
    if (this.k("bus") <= 0 || !this.ctx) return;
    const ctx = this.ctx;
    this.buffer(name === "doors" ? "bus-air" : "bus-" + name).then((buf) => {
      if (!buf || !this.ctx || !this.on) return;
      const b = this.last?.bus ?? null, h = busHeard(name, b);
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = h.rate;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.5; lp.frequency.value = h.cut;
      // (the engine's tick comes up under the rest, not on with a start)
      const g = ctx.createGain(); g.gain.value = name === "idle" ? 0 : h.gain * this.k("bus");
      const p = ctx.createStereoPanner(); p.pan.value = clamp(b?.pan ?? pan, -1, 1);
      src.connect(lp).connect(g).connect(p).connect(this.out);
      const entry = { name, src, g, lp, p };
      this.busSrcs.push(entry);
      src.onended = () => { this.busSrcs = this.busSrcs.filter((e) => e !== entry); };
      src.start();
    });
  }
  /* the el: the recording starts as the train comes into earshot and
     follows it, louder and panned as it crosses, fading as it goes */
  private trainStart() {
    const ctx = this.ctx!, file = TRAINS[this.mix.train] ?? "train-astoria";
    this.buffer(file).then((buf) => {
      if (!buf || !this.ctx) return;
      this.trainStop();
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0;
      const p = ctx.createStereoPanner();
      src.connect(g).connect(p).connect(this.out);
      src.start(0, 2);
      this.trainSrc = { src, g, p };
    });
  }
  private trainStop() {
    const t = this.trainSrc;
    if (!t || !this.ctx) return;
    t.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
    t.src.stop(this.ctx.currentTime + 4);
    this.trainSrc = null;
  }

  /* play one now, whatever the season (the mixer's ▶) */
  play(key: string) {
    if (!this.ctx) return;
    const pan = this.last?.flock.pan ?? 0;
    if (key === "wings") this.wings(pan);
    else if (key === "bus") this.busCue("arrive", this.last?.bus?.pan ?? 0.6);
    else if (key === "ball") {
      // (a couple of dribbles and a shot: off the board, or in)
      [0, 420, 840].forEach((ms) => this.timers.push(window.setTimeout(() => this.courtHit("bounce", 0, 0.75), ms)));
      this.timers.push(window.setTimeout(() => this.courtHit(Math.random() < 0.5 ? "net" : "rim", 0, 1), 1700));
    } else if (key === "skate") {
      this.courtHit("pop", 0, 1);
      this.timers.push(window.setTimeout(() => this.courtHit(Math.random() < 0.6 ? "land" : "bail", 0, 1), 540));
    }
    else if (key === "birds") this.birds(true);
    else if (key === "crickets") this.crickets(true);
  }

  /* ── each frame, from the scene ────────────────────────── */
  frame(f: SoundFrame) {
    this.last = f;
    if (!this.ctx || !this.on) return;
    const day = 1 - f.night, L = this.loops;
    /* the soundscape: day's and night's, crossfading with the light, a
       little quieter under snow and while the train goes over */
    this.playLoop(L.scapeDay, SCAPES[this.mix.scapeDay] ?? "scape-brooklyn");
    this.playLoop(L.scapeNight, SCAPES[this.mix.scapeNight] ?? "scape-rooftop-night");
    const tn = f.train.on ? f.train.near : 0;
    const bed = this.k("scape") * (1 - 0.3 * clamp(f.snow)) * (1 - 0.45 * tn);
    this.set(L.scapeDay, 0.9 * bed * Math.sqrt(day), 1.2);
    this.set(L.scapeNight, 0.9 * bed * Math.sqrt(f.night), 1.2);
    /* the train */
    if (f.train.on && !this.trainWas) this.trainStart();
    if (!f.train.on && this.trainWas) this.trainStop();
    this.trainWas = f.train.on;
    if (this.trainSrc) {
      this.trainSrc.g.gain.setTargetAtTime(1.1 * this.k("train") * Math.pow(tn, 1.3), this.ctx.currentTime, 0.3);
      this.trainSrc.p.pan.setTargetAtTime(f.train.pan, this.ctx.currentTime, 0.2);
    }
    /* the court */
    for (const h of f.court.heard) this.courtHit(h.k, h.pan, h.s);
    {
      const roll = f.court.roll, pace = clamp((roll?.v ?? 0) / 11), R = L.roll;
      this.set(R, 0.5 * this.k("skate") * Math.pow(pace, 1.3), 0.12);
      if (roll) R.p?.pan.setTargetAtTime(roll.pan, this.ctx.currentTime, 0.2);
      // (the faster it rolls, the higher it sings)
      R.src?.playbackRate.setTargetAtTime(0.8 + 0.35 * pace, this.ctx.currentTime, 0.2);
    }
    /* the bus: each sound once per bus, at its moment */
    const b = f.bus;
    if (!b) this.busDone = { arrive: false, air: false, doors: false, leave: false };
    else {
      // (from the moment it sets out, still out of sight down the street)
      if (b.phase === "in" && !this.busDone.arrive) { this.busDone.arrive = true; this.busCue("arrive", b.pan); }
      // (as it settles: the last couple of feet are a crawl)
      if ((b.phase === "dwell" || (b.phase === "in" && b.toStop < 1.2)) && !this.busDone.air) { this.busDone.air = true; this.busCue("air", b.pan); this.busCue("idle", b.pan); }
      if (b.phase === "dwell" && b.t > 4.5 && !this.busDone.doors) { this.busDone.doors = true; this.busCue("doors", b.pan); }
      if ((b.phase === "out" || b.phase === "drive") && !this.busDone.leave) { this.busDone.leave = true; this.busCue("leave", b.pan); }
      const now = this.ctx.currentTime, k = this.k("bus");
      for (const e of this.busSrcs) {
        const h = busHeard(e.name, b);
        e.g.gain.setTargetAtTime(h.gain * k, now, 0.35);
        e.lp.frequency.setTargetAtTime(h.cut, now, 0.35);
        e.src.playbackRate.setTargetAtTime(h.rate, now, 0.5);
        e.p.pan.setTargetAtTime(b.pan, now, 0.4);
      }
    }
    /* the pigeons: cooing while they're down, wings as they go up */
    this.playLoop(L.coo, "coo-1");
    const cooing = this.held("coo") || (f.flock.down && f.night < 0.5);
    this.set(L.coo, (cooing ? 0.5 : 0) * this.k("coo"), 0.8);
    L.coo.p?.pan.setTargetAtTime(this.held("coo") ? 0 : f.flock.pan, this.ctx.currentTime, 0.5);
    if (this.wasDown && !f.flock.down) this.wings(f.flock.pan);
    this.wasDown = f.flock.down;
    /* the wind follows the breeze and the gusts; the leaves rustle in it
       while the crowns are full, a thinner whistle through bare ones */
    const air = this.held("wind") ? 0.8 : clamp(f.wind * 0.35 + f.gust * 0.8);
    this.set(L.wind, (0.012 + 0.04 * air) * this.k("wind"), 0.5);
    L.wind.f?.frequency.setTargetAtTime(380 + 500 * air + 300 * (1 - f.density), this.ctx.currentTime, 0.6);
    this.set(L.leaves, 0.025 * (this.held("leaves") ? 0.8 : air * clamp(f.density * 1.3)) * this.k("leaves"), 0.3);
    /* cicadas: summer days, swelling and fading on their own slow cycle */
    const ct = this.ctx.currentTime;
    const swell = 0.55 + 0.45 * Math.sin(ct * 0.21) * Math.sin(ct * 0.077 + 1);
    this.set(L.cicada, 0.02 * clamp((this.held("cicada") ? 1 : seasonK(f.season, 1) * day) * swell) * this.k("cicada"), 1.2);
  }
  /* the train, heard on the mixer's ▶: the scene sends a real one */

  dispose() {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.ctx?.close();
    this.ctx = null;
  }
}
