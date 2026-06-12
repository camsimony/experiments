import {useEffect, useMemo, useRef, useState} from 'react';
import {DialRoot, useDialKit} from 'dialkit';

import {clockRegistry, getClockById} from './app/clockRegistry';
import {DEFAULT_RUNTIME_PARAMS, type ClockRuntimeParams, type MotionMode} from './app/clockTypes';
import {getInitialClockId} from './app/galleryState';
import {shouldReduceMotion} from './engine/time';
import {runtimeDialConfig, type RuntimeDialValues} from './clocks/reference-word-clock/dialConfig';
import './styles/global.css';

function toRuntimeParams(dial: RuntimeDialValues): ClockRuntimeParams {
  const mode = dial.Time.mode === 'scrub' ? 'scrub' : 'live';
  const motionMode: MotionMode = dial.Motion.mode === 'tick-settle' ? 'tick-settle' : 'continuous';

  return {
    mode,
    motionMode,
    scrubTime: {
      hour: dial.Time.hour,
      minute: dial.Time.minute,
      second: dial.Time.second,
    },
    visuals: {
      wordColor: dial.Visuals.wordColor,
      secondHandColor: dial.Visuals.secondHandColor,
      hourHandWidth: dial.Visuals.hourHandWidth,
      minuteHandWidth: dial.Visuals.minuteHandWidth,
      minuteHandBlur: dial.Visuals.minuteHandBlur,
      secondHandWidth: dial.Visuals.secondHandWidth,
      centerPinRadius: dial.Visuals.centerPinRadius,
      artboardScale: dial.Visuals.artboardScale,
    },
    motion: {
      settleAmount: dial.Motion.settleAmount,
      settleDurationMs: dial.Motion.settleDurationMs,
    },
    wordMagnet: {
      maxPull: dial.WordMagnet.maxPull,
      basePull: dial.WordMagnet.basePull,
      falloffDistance: dial.WordMagnet.falloffDistance,
      maxScaleLift: dial.WordMagnet.maxScaleLift,
      followSmoothing: dial.WordMagnet.followSmoothing,
      returnSmoothing: dial.WordMagnet.returnSmoothing,
    },
  };
}

export default function App() {
  const availableClockIds = useMemo(() => clockRegistry.map((clock) => clock.id), []);
  const [activeClockId, setActiveClockId] = useState(() => getInitialClockId(availableClockIds));
  const [reducedMotion, setReducedMotion] = useState(() => shouldReduceMotion());
  const runtimeParamsRef = useRef<ClockRuntimeParams>(DEFAULT_RUNTIME_PARAMS);
  const dial = useDialKit('Clock runtime', runtimeDialConfig, {
    shortcuts: {
      'Time.hour': {key: 'h', interaction: 'drag', mode: 'coarse'},
      'Time.minute': {key: 'm', interaction: 'drag', mode: 'coarse'},
      'Time.second': {key: 's', interaction: 'drag', mode: 'coarse'},
      'Visuals.artboardScale': {key: 'z', interaction: 'move', mode: 'fine'},
    },
  }) as RuntimeDialValues;

  runtimeParamsRef.current = toRuntimeParams(dial);

  useEffect(() => {
    const onHashChange = () => setActiveClockId(getInitialClockId(availableClockIds));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [availableClockIds]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;

    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const activeClock = getClockById(activeClockId);
  const ActiveClock = activeClock.Component;

  return (
    <main className="clock-app">
      <div className="clock-app__stage">
        <ActiveClock clockId={activeClock.id} runtimeParamsRef={runtimeParamsRef} reducedMotion={reducedMotion} />
      </div>
      <p className="clock-app__caption">
        {activeClock.name} · {runtimeParamsRef.current.mode === 'live' ? 'live time' : 'scrubbed time'} · {runtimeParamsRef.current.motionMode}
      </p>
      <DialRoot position="bottom-right" defaultOpen={false} theme="light" productionEnabled />
    </main>
  );
}
