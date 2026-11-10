/* ══ The streets ══════════════════════════════════════════
   Two streets: the one under the el across the top, and one down the
   right between the court and the brownstones, whose fronts face the
   court across it. Where they meet, a corner with crosswalks.

   Dark asphalt, the el street with a double yellow line; the side
   street one-way (northbound), parking only on the deli side and the bus
   stop in front of the corner store, its zone marked out at the curb.
   Concrete sidewalk flags with a lighter curb, parked cars (one of them
   a yellow cab), traffic coming up the side street now and then, the
   bus stop's sign, and street trees in square pits in front of the houses. */

export const ROW = /* glsl */ `
uniform float u_rowX;     // the building fronts, world x
uniform vec2 u_street;    // the right-hand street: x0, x1 (kerb to kerb), world
uniform vec2 u_walk;      // sidewalk width either side, and the el street's half-width (world)
uniform vec4 u_car[10];   // x, y, colour index (0 cab, 1 grey, 2 dark blue, 3 white, 4 maroon, 9 bus), heading 0..3; 4..9 are traffic's (moving, or parked at the deli curb)
uniform vec4 u_carB[10];  // traffic's: turn signal (-1 left, +1 right), blink, doors open / brake, body seed (negative: parked, engine off)
uniform vec4 u_stop;      // the bus stop: shelter x0, y0, x1, y1 (world); the sign stands at the curb before it
uniform float u_zone;     // the bus zone's far end, world y (it runs from the crosswalk)

vec3 asphaltStreet(vec2 p) {
  return vec3(0.2, 0.21, 0.22) * (0.88 + 0.2 * fbm3(p * 50.0)) * (0.92 + 0.1 * fbm(p * 6.0));
}
vec3 sidewalk(vec2 p, vec2 a) {
  // a: position in feet along and across the sidewalk
  vec2 f = fract(a / 5.0);
  float joint = 1.0 - smoothstep(0.0, 0.04, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  vec3 c = vec3(0.66, 0.64, 0.6) * (0.9 + 0.15 * fbm3(p * 70.0));
  return mix(c, vec3(0.5, 0.49, 0.46), joint * 0.6);
}

// how plowed it is here: 1 in the traffic lanes, falling to 0 in the
// banks of snow along the kerbs and where the cars are parked
float plowed(vec2 p) {
  float v = p.y - u_el.x;
  float elHalf = u_walk.y;
  float a = 0.0;
  if (abs(v) < elHalf) a = smoothstep(elHalf, elHalf - 9.0 * u_ft, abs(v));
  if (p.x > u_street.x && p.x < u_street.y && v > -elHalf) {
    float cx = (u_street.x + u_street.y) * 0.5, hw = (u_street.y - u_street.x) * 0.5;
    a = max(a, smoothstep(hw, hw - 9.0 * u_ft, abs(p.x - cx)));
  }
  // a little grey slush left in the tyre tracks
  return a * (0.82 + 0.18 * fbm3(p * 40.0));
}

// everything that isn't park, court or building: streets and sidewalks
void cityGround(vec2 p, inout vec3 col) {
  // behind the fronts it's all building: what shows between roofs is
  // the shade of a party wall
  if (p.x >= u_rowX && p.y > u_el.x + u_walk.y + u_walk.x) { col = vec3(0.17, 0.13, 0.11); return; }
  float elHalf = u_walk.y;
  float walk = u_walk.x;
  float v = p.y - u_el.x;                       // across the el street, world
  bool topStreet = abs(v) < elHalf;
  bool topWalk = v >= elHalf && v < elHalf + walk;
  bool sideStreet = p.x > u_street.x && p.x < u_street.y && v > elHalf;
  bool nearWalk = p.x > u_street.x - walk && p.x <= u_street.x && v > elHalf;
  bool farWalk = p.x >= u_street.y && p.x < u_rowX && v > elHalf;   // the walk, and the yards' ground under the stoops

  if (topStreet || (sideStreet && v < elHalf + walk)) {
    col = asphaltStreet(p);
    // double yellow down the middle of the el street
    float yl = 1.0 - smoothstep(0.12, 0.22, abs(abs(v / u_ft) - 0.35));
    col = mix(col, vec3(0.78, 0.62, 0.22), yl * 0.85 * (topStreet ? 1.0 : 0.0));
    // the crosswalk across the side street where it meets the corner
    if (sideStreet) {
      float stripe = step(0.5, fract((p.x - u_street.x) / u_ft / 3.0));
      col = mix(col, vec3(0.86, 0.85, 0.82), stripe * 0.8);
    }
    return;
  }
  if (sideStreet) {
    col = asphaltStreet(p);
    // (one-way: no centre line.) The bus zone along the deli curb, from
    // the crosswalk: a broken white line along its edge, a solid one
    // closing it off
    float zx = (u_street.y - p.x) / u_ft;
    float inZone = step(p.y, u_zone);
    float edge = (1.0 - smoothstep(0.12, 0.25, abs(zx - 9.5))) * step(0.5, fract(p.y / u_ft / 6.0)) * inZone;
    float endL = (1.0 - smoothstep(0.12, 0.25, abs((p.y - u_zone) / u_ft))) * step(zx, 9.5);
    col = mix(col, vec3(0.84, 0.83, 0.8), max(edge, endL) * 0.75);
    return;
  }
  if (topWalk || nearWalk || farWalk) {
    vec2 a = topWalk ? vec2(p.x, v - elHalf) / u_ft : vec2(p.y, p.x) / u_ft;
    col = sidewalk(p, a);
    // the kerb, a lighter edge along the street
    float kerb = topWalk ? 1.0 - smoothstep(0.4, 0.9, (v - elHalf) / u_ft)
               : nearWalk ? 1.0 - smoothstep(0.4, 0.9, (u_street.x - p.x) / u_ft)
               : 1.0 - smoothstep(0.4, 0.9, (p.x - u_street.y) / u_ft);
    col = mix(col, vec3(0.75, 0.73, 0.69), kerb);
    return;
  }
}

// parked cars, from above. Local frame: x across (right +), y along
// (front +), feet. A tapered body, its sides rolling off into shade
// away from the sun, the roof a lit panel, the glass dark with a
// band of sky, door seams, mirrors, lights, and the cab's roof sign
const vec3 CAR_COL[5] = vec3[](vec3(0.95, 0.72, 0.12), vec3(0.55, 0.56, 0.57), vec3(0.16, 0.2, 0.3), vec3(0.86, 0.86, 0.84), vec3(0.42, 0.13, 0.13));
vec2 carLocal(vec2 d, float dir) {
  // a moving one's heading is free: 4 + radians from north
  if (dir > 3.5) { float a = dir - 4.0; vec2 f = vec2(sin(a), -cos(a)); return vec2(dot(d, vec2(f.y, -f.x)), dot(d, f)); }
  return dir < 0.5 ? d : dir < 1.5 ? vec2(-d.y, d.x) : dir < 2.5 ? -d : vec2(d.y, -d.x);
}
float carBody(vec2 d, float len) {
  float hw = 2.95 - 0.35 * smoothstep(len - 2.5, len, abs(d.y));
  return boxDist(d, vec2(0.0), vec2(hw - 0.6, len - 0.6)) - 0.6;
}
// ── the bus, from above (its own frame, ft, front +y): a long white
//    roof, rounded at the corners; the blue band along its sides just
//    showing; the windscreen dark across the front, the side windows a
//    dark strip down each edge; the air-conditioning pod at the back,
//    roof hatches; its front door, open at the stop; turn signals
float busShape(vec2 d, vec4 B, out vec3 col) {
  col = vec3(0.0);
  if (abs(d.x) > 5.0 || abs(d.y) > 19.0) return 0.0;
  float bd = boxDist(d, vec2(0.0), vec2(3.4, 17.2)) - 0.8;
  float a = 1.0 - smoothstep(-0.25, 0.2, bd);
  if (a <= 0.0) return 0.0;
  vec2 L = carLocal(-normalize(u_sun), 2.0);
  vec3 roof = vec3(0.86, 0.87, 0.88) * (0.93 + 0.07 * smoothstep(-4.0, 4.0, d.x * L.x * 2.0));
  col = roof;
  // the side band, blue, and the windows above it, at the very edges
  float edgeX = abs(d.x);
  col = mix(col, vec3(0.16, 0.18, 0.22), smoothstep(3.55, 3.75, edgeX) * step(-14.5, d.y) * step(d.y, 15.5));
  col = mix(col, vec3(0.14, 0.34, 0.68), smoothstep(3.95, 4.1, edgeX));
  // windscreen across the front, the rear window
  col = mix(col, vec3(0.1, 0.12, 0.15), smoothstep(16.3, 16.7, d.y));
  col = mix(col, vec3(0.2, 0.22, 0.25), smoothstep(-16.7, -17.1, d.y) * 0.8);
  // the AC pod at the back, raised, with its grille; two roof hatches
  float pod = 1.0 - smoothstep(-0.15, 0.15, boxDist(d, vec2(0.0, -11.0), vec2(2.6, 3.4)) - 0.4);
  vec3 pc = vec3(0.74, 0.75, 0.77) * (1.0 - 0.12 * step(0.5, fract(d.y * 1.2)) * step(abs(d.x), 1.8));
  col = mix(col, pc, pod);
  float hatch = max(1.0 - smoothstep(-0.1, 0.1, boxDist(d, vec2(0.0, 2.0), vec2(1.1, 1.1))), 1.0 - smoothstep(-0.1, 0.1, boxDist(d, vec2(0.0, 9.5), vec2(1.1, 1.1))));
  col = mix(col, vec3(0.7, 0.72, 0.74), hatch * 0.8);
  // the front door (on its right: local -x), dark when open
  float door = (1.0 - smoothstep(-0.1, 0.1, boxDist(d, vec2(-4.0, 13.2), vec2(0.45, 1.8)))) * B.z;
  col = mix(col, vec3(0.08, 0.08, 0.09), door);
  // signals
  if (abs(B.x) > 0.5 && B.y > 0.5) {
    float sx = B.x > 0.0 ? -1.0 : 1.0;
    float bl = max(1.0 - smoothstep(0.1, 0.6, length(d - vec2(sx * 3.8, 17.4))), 1.0 - smoothstep(0.1, 0.6, length(d - vec2(sx * 3.8, -17.4))));
    col = mix(col, vec3(1.0, 0.62, 0.12), bl);
  }
  return a;
}
// headlights, from the moving cars and the bus at dusk and after: a
// warm wash on the road ahead of each
float carLights(vec2 p) {
  float l = 0.0;
  for (int i = 4; i < 10; i++) {
    vec4 c = u_car[i];
    if (c.x > 8.0 || u_carB[i].w < 0.0) continue;
    float len = c.z > 8.5 ? 18.0 : 7.3;
    vec2 d = carLocal((p - c.xy) / u_ft, c.w) - vec2(0.0, len + 9.0);
    l += exp(-(d.x * d.x) / 18.0 - (d.y * d.y) / 60.0);
  }
  return l;
}
// ── the bus stop: just the sign on its pole at the curb (there was a
//    glass shelter here; it didn't earn its place, 2026-11-09). Returns
//    coverage; sh its (soft) shadow
float busStop(vec2 p, out vec3 col, out float sh, out float glow) {
  col = vec3(0.0); sh = 0.0; glow = 0.0;
  if (u_stop.x > 8.0) return 0.0;
  float a = 0.0;
  // the sign: a round pole and the blue sign on it, at the curb
  vec2 sg = vec2(u_street.y + 1.2 * u_ft, u_stop.y - 2.5 * u_ft);
  float pole = 1.0 - smoothstep(0.18, 0.3, length(p - sg) / u_ft);
  float sign_ = 1.0 - smoothstep(-0.05, 0.05, boxDist(p, sg + vec2(0.0, 0.6) * u_ft, vec2(0.25, 0.7) * u_ft) / u_ft);
  if (max(pole, sign_) > 0.0) { col = mix(vec3(0.12, 0.13, 0.14), vec3(0.15, 0.32, 0.65), sign_); a = max(a, max(pole, sign_)); }
  sh = max(sh, (1.0 - smoothstep(0.08, 0.25, length(p - sg - u_sun * 9.0 * u_ft) / u_ft)) * 0.4);
  sh = max(sh, (1.0 - smoothstep(0.05, 0.2, abs(dot(p - sg, normalize(vec2(-u_sun.y, u_sun.x)))) / u_ft)) * step(0.0, dot(p - sg, normalize(u_sun))) * step(dot(p - sg, normalize(u_sun)), length(u_sun) * 9.0 * u_ft) * 0.35);
  return a;
}

// is any car (or the bus) within reach of p? One check, and the loops
// below are skipped whole where the street's empty (most of the frame)
bool anyCarNear(vec2 p, float margin) {
  for (int i = 0; i < 10; i++) {
    vec4 c = u_car[i];
    if (c.x > 8.0) continue;
    vec2 d = (p - c.xy) / u_ft;
    float r = (c.z > 8.5 ? 18.5 : 7.8) + margin;
    if (dot(d, d) < r * r) return true;
  }
  return false;
}
float carShape(vec2 p, out vec3 col) {
  col = vec3(0);
  if (!anyCarNear(p, 1.5)) return 0.0;
  for (int i = 0; i < 10; i++) {
    vec4 c = u_car[i];
    if (c.x > 8.0) continue;
    vec2 d = carLocal((p - c.xy) / u_ft, c.w);
    if (c.z > 8.5) {
      // the bus
      vec3 bc;
      float ba = busShape(d, u_carB[i], bc);
      if (ba > 0.0) { col = bc; return ba; }
      continue;
    }
    if (abs(d.x) > 4.0 || abs(d.y) > 9.0) continue;
    // (a moving car keeps its own seed: from its position it'd change
    // model and paint every frame)
    vec2 key = i >= 4 ? vec2(abs(u_carB[i].w) * 37.0, 3.0) : c.xy;
    float kind = hash12(key * 100.0);
    bool suv = kind > 0.6 && c.z > 0.5;
    float len = suv ? 7.6 : 7.3;
    float bd = carBody(d, len);
    float body = 1.0 - smoothstep(-0.45, 0.35, bd);
    if (body < 0.01) continue;
    vec2 L = carLocal(-normalize(u_sun), c.w);
    vec3 k = CAR_COL[int(c.z + 0.5)];
    // the body is rounded: its sides fall into shade away from the sun
    float side = d.x / 2.9;
    float roll = 1.0 - pow(abs(side), 3.0);
    vec3 cc = k * (0.62 + 0.38 * roll) * (1.0 + 0.22 * side * L.x);
    // the greenhouse: windscreen, roof, rear glass, side windows
    float r0 = suv ? -5.6 : -3.4, r1 = suv ? 2.6 : 1.4;
    float ws = 1.0 - smoothstep(-0.3, 0.3, boxDist(d, vec2(0.0, r1 + 1.0), vec2(2.25 - (d.y - r1) * 0.12, 1.0)) - 0.2);
    float rw = 1.0 - smoothstep(-0.3, 0.3, boxDist(d, vec2(0.0, r0 - 0.7), vec2(2.1, 0.7)) - 0.2);
    float sw = (1.0 - smoothstep(1.9, 2.4, abs(d.x))) * smoothstep(1.6, 2.0, abs(d.x)) * smoothstep(r0 - 0.4, r0 + 0.4, d.y) * smoothstep(r1 + 0.6, r1 - 0.2, d.y);
    float roof = 1.0 - smoothstep(-0.4, 0.4, boxDist(d, vec2(0.0, (r0 + r1) * 0.5), vec2(1.85, (r1 - r0) * 0.5)) - 0.15);
    cc = mix(cc, k * (1.02 + 0.08 * L.x * side), roof);
    // a soft sheen along the roof and bonnet
    cc += vec3(0.1) * (1.0 - smoothstep(0.0, 0.9, abs(d.x + L.x * 0.8))) * (0.5 + 0.5 * roof);
    vec3 glass = mix(vec3(0.07, 0.09, 0.11), vec3(0.4, 0.46, 0.52), smoothstep(-1.5, 1.5, d.x * L.x + 0.5) * 0.6);
    cc = mix(cc, glass, max(max(ws, rw), sw) * 0.82);
    // wipers, the bonnet line, door seams
    // lights: pale at the front corners, red at the back
    float fl = 1.0 - smoothstep(0.1, 0.6, length((vec2(abs(d.x), d.y) - vec2(2.0, len - 0.35)) * vec2(0.6, 1.4)));
    float tl = 1.0 - smoothstep(0.1, 0.6, length((vec2(abs(d.x), d.y) - vec2(2.1, -len + 0.3)) * vec2(0.6, 1.4)));
    cc = mix(cc, vec3(0.92, 0.9, 0.82), fl * 0.5);
    cc = mix(cc, vec3(0.62, 0.12, 0.08), tl * 0.5);
    // braking: the tail lights bright
    if (i >= 4) cc = mix(cc, vec3(1.0, 0.16, 0.1), tl * u_carB[i].z * 0.8);
    // mirrors
    float mir = 0.6 - 0.6 * smoothstep(-0.1, 0.3, boxDist(vec2(abs(d.x), d.y), vec2(3.1, r1 + 0.3), vec2(0.3, 0.2)));
    // the cab: its roof sign, and the black-and-white check along the sides
    if (c.z < 0.5) {
      float sign_ = 1.0 - smoothstep(-0.1, 0.35, boxDist(d, vec2(0.0, (r0 + r1) * 0.5), vec2(0.9, 0.35)));
      cc = mix(cc, vec3(0.95, 0.94, 0.88), sign_);
    }
    cc = mix(cc, k * 0.6, mir);
    // snow on the roof, the bonnet and the boot, thinning to the edges and
    // only a dusting on the glass
    if (u_snow > 0.01) {
      float top = 1.0 - smoothstep(-1.5, -0.7, bd);
      float lump = 0.75 + 0.5 * vnoise(d * 1.6 + key * 50.0);
      float sn = top * mix(1.0, 0.15, max(max(ws, rw), sw)) * smoothstep(0.45, 0.85, lump * u_snow);
      vec3 sc = mix(vec3(0.82, 0.87, 0.96), vec3(1.0, 0.99, 0.97), clamp(0.5 - d.x * L.x * 0.15 + (lump - 0.75), 0.0, 1.0));
      cc = mix(cc, sc, sn * 0.88);
    }
    // spring: petals settled on the roof, bonnet and glass; thickest on
    // the cars parked under the cherries
    if (u_blossom > 0.01) {
      float nearC = 0.0;
      for (int j = 3; j <= 6; j += 3) nearC = max(nearC, 1.0 - smoothstep(0.6, 1.6, length(c.xy - u_crown[j].xy) / u_crown[j].z));
      vec2 pg = d * 3.2 + key * 91.0;
      vec2 pid = floor(pg), pf = fract(pg) - 0.5;
      float an = hash12(pid) * 6.283;
      vec2 po = mat2(cos(an), -sin(an), sin(an), cos(an)) * (pf - (hash22(pid + 3.0) - 0.5) * 0.4);
      float top = 1.0 - smoothstep(-1.2, -0.5, bd);
      float pt = (1.0 - smoothstep(0.14, 0.24, length(po * vec2(1.0, 1.5)))) * step(hash12(pid + 7.0), u_blossom * (0.03 + 0.2 * nearC)) * top;
      cc = mix(cc, mix(vec3(0.86, 0.6, 0.7), vec3(0.94, 0.8, 0.84), hash12(pid + 1.0)), pt * 0.9);
    }
    // a moving car's turn signal, blinking amber at its corners
    if (i >= 4 && abs(u_carB[i].x) > 0.5 && u_carB[i].y > 0.5) {
      float sx = u_carB[i].x > 0.0 ? -1.0 : 1.0;
      float bl = max(1.0 - smoothstep(0.1, 0.5, length(d - vec2(sx * 2.4, len - 0.3))), 1.0 - smoothstep(0.1, 0.5, length(d - vec2(sx * 2.4, -len + 0.3))));
      cc = mix(cc, vec3(1.0, 0.62, 0.12), bl);
    }
    col = cc;
    return max(body, mir);
  }
  return 0.0;
}
float carShadow(vec2 p) {
  // a hard shadow down-sun, and a soft dark contact shadow right round it
  float s = 0.0;
  // (the bus's is thrown 10 ft along the sun; the contact shade 2 ft out)
  if (!anyCarNear(p, 2.5 + 10.0 * length(u_sun))) return s;
  for (int i = 0; i < 10; i++) {
    vec4 c = u_car[i];
    if (c.x > 8.0) continue;
    vec2 d = carLocal((p - c.xy) / u_ft, c.w);
    if (c.z > 8.5) {
      // the bus: tall (10 ft), so its shadow lies well off
      vec2 ds = carLocal((p - u_sun * 10.0 * u_ft - c.xy) / u_ft, c.w);
      s = max(s, (1.0 - smoothstep(-0.4, 0.8, boxDist(ds, vec2(0.0), vec2(3.6, 17.4)) - 0.6)) * 0.8);
      s = max(s, (1.0 - smoothstep(-0.2, 1.6, boxDist(d, vec2(0.0), vec2(3.6, 17.4)) - 0.6)) * 0.6);
      continue;
    }
    if (abs(d.x) > 9.0 || abs(d.y) > 14.0) continue;
    float len = 7.4;
    vec2 ds = carLocal((p - u_sun * 3.8 * u_ft - c.xy) / u_ft, c.w);
    s = max(s, (1.0 - smoothstep(-0.3, 0.5, carBody(ds, len))) * 0.8);
    s = max(s, (1.0 - smoothstep(-0.2, 1.4, carBody(d, len))) * 0.6);
  }
  return s;
}

// ── the street lights: like the park's lamps, a dark post with a ball
//    lamp on top, seen from straight above: you see the ball, and the
//    post only as its long thin shadow. Where each stands at the kerb, in
//    the gaps between the street trees
vec2 slBase(int i) {
  float elK = u_el.x + u_walk.y + 1.8 * u_ft;
  float a = u_street.x - 1.5 * u_ft, b = u_street.y + 1.5 * u_ft;
  return i == 0 ? vec2(a, 0.56) : i == 1 ? vec2(a, 0.93) : i == 2 ? vec2(b, 0.38)
       : i == 3 ? vec2(9.0) :   // (removed: the walk under the el keeps just one)
         i == 4 ? vec2(0.78, elK) : vec2(b, 0.73);
}
const float SL_H = 16.0;   // ft
vec2 slHead(int i) { return slBase(i); }

float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }

// the ball from above: dark, a soft sheen on its sunny side
float streetLight(vec2 p, out vec3 col) {
  col = vec3(0.1, 0.11, 0.11);
  float a = 0.0;
  for (int i = 0; i < 6; i++) {
    vec2 q = (p - slBase(i)) / u_ft;
    float r = length(q);
    if (r > 1.2) continue;
    a = max(a, 1.0 - smoothstep(0.55, 0.8, r));
    float lit = clamp(dot(q / max(r, 1e-3), -normalize(u_sun)), 0.0, 1.0) * smoothstep(0.7, 0.2, r);
    col = mix(vec3(0.09, 0.1, 0.1), vec3(0.22, 0.23, 0.23), lit * 0.6);
  }
  return a;
}
// and its shadow: the thin post laid out along the sun, the ball at its end
float streetLightShadow(vec2 p) {
  float s = 0.0;
  for (int i = 0; i < 6; i++) {
    vec2 b = slBase(i), tip = b + u_sun * SL_H * u_ft;
    if (segD(p, b, tip) > 3.0 * u_ft) continue;
    s = max(s, 1.0 - smoothstep(0.05, 0.45, segD(p, b, tip) / u_ft));
    s = max(s, 1.0 - smoothstep(0.4, 1.15, length(p - tip) / u_ft));
  }
  return s * 0.85;
}
`;
