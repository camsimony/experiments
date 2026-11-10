/* ══ The ground ═══════════════════════════════════════════
   Seen from straight above. World units: the frame is 1.5 × 1.0, y down.
   The layout (layouts.ts) arrives as uniforms. Court lines are drawn in
   feet in "court space": X from the nearest baseline toward half court,
   Y across. A full court is two half courts back to back, so the same
   lines serve both ends.

   Inside the fence: a green-grey court with a terracotta lane, as in
   the aerial references. Outside it, the hexagonal asphalt pavers every
   New York park path is made of, and soil under the trees. */

export const GROUND = /* glsl */ `
uniform float u_ft;       // world units per foot
uniform vec2 u_center;
uniform float u_full;     // 0 half court, 1 full court
uniform float u_vertical; // 1: the court runs top to bottom
uniform vec4 u_fence;     // x0, y0, x1, y1
uniform vec3 u_gate;      // side, position along it, half-width
uniform vec3 u_crown[8];
uniform vec2 u_sun;      // shadow offset per world unit of height
uniform vec3 u_courtCol, u_laneCol;  // the two paints
uniform float u_circleFill;          // centre circle painted like the lane

// world → court feet
vec2 cf(vec2 p) {
  vec2 d = (p - u_center) / u_ft;
  if (u_vertical > 0.5) return vec2(47.0 - abs(d.y), d.x);
  return u_full > 0.5 ? vec2(47.0 - abs(d.x), d.y) : vec2(-d.x, d.y);
}
// the sun's offset along court Y (across the court), per world height
float sunAcross() { return u_vertical > 0.5 ? u_sun.x : u_sun.y; }

const float ARC_X = 14.2;   // where the corner threes meet the arc
const vec2 RIM_F = vec2(5.25, 0.0);

bool inFenceW(vec2 p) { return p.x > u_fence.x && p.x < u_fence.z && p.y > u_fence.y && p.y < u_fence.w; }

float courtLines(vec2 c) {
  float d = 1e3;
  d = min(d, segDist(c, vec2(0, -25), vec2(0, 25)));
  d = min(d, segDist(c, vec2(0, -25), vec2(47, -25)));
  d = min(d, segDist(c, vec2(0, 25), vec2(47, 25)));
  d = min(d, segDist(c, vec2(47, -25), vec2(47, 25)));
  d = min(d, abs(length(c - vec2(47, 0)) - 6.0));
  if (u_full > 0.5) d = min(d, abs(length(c - vec2(47, 0)) - 2.0));
  d = min(d, segDist(c, vec2(0, -8), vec2(19, -8)));
  d = min(d, segDist(c, vec2(0, 8), vec2(19, 8)));
  d = min(d, segDist(c, vec2(19, -8), vec2(19, 8)));
  d = min(d, abs(length(c - vec2(19, 0)) - 6.0));
  d = min(d, segDist(c, vec2(0, -22), vec2(ARC_X, -22)));
  d = min(d, segDist(c, vec2(0, 22), vec2(ARC_X, 22)));
  if (c.x > ARC_X) d = min(d, abs(length(c - RIM_F) - 23.75));
  // (no restricted-area arc under the rim: a park court doesn't have one)
  return d;
}

vec3 asphalt(vec2 p) {
  vec4 v = voronoi(p * 300.0);
  vec3 c = vec3(0.22, 0.25, 0.24) * (0.86 + 0.22 * hash12(v.zw));
  c *= 0.9 + 0.14 * fbm3(p * 45.0);
  return c * (0.9 + 0.12 * smoothstep(0.3, 0.7, fbm(p * 3.0)));
}

// hexagonal pavers: the cell id and the distance to the grout
vec3 hexTile(vec2 p) {
  vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5;
  vec2 b = mod(p - s * 0.5, s) - s * 0.5;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(g);
  return vec3(p - g, 0.5 - max(dot(q, normalize(s)), q.x));
}

void cityGround(vec2 p, inout vec3 col);   // row.ts

vec3 groundColor(vec2 p, out float paint) {
  vec2 c = cf(p);
  paint = 0.0;
  vec3 col;
  if (inFenceW(p)) {
    col = asphalt(p);
    if (c.x > 0.0 && c.x < 47.0 && abs(c.y) < 25.0) {
      bool lane = (c.x < 19.0 && abs(c.y) < 8.0) || (u_circleFill > 0.5 && length(c - vec2(47, 0)) < 6.0);
      vec3 pc = lane ? u_laneCol : u_courtCol;
      float wear = smoothstep(0.6, 0.92, fbm(p * 8.0 + 3.1)) * 0.45
                 + smoothstep(0.78, 1.0, fbm(p * 28.0)) * 0.25;
      pc *= 0.93 + 0.12 * fbm(p * 2.4 + 8.0);
      pc *= 0.92 + 0.08 * fbm3(p * 70.0);
      paint = 1.0 - wear;
      col = mix(col, pc, paint);
    }
    float d = courtLines(c);
    float aa = fwidth(d) * 1.1;
    float line = 1.0 - smoothstep(0.17 - aa, 0.17 + aa, d);
    line *= 0.35 + 0.65 * smoothstep(0.25, 0.55, fbm(p * 40.0 + 1.7));
    col = mix(col, vec3(0.93, 0.92, 0.88), line * 0.95);
    vec4 cr = voronoi(p * 4.0 + vec2(fbm3(p * 6.0), fbm3(p * 6.0 + 4.0)) * 0.5);
    float crack = (1.0 - smoothstep(0.0, 0.016, cr.y - cr.x)) * smoothstep(0.55, 0.7, fbm3(p * 3.0 + 11.0));
    col *= 1.0 - crack * 0.4;
  } else {
    vec3 h = hexTile(p * 75.0);
    vec3 pv = vec3(0.42, 0.41, 0.39) * (0.88 + 0.2 * hash12(h.xy));
    pv *= 0.92 + 0.12 * fbm3(p * 90.0);
    float grout = 1.0 - smoothstep(0.03, 0.09, h.z);
    col = mix(pv, vec3(0.55, 0.52, 0.47), grout * 0.7);
    // soil and leaf mould round the foot of each tree
    float soil = 0.0;
    for (int i = 0; i < 8; i++) {
      vec3 cr = u_crown[i];
      soil = max(soil, 1.0 - smoothstep(0.06, 0.11, length(p - cr.xy) + (fbm3(p * 9.0) - 0.5) * 0.04));
    }
    col = mix(col, vec3(0.28, 0.24, 0.18) * (0.85 + 0.3 * fbm3(p * 60.0)), soil);
    cityGround(p, col);
  }
  return col;
}
`;
