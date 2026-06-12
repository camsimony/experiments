import {useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent} from 'react';
import {DialRoot, DialStore, useDialKit} from 'dialkit';
import {useWebHaptics} from 'web-haptics/react';

import {clockRegistry, getClockById} from './app/clockRegistry';
import {DEFAULT_RUNTIME_PARAMS, type ClockRuntimeParams, type MotionMode} from './app/clockTypes';
import {getInitialClockId} from './app/galleryState';
import {preloadThemeSwitchSound, playThemeSwitchSound} from './engine/themeSwitchSound';
import {shouldReduceMotion} from './engine/time';
import {runtimeDialConfig, soundDialConfig, themeDialConfig, type RuntimeDialValues, type SoundDialValues, type ThemeDialValues} from './clocks/reference-word-clock/dialConfig';
import {buildClockThemeRuntime, REFERENCE_CLOCK_THEME_PRESETS, toHexColorInput, type ReferenceClockThemePreset} from './clocks/reference-word-clock/themes';
import './styles/global.css';

type ClockAppCssVars = CSSProperties & Record<'--clock-app-bg' | '--theme-transition-duration' | '--theme-transition-ease', string>;

const showDialKitControls = import.meta.env.DEV || import.meta.env.VITE_SHOW_DIALKIT === 'true';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildThemeTransitionEase(easeIn: number) {
  return `cubic-bezier(${clamp(easeIn, 0, 0.9).toFixed(2)}, 0, 0.2, 1)`;
}

function clampThemeIndex(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(REFERENCE_CLOCK_THEME_PRESETS.length - 1, parsed));
}

function getThemePresetsFromDial(dial: ThemeDialValues): ReferenceClockThemePreset[] {
  return [
    {name: 'Reference', ...dial.Reference},
    {name: 'Blueprint', ...dial.Blueprint},
    {name: 'Licorice', ...dial.Licorice},
    {name: 'Sorbet', ...dial.Sorbet},
    {name: 'Moss', ...dial.Moss},
    {name: 'Umber', ...dial.Umber},
    {name: 'Indigo', ...dial.Indigo},
    {name: 'Mulberry', ...dial.Mulberry},
    {name: 'Juniper', ...dial.Juniper},
    {name: 'Bone', ...dial.Bone},
    {name: 'Slate', ...dial.Slate},
    {name: 'Kelp', ...dial.Kelp},
    {name: 'Cinder', ...dial.Cinder},
    {name: 'Orchid', ...dial.Orchid},
    {name: 'Tobacco', ...dial.Tobacco},
  ];
}

type ThemeOrderState = {
  length: number;
  queue: number[];
};

function shuffleThemeIndices(length: number) {
  const order = Array.from({length}, (_, index) => index);

  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }

  return order;
}

function createThemeOrder(length: number, currentIndex: number): ThemeOrderState {
  return {
    length,
    queue: shuffleThemeIndices(length).filter((index) => index !== currentIndex),
  };
}

function getNextRandomThemeIndex(currentIndex: number, themeCount: number, state: ThemeOrderState | null) {
  if (themeCount <= 1) return currentIndex;

  const nextState = state?.length === themeCount && state.queue.length > 0
    ? state
    : createThemeOrder(themeCount, currentIndex);
  const [index = currentIndex, ...queue] = nextState.queue;

  return {
    index,
    state: {
      length: themeCount,
      queue,
    },
  };
}

function setThemeDialIndex(index: number) {
  const panel = DialStore.getPanels().find((candidate) => candidate.name === 'Clock themes');
  if (!panel) return;
  DialStore.updateValue(panel.id, 'Active.theme', String(index));
}

function isDialKitEventTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('.dialkit-root'));
}

function emitClockPointerEvent(event: PointerEvent<HTMLElement>, active: boolean) {
  window.dispatchEvent(new CustomEvent('reference-clock:pointer', {
    detail: {
      active,
      clientX: event.clientX,
      clientY: event.clientY,
    },
  }));
}

function getOrCreateThemeColorMeta() {
  const existing = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (existing) return existing;

  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  document.head.append(meta);
  return meta;
}

function getSafariChromeColor(background: string) {
  const fallbackDarkChrome = '#351a17';
  const hex = toHexColorInput(background);
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const perceivedLightness = (r * 299 + g * 587 + b * 114) / 1000;

  return perceivedLightness > 150 ? fallbackDarkChrome : hex;
}

function toRuntimeParams(
  dial: RuntimeDialValues,
  theme: ReferenceClockThemePreset,
  themePress: {isPressing: boolean; releaseToken: number},
  switchMotion: ThemeDialValues['SwitchMotion'],
): ClockRuntimeParams {
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
    theme: buildClockThemeRuntime(theme),
    visuals: {
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
    themeSwitch: {
      isPressing: themePress.isPressing,
      releaseToken: themePress.releaseToken,
      inwardPull: switchMotion.inwardPull,
      scaleDip: switchMotion.scaleDip,
      maxRotation: switchMotion.maxRotation,
      pressSmoothing: switchMotion.pressSmoothing,
      releaseSmoothing: switchMotion.releaseSmoothing,
      releaseIgnoreMs: switchMotion.releaseIgnoreMs,
      transitionDurationMs: switchMotion.transitionDurationMs,
      transitionEaseIn: switchMotion.transitionEaseIn,
    },
    wordMagnet: {
      previewMagnet: dial.WordMagnet.previewMagnet,
      previewX: dial.WordMagnet.previewX,
      previewY: dial.WordMagnet.previewY,
      maxPull: dial.WordMagnet.maxPull,
      basePull: dial.WordMagnet.basePull,
      falloffDistance: dial.WordMagnet.falloffDistance,
      maxScaleLift: dial.WordMagnet.maxScaleLift,
      cursorCapture: dial.WordMagnet.cursorCapture,
      activationFeather: dial.WordMagnet.activationFeather,
      followSmoothing: dial.WordMagnet.followSmoothing,
      returnSmoothing: dial.WordMagnet.returnSmoothing,
    },
  };
}

