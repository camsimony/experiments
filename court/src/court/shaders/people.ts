/* ══ People, from above ════════════════════════════════════
   Simulated in people.ts. Seen from straight overhead a person is mostly
   shoulders and the top of a head: a rounded oblong in the colour of
   their top, the head (hair, or a hat) on it, arms swinging at the
   sides, a foot showing ahead and behind as they stride. What really
   says "person" from up here is the shadow: long and thin along the
   sun, legs to head. A dog is a small oblong with a head and a wagging
   tail, on a lead to its owner's hand.

   They're drawn the way the cars are, not as flat cut-outs: shoulders
   and head are domes, lit on the sun's side and falling into shade away
   from it; the cloth has a little texture; the outline isn't a perfect
   ellipse but wanders a touch, differently for each person; the edges
   feather out into the paving; and each stands in a soft pool of
   contact shade whether or not the sun's out. (u_life switches all of
   that off, for comparison.) */

export const PEOPLE_GLSL = /* glsl */ `
uniform vec4 u_person[12];  // x, y (world), heading, walk phase
uniform vec4 u_personB[12]; // top rgb, kind (0 walking, 1 sitting, 2 with a dog, 3 running, 7 mail, 8 stroller, 9 bike, 11 bags)
uniform vec4 u_personC[12]; // hair (or hat) rgb, a sitter's glance
uniform vec4 u_dog;         // x, y, heading, phase
uniform vec4 u_dogB;        // rgb, owner (-1 none)
uniform vec4 u_player[6];   // the pickup game: as u_person
uniform vec4 u_playerB[6];  // top rgb (or skin), kind (3 running, 4 arms up)
uniform vec4 u_playerC[6];  // hair rgb, how present (fading at the gate)
uniform vec4 u_personD[12]; // skin rgb, bare arms (0 sleeves .. 1)
uniform vec4 u_playerD[6];  // skin rgb, how much of the head is hair
uniform vec4 u_playerG[6];  // what they've on: hat (0 none, 1 headband, 2 cap, 3 cap backwards, 4 durag, 5 big hair), kit (0 tee, 1 jersey), shoes, shorts
uniform vec4 u_playerH[6];  // the hat's rgb, the jersey's piping (0 orange, 1 blue, 2 white)
uniform vec4 u_playerF[6];  // their feet, in their own frame: the left (ahead, to the left), the right
uniform vec4 u_skater[2];   // the skaters: as u_person (facing, kick phase)
uniform vec4 u_skaterB[2];  // top rgb, kind (5 riding, 6 pushing, 3 running)
uniform vec4 u_skaterC[2];  // hair rgb, presence
uniform vec4 u_skaterD[2];  // skin rgb, hair cover
uniform vec4 u_board[2];    // their boards: x, y, heading, height ft
uniform vec4 u_boardB[2];   // spin, roll (a flip), deck graphic, on
uniform vec4 u_personE[12]; // arm swing, on the phone, stride bob
uniform vec4 u_personF[12]; // their feet, in their own frame: the left, the right (x > 50: not on foot)
uniform vec4 u_ball;        // x, y (world), height (ft), on

// (a walker's own arm swing, and whether they're on their phone: set for
// each passer-by before drawing them, left at 1 and 0 for everyone else;
// the sun's direction in their frame, and a seed of their own)
float gArm = 1.0, gPhone = 0.0, gSeed = 0.0;
// (and a player's feet, where they are on the ground: gFeetOn says to use them)
vec4 gFeet = vec4(0.0); bool gFeetOn = false, gPlayer = false;
vec4 gKit = vec4(0.0), gHat = vec4(0.0);
// passers-by are drawn a little larger than life (true scale reads too
// small against the cars from up here; the players are at 1.5); what
// they push or ride stays true to the cars
const float PED = 1.4, PROP = 1.15;
vec2 gSun = vec2(0.0);
float ell(vec2 l, vec2 c, vec2 r, float soft) {
  // the outline wanders a little, so no one's a perfect ellipse, and the
  // edge is feathered wider than a hard cut-out's
  float wob = (vnoise(l * 5.0 + gSeed * 7.3) - 0.5) * 0.14 * u_life;
  float sf = mix(soft, min(0.9, soft * 1.5 + 0.12), u_life);
  return 1.0 - smoothstep(1.0 - sf, 1.0, length((l - c) / r) * (1.0 + wob));
}
// a dome's shading: lit toward the sun, into shade away from it, and
// darker right at the rim (q: position on the dome, -1..1 across it)
float dome(vec2 q) {
  float r2 = min(dot(q, q), 1.0);
  float lit = dot(q, gSun) * sqrt(1.0 - r2 * 0.6);
  // (the middle keeps its colour; the sun side lifts, the far side and
  // the rim fall off)
  return mix(1.0, (0.98 + 0.24 * lit) * (1.0 - 0.16 * r2 * r2), u_life);
}
// (the old drawing: separate ellipses, for ?life=0)
float personFlat(vec2 l, float ph, vec3 top, float kind, vec3 hair, float look, vec3 skin, float bare, float hairK, out vec3 col) {
  float sw = sin(ph);
  vec3 legs = vec3(0.17, 0.2, 0.26);
  float a = 0.0;
  col = legs;
  if (kind > 0.5 && kind < 1.5) {
    // sitting: knees out in front
    float k = max(ell(l, vec2(0.75, 0.32), vec2(0.55, 0.22), 0.4), ell(l, vec2(0.75, -0.32), vec2(0.55, 0.22), 0.4));
    a = max(a, k);
  } else if (kind > 8.5 && kind < 9.5) {
    // on a bike: feet going round on the pedals, either side of the frame
    float f = max(ell(l, vec2(sin(ph) * 0.35, 0.3), vec2(0.28, 0.13), 0.5), ell(l, vec2(-sin(ph) * 0.35, -0.3), vec2(0.28, 0.13), 0.5));
    col = mix(col, vec3(0.12, 0.12, 0.13), f);
    a = max(a, f);
  } else if (kind > 4.5 && kind < 6.5) {
    // on a board, side-on: the feet across it, shoulder-width apart along
    // it; pushing, the back foot is down beside it, kicking back
    float f = ell(l, vec2(0.02, 0.78), vec2(0.32, 0.15), 0.5);
    vec2 bk = kind > 5.5 ? vec2(0.45, -0.5 - (0.5 + 0.5 * sin(ph)) * 0.9) : vec2(0.02, -0.72);
    f = max(f, ell(l, bk, vec2(0.32, 0.15), 0.5));
    col = mix(col, vec3(0.12, 0.12, 0.13), f);
    a = max(a, f);
  } else {
    // a foot ahead and one behind, swapping with each stride (longer, running)
    float st = kind > 2.5 ? 0.85 : 0.62;
    float f = max(ell(l, vec2(sw * st, 0.2), vec2(0.3, 0.14), 0.5), ell(l, vec2(-sw * st, -0.2), vec2(0.3, 0.14), 0.5));
    col = mix(col, vec3(0.12, 0.12, 0.13), f);
    // (a hint of foot, not a solid pill: it's the shadow that says legs)
    a = max(a, f * mix(1.0, 0.7, u_life));
  }
  // arms: swinging opposite the feet (resting on the knees, sitting)
  float as_ = (kind > 0.5 && kind < 1.5) || kind > 4.5 ? 0.0 : sw * (kind > 2.5 ? 0.4 : 0.22) * gArm;
  float arm = max(ell(l, vec2(-as_, 0.7), vec2(0.34, 0.16), 0.5), ell(l, vec2(as_, -0.7), vec2(0.34, 0.16), 0.5));
  // on the phone: one hand up in front, the screen a pale fleck in it
  if (gPhone > 0.5) arm = max(ell(l, vec2(as_ * 0.3, 0.7), vec2(0.32, 0.15), 0.5), ell(l, vec2(0.42, -0.32), vec2(0.3, 0.13), 0.5));
  // arms out to the handlebars (a bike, a stroller); carrying bags,
  // they hang straight
  if (kind > 7.5 && kind < 9.5) arm = max(ell(l, vec2(0.55, 0.55), vec2(0.45, 0.14), 0.5), ell(l, vec2(0.55, -0.55), vec2(0.45, 0.14), 0.5));
  if (kind > 10.5) arm = max(ell(l, vec2(-sw * 0.06, 0.72), vec2(0.32, 0.15), 0.5), ell(l, vec2(sw * 0.06, -0.72), vec2(0.32, 0.15), 0.5));
  // arms up (shooting, or a hand up to contest): reaching out in front
  if (kind > 3.5 && kind < 4.5) arm = max(ell(l, vec2(0.6, 0.36), vec2(0.5, 0.15), 0.5), ell(l, vec2(0.6, -0.36), vec2(0.5, 0.15), 0.5));
  // (bare arms in a tee or a vest; sleeves in a coat)
  col = mix(col, mix(top * 0.85, skin, bare * smoothstep(0.25, 0.45, abs(l.y))) * dome((l - vec2(0.0, sign(l.y) * 0.7)) / vec2(0.5, 0.3)), arm);
  a = max(a, arm * mix(1.0, 0.8, u_life));
  // shoulders and back
  float b = ell(l, vec2(-0.02, 0.0), vec2(0.48, 0.8), 0.35);
  // the cloth: a little texture, a fold or two, over the shoulders' dome
  float cloth = mix(1.0, 0.9 + 0.2 * vnoise(l * 4.5 + gSeed * 13.1), u_life);
  vec3 tc = top * (0.95 + 0.1 * smoothstep(0.3, -0.3, l.x)) * cloth * dome((l - vec2(-0.02, 0.0)) / vec2(0.5, 0.82));
  col = mix(col, tc, b);
  a = max(a, b);
  if (gPhone > 0.5) {
    float ph_ = 1.0 - smoothstep(0.06, 0.1, length((l - vec2(0.62, -0.22)) / vec2(1.0, 0.6)));
    col = mix(col, vec3(0.75, 0.8, 0.85), ph_);
    a = max(a, ph_);
  }
  // the head, a touch ahead of the shoulders; turned, if they're looking
  vec2 hc = vec2(0.08, 0.0) + vec2(cos(look), sin(look)) * 0.05;
  float h = ell(l, hc, vec2(0.36), 0.35);
  // the crown is hair (or a hat); the brow in front, and the whole head
  // if it's shaved, is skin
  vec3 hd = mix(skin, hair, (1.0 - smoothstep(0.08, 0.2, l.x - hc.x)) * hairK);
  col = mix(col, hd * (0.9 + 0.2 * smoothstep(0.0, -0.3, l.x - hc.x)) * dome((l - hc) / 0.36), h);
  a = max(a, h);
  // the edge feathers into the ground a little
  return mix(a, a * a * (3.0 - 2.0 * a), u_life * 0.6);
}
// one person in their own frame, feet: x forward, y to their left.
// Not separate ellipses: each part is a signed distance, and they're
// joined with a smooth minimum so arms and feet flow out of the torso and
// the head sits on a neck, one silhouette; the colours grade into each
// other by distance rather than switching at a line
float sdEll(vec2 l, vec2 c, vec2 r) { return (length((l - c) / r) - 1.0) * min(r.x, r.y); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float person(vec2 l, float ph, vec3 top, float kind, vec3 hair, float look, vec3 skin, float bare, float hairK, out vec3 col) {
  if (u_life < 0.5) return personFlat(l, ph, top, kind, hair, look, skin, bare, hairK, col);
  // the outline wanders a little, differently for each person
  l *= 1.0 + (vnoise(l * 5.0 + gSeed * 7.3) - 0.5) * 0.12;
  float sw = sin(ph);
  vec3 legs = vec3(0.17, 0.2, 0.26), shoe = vec3(0.12, 0.12, 0.13);
  // a player's own shoes and shorts, and what's on their head
  float hat = 0.0, hr = 0.27;
  // (the passers-by: everyone's trousers their own, by who they are;
  // some, of those out in short sleeves, in shorts)
  float shortsK = gPlayer ? 1.0 : 0.0;
  if (gFeetOn && !gPlayer) {
    float t = hash12(vec2(gSeed, 3.0));
    legs = t < 0.3 ? vec3(0.17, 0.2, 0.26) : t < 0.5 ? vec3(0.1, 0.1, 0.11) : t < 0.7 ? vec3(0.24, 0.3, 0.42) : t < 0.86 ? vec3(0.52, 0.46, 0.36) : vec3(0.3, 0.31, 0.3);
    shoe = hash12(vec2(gSeed, 5.0)) < 0.3 ? vec3(0.82, 0.82, 0.8) : shoe;
    shortsK = bare > 0.9 && hash12(vec2(gSeed, 9.0)) < 0.45 ? 1.0 : 0.0;
  }
  if (gPlayer) {
    float s = gKit.z, q = gKit.w;
    shoe = s < 0.5 ? vec3(0.1, 0.1, 0.11) : s < 1.5 ? vec3(0.93, 0.93, 0.9) : s < 2.5 ? vec3(0.8, 0.14, 0.12) : s < 3.5 ? vec3(0.66, 0.82, 0.24) : vec3(0.95, 0.5, 0.12);
    legs = q < 0.5 ? vec3(0.09, 0.09, 0.1) : q < 1.5 ? vec3(0.45, 0.46, 0.48) : q < 2.5 ? vec3(0.1, 0.14, 0.3) : q < 3.5 ? vec3(0.1, 0.3, 0.72) : vec3(0.8, 0.8, 0.78);
    hat = gKit.x; if (hat > 4.5) hr = 0.33;
  }
  bool sitting = kind > 0.5 && kind < 1.5, biking = kind > 8.5 && kind < 9.5, boarding = kind > 4.5 && kind < 6.5;
  bool running = kind > 2.5 && kind < 3.5, armsUp = kind > 3.5 && kind < 4.5;
  // feet
  float f1, f2; vec3 fc = shoe;
  if (sitting) { f1 = sdEll(l, vec2(0.75, 0.32), vec2(0.55, 0.22)); f2 = sdEll(l, vec2(0.75, -0.32), vec2(0.55, 0.22)); fc = legs; }
  else if (biking) { f1 = sdEll(l, vec2(sw * 0.35, 0.3), vec2(0.28, 0.13)); f2 = sdEll(l, vec2(-sw * 0.35, -0.3), vec2(0.28, 0.13)); }
  else if (boarding) {
    vec2 bk = kind > 5.5 ? vec2(0.45, -0.5 - (0.5 + 0.5 * sw) * 0.9) : vec2(0.02, -0.72);
    f1 = sdEll(l, vec2(0.02, 0.78), vec2(0.32, 0.15)); f2 = sdEll(l, bk, vec2(0.32, 0.15));
  } else {
    float st = running ? 0.85 : 0.62;
    f1 = sdEll(l, vec2(sw * st, 0.2), vec2(0.3, 0.14)); f2 = sdEll(l, vec2(-sw * st, -0.2), vec2(0.3, 0.14));
    if (gFeetOn) { f1 = sdEll(l, gFeet.xy, vec2(0.3, 0.14)); f2 = sdEll(l, gFeet.zw, vec2(0.3, 0.14)); }
  }
  float feet = min(f1, f2);
  // a player's legs: from each hip out to its foot, wherever that is on
  // the ground, so a foot that's reached out is still on the end of a
  // leg (the shorts at the top of it, then the bare shin, narrowing)
  float leg = 1e3, legK = 0.0;
  if (gFeetOn) {
    for (int j = 0; j < 2; j++) {
      vec2 hip = vec2(-0.03, j == 0 ? 0.17 : -0.17), ft = j == 0 ? gFeet.xy : gFeet.zw;
      vec2 pa = l - hip, ba = ft - hip;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      float dl = length(pa - ba * h) - mix(0.15, 0.1, h);
      if (dl < leg) { leg = dl; legK = h * length(ba); }
    }
  }
  // arms: swinging opposite the feet; out to the bars; hanging with bags;
  // up in front; one up with a phone
  float as_ = sitting || kind > 4.5 ? 0.0 : sw * (running ? 0.4 : 0.22) * gArm;
  float a1 = sdEll(l, vec2(-as_, 0.56), vec2(0.3, 0.12)), a2 = sdEll(l, vec2(as_, -0.56), vec2(0.3, 0.12));
  if (gPhone > 0.5) { a1 = sdEll(l, vec2(as_ * 0.3, 0.56), vec2(0.28, 0.12)); a2 = sdEll(l, vec2(0.4, -0.28), vec2(0.28, 0.11)); }
  if (kind > 7.5 && kind < 9.5) { a1 = sdEll(l, vec2(0.5, 0.48), vec2(0.42, 0.11)); a2 = sdEll(l, vec2(0.5, -0.48), vec2(0.42, 0.11)); }
  if (kind > 10.5) { a1 = sdEll(l, vec2(-sw * 0.06, 0.58), vec2(0.28, 0.12)); a2 = sdEll(l, vec2(sw * 0.06, -0.58), vec2(0.28, 0.12)); }
  // a player's arms: each from its shoulder to its hand, and the hand
  // swung as far as the opposite foot's stepped (forward with it, back
  // with it), so the arms pump as hard as the legs go; a defender's are
  // out wide, down in a stance
  float armH = 0.0;
  bool limbs = gFeetOn && gPhone < 0.5 && !(kind > 7.5 && kind < 9.5) && kind < 10.5;
  if (limbs) {
    float guard = gPlayer ? fract(gKit.y) * 4.0 : 0.0, armAmt = gPlayer ? 1.0 : min(1.0, gArm), rest = gPlayer ? 0.14 : 0.04;
    for (int j = 0; j < 2; j++) {
      float sg = j == 0 ? 1.0 : -1.0, fx = j == 0 ? gFeet.z : gFeet.x;
      float swg = clamp(fx * 0.8, -0.75, 0.8) * armAmt;
      vec2 sh = vec2(0.0, sg * 0.48);
      vec2 hand = vec2(swg + rest, sg * (0.66 - 0.14 * abs(swg)));
      hand = mix(hand, vec2(0.3 + swg * 0.2, sg * 1.15), guard);
      vec2 pa = l - sh, ba = hand - sh;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      float da = length(pa - ba * h) - mix(0.13, 0.095, h);
      if (j == 0) { a1 = da; armH = h; } else { a2 = da; if (a2 < a1) armH = h; }
    }
  }
  if (armsUp) { a1 = sdEll(l, vec2(0.55, 0.3), vec2(0.48, 0.12)); a2 = sdEll(l, vec2(0.55, -0.3), vec2(0.48, 0.12)); }
  float arms = min(a1, a2);
  // shoulders and back, and the head (a touch smaller than it was, so it
  // sits in the shoulders rather than on them), turned if they're looking
  // (shoulders about a foot and a half across at the passers-by's
  // scale, narrowing toward the hips behind)
  float torso = sdEll(l, vec2(0.0, 0.0), vec2(0.36, 0.56 * (1.0 - 0.2 * smoothstep(0.1, -0.4, l.x))));
  vec2 hc = vec2(0.12, 0.0) + vec2(cos(look), sin(look)) * 0.04;
  float head = sdEll(l, hc, vec2(hr));
  // a cap's brim, out in front (or behind, worn backwards); a durag's
  // tail down the back of the neck
  float brim = 1e3;
  if (hat > 1.5 && hat < 2.5) brim = sdEll(l, hc + vec2(0.27, 0.0), vec2(0.17, 0.2));
  else if (hat > 2.5 && hat < 3.5) brim = sdEll(l, hc - vec2(0.27, 0.0), vec2(0.17, 0.2));
  else if (hat > 3.5 && hat < 4.5) brim = sdEll(l, hc - vec2(0.3, 0.0), vec2(0.2, 0.09));
  // one silhouette: arms and feet filleted into the torso (just enough
  // to lose the seams, not the shape), the head on a short neck
  float body = smin(torso, arms, 0.16);
  body = smin(body, feet, 0.12);
  if (gFeetOn) body = smin(min(body, leg), min(torso, leg), 0.1);
  body = smin(body, head, 0.12);
  if (brim < 1.0) body = smin(body, brim, 0.05);
  // colours grade into each other by how near each part is
  float k = 0.09;
  float wt = exp(-max(torso, 0.0) / k), wa = exp(-max(arms, 0.0) / k), wf = exp(-max(feet, 0.0) / k) * 0.9, wh = exp(-max(head, 0.0) / (k * 0.6)) * 2.2;
  vec3 cloth = top * (0.9 + 0.2 * vnoise(l * 4.5 + gSeed * 13.1)) * (0.95 + 0.1 * smoothstep(0.3, -0.3, l.x)) * dome(l / vec2(0.38, 0.58));
  // (the arms a shade darker where they meet the body: the fold of the
  // sleeve, and what keeps them readable as arms)
  vec3 armC = mix(top * 0.8, skin, bare * smoothstep(0.2, 0.4, abs(l.y))) * dome((l - vec2(0.0, sign(l.y) * 0.56)) / vec2(0.45, 0.25));
  vec3 hd = mix(skin, hair, (1.0 - smoothstep(0.03, 0.14, l.x - hc.x)) * hairK) * (0.9 + 0.2 * smoothstep(0.0, -0.3, l.x - hc.x)) * dome((l - hc) / hr);
  // the head stands off the shoulders: a little shade under it, all
  // round, so it doesn't run into the shirt
  float under = (1.0 - smoothstep(0.0, 0.13, head)) * 0.34;
  if (limbs) armC = mix(top * 0.8, skin, smoothstep(0.2, 0.42, armH) * (gPlayer ? 1.0 : bare > 0.5 ? bare : 0.0)) * 0.96;
  // (a long sleeve still has a hand at the end of it)
  if (limbs && !gPlayer && bare <= 0.5) armC = mix(armC, skin, smoothstep(0.8, 0.95, armH));
  if (gFeetOn) wf *= smoothstep(-0.06, 0.04, torso);
  cloth *= 1.0 - under; armC *= 1.0 - under; wh *= 1.6;
  if (gPlayer) {
    // a headband: a ring of it round the head; a cap or a durag: over
    // the whole of it (a cap's button on top, its brim a shade darker)
    if (hat > 0.5 && hat < 1.5) hd = mix(hd, gHat.rgb, smoothstep(-0.13, -0.1, head) * 0.95);
    else if (hat > 1.5 && hat < 4.5) {
      hd = gHat.rgb * (0.85 + 0.5 * dome((l - hc) / hr));
      if (hat < 3.5) hd = mix(hd, gHat.rgb * 1.8 + 0.08, 1.0 - smoothstep(0.03, 0.06, length(l - hc)));
    }
    // the jersey: cut away at the shoulders (bare, with the arms), piped
    // down each side and round the neck
    if (gKit.y > 0.5) {
      vec3 pipe = gHat.w < 0.5 ? vec3(0.95, 0.5, 0.12) : gHat.w < 1.5 ? vec3(0.1, 0.3, 0.72) : vec3(0.95);
      float ay = abs(l.y);
      cloth = mix(cloth, pipe, (1.0 - smoothstep(0.02, 0.045, abs(ay - 0.33))) * 0.9);
      cloth = mix(cloth, pipe, (1.0 - smoothstep(0.02, 0.045, abs(head - 0.07))) * 0.9);
      cloth = mix(cloth, skin * 0.95, smoothstep(0.37, 0.41, ay));
      armC = skin * 0.96 * (1.0 - under);
    }
  }
  float wl = gFeetOn ? exp(-max(leg, 0.0) / k) * 0.8 * smoothstep(-0.06, 0.04, torso) : 0.0;
  vec3 legC = mix(legs * 1.25, skin * 0.86, smoothstep(0.3, 0.55, legK) * shortsK);
  col = (cloth * wt + armC * wa + fc * wf + hd * wh + legC * wl) / (wt + wa + wf + wh + wl + 1e-4);
  if (brim < 1.0) col = mix(col, gHat.rgb * 0.8, (1.0 - smoothstep(-0.03, 0.03, brim)) * smoothstep(-0.03, 0.03, head));
  if (gPhone > 0.5) col = mix(col, vec3(0.75, 0.8, 0.85), 1.0 - smoothstep(0.06, 0.1, length((l - vec2(0.62, -0.22)) / vec2(1.0, 0.6))));
  // the edge, feathered out into the ground
  float a = 1.0 - smoothstep(-0.08, 0.08, body);
  return a * a * (3.0 - 2.0 * a);
}
float dogShape(vec2 l, float ph, vec3 c, out vec3 col) {
  col = c;
  float body = ell(l, vec2(0.0), vec2(1.0, 0.36), 0.35);
  float head = ell(l, vec2(1.05, 0.0), vec2(0.34, 0.27), 0.4);
  float ears = max(ell(l, vec2(0.95, 0.24), vec2(0.15, 0.1), 0.5), ell(l, vec2(0.95, -0.24), vec2(0.15, 0.1), 0.5));
  vec2 tc = vec2(-1.15, sin(ph * 1.7) * 0.25);
  float tail = 1.0 - smoothstep(0.06, 0.13, length(l - vec2(clamp(l.x, -1.45, -0.9), mix(0.0, tc.y, clamp((-l.x - 0.9) / 0.55, 0.0, 1.0)))));
  float legs = 0.0;
  for (int k = 0; k < 4; k++) {
    float fx = k < 2 ? 0.62 : -0.62, fy = mod(float(k), 2.0) < 0.5 ? 0.3 : -0.3;
    float s = sin(ph + float(k) * 1.6) * 0.18;
    legs = max(legs, ell(l, vec2(fx + s, fy), vec2(0.13, 0.1), 0.5));
  }
  col = mix(c * 0.8, c, body) * dome(l / vec2(1.1, 0.4));
  col = mix(col, c * 0.65, ears);
  float a = max(max(max(body, head), max(ears, tail * 0.95)), legs * 0.9);
  return mix(a, a * a * (3.0 - 2.0 * a), u_life * 0.6);
}

// a skateboard from above, its own frame (ft): x along it. The grip
// tape's black; rolled over in a flip it narrows edge-on, and past the
// halfway shows the graphic underneath and the wheels
float boardShape(vec2 l, float roll, float deck, out vec3 col) {
  float c = cos(roll);
  float w = max(0.05, 0.38 * abs(c));
  vec2 q = abs(l) - vec2(1.35 - w, 0.0);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - w;
  float a = 1.0 - smoothstep(-0.05, 0.04, d);
  vec3 under = deck < 0.5 ? vec3(0.82, 0.32, 0.2) : vec3(0.88, 0.82, 0.58);
  col = c >= 0.0 ? vec3(0.13, 0.13, 0.14) : under;
  if (c < 0.0) {
    vec2 wq = vec2(abs(l.x) - 0.95, abs(l.y) - 0.3 * abs(c));
    float wh = 1.0 - smoothstep(0.08, 0.14, length(wq));
    col = mix(col, vec3(0.92, 0.9, 0.84), wh);
  }
  return a;
}
// what someone has with them, in their own frame: a stroller pushed ahead,
// a Citi Bike under them, a bag in each hand, the mail carrier's satchel
float segL(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float rbox(vec2 l, vec2 c, vec2 h, float r) { vec2 q = abs(l - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float propShape(vec2 l, float kind, float ph, out vec3 col) {
  col = vec3(0.0);
  float a = 0.0;
  if (kind > 7.5 && kind < 8.5) {
    // the stroller: its seat, the hood over the front of it, the handle
    // the parent holds, four little wheels
    float body = 1.0 - smoothstep(-0.05, 0.05, rbox(l, vec2(2.15, 0.0), vec2(0.72, 0.46), 0.28));
    float hood = 1.0 - smoothstep(-0.05, 0.05, rbox(l, vec2(2.45, 0.0), vec2(0.45, 0.48), 0.4));
    float handle = 1.0 - smoothstep(0.04, 0.09, segL(l, vec2(1.2, -0.48), vec2(1.2, 0.48)));
    float wh = 0.0;
    for (int k = 0; k < 4; k++) wh = max(wh, 1.0 - smoothstep(0.08, 0.14, length(l - vec2(k < 2 ? 1.55 : 2.75, mod(float(k), 2.0) < 0.5 ? 0.52 : -0.52))));
    col = vec3(0.1, 0.1, 0.11);
    col = mix(col, vec3(0.3, 0.33, 0.38), body);
    col = mix(col, vec3(0.18, 0.2, 0.24) * (0.85 + 0.25 * step(0.5, fract(l.x * 3.0))), hood);
    a = max(max(body, hood), max(handle, wh));
  } else if (kind > 8.5 && kind < 9.5) {
    // a Citi Bike: the chunky blue frame, the wheels edge-on (thin dark
    // strokes), mudguards, the bars across, the rack on the front
    float tyre = max(1.0 - smoothstep(0.05, 0.1, segL(l, vec2(0.95, 0.0), vec2(2.85, 0.0))), 1.0 - smoothstep(0.05, 0.1, segL(l, vec2(-2.0, 0.0), vec2(-0.1, 0.0))));
    float frame = 1.0 - smoothstep(0.08, 0.14, segL(l, vec2(-0.85, 0.0), vec2(1.15, 0.0)));
    float guard = max(1.0 - smoothstep(0.07, 0.12, segL(l, vec2(1.35, 0.0), vec2(2.45, 0.0))), 1.0 - smoothstep(0.07, 0.12, segL(l, vec2(-1.6, 0.0), vec2(-0.6, 0.0))));
    float bars = 1.0 - smoothstep(0.04, 0.08, segL(l, vec2(1.15, -0.95), vec2(1.15, 0.95)));
    float rack = 1.0 - smoothstep(-0.04, 0.04, rbox(l, vec2(1.85, 0.0), vec2(0.32, 0.42), 0.08));
    col = vec3(0.1, 0.1, 0.11);
    col = mix(col, vec3(0.16, 0.42, 0.78), max(frame, guard));
    col = mix(col, vec3(0.16, 0.17, 0.19), rack);
    a = max(max(tyre, frame), max(max(guard, bars), rack * 0.95));
  } else if (kind > 10.5) {
    // groceries: a paper bag in each hand, swinging a little
    float sw = sin(ph) * 0.12;
    float b1 = 1.0 - smoothstep(-0.04, 0.04, rbox(l, vec2(-0.05 + sw, 1.08), vec2(0.3, 0.22), 0.06));
    float b2 = 1.0 - smoothstep(-0.04, 0.04, rbox(l, vec2(-0.05 - sw, -1.08), vec2(0.3, 0.22), 0.06));
    col = vec3(0.74, 0.6, 0.42) * (0.9 + 0.1 * sign(l.x));
    a = max(b1, b2);
  } else if (kind > 6.5 && kind < 7.5) {
    // the mail carrier's satchel on the hip, its strap across the back
    float bag = ell(l, vec2(-0.05, -0.98), vec2(0.44, 0.26), 0.35);
    float strap = (1.0 - smoothstep(0.04, 0.08, segL(l, vec2(0.25, 0.62), vec2(-0.2, -0.78))));
    col = mix(vec3(0.16, 0.18, 0.24), vec3(0.3, 0.34, 0.44), bag);
    a = max(bag, strap * 0.9);
  }
  return a;
}
vec2 toLocal(vec2 p, vec2 at, float hd) {
  vec2 d = (p - at) / u_ft, f = vec2(cos(hd), sin(hd));
  return vec2(dot(d, f), dot(d, vec2(-f.y, f.x)));
}
// the sun's direction (toward it) in a figure's frame
void faceSun(float hd) {
  vec2 s = -normalize(u_sun + vec2(1e-4)), f = vec2(cos(hd), sin(hd));
  gSun = vec2(dot(s, f), dot(s, vec2(-f.y, f.x)));
}
// is anyone (or their bike, board, dog) within r feet of p at all? Most
// of the frame has no one: one check, and the loops below are skipped
// as a whole
bool anyoneNear(vec2 p, float r) {
  float rr = r * r * u_ft * u_ft;
  for (int i = 0; i < 12; i++) { vec2 d = p - u_person[i].xy; if (dot(d, d) < rr) return true; }
  for (int i = 0; i < 6; i++) { vec2 d = p - u_player[i].xy; if (dot(d, d) < rr) return true; }
  for (int i = 0; i < 2; i++) { vec2 d = p - u_skater[i].xy, e = p - u_board[i].xy; if (u_boardB[i].w > 0.5 && (dot(d, d) < rr || dot(e, e) < rr)) return true; }
  if (u_dogB.w > -0.5) { vec2 d = p - u_dog.xy; if (dot(d, d) < rr) return true; }
  return false;
}
vec4 peopleAt(vec2 p) {
  vec4 o = vec4(0.0);
  if (!anyoneNear(p, 5.0)) return o;
  // the lead first, under everything: from the owner's hand to the collar
  if (u_dogB.w > -0.5 && length(p - u_dog.xy) < 5.0 * u_ft) {
    int oi = int(u_dogB.w + 0.5);
    vec4 P = u_person[oi];
    vec2 hand = P.xy + (vec2(cos(P.z), sin(P.z)) * 0.3 + vec2(sin(P.z), -cos(P.z)) * 0.85) * PED * u_ft;
    vec2 col_ = u_dog.xy + vec2(cos(u_dog.z), sin(u_dog.z)) * 0.8 * u_ft;
    vec2 pa = p - hand, ba = col_ - hand;
    float d = length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) / u_ft;
    o = mix(o, vec4(0.1, 0.1, 0.11, 1.0), (1.0 - smoothstep(0.03, 0.09, d)) * 0.9);
    vec3 dc;
    faceSun(u_dog.z); gSeed = 4.0;
    float da = dogShape(toLocal(p, u_dog.xy, u_dog.z) / 1.15, u_dog.w, u_dogB.rgb, dc);
    o = mix(o, vec4(dc, 1.0), da);
  }
  // everyone, in one loop (so the figure is drawn by one copy of
  // person(), not three: the shader's size is what the whole frame pays
  // for): the people on the walk first, then the skaters, each on (or
  // after) their board, then the pickup game, drawn a little larger
  // than life so it reads from up here
  for (int i = 0; i < 20; i++) {
    vec4 P, B, C, D;
    float scale, bare, hairK, alpha, look;
    if (i < 12) {
      P = u_person[i];
      if (length(p - P.xy) > 4.0 * u_ft) continue;
      vec3 c;
      // (bobbing as they stride: from above, a touch bigger and smaller)
      float bob = 1.0 + 0.025 * u_personE[i].z;
      float kd = u_personB[i].w;
      // the stroller or bike first, under them (at the cars' scale); the
      // bags and satchel ride with the body
      bool carried = kd > 10.5 || (kd > 6.5 && kd < 7.5);
      float pa = propShape(toLocal(p, P.xy, P.z) / ((carried ? PED : PROP) * bob), kd, P.w, c);
      o = mix(o, vec4(c, 1.0), pa);
      if (length(p - P.xy) > 2.0 * PED * u_ft) continue;
      B = u_personB[i]; C = u_personC[i]; D = u_personD[i];
      scale = PED * bob; bare = D.w; hairK = 1.0; alpha = 1.0; look = C.w;
      gArm = u_personE[i].x; gPhone = u_personE[i].y; gSeed = float(i) + 1.0;
      gFeet = u_personF[i]; gFeetOn = gFeet.x < 50.0; gPlayer = false;
    } else if (i < 14) {
      int k = i - 12;
      vec4 Bd = u_board[k], Bb = u_boardB[k];
      if (Bb.w < 0.5) continue;
      float lift = 1.0 + Bd.w * 0.04;
      P = u_skater[k];
      if (length(p - P.xy) > 3.5 * u_ft && length(p - Bd.xy) > 3.5 * u_ft) continue;
      vec3 c;
      float a = boardShape(toLocal(p, Bd.xy, Bd.z + Bb.x) / (1.4 * lift), Bb.y, Bb.z, c);
      o = mix(o, vec4(c, 1.0), a * u_skaterC[k].w);
      if (length(p - P.xy) > 3.5 * u_ft) continue;
      B = u_skaterB[k]; C = u_skaterC[k]; D = u_skaterD[k];
      scale = 1.4 * lift; bare = 1.0; hairK = D.w; alpha = C.w; look = B.w > 4.5 ? 1.3 : 0.0;
      gArm = 1.0; gPhone = 0.0; gSeed = 20.0 + float(k);
      gFeetOn = false; gPlayer = false;
    } else {
      int k = i - 14;
      P = u_player[k];
      if (length(p - P.xy) > 3.0 * u_ft) continue;
      B = u_playerB[k]; C = u_playerC[k]; D = u_playerD[k];
      scale = 1.5; bare = 1.0; hairK = D.w; alpha = C.w; look = 0.0;
      gArm = 1.0; gPhone = 0.0; gSeed = 30.0 + float(k);
      gFeet = u_playerF[k]; gKit = u_playerG[k]; gHat = u_playerH[k];
      gFeetOn = true; gPlayer = true;
    }
    faceSun(P.z);
    vec3 c;
    float a = person(toLocal(p, P.xy, P.z) / scale, P.w, B.rgb, B.w, C.rgb, look, D.rgb, bare, hairK, c);
    o = mix(o, vec4(c, 1.0), a * alpha);
  }
  gArm = 1.0; gPhone = 0.0; gFeetOn = false; gPlayer = false;
  return o;
}
// the ball: orange, its black seams, lit on the sun's side; it's drawn
// over the players (it's in their hands, or above them)
vec4 ballAt(vec2 p) {
  if (u_ball.w < 0.5) return vec4(0.0);
  vec2 d = (p - u_ball.xy) / u_ft;
  float r = 0.55 * (1.0 + u_ball.z * 0.012);
  float a = 1.0 - smoothstep(r - 0.1, r + 0.04, length(d));
  if (a <= 0.0) return vec4(0.0);
  vec3 c = vec3(0.86, 0.42, 0.16) * (0.75 + 0.45 * clamp(dot(d / r, -normalize(u_sun)) * 0.6 + 0.5, 0.0, 1.0));
  float seam = (1.0 - smoothstep(0.02, 0.06, abs(d.x))) + (1.0 - smoothstep(0.02, 0.06, abs(length(d - vec2(r * 1.2, 0.0)) - r * 0.85)));
  c = mix(c, vec3(0.15, 0.08, 0.05), clamp(seam, 0.0, 1.0) * 0.7);
  return vec4(c, a);
}
// their shadows, long and thin down the sun: not a stencil, but the
// figure itself laid down along the sun's direction. Each part (the
// legs, scissoring as they walk; the torso; the arms, swinging, or
// hanging with bags, or out to the bars; the head) is taken from where
// it sits in the figure's own frame and projected across the sun at its
// height, so someone walking into the sun throws a narrow shadow and
// someone crossing it a wide one, and no two are the same. Each person
// their own height, too. (scale: how large the figure's drawn.)
vec2 proj(vec2 c, vec2 r, vec2 ax) { return vec2(c.x * ax.x + c.y * ax.y, sqrt(r.x * r.x * ax.x * ax.x + r.y * r.y * ax.y * ax.y)); }
float band(float across, vec2 cw, float soft) { return 1.0 - smoothstep(cw.y - soft, cw.y + soft, abs(across - cw.x)); }
// a stretch of the shadow's length, from a to b (as fractions of its
// height), its ends soft so the parts run into each other
float seg(float t, float a, float b, float w) { return smoothstep(a - w, a + w, t) * (1.0 - smoothstep(b - w, b + w, t)); }
float figureShadow(vec2 p, vec4 P, float kind, float scale, float armK, float seed, float softK) {
  vec2 sd = u_sun / max(length(u_sun), 1e-3);
  vec2 d = (p - P.xy) / u_ft;
  bool sitting = kind > 0.5 && kind < 1.5, biking = kind > 8.5 && kind < 9.5, boarding = kind > 4.5 && kind < 6.5;
  bool running = kind > 2.5 && kind < 3.5, armsUp = kind > 3.5 && kind < 4.5, bars = kind > 7.5 && kind < 9.5, bags = kind > 10.5;
  float hv = 0.9 + 0.2 * hash12(vec2(seed, 7.0));
  float H = (sitting ? 3.6 : biking ? 4.6 : 5.6) * hv * (scale / 1.15) * length(u_sun);
  float along = dot(d, sd), across = dot(d, vec2(-sd.y, sd.x));
  if (along < -1.5 || along > H * 1.3 + 1.0 || abs(across) > 2.6 * scale) return 0.0;
  float t = clamp(along / H, 0.0, 1.0);
  // the figure's own axes (x forward, y left) seen across the sun
  vec2 f = vec2(cos(P.z), sin(P.z)), perp = vec2(-sd.y, sd.x);
  vec2 ax = vec2(dot(f, perp), dot(vec2(-f.y, f.x), perp)) * scale;
  float soft = softK * scale, sw = sin(P.w);
  // (how soft the parts' ends are along the length: softer figures,
  // softer joins)
  float ew = softK * 0.6;
  float s = 0.0;
  // legs: from the hips (close together) down to the feet (apart with
  // the stride); sitting, out in front
  if (sitting) {
    float k = seg(t, -1.0, 0.36, ew);
    s = max(s, max(band(across, proj(vec2(0.75, 0.32), vec2(0.5, 0.2), ax), soft), band(across, proj(vec2(0.75, -0.32), vec2(0.5, 0.2), ax), soft)) * k);
  } else {
    float legT = 1.0 - smoothstep(0.0, 0.5, t);
    float st = (biking ? 0.35 : running ? 0.85 : boarding ? 0.0 : 0.62) * legT;
    vec2 lr = vec2(0.14, 0.11);
    float lk = seg(t, -1.0, 0.5, ew);
    vec2 g1 = vec2(sw * st, 0.17), g2 = vec2(-sw * st, -0.17);
    if (gFeetOn) { g1 = vec2(gFeet.x * legT, mix(0.17, gFeet.y, legT)); g2 = vec2(gFeet.z * legT, mix(-0.17, gFeet.w, legT)); }
    s = max(s, band(across, proj(g1, lr, ax), soft) * lk);
    s = max(s, band(across, proj(g2, lr, ax), soft) * lk);
  }
  // the torso: hips to shoulders, filling out upward (leaning forward on
  // a bike)
  float t0 = sitting ? 0.3 : 0.42, t1 = 0.86;
  float tk = seg(t, t0, t1, ew);
  float hip = mix(0.78, 1.0, smoothstep(t0, t1 - 0.1, t));
  s = max(s, band(across, proj(vec2(biking ? 0.25 : 0.0, 0.0), vec2(0.34, 0.56 * hip), ax), soft * 1.3) * tk);
  // the arms: hanging from the shoulders, swinging with the stride (most
  // at the hand); straight down with bags; forward to the bars; up and
  // out, shooting
  if (!sitting) {
    float handT = 1.0 - smoothstep(0.42, 0.82, t);
    float as_ = (boarding ? 0.0 : sw * (running ? 0.4 : 0.22) * armK) * handT;
    vec2 ar = vec2(0.13, 0.11);
    float ak = seg(t, 0.4, 0.84, ew);
    vec2 c1 = vec2(-as_, 0.56), c2 = vec2(as_, -0.56);
    if (bags) { c1 = vec2(0.0, 0.58); c2 = vec2(0.0, -0.58); }
    if (bars) { c1 = vec2(0.5 * handT, 0.48); c2 = vec2(0.5 * handT, -0.48); ak = seg(t, 0.5, 0.84, ew); }
    if (gFeetOn && !bags && !bars) { c1 = vec2(clamp(gFeet.z * 0.8, -0.75, 0.8) * handT * min(1.0, armK), 0.56); c2 = vec2(clamp(gFeet.x * 0.8, -0.75, 0.8) * handT * min(1.0, armK), -0.56); }
    if (armsUp) { c1 = vec2(0.55, 0.3); c2 = vec2(0.55, -0.3); ak = seg(t, 0.84, 2.0, ew) * (1.0 - smoothstep(H * 1.22, H * 1.34, along)); }
    s = max(s, max(band(across, proj(c1, ar, ax), soft), band(across, proj(c2, ar, ax), soft)) * ak);
  }
  // the head
  vec2 hc = proj(vec2(0.12, 0.0), vec2(0.27), ax);
  s = max(s, 1.0 - smoothstep(0.27 * scale - soft, 0.27 * scale + soft, length(vec2((along - H * 0.93) * 0.85, across - hc.x))));
  // and the soft dark right at the feet
  s = max(s, (1.0 - smoothstep(0.4, 0.9, length(d) / scale)) * 0.6);
  return s * smoothstep(-0.5, -0.1, along);
}
float peopleShadow(vec2 p) {
  float s = 0.0;
  // (a shadow reaches about 1.3 heights down the sun, a player's up to
  // 8 ft tall; the skaters' are thrown further when they're in the air)
  if (!anyoneNear(p, 2.5 + 9.6 * length(u_sun) + 4.0 * max(u_board[0].w, u_board[1].w))) return s;
  // (everyone in one loop, as in peopleAt: one copy of figureShadow)
  for (int i = 0; i < 20; i++) {
    vec4 P; float kind, scale, armK, seed, softK, alpha; vec2 q = p;
    if (i < 12) {
      P = u_person[i];
      if (P.x > 8.0) continue;
      gFeet = u_personF[i]; gFeetOn = gFeet.x < 50.0;
      kind = u_personB[i].w; scale = PED; armK = u_personE[i].x; seed = float(i) + 1.0; softK = 0.2; alpha = 1.0;
      // a stroller's or bike's shadow, low, just off along the sun
      if (kind > 7.5 && kind < 9.5) {
        vec3 dc;
        s = max(s, propShape(toLocal(p - u_sun * 2.2 * u_ft, P.xy, P.z) / PROP, kind, P.w, dc) * 0.7);
      }
    } else if (i < 14) {
      // the skaters' (thrown further off in the air), and their boards'
      int k = i - 12;
      if (u_boardB[k].w < 0.5) continue;
      gFeetOn = false;
      float hh = u_board[k].w;
      q = p - u_sun * hh * u_ft;
      vec3 dc;
      s = max(s, boardShape(toLocal(p - u_sun * (hh + 0.3) * u_ft, u_board[k].xy, u_board[k].z + u_boardB[k].x) / 1.4, u_boardB[k].y, 0.0, dc) * 0.7 * u_skaterC[k].w);
      P = u_skater[k]; kind = u_skaterB[k].w; scale = 1.4; armK = 1.0; seed = 20.0 + float(k); softK = 0.16; alpha = u_skaterC[k].w;
    } else {
      int k = i - 14;
      P = u_player[k];
      if (P.x > 8.0) continue;
      kind = u_playerB[k].w; scale = 1.5; armK = 1.0; seed = 30.0 + float(k); softK = 0.12; alpha = u_playerC[k].w;
      gFeet = u_playerF[k]; gFeetOn = true;
    }
    s = max(s, figureShadow(q, P, kind, scale, armK, seed, softK) * alpha);
  }
  gFeetOn = false;
  // the ball's, further off the higher it goes
  if (u_ball.w > 0.5) s = max(s, (1.0 - smoothstep(0.35, 0.6, length((p - u_sun * u_ball.z * u_ft - u_ball.xy) / u_ft))) * 0.8);
  if (u_dogB.w > -0.5) {
    vec3 dc;
    s = max(s, dogShape(toLocal(p - u_sun * 1.4 * u_ft, u_dog.xy, u_dog.z) / 1.15, u_dog.w, vec3(0.0), dc) * 0.8);
  }
  return s;
}
// the soft dark right under each figure, there whatever the weather: it
// sits them on the ground (and is most of what grounds the cars too)
float peopleContact(vec2 p) {
  float s = 0.0;
  if (!anyoneNear(p, 3.0)) return s;
  for (int i = 0; i < 12; i++) {
    vec4 P = u_person[i];
    if (P.x > 8.0) continue;
    vec2 d = (p - P.xy) / u_ft;
    float k = u_personB[i].w;
    // (a bike's or a stroller's spreads along it)
    vec2 r = k > 7.5 && k < 9.5 ? vec2(2.2, 0.9) : vec2(0.95, 0.8) * PED / 1.15;
    vec2 f = vec2(cos(P.z), sin(P.z));
    vec2 l = vec2(dot(d, f), dot(d, vec2(-f.y, f.x))) + (k > 7.5 && k < 9.5 ? vec2(-0.6, 0.0) : vec2(0.0));
    s = max(s, 1.0 - smoothstep(0.2, 1.0, length(l / r)));
  }
  for (int i = 0; i < 6; i++) {
    vec4 P = u_player[i];
    if (P.x > 8.0) continue;
    s = max(s, (1.0 - smoothstep(0.3, 1.1, length((p - P.xy) / u_ft))) * u_playerC[i].w);
  }
  for (int i = 0; i < 2; i++) {
    if (u_boardB[i].w < 0.5) continue;
    s = max(s, (1.0 - smoothstep(0.4, 1.2, length((p - u_skater[i].xy) / u_ft))) * u_skaterC[i].w * (1.0 - smoothstep(0.0, 3.0, u_board[i].w)));
  }
  if (u_dogB.w > -0.5) s = max(s, 1.0 - smoothstep(0.3, 1.1, length((p - u_dog.xy) / u_ft)));
  return s * u_life;
}
`;
