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
  bus: { pan: number; phase: string; t: number; toStop: number } | null;
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
  master: 1,
  level: { scape: 1, train: 1, bus: 1, wings: 1, coo: 1, wind: 0.6, leaves: 0.6, birds: 0.7, cicada: 0.7, crickets: 0.7 },
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
  private busDone = { arrive: false, doors: false, leave: false };
  private busSrcs: { src: AudioBufferSourceNode; p: StereoPannerNode }[] = [];
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
    [...Object.values(SCAPES), ...Object.values(TRAINS), "wings-1", "wings-2", "coo-1", "bus-arrive", "bus-doors", "bus-leave"].forEach((f) => this.buffer(f));
    /* the soundscape: two loops, day and night, crossfaded */
    this.loops.scapeDay = this.loop();
    this.loops.scapeNight = this.loop();
    this.loops.coo = this.loop(true);
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
  private playLoop(L: Loop, file: string) {
    if (L.file === file) return;
    L.file = file;
    this.buffer(file).then((buf) => {
      if (!buf || !this.ctx || L.file !== file) return;
      const ctx = this.ctx, old = L.src;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const fade = ctx.createGain(); fade.gain.value = 0;
      src.connect(fade).connect(L.g);
      src.start(0, Math.random() * buf.duration * 0.8);
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
  /* the bus (a real MTA bus at a stop on 8th Avenue, in three cuts):
     the approach and the brakes' hiss as it stops; the doors and the
     air let go, partway through its wait; the pull-away, fading up the
     street. Each follows the bus across the stereo field */
  private busCue(name: "arrive" | "doors" | "leave", pan: number) {
    const k = this.k("bus");
    if (k <= 0 || !this.ctx) return;
    const ctx = this.ctx;
    this.buffer("bus-" + name).then((buf) => {
      if (!buf || !this.ctx || !this.on) return;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = (name === "doors" ? 0.7 : 0.85) * k;
      const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
      src.connect(g).connect(p).connect(this.out);
      const entry = { src, p };
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
    /* the bus: each sound once per bus, at its moment */
    const b = f.bus;
    if (!b) this.busDone = { arrive: false, doors: false, leave: false };
    else {
      if (b.phase === "in" && b.toStop < 72 && !this.busDone.arrive) { this.busDone.arrive = true; this.busCue("arrive", b.pan); }
      if (b.phase === "dwell" && b.t > 4.5 && !this.busDone.doors) { this.busDone.doors = true; this.busCue("doors", b.pan); }
      if ((b.phase === "out" || b.phase === "drive") && !this.busDone.leave) { this.busDone.leave = true; this.busCue("leave", b.pan); }
      for (const e of this.busSrcs) e.p.pan.setTargetAtTime(b.pan, this.ctx.currentTime, 0.4);
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
