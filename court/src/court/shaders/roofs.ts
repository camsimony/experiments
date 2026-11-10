/* ══ Rooftops ═════════════════════════════════════════════
   What you mostly see of a brownstone from above is its roof, so that's
   where the detail goes: each object on it is a box with a height, lit
   along the edge facing the sun and throwing its shadow across the roof.
   Stair bulkheads, chimneys with clay flue pots, skylights, hatches,
   AC condensers with their fans, vent pipes, a satellite dish, and on
   one roof a deck with planters. Under them: tar, silver coat or grey
   membrane, laid in strips, patched, stained where water stands.

   r is in feet: r.x back from the front wall, r.y across the lot. */

export const ROOFS = /* glsl */ `
float roofShade;   // how much of the roof here is in its own shadow

// a box on the roof: draw its top (lit edge toward the sun) or, if r is
// just beyond it, down-sun, its shadow
void roofBox(vec2 r, vec2 c, vec2 s, float h, vec3 top, inout vec3 col) {
  vec2 sun = u_sun;
  float sh = 1.0 - smoothstep(-0.2, 0.25, boxDist(r - sun * h, c, s));
  float d = boxDist(r, c, s);
  float inside = 1.0 - smoothstep(-0.12, 0.08, d);
  roofShade = max(roofShade, sh * (1.0 - inside));
  vec2 e = (r - c) / s;
  vec2 n = abs(e.x) > abs(e.y) ? vec2(sign(e.x), 0.0) : vec2(0.0, sign(e.y));
  float edge = smoothstep(-0.55, -0.05, d) * dot(n, -normalize(sun));
  col = mix(col, top * (1.0 + edge * 0.3), inside);
}
void roofDisc(vec2 r, vec2 c, float rad, float h, vec3 top, inout vec3 col) {
  vec2 sun = u_sun;
  float sh = 1.0 - smoothstep(rad - 0.15, rad + 0.2, length(r - sun * h - c));
  float d = length(r - c) - rad;
  float inside = 1.0 - smoothstep(-0.1, 0.06, d);
  roofShade = max(roofShade, sh * (1.0 - inside));
  float lit = dot(normalize(r - c + 1e-4), -normalize(sun)) * smoothstep(-rad * 0.6, 0.0, d);
  col = mix(col, top * (1.0 + lit * 0.3), inside);
}

vec3 roofColor(vec4 L, float i, vec2 r, float w, float hPrev, float h) {
  roofShade = 0.0;
  float k = hash12(vec2(i, 2.0)), k2 = hash12(vec2(i, 9.0)), k3 = hash12(vec2(i, 13.0));
  vec2 q = r * u_ft;   // world-ish, for noise
  // ── the surface
  vec3 c;
  if (k < 0.15) {
    // tar: near black, gravel speckle, glossy patches
    c = vec3(0.24, 0.23, 0.23) * (0.85 + 0.25 * fbm(r * 0.4 + i));
    c += (hash12(floor(r * 6.0) + i) - 0.5) * 0.05;
    c = mix(c, vec3(0.11, 0.11, 0.12), smoothstep(0.55, 0.62, fbm3(r * 0.15 + i * 3.0)) * 0.8);
  } else if (k < 0.8) {
    // silver coat, brushed on in strokes along the lot, gone grey in places
    c = vec3(0.76, 0.76, 0.75) * (0.92 + 0.08 * vnoise(vec2(r.x * 0.1, r.y * 0.6) + i));
    c = mix(c, vec3(0.5, 0.5, 0.5), smoothstep(0.5, 0.8, fbm(r * 0.15 + i)) * 0.35);
  } else {
    // membrane in strips across the lot, seams just showing
    c = vec3(0.56, 0.53, 0.48) * (0.88 + 0.2 * fbm(r * 0.3 + i));
    c *= 1.0 - (1.0 - smoothstep(0.0, 0.1, abs(fract(r.x / 3.2) - 0.5) - 0.45)) * 0.18;
  }
  // water stains: soft rings where puddles stood
  float st = fbm3(r * 0.12 + i * 5.0);
  c *= 1.0 - (1.0 - smoothstep(0.0, 0.03, abs(st - 0.6))) * 0.12;

  // ── a roof deck on one house: boards, planters along the edge, chairs
  bool deck = L.w < 0.5 && k2 > 0.62;
  if (deck) {
    vec2 dc = vec2(9.0, w * 0.5);
    float on = 1.0 - smoothstep(0.0, 0.1, boxDist(r, dc, vec2(6.0, w * 0.5 - 2.2)));
    vec3 wood = vec3(0.5, 0.36, 0.24) * (0.85 + 0.2 * hash12(vec2(floor(r.y / 0.5), i)));
    wood *= 1.0 - (1.0 - smoothstep(0.0, 0.06, abs(fract(r.y / 0.5) - 0.5) - 0.42)) * 0.3;
    c = mix(c, wood, on);
    for (int j = 0; j < 4; j++) {
      vec2 pc = vec2(3.6 + float(j) * 3.6, w - 2.8);
      roofBox(r, pc, vec2(1.3, 0.7), 2.0, vec3(0.42, 0.28, 0.2), c);
      float plant = 1.0 - smoothstep(0.6, 1.1, length((r - pc) * vec2(0.8, 1.2)) + (vnoise(r * 4.0) - 0.5) * 0.5);
      c = mix(c, mix(vec3(0.2, 0.32, 0.14), vec3(0.4, 0.5, 0.2), vnoise(r * 6.0)) * mix(1.0, 0.6, u_snow), plant * step(0.15, u_density));
    }
    roofBox(r, vec2(8.0, w * 0.4), vec2(0.9, 0.9), 2.5, vec3(0.75, 0.74, 0.7), c);
    roofBox(r, vec2(10.4, w * 0.45), vec2(0.9, 0.9), 2.5, vec3(0.75, 0.74, 0.7), c);
  }

  // ── the things on every roof
  // stair bulkhead: brick box, tar top, its door facing the front
  vec2 bh = vec2(deck ? 20.0 : 13.0 + 8.0 * k3, w * (0.25 + 0.15 * k2));
  roofBox(r, bh, vec2(3.6, 2.8), 8.0, vec3(0.24, 0.23, 0.22), c);
  // chimney, against a party wall, with two or three clay flue pots
  vec2 ch = vec2(5.0 + 14.0 * fract(k * 7.0), 1.6);
  roofBox(r, ch, vec2(1.6, 1.0), 4.0, vec3(0.45, 0.26, 0.19), c);
  for (int j = 0; j < 3; j++) {
    if (float(j) > 1.0 + k3) break;
    roofDisc(r, ch + vec2(-0.9 + float(j) * 0.9, 0.0), 0.36, 5.0, vec3(0.62, 0.36, 0.24), c);
    c = mix(c, vec3(0.12), (1.0 - smoothstep(0.08, 0.25, length(r - ch - vec2(-0.9 + float(j) * 0.9, 0.0)))) * 0.7);
  }
  // skylight over the stairs: wired glass, a frame
  if (!deck || k3 > 0.5) {
    vec2 sk = vec2(bh.x - 6.0, w * 0.68);
    float g = 1.0 - smoothstep(-0.1, 0.05, boxDist(r, sk, vec2(2.0, 1.6)));
    roofBox(r, sk, vec2(2.2, 1.8), 1.0, vec3(0.5, 0.5, 0.5), c);
    vec3 glass = mix(vec3(0.32, 0.4, 0.46), vec3(0.72, 0.78, 0.8), smoothstep(-1.6, 1.6, r.y - sk.y) * 0.8);
    glass *= 1.0 - (1.0 - smoothstep(0.0, 0.06, abs(fract((r.x - sk.x) * 0.9) - 0.5) - 0.42)) * 0.3;
    c = mix(c, glass, g);
  }
  // AC condenser: pale box, a dark round fan grille
  if (k2 > 0.5) {
    vec2 ac = vec2(4.0 + 8.0 * k2, w * 0.5 + (k3 - 0.5) * w * 0.4);
    roofBox(r, ac, vec2(1.5, 1.5), 3.0, vec3(0.72, 0.72, 0.7), c);
    float fan = length(r - ac);
    c = mix(c, vec3(0.3, 0.3, 0.31), (1.0 - smoothstep(0.7, 1.15, fan)) * 0.7);
  }
  // galvanised hatch, vent pipes, a satellite dish
  if (k3 > 0.6) roofDisc(r, vec2(3.0, w - 3.2), 0.9, 1.5, vec3(0.86, 0.86, 0.84), c);

  // ── the parapets: brick, with a pale stone coping, on the front and
  //    along each party wall
  float pd = min(min(r.y, w - r.y), r.x);
  float par = 1.0 - smoothstep(0.7, 0.9, pd);
  vec3 brick = vec3(0.46, 0.28, 0.2) * (0.85 + 0.2 * vnoise(r * 3.0));
  vec3 cope = vec3(0.7, 0.66, 0.6) * (0.9 + 0.1 * vnoise(r * 2.0));
  c = mix(c, mix(brick, cope, 1.0 - smoothstep(0.25, 0.45, abs(pd - 0.4))), par);
  // their shadow inside them, the side away from the sun
  float lee = max(1.0 - smoothstep(0.9, 0.9 + u_sun.x * 3.0, r.x), 1.0 - smoothstep(0.9, 0.9 + u_sun.y * 3.0, r.y));
  roofShade = max(roofShade, lee * (1.0 - par));
  // a taller neighbour on the up-sun side throws its shadow across
  if (hPrev > h) roofShade = max(roofShade, 1.0 - smoothstep(0.0, 0.6, r.y - (hPrev - h) * u_sun.y));
  return c;
}
`;
