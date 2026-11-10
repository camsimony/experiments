import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import TopDownCourt from "./TopDownCourt";
import { SEASONS, seasonNow } from "./seasons";
import { TIMES, timeNow } from "./daylight";
import { LAYOUTS, PAINTS } from "./layouts";
import { CourtSound } from "./sound/engine";
import SoundMixer from "./sound/SoundMixer";

/* ══ Court scene ══════════════════════════════════════════
   The top-down court, opening on today's season in New York, with a
   quiet control underneath to turn the year by hand. */

/* the paces the drawing-in can be replayed at */
const PACES = [1, 0.5, 0.25, 0.1];

export default function CourtScene({ onDrawn, onRedraw }: { onDrawn?: () => void; onRedraw?: () => void }) {
  const [season, setSeason] = useState<number | null>(null);
  /* the half court, chosen over the full court (2026-11-07); the full
     court layout is kept in layouts.ts as FULL_COURT */
  const layout = 0;
  /* green court, terracotta lane: chosen over tan (2026-11-07) */
  const paint = 0;
  /* the light: the visitor's own time of day, or picked by hand */
  const [time, setTime] = useState(0);
  /* testing: send a train now */
  const [trainCall, setTrainCall] = useState(0);
  /* and the bus */
  const [busCall, setBusCall] = useState(0);
  /* the scene: being built, running, or not able to run here (no WebGL2,
     or a machine it's too much for), when a still stands in */
  const [scene, setScene] = useState<"building" | "live" | "still">("building");
  /* the scene opens by being drawn in; the rest of the page (the
     lettering, these controls) waits for it, then eases in */
  const [drawn, setDrawn] = useState(false);
  const done = () => { setDrawn(true); onDrawn?.(); };
  /* drawn in again, on asking, at a pace of the visitor's choosing */
  const [redraw, setRedraw] = useState(0);
  const [pace, setPace] = useState(0);
  const replay = () => {
    /* (nothing to replay where motion's turned down: it isn't drawn in there) */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setRedraw((n) => n + 1); onRedraw?.();
  };
  useEffect(() => {
    /* (dev: ?season=0..3&time=0..2 to open on a given one) */
    const q = new URLSearchParams(window.location.search);
    const qs = Number(q.get("season")), qt = Number(q.get("time"));
    setSeason(q.has("season") && qs >= 0 && qs <= 3 ? qs : seasonNow());
    setTime(q.has("time") && qt >= 0 && qt <= 2 ? qt : timeNow());
  }, []);
  /* sound: off to start. Turned on, it's remembered, and comes back on
     at the visitor's first click or key next time (a browser won't play
     before one) */
  const sound = useRef<CourtSound | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const toggleSound = (on: boolean) => {
    sound.current ??= new CourtSound();
    sound.current.setEnabled(on);
    setSoundOn(on);
    try { localStorage.setItem("court-sound", on ? "1" : "0"); } catch {}
  };
  useEffect(() => {
    let wanted = false;
    try { wanted = localStorage.getItem("court-sound") === "1"; } catch {}
    if (!wanted) return;
    const go = () => { toggleSound(true); off(); };
    const off = () => { window.removeEventListener("pointerdown", go); window.removeEventListener("keydown", go); };
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    return off;
  }, []);
  useEffect(() => () => sound.current?.dispose(), []);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* the frame takes the layout's shape; a tall one is held to ~80% of
          the window's height so the whole court is always in view */}
      <div
        className="relative w-full"
        style={{
          aspectRatio: `${LAYOUTS[layout].world[0]} / ${LAYOUTS[layout].world[1]}`,
          maxWidth: LAYOUTS[layout].vertical ? "calc(80dvh * 2 / 3)" : undefined,
        }}
      >
        {scene === "still" ? (
          <img src={`${import.meta.env.BASE_URL}court/top-down.jpg`} alt="A New York park basketball court seen from above, under plane trees." className="absolute inset-0 h-full w-full object-cover" />
        ) : season !== null && (
          <div className={`absolute inset-0 transition-opacity duration-500 ease-out ${scene === "live" ? "opacity-100" : "opacity-0"}`}>
            <TopDownCourt season={season} tod={TIMES[time].tod} trainCall={trainCall} busCall={busCall} sound={soundOn ? sound.current : null} layout={LAYOUTS[layout]} paint={PAINTS[paint]} label="A New York park basketball court seen from above, under plane trees." onReady={() => setScene("live")} onDrawn={done} redraw={redraw} drawSpeed={PACES[pace]} onFail={() => { done(); setScene("still"); sound.current?.setEnabled(false); setSoundOn(false); }} />
          </div>
        )}
      </div>
      {/* (the seasons, the light and the sound are the live scene's: a
          still has none to change) */}
      <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-medium transition-opacity delay-500 duration-700 ease-out motion-reduce:transition-none ${scene === "still" ? "invisible" : ""} ${drawn ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={scene === "still"}>
        <div role="radiogroup" aria-label="Season" className="flex items-center gap-1">
          {SEASONS.map((s, i) => (
            <button
              key={s.name}
              type="button"
              role="radio"
              aria-checked={season === i}
              onClick={() => setSeason(i)}
              className={`rounded-full px-2.5 py-1 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
                season === i ? "text-neutral-800" : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Time of day" className="flex items-center gap-1">
          {TIMES.map((s, i) => (
            <button
              key={s.name}
              type="button"
              role="radio"
              aria-checked={time === i}
              onClick={() => setTime(i)}
              className={`rounded-full px-2.5 py-1 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
                time === i ? "text-neutral-800" : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTrainCall((n) => n + 1)}
          className="rounded-full px-2.5 py-1 text-[12px] text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Train
        </button>
        <button
          type="button"
          onClick={() => setBusCall((n) => n + 1)}
          className="rounded-full px-2.5 py-1 text-[12px] text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Bus
        </button>
        {/* the drawing-in, again; and how fast (each press slower, then
            back round), which plays it at once */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={replay}
            className="rounded-full py-1 pl-2.5 pr-1 text-[12px] text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Replay
          </button>
          <button
            type="button"
            aria-label={`Replay speed: ${PACES[pace]}×. Change speed and replay`}
            onClick={() => { setPace((i) => (i + 1) % PACES.length); replay(); }}
            className="rounded-full py-1 pl-1 pr-2.5 text-[12px] tabular-nums text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            {PACES[pace]}×
          </button>
        </div>
        {/* the sound: off until turned on */}
        <button
          type="button"
          aria-pressed={soundOn}
          aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
          onClick={() => toggleSound(!soundOn)}
          className="rounded-full p-1.5 text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          {soundOn ? <Volume2 size={14} strokeWidth={1.75} aria-hidden /> : <VolumeX size={14} strokeWidth={1.75} aria-hidden />}
        </button>
        {/* the mixer, behind the sliders */}
        <SoundMixer
          sound={() => sound.current}
          ensureOn={() => { if (!sound.current?.enabled) toggleSound(true); }}
          sendTrain={() => setTrainCall((n) => n + 1)}
          sendBus={() => setBusCall((n) => n + 1)}
        />
      </div>
    </div>
  );
}

