import {useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent} from 'react';
import {DialRoot, DialStore, useDialKit} from 'dialkit';
import {useWebHaptics} from 'web-haptics/react';

import {clockRegistry, getClockById} from './app/clockRegistry';
import {DEFAULT_RUNTIME_PARAMS, type ClockRuntimeParams, type MotionMode} from './app/clockTypes';
import {getInitialClockId} from './app/galleryState';
import {preloadThemeSwitchSound, playThemeSwitchSound} from './engine/themeSwitchSound';
import {shouldReduceMotion} from './engine/time';
import {runtimeDialConfig, soundDialConfig, themeDialConfig, type RuntimeDialValues, type SoundDialValues, type ThemeDialValues} from './clocks/reference-word-clock/dialConfig';
import {buildClockThemeRuntime, KNICKS_CLOCK_THEME_PRESET, REFERENCE_CLOCK_THEME_PRESETS, toHexColorInput, type ReferenceClockThemePreset} from './clocks/reference-word-clock/themes';
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

const KNICKS_TRIGGER_CLICK_COUNT = 5;
const KNICKS_TRIGGER_WINDOW_MS = 1800;
const KNICKS_MODE_DURATION_MS = 30_000;
const KNICKS_INITIAL_BASKETBALL_COUNT = 34;
const KNICKS_BASKETBALLS_PER_EXTRA_BURST = 18;
const KNICKS_MAX_BASKETBALLS = 178;

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

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function getClockViewportCenter() {
  const svg = document.querySelector<SVGSVGElement>('.reference-clock__svg');
  const rect = svg?.getBoundingClientRect();

  if (!rect || rect.width === 0 || rect.height === 0) {
    return {x: window.innerWidth / 2, y: window.innerHeight / 2};
  }

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

type BasketballParticle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
};

function createBasketballPhysicsParticles(triggerToken: number, count: number) {
  const random = seededRandom(triggerToken * 1459 + 23);
  const center = getClockViewportCenter();

  return Array.from({length: count}, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (random() - 0.5) * 0.72;
    const speed = 5.8 + random() * 5.4;
    const size = 22 + random() * 16;

    return {
      id: `${triggerToken}-${index}`,
      x: center.x + Math.cos(angle) * 4,
      y: center.y + Math.sin(angle) * 4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      rotation: random() * 360,
      spin: (random() > 0.5 ? 1 : -1) * (3.2 + random() * 5.8),
    } satisfies BasketballParticle;
  });
}

