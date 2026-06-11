import {useRef, type CSSProperties} from 'react';

import type {ClockProps} from '../../app/clockTypes';
import {useClockRuntime} from '../../engine/useClockRuntime';
import {VIEWBOX, WORD_LAYOUT} from './layout';
import './styles.css';

type ClockCssVars = CSSProperties & Record<'--word-color' | '--second-hand-color' | '--hour-hand-width' | '--minute-hand-width' | '--second-hand-width' | '--center-pin-radius' | '--artboard-scale', string>;

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
          <filter id="center-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.85  0 1 0 0 0.06  0 0 1 0 0.5  0 0 0 0.45 0" />
            <feBlend in="SourceGraphic" />
          </filter>
        </defs>

        <rect className="reference-clock__paper" x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} />

        <g className="reference-clock__words" aria-hidden="true">
          {WORD_LAYOUT.map((word) => (
            <text
              key={word.label}
              className="reference-clock__word"
              x={word.x}
              y={word.y}
              fontSize={word.fontSize}
              textAnchor={word.anchor ?? 'middle'}
              transform={`rotate(${word.rotation} ${word.x} ${word.y})`}
            >
              {word.label}
            </text>
          ))}
        </g>

        <g className="reference-clock__hands" aria-hidden="true">
          <g ref={minuteHandRef} className="reference-clock__hand reference-clock__hand--minute" transform={`rotate(0 ${VIEWBOX.centerX} ${VIEWBOX.centerY})`}>
            <line x1={VIEWBOX.centerX} y1={VIEWBOX.centerY + 18} x2={VIEWBOX.centerX} y2="112" />
          </g>
          <g ref={hourHandRef} className="reference-clock__hand reference-clock__hand--hour" transform={`rotate(0 ${VIEWBOX.centerX} ${VIEWBOX.centerY})`}>
            <line x1={VIEWBOX.centerX} y1={VIEWBOX.centerY + 12} x2={VIEWBOX.centerX} y2="158" />
          </g>
          <g ref={secondHandRef} className="reference-clock__hand reference-clock__hand--second" transform={`rotate(0 ${VIEWBOX.centerX} ${VIEWBOX.centerY})`}>
            <line x1={VIEWBOX.centerX} y1={VIEWBOX.centerY + 160} x2={VIEWBOX.centerX} y2="151" />
          </g>
        </g>

        <g className="reference-clock__center" aria-hidden="true" filter="url(#center-glow)">
          <rect x={VIEWBOX.centerX - 10} y={VIEWBOX.centerY - 10} width="20" height="20" rx="1.5" />
          <circle cx={VIEWBOX.centerX} cy={VIEWBOX.centerY} r="var(--center-pin-radius)" />
        </g>
      </svg>
    </section>
  );
}
