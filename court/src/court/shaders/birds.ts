/* ══ Birds: the pigeons, from above ════════════════════════
   Simulated in pigeons.ts; here each is drawn from its position, heading
   and height. On the ground a pigeon from above is a soft grey oval, a
   small dark head in front (bobbing as it walks, dipping as it pecks),
   the fan of its tail behind, two black bars across the folded wings. In
   the air its wings come out either side, longer as they sweep through
   the middle of a beat, shorter at the top and bottom of it, held out
   flat in a glide. Each throws its shadow, further off the higher it is. */

export const BIRDS_GLSL = /* glsl */ `
uniform vec4 u_bird[9];    // x, y (world), heading, height (ft)
uniform vec4 u_birdB[9];   // wing (0 folded .. 1 out), cos(flap), head bob, variant
// 1: the softer, rounder drawing of everything alive (0: flat cut-outs);
// fixed when the shader's built, so only one drawing is compiled in
#ifdef FLAT_LIFE
const float u_life = 0.0;
#else
const float u_life = 1.0;
#endif

// a pigeon's sun, in its frame, and its own seed (set before drawing each)
vec2 bSun = vec2(0.0); float bSeed = 0.0;

// one pigeon in its own frame, feet: x forward, y to its left
float pigeon(vec2 l, float wing, float flapC, float bob, float v, out vec3 col) {
  vec3 body = v < 0.5 ? vec3(0.55, 0.58, 0.64) : v < 1.5 ? vec3(0.34, 0.36, 0.4)
            : v < 2.5 ? vec3(0.9, 0.9, 0.87) : vec3(0.56, 0.46, 0.42);
  vec3 head = v < 2.5 ? (v > 1.5 ? vec3(0.86, 0.86, 0.84) : vec3(0.33, 0.36, 0.42)) : vec3(0.46, 0.37, 0.34);
  vec3 dark = v > 1.5 && v < 2.5 ? vec3(0.75, 0.75, 0.73) : vec3(0.17, 0.18, 0.21);
  // body, head and tail (the body's outline not quite an ellipse: a
  // little fuller one side, as a bird's is)
  vec2 bq = (l - vec2(-0.05, 0.0)) / vec2(0.56, 0.27);
  float wob = (vnoise(l * 6.0 + bSeed * 9.1) - 0.5) * 0.16 * u_life;
  float b = 1.0 - smoothstep(mix(0.78, 0.7, u_life), 1.05, length(bq) * (1.0 + wob));
  vec2 hc = vec2(0.56 + bob * 0.12, 0.0);
  float h = 1.0 - smoothstep(mix(0.12, 0.09, u_life), 0.2, length(l - hc));
  float tw = 0.11 + 0.08 * clamp(-(l.x + 0.45) / 0.45, 0.0, 1.0);
  float t = (1.0 - smoothstep(0.75, 1.0, abs(l.y) / tw)) * step(l.x, -0.35) * (1.0 - smoothstep(0.88, 0.98, -l.x));
  col = body;
  // the body's a dome: lit toward the sun, shaded away, darker at the
  // rim; and the feathers a little uneven
  float r2 = min(dot(bq, bq), 1.0);
  col *= mix(1.0, (0.98 + 0.22 * dot(bq, bSun) * sqrt(1.0 - r2 * 0.6)) * (1.0 - 0.15 * r2 * r2) * (0.94 + 0.12 * vnoise(l * 7.0 + bSeed * 5.0)), u_life);
  // the folded wings: two dark bars across them (soft, from up here),
  // the dark primaries crossed over the tail; a checker's wings speckled;
  // the neck's sheen
  float bw = mix(0.05, 0.11, u_life), bs = mix(1.0, 0.7, u_life);
  if (v < 0.5) col = mix(col, dark, (1.0 - smoothstep(0.02, bw, abs(l.x + 0.24))) * (1.0 - smoothstep(0.18, 0.26, abs(l.y))) * (1.0 - wing) * bs);
  if (v < 0.5) col = mix(col, dark, (1.0 - smoothstep(0.02, bw, abs(l.x + 0.08))) * (1.0 - smoothstep(0.2, 0.28, abs(l.y))) * (1.0 - wing) * bs);
  if (v > 0.5 && v < 1.5) col = mix(col, vec3(0.52, 0.55, 0.6), smoothstep(0.45, 0.65, vnoise(l * 9.0 + bSeed)) * 0.6);
  col = mix(col, dark * 1.4, smoothstep(-0.38, -0.5, l.x) * (1.0 - wing) * step(v, 1.5) * 0.7);
  col = mix(col, mix(vec3(0.3, 0.5, 0.42), vec3(0.5, 0.36, 0.55), step(0.0, l.y)), (1.0 - smoothstep(0.0, 0.1, abs(l.x - 0.36))) * 0.55 * step(v, 1.5));
  col = mix(col, head, h);
  // the tail's dark band at its tip
  col = mix(col, dark, t * smoothstep(-0.72, -0.8, l.x) * step(v, 1.5) * (1.0 - b));
  float a = max(max(b, h), t);
  a = mix(a, a * a * (3.0 - 2.0 * a), u_life * 0.6);
  // the wings, out: each from the shoulder to a rounded tip, swept back,
  // the trailing feathers darker
  if (wing > 0.01) {
    float span = 1.3 * wing * (1.0 - 0.5 * abs(flapC));
    float s = (abs(l.y) - 0.12) / max(span, 0.01);
    float xc = 0.06 - 0.32 * s * s;
    float ch = 0.3 * (1.0 - 0.55 * s) * sqrt(max(0.0, 1.0 - pow(max(s, 0.0), 6.0)));
    float w = (1.0 - smoothstep(ch * 0.8, ch, abs(l.x - xc))) * step(0.0, s) * step(s, 1.0);
    vec3 wc = mix(body, dark, smoothstep(0.6, 0.95, s) * 0.8 + smoothstep(0.0, -ch, l.x - xc) * 0.25);
    if (v > 1.5 && v < 2.5) wc = body;
    col = mix(col, wc, w * (1.0 - max(b, h)));
    a = max(a, w);
  }
  return a;
}

// is any pigeon within r ft of p (shifted by its shadow's throw, when
// asked for shadows)? One check, so the loops below skip whole
bool anyBirdNear(vec2 p, float r, bool shadow) {
  float rr = r * r * u_ft * u_ft;
  for (int i = 0; i < 9; i++) {
    vec4 A = u_bird[i];
    if (A.x > 8.0) continue;
    vec2 d = p - A.xy - (shadow ? u_sun * max(A.w, 0.5) * u_ft : vec2(0.0));
    if (dot(d, d) < rr) return true;
  }
  return false;
}
// the birds at p: those on the ground (high < 0.5), or those in the air
vec4 birdsAt(vec2 p, bool air) {
  vec4 o = vec4(0.0);
  if (!anyBirdNear(p, 2.4, false)) return o;
  for (int i = 0; i < 9; i++) {
    vec4 A = u_bird[i], B = u_birdB[i];
    if ((A.w > 0.5) != air) continue;
    vec2 d = (p - A.xy) / u_ft;
    if (dot(d, d) > 5.0) continue;
    vec2 f = vec2(cos(A.z), sin(A.z));
    // (each its own size, a little)
    float sz = 1.25 * mix(1.0, 0.9 + 0.2 * hash12(vec2(float(i), 2.0)), u_life);
    vec2 l = vec2(dot(d, f), dot(d, vec2(-f.y, f.x))) / sz;
    vec2 sn = -normalize(u_sun + vec2(1e-4));
    bSun = vec2(dot(sn, f), dot(sn, vec2(-f.y, f.x))); bSeed = float(i);
    vec3 c;
    float a = pigeon(l, B.x, B.y, B.z, B.w, c);
    // lit from the low sun's side, a touch
    c *= 0.92 + 0.16 * clamp(dot(normalize(d + 1e-4), -normalize(u_sun)), 0.0, 1.0) * a;
    o = mix(o, vec4(c, 1.0), a);
  }
  return o;
}
// the soft dark right under each, on the ground, sun or no sun
float birdContact(vec2 p) {
  float s = 0.0;
  if (!anyBirdNear(p, 1.2, false)) return s;
  for (int i = 0; i < 9; i++) {
    vec4 A = u_bird[i];
    if (A.x > 8.0 || A.w > 0.5) continue;
    vec2 d = (p - A.xy) / u_ft, f = vec2(cos(A.z), sin(A.z));
    vec2 l = vec2(dot(d, f), dot(d, vec2(-f.y, f.x)));
    s = max(s, 1.0 - smoothstep(0.2, 0.8, length((l - vec2(-0.05, 0.0)) / vec2(0.75, 0.5))));
  }
  return s * u_life;
}
// and their shadows: on the ground a soft dark patch right under each,
// in the air its whole shape thrown off along the sun
float birdShadow(vec2 p) {
  float s = 0.0;
  if (!anyBirdNear(p, 2.2, true)) return s;
  for (int i = 0; i < 9; i++) {
    vec4 A = u_bird[i], B = u_birdB[i];
    float h = max(A.w, 0.5);
    vec2 d = (p - u_sun * h * u_ft - A.xy) / u_ft;
    if (dot(d, d) > 4.0) continue;
    vec2 f = vec2(cos(A.z), sin(A.z));
    vec2 l = vec2(dot(d, f), dot(d, vec2(-f.y, f.x))) / 1.35;
    vec3 c;
    s = max(s, pigeon(l, B.x, B.y, 0.0, 0.0, c) * (A.w > 0.5 ? 0.45 : 0.6));
  }
  return s;
}
`;
