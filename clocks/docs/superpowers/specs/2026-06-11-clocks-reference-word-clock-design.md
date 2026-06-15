# Clocks Experiment — Reference Word Clock Design

## Status

Approved design for v1. Implementation has not started.

## Context

Cameron wants a standalone clock experiment in the `camsimony/experiments` repo, starting with a close visual homage to the supplied reference image:

`/Users/cameron.simony/Desktop/d5a2a8e1f3677136f5a85e96d222495c.webp`

The first version should match the reference closely enough to judge the idea, then serve as a foundation for future clock variations that can be cycled through. The project should optimize for visual craft, smoothness, and iterability over generic component reuse.

Relevant craft guidance:

- Emil/interface-polish principles: invisible details, optical alignment, purposeful motion, no gratuitous animation.
- DialKit should be used as the hidden tuning/debug layer for craft controls.

## Goals

- Build a working clock that defaults to real current time.
- Start with one clock variation: `reference-word-clock`.
- Match the reference image as a near-literal v1 homage:
  - white portrait artboard
  - large irregular green number words One–Twelve
  - black/gray/red hands
  - small center pin/detail
- Keep animation extremely smooth.
- Provide scrub/demo controls for judging composition and motion.
- Architect the project as a small clock gallery so more clock variations can be added later.

## Non-goals for v1

- No phrase-based word clock behavior such as “it is ten past three.”
- No generic publishable clock component API.
- No visible clock picker until more than one clock exists.
- No heavy canvas/WebGL rendering for v1.
- No precise tracing of the reference image as an imported asset; the reference guides composition.

## Recommended Architecture

Use **Vite + React + TypeScript + SVG + direct requestAnimationFrame rendering + DialKit**.

React is the app shell and clock-gallery runtime. It is not the per-frame animation engine. The clock face remains SVG for crisp typography and precise geometry. The hand motion is driven imperatively through refs in a `requestAnimationFrame` loop to avoid React state updates every frame.

DialKit is used as a hidden craft/tuning surface. It should not visually become part of the artboard. Install DialKit and its Motion ecosystem dependency during setup:

```bash
npm install dialkit motion
```

### Project structure

```txt
clocks/
  package.json
  index.html
  src/
    main.tsx
    App.tsx
    app/
      clockRegistry.ts
      galleryState.ts
    engine/
      time.ts
      handAngles.ts
      handMotion.ts
      useClockRuntime.ts
    clocks/
      reference-word-clock/
        ReferenceWordClock.tsx
        dialConfig.ts
        layout.ts
        styles.css
        metadata.ts
    styles/
      global.css
```

### Layer responsibilities

| Layer | Responsibility |
| --- | --- |
| React app shell | Mount active clock, provide registry/gallery state, add DialKit root. |
| Clock registry | List available clock variations; v1 has only `reference-word-clock`. |
| Clock engine | Compute live/scrubbed time, hand angles, motion variants, reduced-motion behavior. |
| SVG clock renderer | Render words, hands, center pin, and artboard for a clock variation. |
| RAF runtime | Update SVG hand transforms directly via refs. |
| DialKit | Hidden tuning controls for time, motion, layout, and visuals. |
| CSS | Artboard composition, typography, responsive sizing, reduced-motion fallbacks. |

## Clock Variation Model

Each clock variation should behave like a small plugin/module.

Minimum metadata and props:

```ts
type ClockDefinition = {
  id: string;
  name: string;
  Component: React.ComponentType<ClockProps>;
};

type ClockProps = {
  clockId: string;
  runtimeParamsRef: React.MutableRefObject<ClockRuntimeParams>;
  reducedMotion: boolean;
};

type ClockRuntimeParams = {
  mode: 'live' | 'scrub';
  motionMode: 'continuous' | 'tick-settle';
  scrubTime: { hour: number; minute: number; second: number };
};
```

The app shell owns `runtimeParamsRef` and updates it from DialKit/runtime controls. Each clock component owns its SVG element refs and passes those refs plus `runtimeParamsRef` into `useClockRuntime`. This keeps the shared runtime state centralized while allowing each clock variation to define its own SVG structure.

`reference-word-clock` is the first registered variation. Future clocks can be added beside it without changing the shared engine.

For each variation:

- `metadata.ts` exports its `ClockDefinition` metadata.
- `layout.ts` exports the static visual layout for that variation, including each word's x/y position, rotation, font size, and anchor/alignment.
- `dialConfig.ts` exports the DialKit config/schema for that variation. It is consumed by the clock component and should not bleed into the shared engine.

The gallery shell should already support:

- `activeClockId` in app state
- fallback to `reference-word-clock` if an id is unknown
- future next/previous cycling
- future URL hash selection, e.g. `#reference-word-clock`

Visible cycling UI is not required in v1 because there is only one clock.

## Reference Word Clock Visual Design

The first clock should intentionally start close to the reference.

### Artboard

- A white portrait-ish artboard floats on the page.
- The clock fills most of the artboard.
- Browser/page background can be quiet and neutral; the composition itself should read as a clean reference canvas.
- Demo controls must not move or visually pollute the artboard.

### Typography and number words