export default function App() {
  const availableClockIds = useMemo(() => clockRegistry.map((clock) => clock.id), []);
  const [activeClockId, setActiveClockId] = useState(() => getInitialClockId(availableClockIds));
  const [reducedMotion, setReducedMotion] = useState(() => shouldReduceMotion());
  const [themePress, setThemePress] = useState({isPressing: false, releaseToken: 0});
  const themePressingRef = useRef(false);
  const themeOrderRef = useRef<ThemeOrderState | null>(null);
  const runtimeParamsRef = useRef<ClockRuntimeParams>(DEFAULT_RUNTIME_PARAMS);
  const previousRandomCollectionRef = useRef<SoundDialValues['RandomCollection'] | null>(null);
  const {trigger: triggerHaptic} = useWebHaptics();
  const dial = useDialKit('Clock runtime', runtimeDialConfig, {
    shortcuts: {
      'Time.hour': {key: 'h', interaction: 'drag', mode: 'coarse'},
      'Time.minute': {key: 'm', interaction: 'drag', mode: 'coarse'},
      'Time.second': {key: 's', interaction: 'drag', mode: 'coarse'},
      'Visuals.artboardScale': {key: 'z', interaction: 'move', mode: 'fine'},
    },
  }) as RuntimeDialValues;
  const themeDial = useDialKit('Clock themes', themeDialConfig) as ThemeDialValues;
  const soundDial = useDialKit('Clock sound', soundDialConfig) as SoundDialValues;
  const themePresets = getThemePresetsFromDial(themeDial);
  const activeThemeIndex = clampThemeIndex(themeDial.Active.theme);
  const activeTheme = themePresets[activeThemeIndex];

  runtimeParamsRef.current = toRuntimeParams(dial, activeTheme, themePress, themeDial.SwitchMotion);
  const appBackground = runtimeParamsRef.current.theme.pageBg;

  useEffect(() => {
    const browserChromeColor = getSafariChromeColor(appBackground);
    document.documentElement.style.setProperty('--clock-document-bg', appBackground);
    document.documentElement.style.backgroundColor = appBackground;
    document.body.style.backgroundColor = appBackground;
    getOrCreateThemeColorMeta().content = browserChromeColor;
  }, [appBackground]);

  useEffect(() => {
    preloadThemeSwitchSound(soundDial.kit);
  }, [soundDial.kit]);

  useEffect(() => {
    const previousCollection = previousRandomCollectionRef.current;
    previousRandomCollectionRef.current = soundDial.RandomCollection;
    if (!previousCollection) return;

    const changedSound = Object.keys(soundDial.RandomCollection).find(
      (soundKey) => previousCollection[soundKey] !== soundDial.RandomCollection[soundKey],
    );
    if (!changedSound) return;

    playThemeSwitchSound({
      ...soundDial,
      enabled: true,
      randomize: false,
      sound: changedSound,
    });
  }, [soundDial]);

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
  const style: ClockAppCssVars = {
    '--clock-app-bg': appBackground,
    '--theme-transition-duration': reducedMotion ? '0ms' : `${runtimeParamsRef.current.themeSwitch.transitionDurationMs}ms`,
    '--theme-transition-ease': buildThemeTransitionEase(runtimeParamsRef.current.themeSwitch.transitionEaseIn),
  };

  const beginThemePress = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || isDialKitEventTarget(event.target)) return;
    themePressingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail for synthetic events; the interaction still works without it.
    }
    emitClockPointerEvent(event, true);
    setThemePress((current) => ({...current, isPressing: true}));
  };

  const updateThemePressPointer = (event: PointerEvent<HTMLElement>) => {
    if (!themePressingRef.current) return;
    emitClockPointerEvent(event, true);
  };

  const releaseThemePress = (event: PointerEvent<HTMLElement>) => {
    if (!themePressingRef.current) return;
    themePressingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Matching the capture guard above.
    }
    emitClockPointerEvent(event, false);
    setThemePress((current) => ({isPressing: false, releaseToken: current.releaseToken + 1}));
    void triggerHaptic('selection');
    playThemeSwitchSound(soundDial);
    const nextTheme = getNextRandomThemeIndex(activeThemeIndex, themePresets.length, themeOrderRef.current);
    if (typeof nextTheme === 'number') {
      setThemeDialIndex(nextTheme);
    } else {
      themeOrderRef.current = nextTheme.state;
      setThemeDialIndex(nextTheme.index);
    }
  };

  const cancelThemePress = (event: PointerEvent<HTMLElement>) => {
    if (!themePressingRef.current) return;
    themePressingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Matching the capture guard above.
    }
    emitClockPointerEvent(event, false);
    setThemePress((current) => ({...current, isPressing: false}));
  };

  return (
    <main
      className="clock-app"
      style={style}
      onPointerDown={beginThemePress}
      onPointerMove={updateThemePressPointer}
      onPointerUp={releaseThemePress}
      onPointerCancel={cancelThemePress}
    >
      <div className="clock-app__stage">
        <ActiveClock clockId={activeClock.id} runtimeParamsRef={runtimeParamsRef} reducedMotion={reducedMotion} />
      </div>
      {showDialKitControls ? <DialRoot position="top-right" defaultOpen={false} theme="light" productionEnabled /> : null}
    </main>
  );
}
