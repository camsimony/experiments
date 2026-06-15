# Clocks Reference Word Clock Implementation Plan

> For agentic workers: REQUIRED: Use subagent-driven-development
> (if subagents available) or executing-plans to implement this plan.

Goal: Build `~/experiments/clocks/` as a runnable Vite + React + TypeScript clock gallery starting with a smooth reference word-clock homage.
Architecture: React owns the app shell, DialKit tuning panel, and clock registry. SVG renders the artboard/words/hands. A direct `requestAnimationFrame` runtime updates SVG hand transforms through refs without per-frame React state.
Tech Stack: Vite, React, TypeScript, SVG, DialKit, Motion, Vitest, pnpm.

## File structure

- Create `clocks/package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html` — standalone Vite app config.
- Create `clocks/src/engine/handAngles.ts` and `.test.ts` — pure angle math.
- Create `clocks/src/engine/time.ts` and `.test.ts` — live/scrub time source and reduced-motion helper.
- Create `clocks/src/engine/handMotion.ts` — continuous/tick-settle transform generation.
- Create `clocks/src/engine/useClockRuntime.ts` — RAF loop that reads params from refs and mutates SVG hand groups.
- Create `clocks/src/app/clockTypes.ts`, `clockRegistry.ts`, `galleryState.ts` — future-friendly clock gallery types/state.
- Create `clocks/src/clocks/reference-word-clock/{ReferenceWordClock.tsx,dialConfig.ts,layout.ts,metadata.ts,styles.css}` — first clock variation.
- Create `clocks/src/App.tsx`, `main.tsx`, `styles/global.css`, `test/setup.ts`.

## Task 1: Scaffold standalone Vite app

Files:
- Create: `clocks/package.json`
- Create: `clocks/index.html`
- Create: `clocks/vite.config.ts`
- Create: `clocks/tsconfig.json`
- Create: `clocks/tsconfig.node.json`
- Create: `clocks/src/main.tsx`
- Create: `clocks/src/App.tsx`
- Create: `clocks/src/styles/global.css`

Steps:
- [ ] Create config files and minimal React shell.
- [ ] Run `cd clocks && pnpm install`.
- [ ] Run `cd clocks && pnpm run build`.
- [ ] Expected: build succeeds with a minimal app.
- [ ] Commit scaffold.

## Task 2: Implement pure clock engine with TDD

Files:
- Create: `clocks/src/engine/handAngles.ts`
- Create: `clocks/src/engine/handAngles.test.ts`
- Create: `clocks/src/engine/time.ts`
- Create: `clocks/src/engine/time.test.ts`
- Create: `clocks/src/test/setup.ts`

Steps:
- [ ] Write failing tests for noon, 3:15:30, angle wrap-around, and scrub time construction.
- [ ] Run `cd clocks && pnpm test -- --run` and confirm tests fail because modules are missing.
- [ ] Implement `calculateHandAngles`, `buildScrubDate`, and `prefersReducedMotion` helper.
- [ ] Run `cd clocks && pnpm test -- --run` and confirm tests pass.
- [ ] Commit engine tests and implementation.

## Task 3: Add gallery types and reference clock metadata/layout

Files:
- Create: `clocks/src/app/clockTypes.ts`
- Create: `clocks/src/app/galleryState.ts`
- Create: `clocks/src/app/clockRegistry.ts`
- Create: `clocks/src/clocks/reference-word-clock/layout.ts`
- Create: `clocks/src/clocks/reference-word-clock/metadata.ts`

Steps:
- [ ] Define `ClockRuntimeParams`, `ClockHandRefs`, `ClockProps`, and `ClockDefinition`.
- [ ] Add fallback `getClockById` behavior.
- [ ] Encode explicit word positions/rotations/sizes from the reference composition in `layout.ts`.
- [ ] Run `cd clocks && pnpm run build`.
- [ ] Commit gallery model and reference layout.

## Task 4: Implement SVG reference word clock

Files:
- Create: `clocks/src/clocks/reference-word-clock/ReferenceWordClock.tsx`
- Create: `clocks/src/clocks/reference-word-clock/styles.css`
- Modify: `clocks/src/clocks/reference-word-clock/metadata.ts`
- Modify: `clocks/src/app/clockRegistry.ts`

Steps:
- [ ] Render portrait white SVG artboard with green words One–Twelve.
- [ ] Render gray minute, black hour, and red second hand groups pivoting around the center.
- [ ] Use Futura/League Spartan/Montserrat-style bold geometric typography.
- [ ] Verify static default hand placement visually before enabling RAF.
- [ ] Run `cd clocks && pnpm run build`.
- [ ] Commit reference SVG clock.

## Task 5: Add DialKit runtime and RAF motion

Files:
- Create: `clocks/src/clocks/reference-word-clock/dialConfig.ts`
- Create: `clocks/src/engine/handMotion.ts`
- Create: `clocks/src/engine/useClockRuntime.ts`
- Modify: `clocks/src/App.tsx`
- Modify: `clocks/src/main.tsx`
- Modify: `clocks/src/clocks/reference-word-clock/ReferenceWordClock.tsx`

Steps:
- [ ] Add `DialRoot` and `useDialKit` controls for time, motion, and visuals.
- [ ] Forward DialKit params into a mutable ref.
- [ ] Implement RAF runtime that reads the ref, computes angles, and writes SVG group transforms.
- [ ] Add continuous mode as default and subtle tick-settle mode.
- [ ] Respect reduced-motion by disabling settle.
- [ ] Run `cd clocks && pnpm test -- --run` and `cd clocks && pnpm run build`.
- [ ] Commit DialKit and RAF runtime.

## Task 6: Browser verification and polish

Files:
- Modify: visual files as needed in `clocks/src/clocks/reference-word-clock/` and `clocks/src/styles/global.css`.

Steps:
- [ ] Start dev server with `cd clocks && pnpm run dev -- --host 127.0.0.1`.
- [ ] Open in Chrome and take a screenshot.
- [ ] Compare against `/Users/cameron.simony/Desktop/d5a2a8e1f3677136f5a85e96d222495c.webp`.
- [ ] Tune word placement, typography, color, and hand weights until close enough for v1 critique.
- [ ] Verify live time, scrub mode, continuous mode, tick-settle mode, and reduced-motion behavior manually.
- [ ] Run final `pnpm test -- --run` and `pnpm run build`.
- [ ] Commit polish.
