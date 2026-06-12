import {useEffect, useRef, type CSSProperties, type PointerEvent} from 'react';

import type {ClockProps} from '../../app/clockTypes';
import {useClockRuntime} from '../../engine/useClockRuntime';
import {VIEWBOX, WORD_LAYOUT} from './layout';
import './styles.css';

type ClockCssVars = CSSProperties & Record<'--word-color' | '--second-hand-color' | '--hour-hand-width' | '--minute-hand-width' | '--second-hand-width' | '--center-pin-radius' | '--artboard-scale', string>;

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
  followSmoothing: number;
  returnSmoothing: number;
};

const WORD_RING = {
  outerRx: 258,
  outerRy: 204,
  innerRx: 94,
  innerRy: 82,
};

const WORD_RING_PATH = [
  `M ${VIEWBOX.centerX - WORD_RING.outerRx} ${VIEWBOX.centerY}`,
  `a ${WORD_RING.outerRx} ${WORD_RING.outerRy} 0 1 0 ${WORD_RING.outerRx * 2} 0`,
  `a ${WORD_RING.outerRx} ${WORD_RING.outerRy} 0 1 0 ${-WORD_RING.outerRx * 2} 0`,
  `M ${VIEWBOX.centerX - WORD_RING.innerRx} ${VIEWBOX.centerY}`,
  `a ${WORD_RING.innerRx} ${WORD_RING.innerRy} 0 1 0 ${WORD_RING.innerRx * 2} 0`,
  `a ${WORD_RING.innerRx} ${WORD_RING.innerRy} 0 1 0 ${-WORD_RING.innerRx * 2} 0`,
].join(' ');

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getSvgPoint(event: PointerEvent<SVGPathElement>) {
  const svg = event.currentTarget.ownerSVGElement;
  const matrix = svg?.getScreenCTM()?.inverse();
  if (!svg || !matrix) return null;

  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(matrix);
}

function calculateWordMagnetTarget(point: {x: number; y: number} | null, word: {x: number; y: number}, settings: WordMagnetSettings): WordMagnetTarget {
  if (!point) return {x: 0, y: 0, scale: 1};

  const dx = point.x - word.x;
  const dy = point.y - word.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const proximity = 1 - clamp(distance / settings.falloffDistance, 0, 1);
  const intensity = proximity * proximity;
  const pull = settings.basePull + settings.maxPull * intensity;

  return {
    x: (dx / distance) * pull,
    y: (dy / distance) * pull,
    scale: 1 + settings.maxScaleLift * intensity,
  };
}

function isNearlyResting(state: WordMagnetState) {
  return Math.abs(state.x) < 0.01 && Math.abs(state.y) < 0.01 && Math.abs(state.scale - 1) < 0.0005;
}

export function ReferenceWordClock({runtimeParamsRef, reducedMotion}: ClockProps) {
  const hourHandRef = useRef<SVGGElement>(null);
  const minuteHandRef = useRef<SVGGElement>(null);
  const secondHandRef = useRef<SVGGElement>(null);
  const wordRefs = useRef<Array<SVGGElement | null>>([]);
  const wordStatesRef = useRef<WordMagnetState[]>(WORD_LAYOUT.map(() => ({x: 0, y: 0, scale: 1})));
  const wordPointerRef = useRef<{active: boolean; point: {x: number; y: number} | null}>({active: false, point: null});
  const visuals = runtimeParamsRef.current.visuals;

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
      const smoothingBase = activePoint ? magnet.followSmoothing : magnet.returnSmoothing;
      const smoothing = 1 - Math.pow(1 - smoothingBase, delta / 16.67);
      let allResting = !activePoint;

      WORD_LAYOUT.forEach((word, index) => {
        const node = wordRefs.current[index];
        const state = wordStatesRef.current[index];
        if (!node || !state) return;

        const target = calculateWordMagnetTarget(activePoint, word, magnet);
        state.x += (target.x - state.x) * smoothing;
        state.y += (target.y - state.y) * smoothing;
        state.scale += (target.scale - state.scale) * smoothing;

        if (activePoint || !isNearlyResting(state)) {
          allResting = false;
        }

        if (!activePoint && isNearlyResting(state)) {
          state.x = 0;
          state.y = 0;
          state.scale = 1;
        }

        node.classList.toggle('is-interacting', Boolean(activePoint));
        node.style.transform = `translate(${state.x.toFixed(3)}px, ${state.y.toFixed(3)}px) scale(${state.scale.toFixed(4)})`;
      });

      if (allResting) {
        WORD_LAYOUT.forEach((_, index) => {
          const node = wordRefs.current[index];
          if (!node) return;
          node.classList.remove('is-interacting');
          node.style.transform = '';
        });
      }

      frame = window.requestAnimationFrame(animateWords);
    };

    frame = window.requestAnimationFrame(animateWords);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const updateWordRingMagnetism = (event: PointerEvent<SVGPathElement>) => {
    const point = getSvgPoint(event);
    if (!point) return;
    wordPointerRef.current = {active: true, point: {x: point.x, y: point.y}};
  };

  const resetWordRingMagnetism = () => {
    wordPointerRef.current = {active: false, point: null};
  };

  const style: ClockCssVars = {
    '--word-color': visuals.wordColor,
    '--second-hand-color': visuals.secondHandColor,
    '--hour-hand-width': `${visuals.hourHandWidth}`,
    '--minute-hand-width': `${visuals.minuteHandWidth}`,
    '--second-hand-width': `${visuals.secondHandWidth}`,
    '--center-pin-radius': `${visuals.centerPinRadius}`,
    '--artboard-scale': `${visuals.artboardScale}`,
  };

  return (
    <section className="reference-clock" aria-label="Reference word clock" style={style}>
      <svg
        className="reference-clock__svg"
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        role="img"
        aria-label="Working clock with number words arranged around the hands"
      >
        <defs>
          <linearGradient id="word-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--word-color)" />
            <stop offset="100%" stopColor="#28863d" />
          </linearGradient>
          <linearGradient id="minute-hand-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VIEWBOX.width} y2="0">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.24" />
          </linearGradient>
          <linearGradient id="hour-hand-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VIEWBOX.width} y2="0">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.86" />
          </linearGradient>
          <linearGradient id="second-hand-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VIEWBOX.width} y2="0">
            <stop offset="0%" stopColor="var(--second-hand-color)" />
            <stop offset="100%" stopColor="#ab122b" />
          </linearGradient>
          <radialGradient id="center-pin-gradient" cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#bd1430" />
            <stop offset="100%" stopColor="#ab122b" />
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

        <path
          className="reference-clock__word-ring-hit-area"
          d={WORD_RING_PATH}
          fillRule="evenodd"
          aria-hidden="true"
          onPointerEnter={updateWordRingMagnetism}
          onPointerMove={updateWordRingMagnetism}
          onPointerLeave={resetWordRingMagnetism}
        />

        <g className="reference-clock__center" aria-hidden="true">
          <circle cx={VIEWBOX.centerX} cy={VIEWBOX.centerY} r="var(--center-pin-radius)" />
        </g>
      </svg>
    </section>
  );
}
