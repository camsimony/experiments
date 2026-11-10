/* ══ The row, leaning ═════════════════════════════════════
   The houses face the court across the side street. Everything else is
   seen from straight above; buildings get a touch of a wide lens, their
   tops pushed a little away from the middle of the frame, the taller
   the further. Only sideways (x), so neighbouring roofs stay flush:
   what opens up is a sliver of each front, a few feet of brown stone,
   window rows and cornice, as at the edge of a drone photograph.

   Kinds of house (u_lots w):
     0  brownstone, stoop up to the parlour floor, areaway below it
     1  tenement, red brick, fire escape, water tower, a deli on the
        corner with its awning
     2  brick rowhouse, lower, a little front yard */

export const BUILDINGS = /* glsl */ `
uniform vec4 u_lots[6];   // y0, y1, storeys, kind

const float STOREY_FT = 11.0;
const float LENS_K = 0.001;   // lean, world per ft of height per unit off-centre

int lotAt(float y) {
  for (int i = 0; i < 6; i++) if (y >= u_lots[i].x && y < u_lots[i].y) return i;
  return -1;
}
float bEmit;   // how much a lit window glows here
vec3 fEmit;    // the light given off at the frontage (the stoops' Christmas lights)
float fOn;     // and how far they've come on
float lotHeight(vec4 L) { return L.z * STOREY_FT + (L.w < 0.5 ? 6.0 : 2.0); }
// (height past a brownstone's adds only a little more lean, so a taller
// neighbour still sits in the row instead of tipping out of it)
float lean(float h) { float he = min(h, 50.0) + max(h - 50.0, 0.0) * 0.25; return (u_rowX + 0.1 - 0.75) * LENS_K * he; }

// ── a front: z height up it, s ft across it from the lot's start
vec3 facadeColor(vec4 L, float i, float z, float s, float w, float h) {
  float k = hash12(vec2(i, 5.0));
  vec3 stone = L.w < 0.5 ? mix(vec3(0.33, 0.23, 0.18), vec3(0.41, 0.28, 0.21), k)
             : L.w < 1.5 ? vec3(0.52, 0.27, 0.2) : vec3(0.58, 0.34, 0.26);
  vec3 c = stone * (0.9 + 0.16 * vnoise(vec2(s * 2.0, z * 2.0) + i * 7.0));
  // the party wall between houses: a darker seam where one front meets the next
  c *= mix(0.62, 1.0, smoothstep(0.0, 0.7, min(s, w - s)));
  // a floor-line band at each storey, faint
  float zb = z - (L.w < 0.5 ? 6.0 : 1.0);
  c *= 1.0 - (1.0 - smoothstep(0.0, 0.5, abs(fract(zb / STOREY_FT) - 0.02) * STOREY_FT)) * 0.12;
  // the cornice: a deep, dark ledge at the top, its brackets catching light
  float corn = smoothstep(h - 3.0, h - 2.7, z);
  c = mix(c, vec3(0.2, 0.16, 0.13) * (0.85 + 0.3 * step(0.6, fract(s * 0.7))), corn);
  // its lit lip at the very top
  c = mix(c, vec3(0.55, 0.47, 0.38), smoothstep(h - 0.9, h - 0.5, z) * 0.8);
  // windows: a row a storey, the parlour floor's taller
  float nWin = L.w < 0.5 ? 2.0 : L.w < 1.5 ? 3.0 : 2.0;
  float base = L.w < 0.5 ? 6.0 : 1.0;
  float zz = z - base;
  float st = floor(zz / STOREY_FT), inSt = zz - st * STOREY_FT;
  bool parlour = L.w < 0.5 && st < 0.5;
  float wz0 = parlour ? 1.6 : 2.6, wz1 = parlour ? 9.4 : 8.4;
  float cell = fract(s / w * nWin);
  float off = abs(cell - 0.5) * w / nWin;
  bool doorBay = L.w < 0.5 && st < 0.5 && abs(s - w * 0.83) < 2.4;
  float wid = clamp(w / nWin * 0.3, 1.6, 2.4);
  bool shop = L.w > 0.5 && L.w < 1.5 && zz < STOREY_FT;
  if (zz > 0.0 && z < h - 2.8 && inSt > wz0 && inSt < wz1 && off < wid && !doorBay && !shop) {
    float wk = hash12(vec2(i * 13.0 + floor(s / w * nWin), st));
    // after dark, some windows are lit: warm, a few cooler (a TV)
    // (each window its own moment to come on)
    bEmit = step(wk, 0.5) * (1.0 - smoothstep(wid - 0.5, wid - 0.1, off)) * (wk < 0.08 ? -1.0 : 1.0) * switchOn(fract(wk * 17.3));
    vec3 g = mix(vec3(0.04, 0.045, 0.06), vec3(0.2, 0.24, 0.28), smoothstep(wz0, wz1, inSt) * 0.6);
    g = mix(g, vec3(0.62, 0.5, 0.36), step(0.8, wk) * 0.6);                      // blinds down
    float frame = smoothstep(wid - 0.5, wid - 0.1, off);
    // soft-edged, no frame lines: a dark pane fading into the stone
    c = mix(g, c, smoothstep(wid - 0.5, wid - 0.1, off) * 0.95);
    // a window box, flowering in summer
    if (wk < 0.18 && inSt < wz0 + 0.8) c = mix(vec3(0.3, 0.2, 0.14), mix(vec3(0.22, 0.36, 0.16), vec3(0.75, 0.25, 0.3), step(0.5, vnoise(vec2(s, z) * 4.0))), step(0.3, u_density));
  }
  // pale stone lintels over the windows and sills under them
  bool winCol = off < wid + 0.25 && !doorBay && !shop && zz > 0.0 && z < h - 3.0;
  if (winCol && (abs(inSt - wz1 - 0.35) < 0.35 || abs(inSt - wz0 + 0.25) < 0.25)) c = mix(c, vec3(0.62, 0.56, 0.48), 0.7);
  // the front door: a pair of dark wood doors under a round arch, in a
  // pale carved stone surround
  if (doorBay && zz > 0.0) {
    float dx = abs(s - w * 0.83);
    float archY = 8.0 + sqrt(max(0.0, 1.6 * 1.6 - dx * dx));
    if (dx < 1.6 && inSt < archY) {
      vec3 wood = vec3(0.2, 0.11, 0.07) * (0.9 + 0.2 * step(0.5, fract(inSt / 3.0)));
      c = mix(wood, vec3(0.08, 0.05, 0.04), 1.0 - smoothstep(0.04, 0.12, dx));   // the meeting stiles
      c = mix(c, vec3(0.3, 0.32, 0.34), smoothstep(8.2, 8.6, inSt) * 0.6);         // the transom glass
    } else if (dx < 2.4 && inSt < archY + 1.0) {
      c = vec3(0.6, 0.52, 0.42);
    }
  }
  // the deli: a glass shopfront
  if (shop) c = mix(vec3(0.12, 0.13, 0.15), vec3(0.75, 0.62, 0.35), step(0.6, vnoise(vec2(s * 0.8, 3.0))) * 0.35);
  // the tenement's fire escape, iron balconies a storey apart
  if (L.w > 0.5 && L.w < 1.5 && zz > STOREY_FT && abs(s / w - 0.5) < 0.26) {
    float plat = 1.0 - smoothstep(0.3, 0.9, abs(inSt - 0.6));
    float rail = 1.0 - smoothstep(0.1, 0.3, abs(inSt - 3.2));
    c = mix(c, vec3(0.07, 0.07, 0.08), max(plat * 0.8, rail * 0.5));
  }
  return c;
}

vec3 waterTower(vec2 r, float w, vec3 c) {
  vec2 t = r - vec2(16.0, w * 0.55);
  float rl = length(t);
  roofShade = max(roofShade, (1.0 - smoothstep(5.6, 6.4, length(t - u_sun * 26.0))) * step(6.0, rl));
  // legs' shadows as thin lines
  float cone = clamp(dot(normalize(t + 1e-4), -normalize(u_sun)) * 0.5 + 0.5, 0.0, 1.0);
  vec3 wood = mix(vec3(0.28, 0.2, 0.14), vec3(0.64, 0.5, 0.34), cone);
  wood *= 1.0 - (1.0 - smoothstep(0.0, 0.18, abs(fract(atan(t.y, t.x) * 6.0) - 0.5))) * 0.12;
  c = mix(c, wood, 1.0 - smoothstep(5.6, 6.0, rl));
  c = mix(c, vec3(0.2, 0.15, 0.1), 1.0 - smoothstep(0.3, 0.6, rl));
  return c;
}

// what of the row is at p: 0 nothing, 1 a roof, 2 a front
float buildingShape(vec2 p, out vec3 col, out float shade) {
  col = vec3(0); shade = 0.0; bEmit = 0.0;
  int i = lotAt(p.y);
  if (i < 0) return 0.0;
  vec4 L = u_lots[i];
  float h = lotHeight(L), d = lean(h);
  float w = (L.y - L.x) / u_ft;
  float hPrev = i > 0 ? lotHeight(u_lots[i - 1]) : 0.0;
  // the cornice reaches 1.5 ft out past the front at the top
  float x0 = u_rowX + d - 0.9 * u_ft;
  if (p.x >= x0) {
    vec2 r = vec2((p.x - u_rowX - d) / u_ft, (p.y - L.x) / u_ft);
    if (r.x < 0.3) {
      // the cornice from above: a lit top edge, its brackets below
      col = vec3(0.24, 0.19, 0.15) * (0.9 + 0.25 * step(0.55, fract(r.y * 0.7)));
      col = mix(col, vec3(0.42, 0.36, 0.3), 1.0 - smoothstep(0.0, 0.2, abs(r.x + 0.75)));
      return 1.0;
    }
    col = roofColor(L, float(i), r, w, hPrev, h);
    if (L.w > 0.5 && L.w < 1.5) col = waterTower(r, w, col);
    shade = roofShade;
    return 1.0;
  }
  if (p.x >= u_rowX) {
    float t = (p.x - u_rowX) / max(d - 0.9 * u_ft, 1e-4);
    col = facadeColor(L, float(i), t * h, (p.y - L.x) / u_ft, w, h);
    col *= mix(0.7, 1.08, smoothstep(0.0, 0.7, t));   // darker toward the street
    return 2.0;
  }
  return 0.0;
}

// the row lit, and softened: sampled at a few points round p and
// averaged, so its edges and corners come out very slightly rounded,
// like the rest of the painting, instead of cut with a blade.
// Returns colour premultiplied by coverage, and coverage
vec4 buildingSoft(vec2 p) {
  if (p.x < u_rowX - 1.0 * u_ft || lotAt(p.y) < 0 && lotAt(p.y - 0.8 * u_ft) < 0 && lotAt(p.y + 0.8 * u_ft) < 0) return vec4(0);
  vec4 acc = vec4(0);
  for (int j = 0; j < 5; j++) {
    float a = float(j) * 2.39996 + 0.6;
    vec2 o = j == 0 ? vec2(0) : vec2(cos(a), sin(a)) * 0.22 * u_ft;
    vec3 c; float sh;
    float kind = buildingShape(p + o, c, sh);
    if (kind > 0.0) {
      vec3 b = mix(c * u_sunCol, c * u_shadeCol, sh * u_sunK * 0.9);
      if (bEmit != 0.0) b += (bEmit > 0.0 ? vec3(1.0, 0.7, 0.38) : vec3(0.55, 0.65, 0.9)) * 0.9;
      if (kind < 1.5) b = mix(b, vec3(0.93, 0.94, 0.96) * mix(u_sunCol, u_shadeCol, 0.3 + sh * 0.5), u_snow * 0.85);
      acc += vec4(b, 1.0);
    }
  }
  return acc / 5.0;
}

// ── the sidewalk in front of the houses: stoops, areaways, trash cans,
//    the deli's awning. Returns coverage; sh is shadow cast on the walk
float frontage(vec2 p, out vec3 col, out float sh) {
  col = vec3(0); sh = 0.0; fEmit = vec3(0); fOn = 0.0;
  int i = lotAt(p.y);
  if (i < 0 || p.x > u_rowX) return 0.0;
  vec4 L = u_lots[i];
  float w = (L.y - L.x) / u_ft;
  vec2 s = vec2((u_rowX - p.x) / u_ft, (p.y - L.x) / u_ft);   // ft out from the front, across
  float k = hash12(vec2(float(i), 21.0));
  if (L.w > 0.5 && L.w < 1.5) {
    // the deli's awning, 4 ft out over the walk: canvas sloping down
    // from the wall to a front valance. Lit on the slope that faces the
    // low sun, a soft fold at the top, a shaded valance, rounded corners,
    // and a soft dark band on the walk just under its edge
    vec2 aw = vec2(2.0, 9.5);
    vec2 he = vec2(2.0, 7.0);
    float ad = boxDist(s, aw, he - 0.4) - 0.4;
    float a = 1.0 - smoothstep(-0.05, 0.05, ad);
    sh = (1.0 - smoothstep(0.0, 0.9, ad)) * 0.75;
    if (a > 0.0) {
      float slope = smoothstep(0.0, 3.3, s.x);
      vec3 canvas = vec3(0.12, 0.38, 0.25);
      vec3 c = canvas * mix(0.5, 1.3, pow(slope, 0.8));
      // tucked in against the wall it's in the building's shade
      c *= mix(0.7, 1.0, smoothstep(0.0, 0.9, s.x));
      // the canvas sags a little between its frame ribs
      float rib = 0.5 + 0.5 * cos(s.y * 6.2832 / 3.0);
      c *= mix(0.78, 1.08, rib);
      // the valance: the front drop, seen almost edge-on, in shade
      float val = smoothstep(3.4, 3.5, s.x);
      c = mix(c, canvas * 0.45, val);
      // the white piping along the fold
      c = mix(c, vec3(0.88, 0.87, 0.82), (1.0 - smoothstep(0.08, 0.16, abs(s.x - 3.35))) * 0.9);
      // and darker at its ends, where it turns down
      c *= mix(1.0, 0.75, smoothstep(he.y - 0.8, he.y + 0.2, abs(s.y - aw.y)));
      col = c;
      return a;
    }
    // milk crates by the door
    float crate = 1.0 - smoothstep(-0.05, 0.05, boxDist(s, vec2(5.0, 9.5), vec2(0.8, 2.0)));
    if (crate > 0.0) { col = mix(vec3(0.75, 0.25, 0.15), vec3(0.85, 0.6, 0.15), step(0.5, fract(s.y * 0.6))); return crate; }
    return 0.0;
  }
  if (L.w > 1.5) {
    // the rowhouse's front yard: a low iron fence, a shrub
    float fence = 1.0 - smoothstep(0.1, 0.3, abs(s.x - 4.75));
    float shrub = 1.0 - smoothstep(1.0, 1.9, length(s - vec2(2.4, w * 0.3)) + (vnoise(s * 1.5) - 0.5));
    if (fence > 0.1 && s.x < 5.0) { col = vec3(0.08); return fence * 0.8; }
    if (s.x < 5.0) { col = mix(vec3(0.42, 0.4, 0.36), vec3(0.18, 0.28, 0.13) * mix(1.0, 0.7, u_autumn), shrub); return 1.0; }
    return 0.0;
  }
  // ── a brownstone. The stoop: a short flight of stone steps from the
  //    parlour door down to the walk, treads lit at their noses, iron
  //    railings, newel posts at the bottom
  float sy = s.y - w * 0.83;
  // ── in winter, a string of coloured bulbs along each railing, a few
  //    inches apart, each a bead of colour with a soft glow round it that
  //    twinkles now and then
  float xmas = smoothstep(0.35, 0.75, u_snow);
  fOn = switchOn(0.6 + 0.12 * float(i));
  if (xmas > 0.0 && s.x > -0.5 && s.x < 5.6 && abs(abs(sy) - 2.2) < 1.6) {
    const vec3 BULB[5] = vec3[](vec3(1.0, 0.18, 0.12), vec3(0.15, 0.85, 0.3), vec3(0.2, 0.45, 1.0), vec3(1.0, 0.75, 0.15), vec3(1.0, 0.4, 0.7));
    float sp = 1.15;   // a bulb every foot or so: separate beads, not a bar
    float side = sy < 0.0 ? 0.0 : 1.0;
    for (int j = -1; j <= 1; j++) {
      float bi = clamp(floor(s.x / sp) + float(j), 0.0, 4.0);
      // the string droops a little between the bulbs
      vec2 b = vec2((bi + 0.5) * sp, (side * 2.0 - 1.0) * (2.2 + 0.08 * sin(bi * 2.1)));
      float d = length(vec2(s.x, sy) - b);
      vec3 bc = BULB[int(mod(bi + side * 2.0 + float(i) * 3.0, 5.0))];
      float tw = 0.75 + 0.25 * sin(u_time * (1.3 + hash12(vec2(bi, side + float(i))) * 2.0) + bi * 4.0);
      fEmit += bc * ((1.0 - smoothstep(0.09, 0.15, d)) * 0.85 + exp(-d * d / 0.09) * 0.35 * fOn) * tw * xmas;
    }
  }
  // stoop height above the walk: 5 ft at the door, down to nothing at the walk
  float stoopD = boxDist(vec2(s.x, sy), vec2(2.5, 0.0), vec2(2.1, 2.5)) - 0.4;
  if (stoopD < 0.15) {
    float a = 1.0 - smoothstep(-0.15, 0.15, stoopD);
    sh = 0.0;
    // treads lit at their noses, each riser a dark line in shadow
    float tread = fract(s.x * 1.2);
    vec3 stone = vec3(0.47, 0.34, 0.26);
    vec3 c = stone * mix(1.2, 0.66, smoothstep(0.1, 0.95, tread)) * mix(1.1, 0.85, s.x / 5.0);
    // the cheek walls each side: solid stone, rounded tops, the one on
    // the sun's side lit and the other in shade
    float cheek = smoothstep(1.7, 2.1, abs(sy));
    float cheekLit = sy < 0.0 ? 1.28 : 0.6;
    c = mix(c, stone * 0.95 * cheekLit * mix(1.0, 0.85, smoothstep(2.4, 2.9, abs(sy))), cheek);
    // the iron railing along each cheek wall, soft
    c = mix(c, vec3(0.1, 0.09, 0.09), (1.0 - smoothstep(0.08, 0.3, abs(abs(sy) - 2.2))) * 0.75);
    // the newel posts at the bottom
    c = mix(c, stone * 0.85, 1.0 - smoothstep(0.3, 0.6, length(vec2(s.x - 4.5, abs(sy) - 2.2))));
    // the top landing and the doorway, seen from above: a dark recess in
    // the front with pale stone jambs either side, and the carved stone
    // hood over it reaching out across the landing, throwing its shade
    // back into the door
    if (s.x < 1.6) {
      float ay = abs(sy);
      vec3 land = stone * 1.02;
      c = mix(c, land, smoothstep(1.6, 1.3, s.x) * (1.0 - cheek));
      if (ay < 1.35 && s.x < 1.0) c = mix(vec3(0.2, 0.11, 0.07), vec3(0.05, 0.03, 0.02), smoothstep(1.0, 0.1, s.x));
      if (ay >= 1.35 && ay < 2.0 && s.x < 1.0) c = vec3(0.64, 0.56, 0.46) * mix(0.8, 1.12, step(sy, 0.0));
      // the hood: a slab with a lit front lip and its shadow on the landing
      float hood = (1.0 - smoothstep(2.25, 2.4, ay)) * smoothstep(0.95, 1.02, s.x) * (1.0 - smoothstep(1.3, 1.38, s.x));
      float hoodSh = (1.0 - smoothstep(2.0, 2.3, ay)) * smoothstep(1.3, 1.4, s.x) * (1.0 - smoothstep(1.5, 1.8, s.x));
      c *= 1.0 - hoodSh * 0.35;
      vec3 hc = vec3(0.66, 0.56, 0.44) * mix(0.95, 1.15, smoothstep(1.0, 1.3, s.x));
      c = mix(c, hc, hood);
    }
    col = c;
    return a;
  }
  // the areaway: a little sunken yard before the basement, just a shade
  // lower than the walk (it takes the snow like everything else), an iron
  // railing along its edge, and the bins
  // the stoop's shadow, down-sun of it, longer near the door where it's tall
  vec2 ss = vec2(s.x, sy) + vec2(u_sun.x, -u_sun.y) * mix(4.5, 0.5, clamp(s.x / 5.0, 0.0, 1.0));
  sh = (1.0 - smoothstep(-0.3, 0.9, boxDist(ss, vec2(2.5, 0.0), vec2(2.1, 2.5)) - 0.4)) * 0.5;
  // and the soft dark where it meets the ground, all round
  sh = max(sh, (1.0 - smoothstep(0.0, 0.9, stoopD)) * 0.4);
  if (s.x < 5.0) {
    float fence = 1.0 - smoothstep(0.1, 0.3, abs(s.x - 4.75));
    vec3 c = vec3(0.12, 0.12, 0.13);
    float a = 0.22 * (1.0 - fence) + fence * 0.8;
    for (int j = 0; j < 2; j++) {
      if (float(j) > k * 2.0) break;
      vec2 bc = vec2(2.2, 1.8 + float(j) * 1.9 + k * 2.0);
      float bin = length(s - bc);
      vec3 lid = j == 1 ? vec3(0.24, 0.34, 0.52) : vec3(0.2, 0.21, 0.22);
      float lit = dot(normalize(s - bc + 1e-4), vec2(1.0, -1.0) * 0.7);
      float on = 1.0 - smoothstep(0.55, 0.95, bin);
      c = mix(c, lid * (1.0 + lit * 0.2), on);
      a = max(a, on * 0.95);
    }
    col = c;
    return a;
  }
  return 0.0;
}
`;
