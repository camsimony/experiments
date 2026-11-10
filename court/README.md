# Court

A New York park half-court seen from above, drawn live in one WebGL2
fragment shader: plane trees, a one-way street with a bus stop, pickup
basketball, pedestrians, pigeons and an elevated train, through four
seasons and three times of day, with field-recorded sound.

## Run

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # typecheck, then a static build in dist/
```

## Layout

- `src/court/CourtScene.tsx`: the frame, the season/time/sound controls, and the still that stands in when the scene can't run
- `src/court/TopDownCourt.tsx`: the canvas, the frame loop, and the simulation's uniforms
- `src/court/shaders/`: the scene shader, in sections, and the post pass
- `src/court/{traffic,people,pickup,pigeons,skate,trees}.ts`: the simulations
- `src/court/sound/`: the sound engine and mixer
- `public/sounds/court/`: CC0 recordings from Freesound, credited in `CREDITS.md`

## On a visitor's machine

The scene draws at 30fps and pauses when off screen. If frames run late
it drops its resolution, then to 20fps. With no WebGL2, a software
renderer (production builds only), a lost context, or a machine that
still can't keep up, `public/court/top-down.jpg` is shown in its place.
With reduced motion it holds still.

## Dev-only

Query parameters: `?season=0..3&time=0..2`, `?sim=N` (run the street N
steps ahead before the first frame), `?scale=N` (pin the scene scale),
`?skip=TREES,CARS,…` (leave shader sections out).

Console: `__court.bench(30)`, `__court.size()`, `__traffic.bus()`,
`__people.spawn("walk")`.

`?life=0` shows the older, flat figures, in any build.