- Render number labels only: One, Two, Three, Four, Five, Six, Seven, Eight, Nine, Ten, Eleven, Twelve.
- No phrase words.
- Use a bold condensed/geometric sans-serif that matches the reference's heavy word shapes.
  - Preferred local target: **Futura Bold / Futura Condensed Extra Bold** if available.
  - Web fallback: use a bundled or imported close equivalent such as **League Spartan**, **Montserrat ExtraBold**, or another bold geometric sans; choose the one closest to the reference after visual inspection.
  - Font choice is part of visual parity and should be screenshot-verified.
- Words are irregularly positioned around the center rather than evenly radial.
- Each word has explicit layout config:
  - x/y position
  - rotation
  - font size
  - anchor/alignment
- Initial visual target: green tone close to the reference.

### Hands

- Use SVG line/polygon/groups for hands.
- Hour/minute hands should mimic the reference’s black + pale gray asymmetric feel.
- Second hand is a thin red line extending through the center.
- Center pin/detail should be small red/pink, potentially with a subtle square/glow if it helps match the reference.

## Motion Design

### Default behavior

- Clock opens in real-time mode.
- Default motion mode is continuous sweep:
  - second hand updates every animation frame
  - minute and hour hands update continuously based on seconds/milliseconds
- RAF should mutate transform only, preferably on SVG groups/lines with stable transform origins.
- SVG rotation must explicitly set the pivot. Use hand groups that rotate around the clock center, or set `transform-origin` to the center coordinate. If CSS transforms are used on SVG elements, set `transform-box` / `transform-origin` deliberately and verify with a fixed static time before wiring RAF.
- No per-frame React state updates.

### Tick/settle mode

Tick/settle is available through DialKit for comparison. It is not the default.

- Second hand lands once per second.
- It should implement a tiny mechanical settle/overshoot.
- The effect should be subtle and tunable, not gimmicky.

### Reduced motion

When `prefers-reduced-motion` is enabled:

- Disable decorative settle/overshoot.
- Keep time accurate.
- Prefer simpler direct hand updates.

## DialKit Controls

DialKit is the hidden craft panel.

Add `DialRoot` in the app shell and import DialKit styles. Use DialKit controls instead of building custom hidden controls.

Control groups for v1:

- **Time**
  - live vs scrub mode
  - hour/minute/second scrub values
  - reset to live
- **Motion**
  - continuous vs tick/settle
  - settle amount
  - settle duration or spring feel
- **Visuals**
  - green word color
  - second-hand color
  - hand weights
  - center pin size/glow
- **Reference layout**
  - optional coarse controls for artboard scale/offset
  - optional per-word tuning if practical

Values tuned through DialKit can later be frozen back into static config.

Mount `<DialRoot>` outside the artboard composition, such as a fixed bottom-right tuning panel while the white artboard remains centered. The DialKit panel can be visible in the surrounding browser workspace, but it must not overlap or shift the white artboard canvas.

Each clock's `dialConfig.ts` owns that variation's DialKit controls; shared time/motion controls belong in the app/runtime layer.

## Time and Data Flow

Runtime state includes:

- `mode`: `live | scrub`
- `motionMode`: `continuous | tick-settle`
- `activeClockId`
- scrubbed time fields
- tuned visual/motion/layout parameters

Flow:

1. `App` mounts the active clock from `clockRegistry`.
2. `DialRoot` and DialKit config expose hidden controls.
3. The active clock receives stable config and refs.
4. `useClockRuntime` owns the RAF loop.
5. DialKit params from `useDialKit` are forwarded into the RAF loop through a mutable ref. React can update the ref when params change, but the RAF callback reads from the ref and must not call `setState` every frame.
6. RAF chooses the time source:
   - live mode: `new Date()`
   - scrub mode: synthetic date from DialKit values in the mutable ref
7. Engine calculates hand angles.
8. Renderer applies transforms directly to SVG hand refs.

## Quality Bar and Verification

Before v1 is considered done:

### Visual verification

- Screenshot the local clock and compare to the reference image.
- Check top-to-bottom structure:
  - white portrait artboard
  - irregular word placement
  - rotations and size relationships
  - green color
  - hand weights/colors
  - center detail
  - overall spacing and fill

### Behavior verification

- Confirm live time matches system time.
- Confirm scrub mode displays selected time.
- Confirm returning from scrub to live mode works.
- Confirm continuous mode has no visible jumps.
- Confirm tick/settle remains subtle.
- Confirm reduced-motion mode avoids decorative motion.

### Performance verification

- No per-frame React render loop.
- No layout reads/writes per frame.
- RAF mutates hand transforms only.
- No `transition: all`.
- No expensive effects in the hot path.

### Browser verification

- Chrome desktop viewport.
- Narrower viewport to ensure artboard scales gracefully.

## Acceptance Criteria

- `~/experiments/clocks/` contains a runnable standalone Vite/React/TypeScript experiment.
- Running the dev server opens the reference word clock.
- The clock defaults to real current time.
- Hands animate smoothly in continuous mode.
- DialKit can switch to scrubbed time and tick/settle mode.
- The main artboard remains visually clean when controls are hidden.
- The first clock is registered through a gallery/registry structure, not hard-coded as a one-off.
- Visual output is close enough to the supplied reference to support iterative critique.

## Open Follow-up After v1

- Add visible next/previous controls once a second clock exists.
- Add URL hash routing for specific clocks.
- Add alternative clock variations.
- Potentially add saved DialKit presets for tuned clock variants.
