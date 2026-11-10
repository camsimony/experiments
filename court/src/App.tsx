import { useState } from "react";
import CourtScene from "./court/CourtScene";
/* the lettering over the scene, as a drawing (so it takes the page's ink) */
import wordmark from "./assets/city-of-new-york.svg?raw";

/* the lettering, printed rather than drawn by a machine: its edges
   roughened a hair and softened, and the ink thinner in places, the way
   a screen print sits on cloth. (All in screen pixels: it's the same
   tooth whatever size the lettering is) */
function Ink() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id="ink" x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
        {/* the edge: nudged about by a fine noise, then a breath of blur */}
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="7" result="tooth" />
        <feDisplacementMap in="SourceGraphic" in2="tooth" scale="0.9" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feGaussianBlur in="rough" stdDeviation="0.32" result="soft" />
        {/* the ink: a coarser mottle and a fine grain, taken out of its
            weight (never to nothing) */}
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3" result="mottle" />
        <feColorMatrix in="mottle" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.45 0 0 0 0.76" result="mottleA" />
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="11" result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.7 0 0 0 0.62" result="grainA" />
        <feComposite in="soft" in2="mottleA" operator="in" result="worn" />
        <feComposite in="worn" in2="grainA" operator="in" />
      </filter>
    </svg>
  );
}

export default function App() {
  /* the scene's drawn in first, on its own; then the lettering eases in
     over it (its place kept, so nothing moves) */
  const [drawn, setDrawn] = useState(false);
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-white px-6 py-12">
      <h1 className="sr-only">A New York park basketball court, seen from above</h1>
      <Ink />
      <div className="flex w-full max-w-[760px] flex-col items-center gap-6">
        {/* centred by eye, not by its box: the top three lines sit to the
            left over a long last one, so its weight is 12% of its width
            left of its middle. Moved half of that to the right, between
            the two (its box centred looks left; its weight centred leaves
            the k's tail hanging out) */}
        <div className={`translate-x-[6%] transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${drawn ? "opacity-100" : "translate-y-1.5 opacity-0"}`}>
          <div className="h-24 text-neutral-800 sm:h-28 [&>svg]:h-full [&>svg]:w-auto" style={{ filter: "url(#ink)" }} dangerouslySetInnerHTML={{ __html: wordmark }} />
        </div>
        <CourtScene onDrawn={() => setDrawn(true)} onRedraw={() => setDrawn(false)} />
      </div>
    </main>
  );
}
