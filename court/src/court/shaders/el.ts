/* ══ The elevated subway ══════════════════════════════════
   A two-track el running across the top of the frame, over a street, as
   in the aerial reference beside the train. From above: dark green
   steel girders along each track, timber ties every two feet with the
   street showing between them, two rails each, and lateral beams where
   the columns stand. It's 30 ft up, so its shadow (stripes of ties,
   solid girders) lands well down and to the right of it.

   A train passes now and then (u_train, from the component): silver
   cars, ribbed roofs with two AC units each, dark gaps between cars. Its
   shadow slides across the sidewalk and the top of the court with it. */

export const EL = /* glsl */ `
uniform vec2 u_el;       // centre y and full width of the structure, world
uniform vec4 u_train;    // front x (world), track (0 upper, 1 lower), direction (+1 / -1), on (0/1)

const float EL_H = 30.0;       // deck height, ft
const float TRAIN_H = 12.0;    // the train's roof above the deck, ft
const float CAR_FT = 51.0, CARS = 8.0;

// where a point sits on the el: v across it (ft from its centre line),
// and returns whether it's on the structure at all
float elV(vec2 p) { return (p.y - u_el.x) / u_ft; }
float trackV(float t) { return t < 0.5 ? -6.5 : 6.5; }   // centre of each track, ft

// the deck from above. col is its colour; returns how much is solid
// (the gaps between ties are open, the street shows through)
float elShape(vec2 p, out vec3 col) {
  float v = elV(p), x = p.x / u_ft;
  float half_ = u_el.y / u_ft * 0.5;
  col = vec3(0);
  if (abs(v) > half_) return 0.0;
  float a = 0.0;
  // the girders: along both outer edges and down the middle
  float g = min(abs(abs(v) - half_ + 1.0), abs(v));
  float girder = 1.0 - smoothstep(0.7, 1.0, g);
  vec3 steel = vec3(0.2, 0.26, 0.23) * (0.85 + 0.25 * fbm3(p * 60.0));
  steel = mix(steel, vec3(0.42, 0.24, 0.14), smoothstep(0.55, 0.8, fbm3(p * 25.0)) * 0.45);  // rust
  // lateral beams where the columns are, every 45 ft
  float beam = 1.0 - smoothstep(0.6, 0.9, abs(mod(x + 22.5, 45.0) - 22.5));
  // each track: ties every two feet, two rails
  float tie = 0.0, rail = 0.0;
  for (int t = 0; t < 2; t++) {
    float tv = v - trackV(float(t));
    if (abs(tv) < 4.2) {
      tie = max(tie, 1.0 - smoothstep(0.32, 0.5, abs(fract(x * 0.5) - 0.5)));
      rail = max(rail, 1.0 - smoothstep(0.08, 0.16, abs(abs(tv) - 2.35)));
    }
  }
  vec3 wood = vec3(0.3, 0.24, 0.19) * (0.8 + 0.35 * hash12(vec2(floor(x * 0.5), floor(v))));
  col = wood; a = max(a, tie * 0.95);
  if (beam > a) { col = steel * 0.9; a = beam; }
  if (girder > 0.0) { col = mix(col, steel, girder); a = max(a, girder); }
  if (rail > 0.0) { col = mix(col, vec3(0.62, 0.62, 0.6), rail); a = max(a, rail); }
  return a;
}

// the train, from above, if one is passing
float trainShape(vec2 p, out vec3 col) {
  col = vec3(0);
  if (u_train.w < 0.5) return 0.0;
  float v = elV(p) - trackV(u_train.y);
  if (abs(v) > 5.0) return 0.0;
  // distance back along the train from its front, ft
  float along = (u_train.x - p.x) / u_ft * u_train.z;
  if (along < 0.0 || along > CAR_FT * CARS) return 0.0;
  float inCar = mod(along, CAR_FT);
  // the gap between cars, and the cars' rounded ends
  float body = smoothstep(0.0, 0.8, inCar) * smoothstep(CAR_FT, CAR_FT - 0.8, inCar);
  body *= 1.0 - smoothstep(4.5, 5.0, abs(v));
  // stainless roof: fine ribs along the car, lit along one side
  // stainless: cool and bright, the ribs catching the low sun in lines,
  // the side toward the sun brighter, and a soft sheen sliding along it
  float rib = 0.5 + 0.5 * sin(v * 11.0);
  vec3 c = mix(vec3(0.56, 0.6, 0.64), vec3(0.86, 0.89, 0.92), rib * 0.45 + smoothstep(4.0, -4.0, v) * 0.4);
  c *= 0.95 + 0.1 * vnoise(vec2(along * 0.08, v));
  // two AC units on every car, and a dark seam down the middle
  float ac = max(1.0 - smoothstep(0.0, 0.3, boxDist(vec2(inCar, v), vec2(13.0, 0.0), vec2(3.0, 2.6))),
                 1.0 - smoothstep(0.0, 0.3, boxDist(vec2(inCar, v), vec2(38.0, 0.0), vec2(3.0, 2.6))));
  c = mix(c, vec3(0.5, 0.52, 0.53), ac);
  c *= 1.0 - (1.0 - smoothstep(0.0, 0.25, abs(v))) * 0.15;
  col = c;
  return body;
}

// the el's shadow (and the train's) on the ground below and beside it
float elShadow(vec2 p) {
  vec3 dummy;
  // a deck 30 ft up throws a soft shadow: the sun's disc blurs the ties
  // into an even half-shade, and only the girders and beams stay as
  // firmer, still soft-edged bands
  vec2 q = p - u_sun * EL_H * u_ft;
  float s = 0.0;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 2.39996;
    vec2 o = vec2(cos(a), sin(a)) * sqrt((float(i) + 0.5) / 6.0) * 1.6 * u_ft;
    s += elShape(q + o, dummy);
  }
  s = s / 6.0 * 0.62;
  vec2 qt = p - u_sun * (EL_H + TRAIN_H) * u_ft;
  s = max(s, 0.5 * (trainShape(qt + vec2(0.8, 0.0) * u_ft, dummy) + trainShape(qt - vec2(0.8, 0.0) * u_ft, dummy)) * 0.8);
  return s;
}

// at night, the light from a passing train's windows: from above you
// can't see in, but you see the light they throw, a bright strip along
// each side of every car, broken by the pillars between the windows and
// dark at the doors and the gaps between cars. Returns its strength at p,
// and through rim, the lit edge along the car's roof
float trainGlow(vec2 p, out float rim) {
  rim = 0.0;
  if (u_train.w < 0.5) return 0.0;
  float v = elV(p) - trackV(u_train.y);
  if (abs(v) > 11.0) return 0.0;
  float along = (u_train.x - p.x) / u_ft * u_train.z;
  if (along < -3.0 || along > CAR_FT * CARS + 3.0) return 0.0;
  float inCar = mod(along, CAR_FT);
  // windows along the car, every 5 ft or so, the doors (four a side) dark
  // (soft: the light spreads, so the windows only just show as a ripple
  // in it, and it dips a little at the doors and between the cars)
  float win = 0.5 + 0.5 * cos(inCar / 4.6 * 6.2832);
  float door = 0.0;
  for (int d = 0; d < 4; d++) door = max(door, 1.0 - smoothstep(0.0, 3.5, abs(inCar - (6.5 + float(d) * 12.7))));
  float ends = smoothstep(0.0, 5.0, inCar) * smoothstep(CAR_FT, CAR_FT - 5.0, inCar);
  float lit = (0.82 + 0.18 * win) * (1.0 - door * 0.3) * mix(0.55, 1.0, ends);
  // the spill falls off away from the car's side in a soft bloom, and
  // tapers off at the train's two ends
  float out_ = abs(v) - 4.2;
  rim = lit * (1.0 - smoothstep(0.0, 1.0, abs(out_ + 0.4)));
  float fall = exp(-max(out_, 0.0) * max(out_, 0.0) / 12.0) * smoothstep(-2.0, 0.5, out_);
  return lit * fall * smoothstep(3.0, -8.0, along - CAR_FT * CARS) * smoothstep(-3.0, 8.0, along);
}
`;
