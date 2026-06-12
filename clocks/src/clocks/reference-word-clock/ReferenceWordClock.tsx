import {useEffect, useRef, type CSSProperties, type PointerEvent} from 'react';

import type {ClockProps} from '../../app/clockTypes';
import {useClockRuntime} from '../../engine/useClockRuntime';
import {VIEWBOX, WORD_LAYOUT} from './layout';
import './styles.css';

type ClockCssVars = CSSProperties & Record<
  | '--paper-color'
  | '--word-color'
  | '--word-gradient-start'
  | '--word-gradient-end'
  | '--hour-hand-color'
  | '--hour-hand-end-color'
  | '--hour-hand-border-color'
  | '--minute-hand-color'
  | '--minute-hand-end-color'
  | '--minute-hand-soft-color'
  | '--minute-hand-border-color'
  | '--second-hand-color'
  | '--second-hand-end-color'
  | '--second-hand-border-color'
  | '--center-pin-color'
  | '--center-pin-end-color'
  | '--center-pin-stroke-color'
  | '--hour-hand-width'
  | '--minute-hand-width'
  | '--second-hand-width'
  | '--center-pin-radius'
  | '--artboard-scale',
  string
>;

type WordMagnetState = {
  x: number;
  y: number;
  scale: number;
};

type WordMagnetTarget = WordMagnetState;

type WordMagnetSettings = {
  previewMagnet: boolean;
  previewX: number;
  previewY: number;
  maxPull: number;
  basePull: number;
  falloffDistance: number;
  maxScaleLift: number;
  cursorCapture: number;
  activationFeather: number;
  followSmoothing: number;
  returnSmoothing: number;
};

