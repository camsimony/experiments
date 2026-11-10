import { useEffect, useRef, useState } from "react";
import { Play, SlidersHorizontal } from "lucide-react";
import { DEFAULT_MIX, SCAPES, TRAINS, VOICE_LIST, type CourtSound, type MixerState } from "./engine";

/* ══ Sound mixer ══════════════════════════════════════════
   Behind the sliders button next to the sound toggle: every voice with
   its level, mute (M) and solo (S); one-shots can be played (▶), and
   seasonal ones held on (H) to hear them out of season. The soundscape
   and the train recording can be swapped. Everything is heard at once
   in the full mix, and remembered; "Copy settings" puts the mix on the
   clipboard to make it the default. */

const KEY = "court-mix";
const load = (): MixerState => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (s) return { ...DEFAULT_MIX, ...s, level: { ...DEFAULT_MIX.level, ...s.level } };
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_MIX));
};

function Tiny({ on, label, title, onClick, children }: { on?: boolean; label: string; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={`grid h-5 w-5 place-items-center rounded text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900 ${
        on ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}

export default function SoundMixer({ sound, ensureOn, sendTrain, sendBus }: { sound: () => CourtSound | null; ensureOn: () => void; sendTrain: () => void; sendBus: () => void }) {
  const [open, setOpen] = useState(false);
  const [mix, setMix] = useState<MixerState>(DEFAULT_MIX);
  const [copied, setCopied] = useState(false);
  const panel = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { setMix(load()); }, []);
  useEffect(() => {
    sound()?.setMix(mix);
    try { localStorage.setItem(KEY, JSON.stringify(mix)); } catch {}
  });
  /* close on a click outside, or Escape */
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); };
  }, [open]);

  const flip = (field: "mute" | "solo" | "hold", k: string) => setMix((m) => ({ ...m, [field]: { ...m[field], [k]: !m[field][k] } }));
  const play = (k: string) => {
    ensureOn();
    if (k === "train") sendTrain();
    else if (k === "bus") sendBus();
    else window.setTimeout(() => sound()?.play(k), 60);
  };
  const select = (label: string, value: string, options: Record<string, string>, set: (v: string) => void) => (
    <label className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className="min-w-0 flex-1 rounded border border-neutral-200 bg-white px-1.5 py-1 text-[12px] text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900"
      >
        {Object.keys(options).map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
  let group = "";

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Sound mixer"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full p-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
          open ? "text-neutral-700" : "text-neutral-400 hover:text-neutral-600"
        }`}
      >
        <SlidersHorizontal size={14} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Sound mixer"
          className="absolute bottom-full right-0 z-20 mb-2 w-[340px] rounded-xl border border-neutral-200 bg-white p-3 text-[12px] font-normal text-neutral-700 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="w-24 shrink-0 font-medium text-neutral-800">Master</span>
            <input
              type="range" min={0} max={2} step={0.01} value={mix.master} aria-label="Master volume"
              onChange={(e) => setMix((m) => ({ ...m, master: +e.target.value }))}
              className="min-w-0 flex-1 accent-neutral-800"
            />
            <span className="w-8 text-right tabular-nums text-neutral-400">{mix.master.toFixed(2)}</span>
          </div>
          <div className="mb-3 space-y-1.5">
            {select("Day", mix.scapeDay, SCAPES, (v) => setMix((m) => ({ ...m, scapeDay: v })))}
            {select("Night", mix.scapeNight, SCAPES, (v) => setMix((m) => ({ ...m, scapeNight: v })))}
            {select("Train", mix.train, TRAINS, (v) => setMix((m) => ({ ...m, train: v })))}
          </div>
          <div className="space-y-1">
            {VOICE_LIST.map((v) => {
              const head = v.group !== group ? (group = v.group) : null;
              const lv = mix.level[v.key] ?? 1;
              return (
                <div key={v.key}>
                  {head && <div className="mb-0.5 mt-2 text-[10px] uppercase tracking-wide text-neutral-400 first:mt-0">{head}</div>}
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate">{v.label}</span>
                    <input
                      type="range" min={0} max={3} step={0.01} value={lv} aria-label={`${v.label} level`}
                      onChange={(e) => setMix((m) => ({ ...m, level: { ...m.level, [v.key]: +e.target.value } }))}
                      className="min-w-0 flex-1 accent-neutral-800"
                    />
                    <span className="w-7 text-right tabular-nums text-neutral-400">{lv.toFixed(1)}</span>
                    <Tiny on={!!mix.mute[v.key]} label={`Mute ${v.label}`} title="Mute" onClick={() => flip("mute", v.key)}>M</Tiny>
                    <Tiny on={!!mix.solo[v.key]} label={`Solo ${v.label}`} title="Solo" onClick={() => flip("solo", v.key)}>S</Tiny>
                    {v.shot ? <Tiny label={`Play ${v.label}`} title={v.key === "train" ? "Send a train" : v.key === "bus" ? "Send the bus" : "Play one"} onClick={() => play(v.key)}><Play size={10} strokeWidth={2} aria-hidden /></Tiny> : <span className="w-5" />}
                    {v.hold ? <Tiny on={!!mix.hold[v.key]} label={`Hold ${v.label} on`} title="Hold on (hear it out of season)" onClick={() => { ensureOn(); flip("hold", v.key); }}>H</Tiny> : <span className="w-5" />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-end gap-3 border-t border-neutral-100 pt-2 text-neutral-500">
            <button type="button" className="hover:text-neutral-800" onClick={() => setMix(JSON.parse(JSON.stringify(DEFAULT_MIX)))}>Reset</button>
            <button
              type="button"
              className="hover:text-neutral-800"
              onClick={() => { navigator.clipboard?.writeText(JSON.stringify(mix, null, 2)); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }}
            >
              {copied ? "Copied" : "Copy settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
