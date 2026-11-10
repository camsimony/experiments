/* ══ Snow ═════════════════════════════════════════════════
   Not a white sheet: a surface. It lies in soft drifts and hollows, so
   the low sun lights the crests and leaves the hollows a pale blue, and
   a few crystals glint. It banks up against the fence, and where people
   have been it's been changed: the sidewalks shovelled down the middle
   (the wet paving showing, the snow thrown up in banks either side), and
   a trodden path from the court's gate off across the park, packed
   greyer and pocked with footprints. */

export const SNOW = /* glsl */ `
// the sidewalks, shovelled: 1 down the cleared strip, 0 off it; and
// through bank, how much snow's been thrown up along its edges
float shovelled(vec2 p, out float bank) {
  bank = 0.0;
  float v = p.y - u_el.x, elHalf = u_walk.y, walk = u_walk.x;
  float d = 99.0;   // ft from the walk's middle
  if (v > elHalf && v < elHalf + walk) d = abs(v - elHalf - walk * 0.5) / u_ft;
  if (v > elHalf + walk && p.x > u_street.x - walk && p.x < u_street.x) d = min(d, abs(p.x - u_street.x + walk * 0.5) / u_ft);
  if (v > elHalf + walk && p.x > u_street.y && p.x < u_street.y + walk) d = min(d, abs(p.x - u_street.y - walk * 0.5) / u_ft);
  if (d > 50.0) return 0.0;
  float wob = (vnoise(p * 60.0) - 0.5) * 0.8 + (vnoise(p * 9.0) - 0.5) * 0.8;
  bank = smoothstep(1.4, 2.2, d + wob) * (1.0 - smoothstep(2.4, 3.8, d + wob));
  // not bare: a thin scraped layer left, patchy
  return (1.0 - smoothstep(0.9, 1.6, d + wob)) * mix(0.55, 0.85, vnoise(p * 80.0));
}

// a path trodden from the gate off across the park, wandering; returns
// 1 on it, and through foot, a footprint
float parkPath(vec2 p, out float foot) {
  foot = 0.0;
  vec2 g = vec2(u_fence.x, u_gate.y);
  if (p.x > g.x) return 0.0;
  float x = (g.x - p.x) / u_ft;   // ft out from the gate
  float yc = g.y + (sin(x * 0.045) * 7.0 + x * 0.22) * u_ft;
  float d = abs(p.y - yc) / u_ft;
  float on = 1.0 - smoothstep(1.6, 2.6, d + (vnoise(p * 50.0) - 0.5));
  // footprints, left and right, a stride apart, a little scattered
  float k = floor(x / 1.25);
  float side = mod(k, 2.0) < 1.0 ? -0.55 : 0.55;
  vec2 fp = vec2((k + 0.5) * 1.25 + (hash12(vec2(k, 2.0)) - 0.5) * 0.3, side + (hash12(vec2(k, 5.0)) - 0.5) * 0.4);
  vec2 q = vec2(x, (p.y - yc) / u_ft) - fp;
  foot = (1.0 - smoothstep(0.25, 0.45, length(q * vec2(0.7, 1.6)))) * on;
  return on;
}

float snowH(vec2 p) {
  // drifts, ripples and the snow against the fence, windward side
  // long wind-ripples across the open snow, drifts, and fine texture
  vec2 wq = mat2(0.8, -0.6, 0.6, 0.8) * p;
  float h = fbm3(p * 5.0 + 1.7) * 0.55 + fbm3(p * 18.0 + 5.0) * 0.3;
  h += sin(wq.x * 70.0 + fbm3(p * 6.0) * 6.0) * 0.05;
  vec2 fc = vec2(u_fence.x + u_fence.z, u_fence.y + u_fence.w) * 0.5;
  vec2 fh = vec2(u_fence.z - u_fence.x, u_fence.w - u_fence.y) * 0.5;
  float fd = boxDist(p, fc, fh) / u_ft;   // ft outside the fence
  h += (1.0 - smoothstep(0.0, 4.0, fd)) * step(0.0, fd) * 0.5;
  return h;
}

// the snow's colour: lit on its crests, blue in its hollows, glinting
vec3 snowColor(vec2 p, float foot, float packed) {
  float e = 0.004;
  float h0 = snowH(p);
  vec2 g = vec2(snowH(p + vec2(e, 0.0)) - h0, snowH(p + vec2(0.0, e)) - h0) / e;
  vec3 n = normalize(vec3(-g * 0.075, 1.0));
  vec3 L = normalize(vec3(-normalize(u_sun), 0.55));
  float lit = clamp(dot(n, L), 0.0, 1.0);
  float flat_ = clamp(dot(vec3(0.0, 0.0, 1.0), L), 0.0, 1.0);
  float rel = mix(1.0, lit / max(flat_, 0.05), 0.85 * u_sunK);
  vec3 c = mix(vec3(0.8, 0.86, 0.97), vec3(1.0, 0.99, 0.97), clamp(rel * 0.55, 0.0, 1.0)) * mix(0.96, 1.04, clamp(rel - 0.6, 0.0, 1.0));
  // packed where people have walked: greyer, flatter, the prints darker
  c = mix(c, vec3(0.8, 0.82, 0.87), packed * 0.75);
  c = mix(c, vec3(0.6, 0.66, 0.8), foot * 0.7);
  // a few crystals catching the sun, twinkling
  vec2 gi = floor(p * 520.0);
  float gl = step(0.9965, hash12(gi)) * (0.5 + 0.5 * sin(u_time * 2.5 + hash12(gi + 3.0) * 40.0));
  c += vec3(0.35) * gl * u_sunK * (1.0 - packed);
  return c;
}
`;
