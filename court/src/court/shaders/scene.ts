import { COMMON } from "./common";
import { GROUND } from "./ground";
import { OVERHEAD } from "./overhead";
import { PROPS } from "./props";
import { EL } from "./el";
import { ROW } from "./row";
import { ROOFS } from "./roofs";
import { SNOW } from "./snow";
import { BUILDINGS } from "./buildings";
import { BIRDS_GLSL } from "./birds";
import { PEOPLE_GLSL } from "./people";

/* ══ The scene pass ═══════════════════════════════════════
   Ground, then the light and shadow on it, then everything above it,
   then whatever is falling through the air. Rendered into a texture at a
   modest resolution; the post pass (post.ts) softens and finishes it.

   Seasons arrive as uniforms, already blended by the component, so a
   change of season is a slow cross-fade of every parameter at once,
   not a swap:
     u_snow     snow lying on the court, 0..1
     u_litter   leaves (or petals) lying on the ground, 0..1
     u_litterCol  their colour
     u_fall     how much is falling through the air, and of what kind
     u_sunCol, u_shadeCol, u_sunK   the light */

export const SCENE_FRAG = /* glsl */ `#version 300 es
precision highp float;
//DEFINES
in vec2 v_uv;
out vec4 o;
uniform vec2 u_res;
uniform vec2 u_world;      // the frame's size in world units
uniform float u_snow;
uniform float u_litter;
uniform vec3 u_litterCol;
uniform vec4 u_fall;        // x amount, y kind (0 petals, 1 leaves, 2 snow), z drift speed
uniform vec3 u_sunCol, u_shadeCol;
uniform float u_sunK;       // how strong the sun is, 0 overcast .. 1 bright
uniform float u_lights;     // the city's lights coming on, 0 all off .. 1 all on (only once it's dark)
uniform float u_night;      // how dark it is, 0 day .. 1 night
uniform float u_dusk;       // how far into the evening, 0 day .. 1 from dusk on
// each light comes on at its own moment as u_lights rises: k (0..1) is
// its place in the queue; a quick fade, with a little flicker as it catches
float switchOn(float k) {
  float t = clamp((u_lights - k * 0.8) / 0.12, 0.0, 1.0);
  return t * mix(0.7 + 0.3 * step(0.5, fract(u_lights * 61.0 + k * 7.0)), 1.0, t);
}

${COMMON}
${GROUND}
${OVERHEAD}
${PROPS}
${EL}
${ROW}
${ROOFS}
${SNOW}
${BUILDINGS}
${BIRDS_GLSL}
${PEOPLE_GLSL}

// one layer of things falling: each cell of a drifting grid holds one,
// at its own height, with its own shadow on the court
vec4 fallLayer(vec2 p, float scale, float seed, float h, out float shadow) {
  shadow = 0.0;
  float t = u_fallT;
  // the wind blows left to right across the frame, a little down it, the
  // way the gusts roll and the trees lean
  const vec2 WIND = vec2(0.96, 0.28);
  vec2 drift = -WIND * t;
  vec2 q = (p + drift) * scale;
  // the shadow first: the same grid, offset by the sun at this height
  vec2 qs = (p - u_sun * h + drift) * scale;
  vec2 id = floor(q), ids = floor(qs);
  vec2 f = fract(q) - 0.5, fs = fract(qs) - 0.5;
  float r = hash12(id + seed), rs = hash12(ids + seed);
  float kind = u_fall.y;
  // ── where each one came from. A leaf (or petal) lives for a while: it
  //    lets go somewhere, blows downwind and lands. Each cell's leaf is
  //    born again every u_fallLife on the life clock (u_lifeT, which runs
  //    faster in a gust: they come down sooner); whether there's one this
  //    time depends on where it was born: almost never in the open, often
  //    under a crown, and more often still if a gust was blowing through
  //    the trees just then. So in a gust the extra leaves come out of the
  //    trees and stream away downwind, landing as they go. (Snow just falls.)
  float fromTree = -1.0;           // (the tree a leaf fell from)
  float life = 0.5, lifeS = 0.5;   // how far through its life, 0..1 (snow: always mid-air)
  float thr = u_fall.x, thrS = u_fall.x;
  if (kind < 1.5) {
    float L = u_fallLife;
    vec2 hb = vec2(hash12(id + seed + 11.0), hash12(ids + seed + 11.0));
    vec2 cyc = floor(u_lifeT / L + hb);
    vec2 age = fract(u_lifeT / L + hb);     // 0 born .. 1 landed
    life = age.x; lifeS = age.y;
    r = hash12(id + seed + cyc.x * 17.3); rs = hash12(ids + seed + cyc.y * 17.3);
    // (most cells have no leaf this lifetime whatever the odds below
    // come to: the most they could be, and out, before working them)
    float thrMax = u_fall.x * (u_fallTune.x + 2.4 * u_fallTune.y * (0.6 + 6.0 * u_fallTune.z));
    if (r > thrMax && rs > thrMax) return vec4(0);
    // when it was born: how far the wind has carried it since, and the
    // gust then (a short history, from JS)
    vec2 hx = histBack(age.x * L), hs = histBack(age.y * L);
    vec2 bp = (id + 0.5) / scale - drift - WIND * (t - hx.x);
    vec2 bps = (ids + 0.5) / scale - drift - WIND * (t - hs.x) + u_sun * h;
    float tr = 0.0, trS = 0.0;
    fromTree = crownId(bp);
    for (int i = 0; i < 8; i++) {
      vec3 cr = u_crown[i];
      // (in spring the cherries shed; the planes hardly at all)
      float w = kind < 0.5 ? (i == 3 || i == 6 ? 1.0 : 0.08) : 1.0;
      tr = max(tr, w * smoothstep(cr.z, cr.z * 0.55, length(bp - cr.xy)));
      trS = max(trS, w * smoothstep(cr.z, cr.z * 0.55, length(bps - cr.xy)));
    }
    // (each cell lets go one leaf a lifetime at most, so under a crown
    // it takes a good share of them: ~15% on the breeze, and a gust
    // shakes several times as many loose)
    thr = u_fall.x * (u_fallTune.x + 2.4 * u_fallTune.y * tr * (0.6 + 3.0 * u_fallTune.z * hx.y));
    thrS = u_fall.x * (u_fallTune.x + 2.4 * u_fallTune.y * trS * (0.6 + 3.0 * u_fallTune.z * hs.y));
  }
  if (r > thr && rs > thrS) return vec4(0);
  // it comes out from among the leaves, and fades as it settles on the
  // ground; snow is just there
  // (soft at the threshold too: a leaf that's only just there is faint,
  // so nothing blinks if the odds shift a touch while it's in the air)
  float fa = clamp((thr - r) / 0.03, 0.0, 1.0) * smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.82, 1.0, life));
  float fas = clamp((thrS - rs) / 0.03, 0.0, 1.0) * smoothstep(0.0, 0.18, lifeS) * (1.0 - smoothstep(0.75, 0.95, lifeS));
  // no flutter: each just rides the wind, at its own spot in its cell,
  // turning slowly as it goes
  vec2 jit = (hash22(id + seed * 3.0) - 0.5) * 0.4;
  vec2 jits = (hash22(ids + seed * 3.0) - 0.5) * 0.4;
  float spin = u_time * (0.1 + 0.2 * hash12(id + 7.0)) * (hash12(id + 8.0) > 0.5 ? 1.0 : -1.0) + r * 6.28;
  vec2 d = f - jit;
  // (petals are smaller than leaves)
  float size = kind > 1.5 ? 0.09 : (kind < 0.5 ? 0.11 : 0.16) * (1.0 - 0.25 * smoothstep(0.6, 1.0, life));
  float a;
  if (kind > 1.5) a = 1.0 - smoothstep(size * 0.6, size, length(d));
  else {
    // a leaf: long and pointed at both ends (|x|/a + (y/b)^2 = 1 has
    // curved sides that meet in a point), a little fuller at the base
    vec2 e = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * d;
    float la = size * 1.35, lb = size * 0.6 * (1.0 + 0.15 * clamp(e.x / la, -1.0, 1.0));
    float v = abs(e.x) / la + (e.y / lb) * (e.y / lb);
    a = 1.0 - smoothstep(0.7, 1.0, v);
  }
  a *= fa;
  float as = (1.0 - smoothstep(size * 0.3, size * 1.3, length(fs - jits))) * fas;
  shadow = as;
  vec3 c = kind > 1.5 ? vec3(0.97, 0.98, 1.0)
         : kind > 0.5 ? (fromTree >= 0.0 && u_autumn > 0.01
             // a leaf is the colour of the tree it fell from, or now and then a bright red
             ? mix(autumnHue(hash12(vec2(fromTree, 3.0)) + (hash12(id + 2.0) - 0.5) * 0.45), vec3(0.88, 0.14, 0.08), step(hash12(id + 21.0), 0.1))
             : mix(vec3(0.85, 0.48, 0.16), vec3(0.95, 0.75, 0.3), hash12(id + 2.0)))
         : mix(vec3(0.98, 0.86, 0.9), vec3(1.0, 0.96, 0.95), hash12(id + 2.0));
  return vec4(c, a);
}

void main() {
  vec2 uv = v_uv;
  vec2 p = uv * u_world;
  vec2 c = cf(p);

#ifndef SKIP_GROUND
  float paint;
  vec3 col = groundColor(p, paint);
#else
  float paint = 0.0; vec3 col = vec3(0.4);
#endif
  bool inFence = inFenceW(p);

  // ── what lies on the ground: leaves or petals heaped against the
  //    fence and under the trees, thin where people play; snow in drifts
#ifndef SKIP_LITTER
  float fd = min(min(abs(p.x - u_fence.x), abs(p.x - u_fence.z)), min(abs(p.y - u_fence.y), abs(p.y - u_fence.w))) / u_ft;
  float fenceNear = 1.0 - smoothstep(0.0, 6.0, fd);
  float under = crownMask(p);
  float edge = clamp(fenceNear + (inFence ? 0.0 : 0.5) + under * 0.6, 0.0, 1.0);
  vec2 lg = p * 85.0;
  vec2 lid = floor(lg), lf = fract(lg) - 0.5;
  float la = hash12(lid + 5.0) * 6.283;
  vec2 lo = mat2(cos(la), -sin(la), sin(la), cos(la)) * (lf - (hash22(lid) - 0.5) * 0.4);
  float heap = smoothstep(0.5, 0.75, fbm(p * 4.0 + 7.0));
  float gather = u_litter * clamp(edge * 0.8 + heap * 0.5 - 0.12, 0.0, 1.0);
  float leaf = (1.0 - smoothstep(0.16, 0.24, length(lo * vec2(1.0, 1.9)))) * step(hash12(lid), gather);
  // in autumn the leaves lying near a tree are that tree's colours (each
  // leaf a little its own way), with now and then a bright red one blown
  // in; away from the trees, and once snow's down, the season's colour
  vec3 lc = u_litterCol;
  float au = u_autumn * (1.0 - u_snow);
  if (au > 0.01) {
    float ti = crownId(p);
    vec3 cr = u_crown[int(ti)];
    // (fully the tree's near it, still mostly so a few crowns away)
    float nearT = mix(0.6, 1.0, 1.0 - smoothstep(0.8, 3.0, length(p - cr.xy) / cr.z));
    vec3 th = autumnHue(hash12(vec2(ti, 3.0)) + (hash12(lid + 9.0) - 0.5) * 0.45) * 0.88;
    lc = mix(lc, th, nearT * au);
    lc = mix(lc, vec3(0.86, 0.13, 0.08), step(hash12(lid + 21.0), 0.1) * au);
  }
  col = mix(col, lc * (0.75 + 0.5 * hash12(lid + 3.0)), leaf * 0.9);
#else
  float fenceNear = 0.0, edge = 0.0;
#endif

  // ── spring: petals drifted where the wind has left them, in a fine
  //    pink-white scatter thickening into drifts: a carpet under each
  //    cherry, heaviest downwind; along the gutters (the far kerb most,
  //    the wind blowing across the street); against the fence
#ifndef SKIP_PETALS
  if (u_blossom > 0.01) {
    float pd = 0.0;
    for (int i = 3; i <= 6; i += 3) {
      vec3 cr = u_crown[i];
      vec2 dc = (p - cr.xy - vec2(cr.z * 0.6, 0.0)) / (cr.z * vec2(2.3, 1.5));
      pd = max(pd, (1.0 - smoothstep(0.2, 1.0, length(dc))) * 0.35);
    }
    if (u_street.x < 8.0) {
      float g0 = (p.x - u_street.x) / u_ft, g1 = (u_street.y - p.x) / u_ft;
      float roadY = step(u_el.x + u_walk.y, p.y);
      pd = max(pd, roadY * (1.0 - smoothstep(0.3, 1.6, g1)) * step(0.0, g1) * 1.0);
      pd = max(pd, roadY * (1.0 - smoothstep(0.2, 1.2, g0)) * step(0.0, g0) * 0.65);
      float gk = (u_el.x + u_walk.y - p.y) / u_ft;
      pd = max(pd, (1.0 - smoothstep(0.2, 1.3, gk)) * step(0.0, gk) * step(p.x, u_street.x) * 0.7);
    }
    pd = max(pd, fenceNear * 0.2);
    // (in clumps and windrows, not an even sprinkle)
    pd *= smoothstep(0.2, 0.62, fbm3(p * 14.0 + 4.0)) * 1.6;
    pd = clamp(pd, 0.0, 1.0) * u_blossom;
    // a faint blush where they lie thickest, and the petals themselves,
    // two sizes, each turned its own way
    col = mix(col, vec3(0.86, 0.66, 0.72), smoothstep(0.25, 0.9, pd) * 0.5);
    for (int k = 0; k < 2; k++) {
      float sc = k == 0 ? 115.0 : 190.0;
      vec2 pg = p * sc + float(k) * 17.0;
      vec2 pid = floor(pg), pf = fract(pg) - 0.5;
      float an = hash12(pid + 2.0) * 6.283;
      vec2 po = mat2(cos(an), -sin(an), sin(an), cos(an)) * (pf - (hash22(pid + 5.0) - 0.5) * 0.45);
      float pt = (1.0 - smoothstep(0.13, 0.22, length(po * vec2(1.0, 1.5)))) * step(hash12(pid + 9.0), pd * (k == 0 ? 0.95 : 0.7));
      vec3 pc = mix(vec3(0.86, 0.6, 0.7), vec3(0.94, 0.8, 0.84), hash12(pid + 1.0));
      col = mix(col, pc, pt * 0.92);
    }
  }
#endif

#ifndef SKIP_SNOW
  float drift = fbm(p * 2.2 + 2.0) * 0.8 + edge * 0.6 - 0.6 + u_snow * 0.5;
  float snow = smoothstep(0.3, 0.62, drift) * smoothstep(0.0, 0.15, u_snow);
  snow = max(snow, u_snow * 0.28 * (0.6 + 0.4 * fbm3(p * 18.0)));
  snow = max(snow, u_snow * (inFence ? 0.0 : 0.97));
  snow *= 1.0 - plowed(p) * 0.9;
  if (snow > 0.001) {
    // the sidewalks shovelled, banks thrown up either side; the trodden path
    float bank, foot;
    float clear = shovelled(p, bank);
    float path = parkPath(p, foot);
    snow *= 1.0 - clear * 0.7;
    snow = max(snow, bank * u_snow);
    // the cleared paving is wet: darker
    col *= 1.0 - clear * u_snow * 0.1;
    // ── melting (and settling, on the way in): as the snow goes it goes
    //    in patches, thin open ground first, the deep drifts and the
    //    banks last, until the last of it is gone
    float melt = clamp(u_snow / 0.85, 0.0, 1.0);
    float holdOn = fbm3(p * 9.0 + 3.0) * 0.55 + vnoise(p * 40.0) * 0.15 - snow * 0.35;
    snow *= smoothstep(holdOn, holdOn + 0.18, melt * 1.05) * smoothstep(0.0, 0.1, melt);
    col = mix(col, snowColor(p, foot, path), snow);
  }
  // the ground it's left behind is wet for a while, darker in patches
  float wet = smoothstep(0.0, 0.25, u_snow) * (1.0 - smoothstep(0.55, 0.85, u_snow));
  col *= 1.0 - wet * 0.14 * smoothstep(0.35, 0.65, fbm3(p * 6.0 + 1.0)) * (1.0 - snow);
#endif

  // ── the light: one low sun, and everything above throws its shadow
#ifndef SKIP_TREESH
  float shTree = max(crownShadow(p, u_sun), trunkShadow(p, u_sun) * 0.85);
  // the branches' shadows, wherever the leaves are thin enough to let
  // them show, and on their own in winter
  shTree = max(shTree, branches(p - u_sun * 22.0 * u_ft + swayAt(p)) * smoothstep(0.2, 0.9, 1.0 - u_density) * 0.85);
#else
  float shTree = 0.0;
#endif
#ifndef SKIP_PROPSH
  float shadow = max(shTree * 0.92, max(hoopShadow(p) * 0.85, fenceShadow(p) * 0.8));
  shadow = max(shadow, max(benchShadow(p), lampShadow(p) * 0.45));
  shadow = max(shadow, max(elShadow(p) * 0.88, carShadow(p)));
  // (lamp shadows kept light: a thin post shouldn't out-shadow a tree)
  shadow = max(shadow, streetLightShadow(p) * 0.53);
#else
  float shadow = shTree;
#endif
#ifndef SKIP_LIFESH
  shadow = max(shadow, birdShadow(p));
  // (kept light: they should read as people, not draw the eye)
  shadow = max(shadow, peopleShadow(p) * 0.5);
#endif
  shadow *= u_sunK;
  col = mix(col * u_sunCol, col * u_shadeCol, shadow);

  // ── things standing on the ground
#ifndef SKIP_PROPS
  vec3 bc;
  float ba = benchShape(p, bc);
  col = mix(col, bc * mix(u_shadeCol, u_sunCol, 0.8), ba);
  col = mix(col, vec3(0.07, 0.08, 0.08), fenceShape(p) * 0.92);
  col = mix(col, vec3(0.09, 0.1, 0.1), lampShape(p));
  vec3 slc;
  float sla = streetLight(p, slc);
  col = mix(col, slc * mix(u_shadeCol, u_sunCol, 0.7), sla);
  vec3 hc;
  float ha = hoopShape(c, hc);
  col = mix(col, hc * mix(u_shadeCol, u_sunCol, 0.85), ha);
#endif
  // the soft dark right under everything alive, whatever the weather
#ifndef SKIP_LIFE
#ifndef SKIP_CONTACT
  float contact = max(peopleContact(p), birdContact(p));
  col = mix(col, col * u_shadeCol / max(u_sunCol, vec3(0.05)) * 0.9, contact * mix(0.3, 0.42, u_sunK));
#endif
#ifndef SKIP_BIRDSG
  // the pigeons on the ground
  vec4 pg = birdsAt(p, false);
  col = mix(col, pg.rgb * mix(u_shadeCol, u_sunCol, 0.85), pg.a);
#endif
#ifndef SKIP_PEOPLE
  // and the people, out walking, or sitting on a bench
  vec4 pp = peopleAt(p);
  col = mix(col, pp.rgb * mix(u_shadeCol, u_sunCol, 0.85), pp.a);
#endif
  vec4 bb = ballAt(p);
  col = mix(col, bb.rgb * mix(u_shadeCol, u_sunCol, 0.9), bb.a);
#endif

  // ── the street's cars and the brownstones' stoops
#ifndef SKIP_CARS
  vec3 kc;
  float ka = carShape(p, kc);
  col = mix(col, kc * mix(u_shadeCol, u_sunCol, 0.9), ka);
#endif
  // the houses' frontage on the walk: stoops, areaways and bins, the
  // deli's awning, and their shadows
#ifndef SKIP_FRONT
  vec3 fc; float fsh;
  float fa = frontage(p, fc, fsh);
  // (part sun shadow, part the soft dark right under things: there even on a grey day)
  col = mix(col, col * u_shadeCol / max(u_sunCol, vec3(0.05)) * 0.9, fsh * mix(0.55, 0.85, u_sunK));
  col = mix(col, fc * mix(u_shadeCol, u_sunCol, 0.9), fa);
  // the bus stop: its shelter and sign, and their shadows
  vec3 bsc; float bsh, bsg;
  float bsa = busStop(p, bsc, bsh, bsg);
  col = mix(col, col * u_shadeCol / max(u_sunCol, vec3(0.05)), bsh * u_sunK);
  col = mix(col, bsc * mix(u_shadeCol, u_sunCol, 0.9), bsa);
  col += vec3(1.0, 0.85, 0.65) * bsg * 0.35 * max(u_dusk * 0.6, u_night);
  // the Christmas lights on the stoops: coloured dots by day, glowing at night
  col += fEmit * (0.25 + 0.75 * fOn);
#endif

  // ── the row, leaning a touch away from the middle so its fronts show:
  //    lit fronts, roofs in their own shadows, snow lying on them in winter
#ifndef SKIP_BUILD
  vec4 bl = buildingSoft(p);
  if (bl.a > 0.0) col = mix(col, bl.rgb / bl.a, bl.a);
#endif

  // ── overhead: trunks and limbs (seen when the leaves are thin), then
  //    the crowns
#ifndef SKIP_TREES
  vec2 q = p + swayAt(p);
  float bare = 1.0 - u_density;
  // plane bark is pale and mottled; the limbs read darker against snow
  col = mix(col, vec3(0.62, 0.58, 0.5) * u_sunCol, trunkShape(p) * smoothstep(0.3, 0.9, bare));
  // the limbs show through the gaps in the crown in every season, and
  // carry the whole tree in winter
  // plane bark: pale and mottled, darker in the crotches
  float bw = branches(q);
  if (bw > 0.001) {
    vec3 bark = mix(vec3(0.3, 0.27, 0.23), vec3(0.46, 0.43, 0.38), smoothstep(0.3, 0.7, fbm3(q * 120.0)));
    col = mix(col, bark * u_sunCol, bw * 0.95);
  }
  vec4 cc = crownColor(q, u_sunCol);
  // (at night the leaves fall into the dark with everything else, lit
  // only from below by the lamps)
  // (and as the light goes at dusk, they go with it, not staying day-bright)
  float sunLum = min(1.0, dot(u_sunCol, vec3(0.34)));
  vec3 leafLight = mix(mix(vec3(sunLum), u_sunCol, 0.5), u_sunCol * 0.8, u_night);
  col = mix(col, cc.rgb * leafLight, cc.a);
#else
  vec2 q = p; vec4 cc = vec4(0.0);
#endif

  // ── the el, above the street, and a train if one is passing
#ifndef SKIP_EL
  vec3 ec;
  float ea = elShape(p, ec);
  ec = mix(ec, vec3(0.93, 0.94, 0.96), u_snow * 0.7 * step(0.5, ea) * smoothstep(0.4, 0.6, fbm3(p * 90.0)));
  col = mix(col, ec * u_sunCol, ea);
  vec3 tc;
  float ta = trainShape(p, tc);
  // stainless steel reflects the sky as much as it takes the sun's colour
  // (at night it goes dark with everything else: a dull sheen of moonlight)
  col = mix(col, tc * mix(vec3(min(1.0, dot(u_sunCol, vec3(0.34)))), u_sunCol, 0.35), ta);
#else
  float ea = 0.0, ta = 0.0;
#endif

  // ── falling: two layers at different heights
#ifndef SKIP_FALL
  if (u_fall.x > 0.001) {
    float s1, s2;
    vec4 f1 = fallLayer(p, 26.0, 1.0, 0.25, s1);
    vec4 f2 = fallLayer(p, 40.0, 9.0, 0.12, s2);
    col = mix(col, col * u_shadeCol / max(u_sunCol, 0.01), max(s1, s2) * 0.35 * u_sunK);
    // (they fall beneath the canopy: under a crown you only glimpse them
    // through its gaps, and they come out from under its edge)
    // (by the crown's overall shape, not its ragged swaying fringe, so a
    // leaf passing out from under it doesn't flicker through the gaps)
    float under = 1.0 - 0.9 * smoothstep(0.15, 0.7, crownMask(q)) * smoothstep(0.1, 0.5, u_density) * step(u_fall.y, 1.5);
    // (snow comes down from above them all, so it isn't hidden)
    col = mix(col, f2.rgb * u_sunCol, f2.a * 0.85 * under);
    col = mix(col, f1.rgb * u_sunCol, f1.a * 0.95 * under);
  }
#endif

  // ── the pigeons in the air, over everything below the el
#ifndef SKIP_AIR
  vec4 pa = birdsAt(p, true);
  col = mix(col, pa.rgb * mix(u_shadeCol, u_sunCol, 0.9), pa.a * (1.0 - max(ea, ta)));
#endif

  // ── clouds: big soft shadows drifting over everything, now and then.
  //    Some minutes it's clear, some it's broken cloud; never overcast
#ifndef SKIP_CLOUD
  float ct = u_time * 0.011;
  vec2 cq = p * 0.9 + vec2(ct, ct * 0.35);
  float cover = 0.56 - 0.16 * (0.5 + 0.5 * sin(u_time * 0.021 + 1.3)) * (0.5 + 0.5 * sin(u_time * 0.0067));
  float cloud = smoothstep(cover, cover + 0.22, fbm(cq + fbm(cq * 1.7 + 4.0) * 0.6));
  col = mix(col, col * u_shadeCol / max(u_sunCol, vec3(0.05)), cloud * 0.5 * u_sunK * (1.0 - shadow * 0.85));
#endif

  // ── the city's lights, once the sun's down: warm pools under the park
  //    lamps and the street lights, the deli's cooler glow on the walk
  // (the deli's lights and the trains' are on before dark: a little at dusk)
#ifndef SKIP_LIGHTS
  float shopOn = max(switchOn(0.1), u_dusk * 0.45);
  if (u_lights > 0.001 || u_dusk > 0.01) {
    vec3 warm = vec3(1.0, 0.72, 0.42);
    float pool = 0.0;
    float onL[2] = float[](switchOn(0.05), switchOn(0.55));
    float onS[6] = float[](switchOn(0.2), switchOn(0.7), switchOn(0.35), switchOn(0.0), switchOn(0.9), switchOn(0.45));
    for (int i = 0; i < 2; i++) { float d = length(p - u_lamp[i]) / (15.0 * u_ft); pool += (exp(-d * d) + 0.25 * exp(-d * 3.0)) * onL[i]; }
    // (the light comes from each street light's head, out over the road)
    vec2 sl[6] = vec2[](slHead(0), slHead(1), slHead(2), slHead(3), slHead(4), slHead(5));
    for (int i = 0; i < 6; i++) { float d = length(p - sl[i]) / (15.0 * u_ft); pool += (exp(-d * d) + 0.25 * exp(-d * 3.0)) * onS[i]; }
    // the street lights' heads: a small bright core
    float core = 0.0;
    for (int i = 0; i < 6; i++) core = max(core, (1.0 - smoothstep(0.3, 1.0, length(p - sl[i]) / u_ft)) * onS[i]);
    for (int i = 0; i < 2; i++) core = max(core, (1.0 - smoothstep(0.3, 1.0, length(p - u_lamp[i]) / u_ft)) * onL[i]);
    // and the headlights of anything coming up the street
    pool += carLights(p) * 0.8 * max(u_dusk, u_night);
    vec2 deli = vec2(u_rowX - 6.0 * u_ft, u_lots[0].x + 9.5 * u_ft);
    // the deli: cold white-blue fluorescent light, spilling wide across the walk
    float shop = exp(-dot((p - deli) * vec2(1.0, 0.7), (p - deli) * vec2(1.0, 0.7)) / pow(9.5 * u_ft, 2.0));
    // under a crown the leaves catch the light from below, but less
    // the el and the train are 30 ft up, above the lamps: they don't catch it
    float above = 1.0 - max(ea, ta);
    vec3 light = above * (warm * pool * 1.5 + vec3(0.6, 0.8, 1.2) * shop * 0.85 * shopOn) * (1.0 - cc.a * 0.6);
    core *= (1.0 - cc.a) * above;
    // (the light lands on what's there: bright on snow, but held from
    // blowing out, and a little straight glow in the air)
    // (partly evened out, so a pool reads round across dark road and
    // bright snow alike rather than picking out the kerb's banks)
    col += light * (0.05 + mix(min(col, vec3(0.3)), vec3(0.17), 0.5) * 2.6);
    col = mix(col, vec3(1.0, 0.9, 0.7), core);
  }
#endif

  // ── a train at night: its windows' light along both sides of each car,
  //    on the deck and the ties and down through to the street, and a
  //    lit edge along its roof
  float trainK = max(u_night, u_dusk * 0.4);
  if (trainK > 0.01) {
    float rim;
    float tg = trainGlow(p, rim);
    vec3 fl = vec3(1.0, 0.82, 0.58);   // a warm interior glow
    col += fl * tg * (0.07 + min(col, vec3(0.25)) * 2.8) * trainK;
    col = mix(col, fl * 0.6, rim * ta * 0.4 * trainK);
  }

  o = vec4(col, 1.0);
}
`;
