/* ══ The trees ════════════════════════════════════════════
   London planes, the tree of every New York park, overhanging the path
   and the edge of the court.

   From above, a plane's crown is a mass of rounded clumps of leaves,
   and that's how it's built: domes scattered on a jittered grid, each a
   slightly different size and height, overlapping. A dome has a real
   normal, so the low sun lights its west face and leaves its east face
   and the creases between domes in shade; that's where the depth comes
   from. Big clumps give the shape, small ones the leafy texture and a
   ragged, see-through fringe. Inside a crown the clumps are dense; out
   toward its edge they thin out, so the outline breaks up.

   The shadow is the same clumps looked up the sun at a few heights (a
   crown is tall, so a low sun streaks it), with the gaps between clumps
   letting light through: dappling falls out of the geometry. */

export const OVERHEAD = /* glsl */ `
uniform float u_time;
uniform float u_windT;    // wind time: runs faster in a gust (integrated in JS)
uniform float u_fallT;    // the same, times how fast things fall this season
uniform float u_gustT;    // the gust clock: how far through its gusts the wind is
uniform float u_gustK;    // how hard the gusts come this season
uniform vec3 u_fallTune;  // scatter, from the trees, more in a gust
uniform float u_fallLife;   // how far (in wind) a falling leaf blows before it lands
uniform float u_lifeT;      // the life clock: how far through their fall leaves are (faster in a gust)
uniform vec2 u_hist[16];    // over the last u_fallLife of it: (wind clock, gust) [0] now, [k] k steps back from u_histOff ago
uniform float u_histOff;    // how much life clock since the last step was recorded

// ── gusts: most of the time a light breeze, and every 15-30s or so a gust
//    swells for a few seconds and dies away. The same smooth 1-D noise as
//    gustAt in TopDownCourt.tsx. gt is the gust clock (integrated in JS,
//    so how often they come can change smoothly); take a little off it
//    further right and a gust rolls in across the frame from the left
float gHash(float i) { return fract(sin(i * 127.1) * 43758.5453); }
float gNoise(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(gHash(i), gHash(i + 1.0), f); }
float gustAt(float gt, float t) { return smoothstep(0.55, 0.92, gNoise(gt)) * (0.75 + 0.25 * gNoise(t * 0.7 + 4.0)); }
// the wind clock and the gust as they were d of life clock ago (0 now ..
// u_fallLife). Read against when each step was recorded, so what a leaf
// knows of its birth holds steady as the history shifts along
vec2 histBack(float d) {
  float step = u_fallLife / 15.0;
  if (d < u_histOff) return mix(u_hist[0], u_hist[1], d / max(u_histOff, 1e-5));
  float x = clamp((d - u_histOff) / step + 1.0, 1.0, 15.0);
  int i = int(floor(x));
  return mix(u_hist[i], u_hist[min(i + 1, 15)], fract(x));
}
float gustHere(vec2 p) { return gustAt(u_gustT - (p.x * 1.6 + p.y * 0.4) * 0.11, u_time) * u_gustK; }
uniform float u_density;   // how full the crowns are, 0 bare .. 1 summer
uniform vec3 u_leafLo, u_leafHi;
uniform float u_blossom;
uniform float u_wind;
uniform sampler2D u_branch;
uniform float u_branchMargin;  // the texture covers the frame and this much round it
uniform vec4 u_trail[8];       // the pointer's recent path: x, y, strength, age (s)
uniform float u_autumn;   // how much each tree turns its own colour

const float CANOPY_FT = 30.0;
const float LEAF_S = 195.0;   // leaves per world unit, the upper layer

// ── the branches, grown in JavaScript (trees.ts) and read from a
//    texture: R is the branches, G is where their leaves gather
// (nothing outside the texture: clamping would smear its edge into stripes)
float inTex(vec2 t) { return step(0.0, t.x) * step(t.x, 1.0) * step(0.0, t.y) * step(t.y, 1.0); }
vec2 branchUV(vec2 q) { return (q + u_branchMargin) / (u_world + 2.0 * u_branchMargin); }
float branches(vec2 q) { vec2 t = branchUV(q); return texture(u_branch, t).r * inTex(t); }
float leafSites(vec2 q) { vec2 t = branchUV(q); return texture(u_branch, t).g * inTex(t); }

// is w anywhere near a crown at all? (within k crown-radii of its
// centre). Most of the frame isn't, and the leaves, their sway and their
// shadows are all exactly nothing there: so each checks this first,
// before any of its noise
bool crownNear(vec2 w, float k) {
  for (int i = 0; i < 8; i++) { vec3 c = u_crown[i]; vec2 d = w - c.xy; if (dot(d, d) < c.z * c.z * k * k) return true; }
  return false;
}
vec2 swayAt(vec2 p) {
  // (only where there's a tree to sway: the leaves reach 2.2 radii at
  // most, the limbs less)
  if (!crownNear(p, 2.4)) return vec2(0.0);
  float t = u_time;
  // a gentle breeze always, and the gusts: the crowns lean and the
  // leaves rustle, the left trees first
  float g = gustHere(p);
  vec2 s = vec2(fbm3(p * 2.6 + vec2(t * 0.12, 0.0)), fbm3(p * 2.6 + vec2(3.7, -t * 0.1))) - 0.5;
  s *= 0.55 + 0.75 * g;
  s += vec2(0.25, 0.08) * g;   // the lean, downwind
  s += (0.3 + 0.6 * g) * (vec2(vnoise(p * 22.0 + t * 0.9), vnoise(p * 22.0 - t * 0.8 + 5.0)) - 0.5);
  s += 0.35 * g * (vec2(vnoise(p * 60.0 + t * 3.0), vnoise(p * 60.0 - t * 2.7 + 9.0)) - 0.5);
  s *= 0.01 * u_wind;
  // ── the pointer moving through the leaves: each point of its recent
  //    path pushes the foliage round it aside, along the way it was
  //    going, and lets it spring back with a little wobble as it settles
  for (int i = 0; i < 8; i++) {
    vec4 tr = u_trail[i];
    if (tr.z < 0.001) continue;
    vec2 d = p - tr.xy;
    float f = exp(-dot(d, d) / 0.0036) * tr.z;          // about 6% of the frame across
    float spring = cos(tr.w * 10.0) * exp(-tr.w * 2.6);
    s += normalize(d + 1e-5) * f * 0.018 * spring;
    // and a little flutter, leaves turning over in the disturbance
    s += (vec2(vnoise(p * 80.0 + t * 6.0), vnoise(p * 80.0 - t * 6.0 + 3.0)) - 0.5) * f * 0.004 * exp(-tr.w * 1.5);
  }
  return s;
}

// how much crown there is at w: 1 deep inside one, 0 outside them all
float crownRad;   // the size of the crown crownMask last found you in
float crownIdx;   // and which one
float crownMask(vec2 w) {
  // (the outline below wanders by at most ~0.7 of a radius, and reaches
  // 1.3 radii: beyond 2.2 there's nothing, so don't look)
  if (!crownNear(w, 2.2)) { crownRad = 0.3; crownIdx = 0.0; return 0.0; }
  // the outline wanders: a crown is a few big limbs' worth of leaves, so
  // it bulges and dents rather than being round. A small street tree
  // wanders at its own, smaller scale, so it's lobed like the big ones
  vec2 warpL = vec2(fbm3(w * 3.0 + 1.3), fbm3(w * 3.0 + 7.9)) - 0.5;
  vec2 warpS = vec2(fbm3(w * 10.0 + 4.1), fbm3(w * 10.0 + 2.6)) - 0.5;
  float m = 0.0; crownRad = 0.3; crownIdx = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 c = u_crown[i];
    vec2 warp = mix(warpS, warpL, smoothstep(0.12, 0.26, c.z)) * c.z;
    float mi = 1.0 - smoothstep(0.4, 1.3, length(w + warp - c.xy) / c.z);
    if (mi > m) { m = mi; crownRad = c.z; crownIdx = float(i); }
  }
  return m;
}

// ── where leaves are. Not circles: an irregular density built from the
//    crown's outline and two scales of noise, so leaves bunch into big
//    masses and smaller sprays with holes between them, and thin out to
//    single leaves at the edge
float leafField(vec2 q) {
  float m = crownMask(q);
  if (m <= 0.0) return -1.0;
  // masses and sprays sized to the tree: a small tree has smaller ones
  float k = clamp(0.3 / crownRad, 1.0, 2.6);
  float mass = fbm(q * 6.0 * k);
  float spray = fbm3(q * 17.0 * k + 3.0);
  // even deep inside a crown there are gaps between the masses
  // leaves grow where the twigs are: the grown tree's leaf sites lead,
  // the crown outline only holds them in
  float f = m * 0.35 + leafSites(q) * 1.15 + (mass - 0.5) * 1.3 + (spray - 0.5) * 0.7 - 0.42;
  // a plane is fullest over its middle, where the limbs rise to the top
  // of the dome, not a ring of leaves round a hole
  f += smoothstep(0.55, 1.0, m) * 0.4;
  // a small street tree is thinner: its branches show through it
  f -= (1.0 - smoothstep(0.1, 0.25, crownRad)) * 0.24;
  // a cherry in bloom is a cloud of flowers, fuller than the planes' new leaves
  if (abs(crownIdx - 3.0) < 0.5 || abs(crownIdx - 6.0) < 0.5) f += u_blossom * 0.32;
  // the edge isn't a line: out in the crown's outer band, sprays of a few
  // leaves reach past the rest and gaps bite in, at the scale of twigs,
  // so the outline breaks up instead of tracing a shape
  float rim = 1.0 - smoothstep(0.3, 0.75, m);
  f += ((fbm3(q * 42.0 * k + 9.1) - 0.5) * 1.1 + (vnoise(q * 110.0) - 0.5) * 0.5) * rim;
  // and never any leaves outside one, however the noise falls
  return mix(-1.0, f, smoothstep(0.0, 0.06, m));
}
float season() { return smoothstep(0.12, 1.0, u_density); }
// the chance a leaf is here: high deep in a mass, falling off at its edge
// (a wide ramp: toward the edge leaves thin out to single ones, scattered)
float leafFill(vec2 q) { return smoothstep(-0.28, 0.3, leafField(q)) * season(); }

// one layer of leaves: on a jittered grid, each a five-lobed plane leaf
// with its own size, turn and tilt. Returns coverage, and through
// tilt the leaf's own normal (xy) and through h which leaf won
float leafLayer(vec2 q, float S, float seed, float fill, out vec2 tilt, out float h) {
  vec2 g = q * S;
  vec2 i0 = floor(g);
  float cover = 0.0; h = -1.0; tilt = vec2(0);
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 id = i0 + vec2(x, y);
    float r0 = hash12(id + seed);
    if (r0 > fill) continue;
    vec2 pos = id + hash22(id + seed + 1.7);
    float size = 0.55 + 0.4 * hash12(id + seed + 2.9);
    float ang = hash12(id + seed + 4.3) * 6.2832;
    vec2 d = (g - pos) / size;
    d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d;
    float r = length(d), a = atan(d.y, d.x);
    // five pointed lobes, the stalk end a little notched
    float lobes = 0.62 + 0.38 * pow(abs(cos(a * 2.5)), 0.7);
    lobes *= 1.0 - 0.25 * smoothstep(0.6, 1.0, cos(a + 1.5708));
    float edge = lobes - r;
    if (edge > -0.08) {
      float c = smoothstep(-0.08, 0.06, edge);
      float hh = hash12(id + seed + 6.1);
      if (c > 0.0 && hh > h) {
        h = hh; cover = max(cover, c);
        tilt = (hash22(id + seed + 8.3) - 0.5) * 1.3;
      }
    }
  }
  return cover;
}

// the crown's coverage, for its shadow: the leaf density, softened
float crownCover(vec2 q, float soft) {
  return smoothstep(mix(-0.05, -0.2, soft), mix(0.25, 0.45, soft), leafField(q)) * season();
}
// and real leaves at one height, for the flecks of sun between them
float leafShadowDetail(vec2 q) {
  vec2 t; float h;
  float fill = leafFill(q);
  return max(leafLayer(q, LEAF_S, 0.0, fill * 0.95, t, h), leafLayer(q, LEAF_S * 0.79, 31.0, min(1.0, fill * 1.25), t, h));
}

// which tree a point belongs to (the crown it's deepest inside)
float crownId(vec2 q) {
  float best = -1.0, id = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 c = u_crown[i];
    float m = 1.0 - length(q - c.xy) / c.z;
    if (m > best) { best = m; id = float(i); }
  }
  return id;
}
// a New York autumn doesn't turn every tree at once or the same way:
// some go gold, some orange, some rust red, a few hang on green-yellow
vec3 autumnHue(float k) {
  vec3 gold = vec3(0.96, 0.72, 0.2), orange = vec3(0.93, 0.47, 0.12);
  vec3 rust = vec3(0.74, 0.22, 0.1), late = vec3(0.66, 0.66, 0.24);
  float f = fract(k) * 4.0;
  return f < 1.0 ? mix(gold, orange, f) : f < 2.0 ? mix(orange, rust, f - 1.0) : f < 3.0 ? mix(rust, gold, f - 2.0) : mix(late, gold, f - 3.0);
}

// ── clumps: a full crown seen from above isn't one surface, it's dozens
//    of leafy clumps, each its own little dome, lit on its sunny side,
//    with dark crevices between them where you look down into the tree.
//    A jittered cell grid; returns the shade of the clump at g, and
//    through id which clump it is
float clumpShade(vec2 g, vec3 L, out float id) {
  vec2 i0 = floor(g);
  float f1 = 9.0, f2 = 9.0; vec2 dn = vec2(0); id = 0.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 c = i0 + vec2(x, y);
    float sz = 0.75 + 0.5 * hash12(c + 3.3);
    vec2 d = (g - c - 0.15 - 0.7 * hash22(c)) / sz;
    float r = dot(d, d);
    if (r < f1) { f2 = f1; f1 = r; dn = d; id = hash12(c + 11.0); }
    else if (r < f2) f2 = r;
  }
  float gap = sqrt(f2) - sqrt(f1);
  float crev = 1.0 - smoothstep(0.0, 0.32, gap);
  vec3 n = normalize(vec3(dn * 1.4, 1.0));
  float lit = clamp(dot(n, L), 0.0, 1.0);
  // higher clumps catch more light; lower ones sit in the others' shade
  return mix(0.72, 1.3, lit) * mix(0.86, 1.12, id) * (1.0 - crev * 0.5);
}

// the crown's colour where it covers, and how much it covers
vec4 crownColor(vec2 q, vec3 sunCol) {
  float fill = leafFill(q);
  if (fill < 0.002) return vec4(0);
  vec2 tU, tL; float hU, hL;
  // the upper leaves, in the sun, and a denser layer below them
  float up = leafLayer(q, LEAF_S, 0.0, fill * 0.95, tU, hU);
  // the lower layer only fills in under the upper one: out at the thin
  // edge it would show as a dark rim round the crown
  float lo = leafLayer(q, LEAF_S * 0.79, 31.0, min(1.0, fill * 1.25) * smoothstep(0.25, 0.7, fill), tL, hL);
  float cover = max(up, lo);
  if (cover < 0.001) return vec4(0);
  bool top = up > 0.001;
  vec2 tilt = top ? tU : tL;
  // a soft hint of the big masses' shape, so the crown still has volume
  float e = 0.01;
  float f0 = leafField(q);
  vec2 grad = vec2(leafField(q + vec2(e, 0)) - f0, leafField(q + vec2(0, e)) - f0) / e;
  // (out at the thin edge the masses' shape fades: there it's single
  // leaves, each lit on its own, not the shaded flank of a dome)
  float edgeT = 1.0 - smoothstep(0.25, 0.7, crownMask(q));
  // how full the crown is: the clumps only take over in high summer, so
  // spring's and autumn's thinner crowns stay as they are
  float full = smoothstep(0.62, 0.95, u_density);
  vec2 nxy = tilt - grad * 0.05 * (1.0 - edgeT * 0.8) * (1.0 - full * 0.7);
  vec3 n = normalize(vec3(nxy, 1.0));
  vec3 L = normalize(vec3(-normalize(u_sun), 0.6));
  float lam = clamp(dot(n, L), 0.0, 1.0);
  // depth: the top of a mass is lit, its underside and the lower layer
  // are in the crown's own shade
  float depth = max(smoothstep(-0.1, 0.5, f0), edgeT * 0.75);
  // each tree its own autumn colour, and each spray of leaves a shade
  // either side of it
  float tid = crownId(q);
  float leafK = hash12(vec2(tid, 3.0)) + ((top ? hU : hL) - 0.5) * 0.35 + (fbm3(q * 12.0) - 0.5) * 0.4;
  vec3 hiC = mix(u_leafHi, autumnHue(leafK), u_autumn);
  vec3 loC = mix(u_leafLo, autumnHue(leafK) * vec3(0.4, 0.3, 0.25), u_autumn);
  vec3 c = mix(loC, hiC, lam);
  c *= top ? mix(0.62, 1.1, depth) : mix(0.32, 0.5, depth);
  if (full > 0.0) {
    float kk = clamp(0.3 / crownRad, 1.0, 2.6);
    float idB, idS;
    float big = clumpShade(q * 15.0 * kk + 4.0, L, idB);
    float small = clumpShade(q * 38.0 * kk, L, idS);
    float sh = big * mix(1.0, small, 0.5);
    // each clump a slightly different green: some warmer and yellower in
    // the sun, some cooler and bluer
    vec3 hue = mix(vec3(0.88, 1.02, 1.06), vec3(1.04, 1.06, 0.88), idB) * mix(0.95, 1.05, idS);
    c = mix(c, c * sh * hue, full * (1.0 - edgeT * 0.6));
  }
  // leaves at the crown's thin edge are lit through
  c += u_leafHi * sunCol * 0.16 * (1.0 - crownMask(q)) * lam * (top ? 1.0 : 0.3);
  // and each leaf is a slightly different colour
  c *= 0.9 + 0.2 * (top ? hU : hL);
  // ── blossom: two of the street trees are flowering cherries, pink all
  //    over in clusters; the planes only catch a few drifts of petals
  bool cherry = abs(tid - 3.0) < 0.5 || abs(tid - 6.0) < 0.5;
  float cluster = smoothstep(0.45, 0.65, fbm3(q * 34.0 + tid * 5.0));
  float pinkP = cherry ? mix(0.6, 0.95, cluster) : cluster * 0.08;
  float hh = top ? hU : hL;
  if (u_blossom > 0.0 && hash12(vec2(hh * 91.0, tid)) < pinkP * u_blossom) {
    vec3 pink = mix(vec3(0.98, 0.76, 0.84), vec3(0.93, 0.56, 0.7), fract(hh * 7.0));
    pink = mix(pink, vec3(1.0, 0.93, 0.95), step(0.8, fract(hh * 13.0)));   // a few nearly white
    c = pink * mix(0.6, 1.08, lam) * (top ? mix(0.8, 1.05, depth) : 0.6);
  }
  return vec4(c, cover);
}

// the crown's shadow: clumps looked up the sun at several heights, softer
// higher up (a wide penumbra), light through the gaps between clumps
float crownShadow(vec2 p, vec2 sun) {
  float s = 0.0;
  // (the shadow's looked up from 16 to 36 ft along the sun: nothing here
  // unless p is within reach of some crown along that stretch)
  bool near = false;
  for (int i = 0; i < 8; i++) {
    vec3 c = u_crown[i];
    if (segDist(p, c.xy + sun * 16.0 * u_ft, c.xy + sun * 36.0 * u_ft) < c.z * 2.3) { near = true; break; }
  }
  if (!near) return 0.0;
  // averaged rather than maxed over the heights, so the clumps smear
  // into streaks along the sun instead of stamping circles
  float acc = 0.0;
  // (the sway sampled once, at the middle height: it's a slow soft
  // field and the shadow's a blur, and five samples of it cost more
  // than the rest of the shadow)
  vec2 sw = swayAt(p - sun * 26.0 * u_ft);
  for (int k = 0; k < 4; k++) {
    float t = float(k) / 3.0;
    float h = mix(16.0, 36.0, t);
    vec2 q = p - sun * h * u_ft + sw;
    float c = crownCover(q, mix(0.5, 1.0, t));
    acc += c;
    s = max(s, c * 0.75);
  }
  float smooth_ = clamp(max(s, acc / 4.0 * 1.35), 0.0, 1.0);
  // break the shadow up with the leaves themselves at mid height: where
  // there's no leaf, a fleck of sun gets through
  vec2 qm = p - sun * 24.0 * u_ft + sw;
  float leafy = leafShadowDetail(qm);
  return smooth_ * mix(0.62, 1.0, leafy);
}

// the trunk, seen from above only in winter, and its long shadow always
float trunkShape(vec2 p) {
  float a = 0.0;
  for (int i = 0; i < 8; i++) a = max(a, 1.0 - smoothstep(1.0, 1.4, length(p - u_crown[i].xy) / u_ft));
  return a;
}
float trunkShadow(vec2 p, vec2 sun) {
  float s = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 base = u_crown[i].xy;
    s = max(s, 1.0 - smoothstep(0.8, 1.4, segDist(p, base, base + sun * 16.0 * u_ft) / u_ft));
  }
  return s;
}

`;
