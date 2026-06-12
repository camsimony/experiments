import {useRef, type CSSProperties, type PointerEvent} from 'react';

import type {ClockProps} from '../../app/clockTypes';
import {useClockRuntime} from '../../engine/useClockRuntime';
import {VIEWBOX, WORD_LAYOUT} from './layout';
import './styles.css';

type ClockCssVars = CSSProperties & Record<'--word-color' | '--second-hand-color' | '--hour-hand-width' | '--minute-hand-width' | '--second-hand-width' | '--center-pin-radius' | '--artboard-scale', string>;

type WordHoverVars = CSSProperties & Record<'--word-hover-x' | '--word-hover-y' | '--word-hover-rotate', string>;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function updateWordMagnetism(event: PointerEvent<SVGGElement>) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const x = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
  const y = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);

  target.style.setProperty('--word-hover-x', `${(x * 5).toFixed(2)}px`);
  target.style.setProperty('--word-hover-y', `${(y * 3.5).toFixed(2)}px`);
  target.style.setProperty('--word-hover-rotate', `${(x * 2.6 + y * -0.6).toFixed(2)}deg`);
}

function enterWordMagnetism(event: PointerEvent<SVGGElement>) {
  event.currentTarget.classList.add('is-interacting');
  updateWordMagnetism(event);
}

function leaveWordMagnetism(event: PointerEvent<SVGGElement>) {
  const target = event.currentTarget;
  target.classList.remove('is-interacting');
  target.style.setProperty('--word-hover-x', '0px');
  target.style.setProperty('--word-hover-y', '0px');
  target.style.setProperty('--word-hover-rotate', '0deg');
}

export function ReferenceWordClock({runtimeParamsRef, reducedMotion}: ClockProps) {
  const hourHandRef = useRef<SVGGElement>(null);
  const minuteHandRef = useRef<SVGGElement>(null);
  const secondHandRef = useRef<SVGGElement>(null);
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
          {WORD_LAYOUT.map((word) => {
            const hoverStyle: WordHoverVars = {'--word-hover-x': '0px', '--word-hover-y': '0px', '--word-hover-rotate': '0deg'};

            return (
              <g key={word.label} transform={`rotate(${word.rotation} ${word.x} ${word.y})`}>
                <g
                  className="reference-clock__word-hover-target"
                  style={hoverStyle}
                  onPointerEnter={enterWordMagnetism}
                  onPointerMove={updateWordMagnetism}
                  onPointerLeave={leaveWordMagnetism}
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
            );
          })}
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