function KnicksBasketballField({active, triggerToken, reducedMotion}: {active: boolean; triggerToken: number; reducedMotion: boolean}) {
  const nodesRef = useRef<Record<string, HTMLSpanElement | null>>({});
  const particlesRef = useRef<BasketballParticle[]>([]);
  const [particleIds, setParticleIds] = useState<string[]>([]);

  useEffect(() => {
    if (!active || reducedMotion) {
      particlesRef.current = [];
      nodesRef.current = {};
      setParticleIds([]);
      return;
    }

    const burstCount = particlesRef.current.length === 0 ? KNICKS_INITIAL_BASKETBALL_COUNT : KNICKS_BASKETBALLS_PER_EXTRA_BURST;
    particlesRef.current = [...particlesRef.current, ...createBasketballPhysicsParticles(triggerToken, burstCount)].slice(-KNICKS_MAX_BASKETBALLS);
    setParticleIds(particlesRef.current.map((particle) => particle.id));
  }, [active, reducedMotion, triggerToken]);

  useEffect(() => {
    if (!active || reducedMotion || particleIds.length === 0) return;

    let frame = 0;
    let previousTime = performance.now();

    const animate = (time: number) => {
      const delta = Math.min(2.4, Math.max(0.35, (time - previousTime) / 16.67));
      previousTime = time;
      const width = window.innerWidth;
      const height = window.innerHeight;

      particlesRef.current.forEach((particle) => {
        const node = nodesRef.current[particle.id];
        if (!node) return;

        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.rotation += particle.spin * delta;

        const radius = particle.size * 0.48;
        if (particle.x <= radius) {
          particle.x = radius;
          particle.vx = Math.abs(particle.vx) * 0.995;
          particle.spin *= -0.98;
        } else if (particle.x >= width - radius) {
          particle.x = width - radius;
          particle.vx = -Math.abs(particle.vx) * 0.995;
          particle.spin *= -0.98;
        }

        if (particle.y <= radius) {
          particle.y = radius;
          particle.vy = Math.abs(particle.vy) * 0.995;
          particle.spin *= -0.98;
        } else if (particle.y >= height - radius) {
          particle.y = height - radius;
          particle.vy = -Math.abs(particle.vy) * 0.995;
          particle.spin *= -0.98;
        }

        particle.vx *= 0.9995;
        particle.vy *= 0.9995;
        node.style.fontSize = `${particle.size.toFixed(1)}px`;
        node.style.transform = `translate3d(${particle.x.toFixed(2)}px, ${particle.y.toFixed(2)}px, 0) translate(-50%, -50%) rotate(${particle.rotation.toFixed(2)}deg)`;
      });

      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [active, reducedMotion, particleIds.length]);

  if (!active || reducedMotion) return null;

  return (
    <div className="clock-app__basketball-field" aria-hidden="true">
      {particleIds.map((particleId) => (
        <span
          key={particleId}
          ref={(node) => {
            nodesRef.current[particleId] = node;
          }}
          className="clock-app__basketball"
        >
          🏀
        </span>
      ))}
    </div>
  );
}

function toRuntimeParams(
  dial: RuntimeDialValues,
  theme: ReferenceClockThemePreset,
  themePress: {isPressing: boolean; releaseToken: number},
  switchMotion: ThemeDialValues['SwitchMotion'],
  easterEgg: {knicksMode: boolean; triggerToken: number},
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
    easterEgg,
  };
}

export default function App() {
  const availableClockIds = useMemo(() => clockRegistry.map((clock) => clock.id), []);
  const [activeClockId, setActiveClockId] = useState(() => getInitialClockId(availableClockIds));
  const [reducedMotion, setReducedMotion] = useState(() => shouldReduceMotion());
  const [themePress, setThemePress] = useState({isPressing: false, releaseToken: 0});
  const [easterEgg, setEasterEgg] = useState({knicksMode: false, triggerToken: 0});
  const themePressingRef = useRef(false);
  const themeOrderRef = useRef<ThemeOrderState | null>(null);
  const rapidThemeClicksRef = useRef<number[]>([]);
  const knicksModeTimeoutRef = useRef<number | null>(null);
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
  const renderedTheme = easterEgg.knicksMode ? KNICKS_CLOCK_THEME_PRESET : activeTheme;

  runtimeParamsRef.current = toRuntimeParams(dial, renderedTheme, themePress, themeDial.SwitchMotion, easterEgg);
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

  useEffect(() => () => {
    if (knicksModeTimeoutRef.current !== null) {
      window.clearTimeout(knicksModeTimeoutRef.current);
    }
  }, []);

  const addKnicksBasketballBurst = () => {
    setEasterEgg((current) => ({...current, triggerToken: current.triggerToken + 1}));
  };

  const triggerKnicksMode = () => {
    rapidThemeClicksRef.current = [];

    if (knicksModeTimeoutRef.current !== null) {
      window.clearTimeout(knicksModeTimeoutRef.current);
    }

    setEasterEgg((current) => ({knicksMode: true, triggerToken: current.triggerToken + 1}));
    knicksModeTimeoutRef.current = window.setTimeout(() => {
      setEasterEgg((current) => ({...current, knicksMode: false}));
      knicksModeTimeoutRef.current = null;
    }, KNICKS_MODE_DURATION_MS);
  };

  const registerThemeReleaseForEasterEgg = () => {
    const now = performance.now();
    rapidThemeClicksRef.current = [...rapidThemeClicksRef.current, now].filter((time) => now - time <= KNICKS_TRIGGER_WINDOW_MS);

    if (rapidThemeClicksRef.current.length >= KNICKS_TRIGGER_CLICK_COUNT) {
      triggerKnicksMode();
      return true;
    }

    return false;
  };

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

    if (easterEgg.knicksMode) {
      addKnicksBasketballBurst();
      return;
    }

    if (registerThemeReleaseForEasterEgg()) return;

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
      <KnicksBasketballField active={easterEgg.knicksMode} triggerToken={easterEgg.triggerToken} reducedMotion={reducedMotion} />
      {showDialKitControls ? <DialRoot position="top-right" defaultOpen={false} theme="light" productionEnabled /> : null}
    </main>
  );
}
