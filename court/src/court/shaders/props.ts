/* ══ Props: fence, gate, benches, lamps, hoops ════════════
   Each is drawn as itself and as its shadow. A thing at height h throws
   its shadow at p + u_sun * h, so to ask "is this ground point in its
   shadow" we look back up the sun: p - u_sun * h. Heights are in feet,
   times u_ft. The sun is low in the west (left), late in the day, so
   shadows run long to the right, as in the aerial references. */

export const PROPS = /* glsl */ `
uniform vec3 u_bench[4];   // x, y, 0 runs vertically / 1 across
uniform vec2 u_lamp[2];

const float FENCE_H = 10.0;

// is this point along a fence side inside the gate?
bool inGate(int side, float along) {
  return int(u_gate.x + 0.5) == side && abs(along - u_gate.y) < u_gate.z;
}

// chain link in the fence's own plane: along it (s) and up it (h), feet
float meshAt(float s, float h) {
  vec2 g = vec2(s + h, s - h) * 1.1;
  vec2 f = abs(fract(g) - 0.5);
  float m = 1.0 - smoothstep(0.36, 0.48, min(f.x, f.y));
  float post = 1.0 - smoothstep(0.12, 0.3, abs(mod(s + 5.0, 10.0) - 5.0));
  float rail = max(1.0 - smoothstep(0.0, 0.25, abs(h - FENCE_H)), 1.0 - smoothstep(0.0, 0.15, abs(h - 0.4)));
  return max(m * 0.5, max(post * 0.95, rail * 0.85));
}

float fenceShadow(vec2 p) {
  vec2 s = u_sun;
  float sh = 0.0;
  // the two ends (constant x): left is side 0, right side 2
  for (int i = 0; i < 2; i++) {
    float xw = i == 0 ? u_fence.x : u_fence.z;
    float h = (p.x - xw) / max(s.x, 1e-4);
    float hf = h / u_ft;
    if (hf > 0.0 && hf < FENCE_H) {
      vec2 q = p - s * h;
      if (q.y > u_fence.y && q.y < u_fence.w && !inGate(i == 0 ? 0 : 2, q.y)) sh = max(sh, meshAt(q.y / u_ft, hf));
    }
  }
  // the two long sides (constant y): top is side 1, bottom side 3
  for (int i = 0; i < 2; i++) {
    float yw = i == 0 ? u_fence.y : u_fence.w;
    float h = (p.y - yw) / max(s.y, 1e-4);
    float hf = h / u_ft;
    if (hf > 0.0 && hf < FENCE_H) {
      vec2 q = p - s * h;
      if (q.x > u_fence.x && q.x < u_fence.z && !inGate(i == 0 ? 1 : 3, q.x)) sh = max(sh, meshAt(q.x / u_ft, hf));
    }
  }
  return sh;
}

// the fence from above: a dark line, posts every ten feet, gate posts
float fenceShape(vec2 p) {
  float w = 0.22 * u_ft, a = 0.0;
  bool spanY = p.y > u_fence.y - w && p.y < u_fence.w + w;
  bool spanX = p.x > u_fence.x - w && p.x < u_fence.z + w;
  float line = 0.0, post = 0.0;
  float pr = 0.42 * u_ft;
  if (spanY) {
    if (!inGate(0, p.y)) line = max(line, 1.0 - smoothstep(w * 0.4, w, abs(p.x - u_fence.x)));
    if (!inGate(2, p.y)) line = max(line, 1.0 - smoothstep(w * 0.4, w, abs(p.x - u_fence.z)));
    float my = mod((p.y - u_fence.y) / u_ft + 5.0, 10.0) - 5.0;
    post = max(post, 1.0 - smoothstep(0.7, 1.0, length(vec2((p.x - u_fence.x) / u_ft, my)) / 0.42));
    post = max(post, 1.0 - smoothstep(0.7, 1.0, length(vec2((p.x - u_fence.z) / u_ft, my)) / 0.42));
  }
  if (spanX) {
    if (!inGate(1, p.x)) line = max(line, 1.0 - smoothstep(w * 0.4, w, abs(p.y - u_fence.y)));
    if (!inGate(3, p.x)) line = max(line, 1.0 - smoothstep(w * 0.4, w, abs(p.y - u_fence.w)));
    float mx = mod((p.x - u_fence.x) / u_ft + 5.0, 10.0) - 5.0;
    post = max(post, 1.0 - smoothstep(0.7, 1.0, length(vec2(mx, (p.y - u_fence.y) / u_ft)) / 0.42));
    post = max(post, 1.0 - smoothstep(0.7, 1.0, length(vec2(mx, (p.y - u_fence.w) / u_ft)) / 0.42));
  }
  return max(line, post);
}

// ── NYC Parks benches: green wooden slats on cast-iron ends. In bench
//    space b (feet): along it |b.y| < 3, across it from the seat's
//    front edge (b.x = -0.9) to the top of the back (b.x = 1.3)
vec2 benchSpace(vec2 p, vec3 bn) {
  vec2 d = (p - bn.xy) / u_ft;
  vec2 b = bn.z > 0.5 ? vec2(d.y, d.x) : vec2(d.x, d.y);
  // the back faces away from the court
  vec2 toCourt = u_center - bn.xy;
  float away = bn.z > 0.5 ? -sign(toCourt.y) : -sign(toCourt.x);
  return vec2(b.x * away, b.y);
}
float benchShape(vec2 p, out vec3 col) {
  col = vec3(0);
  float a = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 b = benchSpace(p, u_bench[i]);
    if (abs(b.y) < 3.0 && b.x > -0.9 && b.x < 1.3) {
      float slat = 1.0 - smoothstep(0.08, 0.16, abs(fract(b.x * 2.2) - 0.5) - 0.18);
      float gap = smoothstep(0.1, 0.2, abs(b.x - 0.45));
      col = vec3(0.24, 0.38, 0.28) * (0.85 + 0.25 * vnoise(vec2(b.y * 6.0, floor(b.x * 2.2) * 7.0)));
      a = max(a, slat * gap * 0.95);
    }
    float ends = min(min(abs(b.y - 2.9), abs(b.y + 2.9)), abs(b.y));
    float iron = (1.0 - smoothstep(0.08, 0.16, ends)) * step(-1.0, b.x) * step(b.x, 1.4);
    if (iron > a) { col = vec3(0.12, 0.13, 0.13); a = iron; }
  }
  return a;
}
float benchShadow(vec2 p) {
  vec3 dummy;
  float s = benchShape(p - u_sun * 1.6 * u_ft, dummy) * 0.85;
  vec2 hb = p - u_sun * 3.0 * u_ft;
  float back = 0.0;
  for (int i = 0; i < 4; i++) back = max(back, step(0.6, benchSpace(hb, u_bench[i]).x));
  return max(s, benchShape(hb, dummy) * back * 0.85);
}

// ── park lamps: a dark head on a tall post, mostly its long thin shadow
const float LAMP_H = 14.0;
float lampShape(vec2 p) {
  float a = 0.0;
  for (int i = 0; i < 2; i++) a = max(a, 1.0 - smoothstep(0.55, 0.8, length(p - u_lamp[i]) / u_ft));
  return a;
}
float lampShadow(vec2 p) {
  float s = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 base = u_lamp[i], top = base + u_sun * LAMP_H * u_ft;
    s = max(s, 1.0 - smoothstep(0.05, 0.45, segDist(p, base, top) / u_ft));
    s = max(s, 1.0 - smoothstep(0.4, 1.15, length(p - top) / u_ft));
  }
  return s;
}

// ── the hoop(s), from above: pole behind the baseline, the arm out to
//    the board (edge-on), the rim, the net hanging inside it. Court
//    space makes one hoop serve both ends of a full court
// the backstop frame: in each side frame (a vertical plane at Y = ±3),
// in feet along it (X) and up it (h): the rear post, top and middle
// rails, and an X of bracing between them
const float FR_X0 = -7.0, FR_X1 = 3.8, FR_H = 13.5;
float frameMembers(float X, float h) {
  float d = abs(X - FR_X0);
  d = min(d, abs(h - FR_H));
  d = min(d, abs(h - 8.5));
  d = min(d, segDist(vec2(X, h), vec2(FR_X0, 0.0), vec2(FR_X1, FR_H)));
  d = min(d, segDist(vec2(X, h), vec2(FR_X0, FR_H), vec2(FR_X1, 4.0)));
  float inside = step(FR_X0 - 0.3, X) * step(X, FR_X1) * step(0.0, h) * step(h, FR_H + 0.3);
  return (1.0 - smoothstep(0.18, 0.32, d)) * inside;
}

float hoopShape(vec2 c, out vec3 col) {
  col = vec3(0);
  float a = 0.0, aa = 0.06;
  // from above you see the frame's top: two rails, cross pieces, posts
  float top = min(abs(abs(c.y) - 3.0), 1e3);
  // (galvanised steel, lit from above: a mid grey, not black, so it
  // reads against its own shadow; the members a touch heavier than
  // true, as the people are, so they hold up from this height)
  float rails = (1.0 - smoothstep(0.16, 0.32, top)) * step(FR_X0 - 0.3, c.x) * step(c.x, FR_X1);
  float cross = (1.0 - smoothstep(0.16, 0.32, min(abs(c.x - FR_X0), abs(c.x - 0.0)))) * step(abs(c.y), 3.0);
  float xb = 1.0 - smoothstep(0.12, 0.26, min(segDist(c, vec2(FR_X0, -3.0), vec2(0.0, 3.0)), segDist(c, vec2(FR_X0, 3.0), vec2(0.0, -3.0))));
  float posts = 1.0 - smoothstep(0.36, 0.52, min(length(c - vec2(FR_X0, 3.0)), length(c - vec2(FR_X0, -3.0))));
  float steel = max(max(rails, cross), max(xb * 0.9, posts));
  vec3 steelC = mix(vec3(0.3, 0.32, 0.34), vec3(0.5, 0.52, 0.54), 0.5 + 0.5 * sin(c.y * 2.0 + c.x * 1.3));
  col = mix(col, steelC, steel); a = max(a, steel);
  // the backboard, edge on: its top edge catches the light, white
  // against everything, with the padding's dark line along the front
  float board = 1.0 - smoothstep(-aa, aa, boxDist(c, vec2(4.0, 0.0), vec2(0.32, 3.1)));
  col = mix(col, mix(vec3(0.5, 0.52, 0.55), vec3(0.97, 0.96, 0.93), smoothstep(3.75, 4.05, c.x)), board); a = max(a, board);
  float pad = 1.0 - smoothstep(-aa, aa, boxDist(c, vec2(3.62, 0.0), vec2(0.1, 3.0)));
  col = mix(col, vec3(0.16, 0.17, 0.18), pad); a = max(a, pad);
  float brk = 1.0 - smoothstep(-aa, aa, boxDist(c, vec2(4.45, 0.0), vec2(0.35, 0.4)));
  col = mix(col, vec3(0.72, 0.29, 0.13), brk); a = max(a, brk);
  vec2 r = c - RIM_F;
  float rl = length(r), ang = atan(r.y, r.x);
  float mesh = max(1.0 - smoothstep(0.0, 0.07, abs(sin(ang * 6.0 + rl * 7.0)) * rl),
                   1.0 - smoothstep(0.0, 0.07, abs(sin(ang * 6.0 - rl * 7.0)) * rl));
  float netA = mesh * (1.0 - smoothstep(0.66, 0.75, rl)) * smoothstep(0.15, 0.4, rl) * 0.9;
  col = mix(col, vec3(0.96, 0.96, 0.94), netA); a = max(a, netA);
  float rm = 1.0 - smoothstep(-aa, aa, abs(rl - 0.75) - 0.14);
  col = mix(col, vec3(0.92, 0.4, 0.14), rm); a = max(a, rm);
  return a;
}
float hoopShadow(vec2 p) {
  float d = 1e3;
  // the two braced side frames: each a vertical plane at Y = ±3, so a
  // ground point is in its shadow if the line back up the sun meets a
  // member. That throws the long lattice shadow of the references
  float fr = 0.0;
  for (int k = 0; k < 2; k++) {
    float Y = k == 0 ? -3.0 : 3.0;
    vec2 cp = cf(p);
    // height at which the ray up the sun crosses the plane (court Y is
    // world y, so this only needs the sun's y)
    float sa = sunAcross();
    float h = (cp.y - Y) / (abs(sa) > 1e-4 ? sa : 1e-4);
    if (h > 0.0 && h < FR_H + 0.4) fr = max(fr, frameMembers(cf(p - u_sun * h * u_ft).x, h));
  }
  for (int i = 0; i < 10; i++) {
    float h = mix(10.0, 13.5, float(i) / 9.0);
    d = min(d, boxDist(cf(p - u_sun * h * u_ft), vec2(4.0, 0.0), vec2(0.2, 3.0)));
  }
  d = min(d, abs(length(cf(p - u_sun * 10.0 * u_ft) - RIM_F) - 0.75) - 0.07);
  float sh = 1.0 - smoothstep(-0.05, 0.12, d);
  float net = (1.0 - smoothstep(0.4, 0.75, length(cf(p - u_sun * 9.0 * u_ft) - RIM_F))) * 0.35;
  return max(max(sh, net), fr * 0.9);
}
`;