const WORD_RING = {
  outerRx: 258,
  outerRy: 204,
  innerRx: 94,
  innerRy: 82,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value: number) {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function getSvgPoint(svg: SVGSVGElement | null, clientX: number, clientY: number) {
  const matrix = svg?.getScreenCTM()?.inverse();
  if (!svg || !matrix) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(matrix);
}

function ellipseDistanceFromBoundary(point: {x: number; y: number}, rx: number, ry: number) {
  const normalizedRadius = Math.hypot((point.x - VIEWBOX.centerX) / rx, (point.y - VIEWBOX.centerY) / ry);
  return (normalizedRadius - 1) * Math.sqrt(rx * ry);
}

function calculateRingActivation(point: {x: number; y: number}, settings: WordMagnetSettings) {
  const feather = Math.max(settings.activationFeather, 1);
  const outsideOuter = Math.max(0, ellipseDistanceFromBoundary(point, WORD_RING.outerRx, WORD_RING.outerRy));
  const insideInner = Math.max(0, -ellipseDistanceFromBoundary(point, WORD_RING.innerRx, WORD_RING.innerRy));
  const outerStrength = smoothstep(1 - outsideOuter / feather);
  const innerStrength = smoothstep(1 - insideInner / feather);

  return outerStrength * innerStrength;
}

function calculateWordMagnetTarget(point: {x: number; y: number} | null, word: {x: number; y: number}, settings: WordMagnetSettings, fieldStrength: number): WordMagnetTarget {
  if (!point || fieldStrength <= 0) return {x: 0, y: 0, scale: 1};

  const dx = point.x - word.x;
  const dy = point.y - word.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const proximity = 1 - clamp(distance / settings.falloffDistance, 0, 1);
  const intensity = proximity * proximity;
  const rawPull = settings.basePull + settings.maxPull * intensity;
  const pull = Math.min(rawPull, distance * settings.cursorCapture) * fieldStrength;

  return {
    x: (dx / distance) * pull,
    y: (dy / distance) * pull,
    scale: 1 + settings.maxScaleLift * intensity * fieldStrength,
  };
}

function isNearlyResting(state: WordMagnetState) {
  return Math.abs(state.x) < 0.01 && Math.abs(state.y) < 0.01 && Math.abs(state.scale - 1) < 0.0005;
}

export function ReferenceWordClock({runtimeParamsRef, reducedMotion}: ClockProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hourHandRef = useRef<SVGGElement>(null);
  const minuteHandRef = useRef<SVGGElement>(null);
  const secondHandRef = useRef<SVGGElement>(null);
  const wordRefs = useRef<Array<SVGGElement | null>>([]);
  const wordStatesRef = useRef<WordMagnetState[]>(WORD_LAYOUT.map(() => ({x: 0, y: 0, scale: 1})));
  const wordPointerRef = useRef<{active: boolean; point: {x: number; y: number} | null; strength: number}>({active: false, point: null, strength: 0});
  const visuals = runtimeParamsRef.current.visuals;
  const theme = runtimeParamsRef.current.theme;

  useClockRuntime({
    hands: {
      hour: hourHandRef,
      minute: minuteHandRef,
      second: secondHandRef,
    },
    runtimeParamsRef,
    reducedMotion,
    centerX: VIEWBOX.centerX,
    centerY: VIEWBOX.centerY,
  });

  useEffect(() => {
    let frame = 0;
    let previousTime = performance.now();

    const animateWords = (time: number) => {
      const delta = Math.min(40, time - previousTime);
      previousTime = time;
      const pointer = wordPointerRef.current;
      const magnet = runtimeParamsRef.current.wordMagnet;
      const previewPoint = magnet.previewMagnet ? {x: magnet.previewX, y: magnet.previewY} : null;
      const activePoint = !reducedMotion ? (pointer.active ? pointer.point : previewPoint) : null;
      const fieldStrength = activePoint ? (pointer.active ? pointer.strength : 1) : 0;
      const smoothingBase = fieldStrength > 0 ? magnet.followSmoothing : magnet.returnSmoothing;
      const smoothing = 1 - Math.pow(1 - smoothingBase, delta / 16.67);
      let allResting = fieldStrength <= 0;

      WORD_LAYOUT.forEach((word, index) => {
        const node = wordRefs.current[index];
        const state = wordStatesRef.current[index];
        if (!node || !state) return;

        const target = calculateWordMagnetTarget(activePoint, word, magnet, fieldStrength);
        state.x += (target.x - state.x) * smoothing;
        state.y += (target.y - state.y) * smoothing;
        state.scale += (target.scale - state.scale) * smoothing;

        if (fieldStrength > 0 || !isNearlyResting(state)) {
          allResting = false;
        }

        if (!activePoint && isNearlyResting(state)) {
          state.x = 0;
          state.y = 0;
          state.scale = 1;
        }

        node.classList.toggle('is-interacting', fieldStrength > 0);
        node.setAttribute(
          'transform',
          `translate(${state.x.toFixed(3)} ${state.y.toFixed(3)}) translate(${word.x} ${word.y}) scale(${state.scale.toFixed(4)}) translate(${-word.x} ${-word.y})`,
        );
      });

      if (allResting) {
        WORD_LAYOUT.forEach((_, index) => {
          const node = wordRefs.current[index];
          if (!node) return;
          node.classList.remove('is-interacting');
          node.removeAttribute('transform');
        });
      }

      frame = window.requestAnimationFrame(animateWords);
    };

    frame = window.requestAnimationFrame(animateWords);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const updateWordRingMagnetism = (event: PointerEvent<HTMLDivElement>) => {
    const point = getSvgPoint(svgRef.current, event.clientX, event.clientY);
    if (!point) return;
    const magnet = runtimeParamsRef.current.wordMagnet;
    wordPointerRef.current = {active: true, point: {x: point.x, y: point.y}, strength: calculateRingActivation(point, magnet)};
  };

  const resetWordRingMagnetism = () => {
    wordPointerRef.current = {active: false, point: null, strength: 0};
  };

  const style: ClockCssVars = {
    '--paper-color': theme.paperColor,
    '--word-color': theme.wordColor,
    '--word-gradient-start': theme.wordGradientStart,
    '--word-gradient-end': theme.wordGradientEnd,
    '--hour-hand-color': theme.hourHandColor,
    '--hour-hand-end-color': theme.hourHandEndColor,
    '--hour-hand-border-color': theme.hourHandBorderColor,
    '--minute-hand-color': theme.minuteHandColor,
    '--minute-hand-end-color': theme.minuteHandEndColor,
    '--minute-hand-soft-color': theme.minuteHandSoftColor,
    '--minute-hand-border-color': theme.minuteHandBorderColor,
    '--second-hand-color': theme.secondHandColor,
    '--second-hand-end-color': theme.secondHandEndColor,
    '--second-hand-border-color': theme.secondHandBorderColor,
    '--center-pin-color': theme.centerPinColor,
    '--center-pin-end-color': theme.centerPinEndColor,
    '--center-pin-stroke-color': theme.centerPinStrokeColor,
    '--hour-hand-width': `${visuals.hourHandWidth}`,
    '--minute-hand-width': `${visuals.minuteHandWidth}`,
    '--second-hand-width': `${visuals.secondHandWidth}`,
    '--center-pin-radius': `${visuals.centerPinRadius}`,
    '--artboard-scale': `${visuals.artboardScale}`,
  };

  return (
    <section className="reference-clock" aria-label="Reference word clock" style={style}>
      <div
        className="reference-clock__magnet-field"
        aria-hidden="true"
        onPointerEnter={updateWordRingMagnetism}
        onPointerMove={updateWordRingMagnetism}
        onPointerLeave={resetWordRingMagnetism}
      />
      <svg
        ref={svgRef}
        className="reference-clock__svg"
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        role="img"
        aria-label="Working clock with number words arranged around the hands"
      >
        <defs>
          <linearGradient id="word-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--word-gradient-start)" />
            <stop offset="100%" stopColor="var(--word-gradient-end)" />
          </linearGradient>
          <linearGradient id="minute-hand-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VIEWBOX.width} y2="0">
            <stop offset="0%" stopColor="var(--minute-hand-color)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--minute-hand-end-color)" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="hour-hand-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VIEWBOX.width} y2="0">
            <stop offset="0%" stopColor="var(--hour-hand-color)" stopOpacity="0.72" />
            <stop offset="100%" stopColor="var(--hour-hand-end-color)" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="second-hand-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VIEWBOX.width} y2="0">
            <stop offset="0%" stopColor="var(--second-hand-color)" />
            <stop offset="100%" stopColor="var(--second-hand-end-color)" />
          </linearGradient>
          <radialGradient id="center-pin-gradient" cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor="var(--center-pin-color)" />
            <stop offset="100%" stopColor="var(--center-pin-end-color)" />
          </radialGradient>
          <filter id="minute-hand-soft-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={visuals.minuteHandBlur} />
          </filter>
        </defs>

        <rect className="reference-clock__paper" x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} />

        <g className="reference-clock__words" aria-hidden="true">
          {WORD_LAYOUT.map((word, index) => (
            <g key={word.label} transform={`rotate(${word.rotation} ${word.x} ${word.y})`}>
              <g
                ref={(node) => {
                  wordRefs.current[index] = node;
                }}
                className="reference-clock__word-hover-target"
              >
                <text
                  className="reference-clock__word"
                  x={word.x}
                  y={word.y}
                  fontSize={word.fontSize}
                  textAnchor={word.anchor ?? 'middle'}
                >
                  {word.label}
                </text>
              </g>
            </g>
          ))}
        </g>

        <g className="reference-clock__hands" aria-hidden="true">
          <g ref={minuteHandRef} className="reference-clock__hand reference-clock__hand--minute" transform={`rotate(0 ${VIEWBOX.centerX} ${VIEWBOX.centerY})`}>
            <line className="reference-clock__hand-soft" x1={VIEWBOX.centerX} y1={VIEWBOX.centerY + 16} x2={VIEWBOX.centerX} y2="60" />
            <line className="reference-clock__hand-border" x1={VIEWBOX.centerX} y1={VIEWBOX.centerY + 16} x2={VIEWBOX.centerX} y2="60" />
            <line className="reference-clock__hand-core" x1={VIEWBOX.centerX} y1={VIEWBOX.centerY + 16} x2={VIEWBOX.centerX} y2="60" />
          </g>
          <g ref={hourHandRef} className="reference-clock__hand reference-clock__hand--hour" transform={`rotate(0 ${VIEWBOX.centerX} ${VIEWBOX.centerY})`}>
            <line className="reference-clock__hand-border" x1={VIEWBOX.centerX} y1={VIEWBOX.centerY + 12} x2={VIEWBOX.centerX} y2="106" />
            <line className="reference-clock__hand-core" x1={VIEWBOX.centerX} y1={VIEWBOX.centerY + 12} x2={VIEWBOX.centerX} y2="106" />
          </g>
          <g ref={secondHandRef} className="reference-clock__hand reference-clock__hand--second" transform={`rotate(0 ${VIEWBOX.centerX} ${VIEWBOX.centerY})`}>
            <line className="reference-clock__hand-border" x1={VIEWBOX.centerX} y1={VIEWBOX.centerY + 142} x2={VIEWBOX.centerX} y2="78" />
            <line className="reference-clock__hand-core" x1={VIEWBOX.centerX} y1={VIEWBOX.centerY + 142} x2={VIEWBOX.centerX} y2="78" />
          </g>
        </g>

        <g className="reference-clock__center" aria-hidden="true">
          <circle cx={VIEWBOX.centerX} cy={VIEWBOX.centerY} r="var(--center-pin-radius)" />
        </g>
      </svg>
    </section>
  );
}
