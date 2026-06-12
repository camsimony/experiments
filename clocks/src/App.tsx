import {useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent} from 'react';
import {DialRoot, DialStore, useDialKit} from 'dialkit';
import {useWebHaptics} from 'web-haptics/react';

import {clockRegistry, getClockById} from './app/clockRegistry';
import {DEFAULT_RUNTIME_PARAMS, type ClockRuntimeParams, type MotionMode} from './app/clockTypes';
import {getInitialClockId} from './app/galleryState';
import {preloadThemeSwitchSound, playThemeSwitchSound} from './engine/themeSwitchSound';
import {shouldReduceMotion} from './engine/time';
import {runtimeDialConfig, themeDialConfig, type RuntimeDialValues, type ThemeDialValues} from './clocks/reference-word-clock/dialConfig';
import {buildClockThemeRuntime, REFERENCE_CLOCK_THEME_PRESETS, type ReferenceClockThemePreset} from './clocks/reference-word-clock/themes';
import './styles/global.css';

type ClockAppCssVars = CSSProperties & Record<'--clock-app-bg', string>;

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
  ];
}

function setThemeDialIndex(index: number) {
  const panel = DialStore.getPanels().find((candidate) => candidate.name === 'Clock themes');
  if (!panel) return;
  DialStore.updateValue(panel.id, 'Active.theme', String(index));
}

function isDialKitEventTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('.dialkit-root'));
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
  const runtimeParamsRef = useRef<ClockRuntimeParams>(DEFAULT_RUNTIME_PARAMS);
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
  const themePresets = getThemePresetsFromDial(themeDial);
  const activeThemeIndex = clampThemeIndex(themeDial.Active.theme);
  const activeTheme = themePresets[activeThemeIndex];

  runtimeParamsRef.current = toRuntimeParams(dial, activeTheme, themePress, themeDial.SwitchMotion);

  useEffect(() => {
    preloadThemeSwitchSound(themeDial.Sound.kit);
  }, [themeDial.Sound.kit]);

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
  const style: ClockAppCssVars = {'--clock-app-bg': runtimeParamsRef.current.theme.pageBg};

  const beginThemePress = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || isDialKitEventTarget(event.target)) return;
    themePressingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail for synthetic events; the interaction still works without it.
    }
    setThemePress((current) => ({...current, isPressing: true}));
  };

  const releaseThemePress = (event: PointerEvent<HTMLElement>) => {
    if (!themePressingRef.current) return;
    themePressingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Matching the capture guard above.
    }
    setThemePress((current) => ({isPressing: false, releaseToken: current.releaseToken + 1}));
    void triggerHaptic('selection');
    playThemeSwitchSound(themeDial.Sound);
    setThemeDialIndex((activeThemeIndex + 1) % themePresets.length);
  };

  const cancelThemePress = (event: PointerEvent<HTMLElement>) => {
    if (!themePressingRef.current) return;
    themePressingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Matching the capture guard above.
    }
    setThemePress((current) => ({...current, isPressing: false}));
  };

  return (
    <main
      className="clock-app"
      style={style}
      onPointerDown={beginThemePress}
      onPointerUp={releaseThemePress}
      onPointerCancel={cancelThemePress}
    >
      <div className="clock-app__stage">
        <ActiveClock clockId={activeClock.id} runtimeParamsRef={runtimeParamsRef} reducedMotion={reducedMotion} />
      </div>
      <DialRoot position="bottom-right" defaultOpen={false} theme="light" productionEnabled />
    </main>
  );
}
