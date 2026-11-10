import { COMMON } from "./common";

/* ══ The finishing pass ═══════════════════════════════════
   What makes the koi pond feel like a photograph of a painting, not a
   render, and the same three moves here:

   1. Soft focus toward the frame. The scene is re-read through a small
      golden-angle disc of samples whose radius grows near the edge, so
      the middle is crisp and the borders go dreamy.
   2. A gentle film look: a soft shoulder on the highlights, blacks
      lifted a touch, a warm cast in the shadows.
   3. Film grain, re-rolled about twelve times a second (not every frame,
      which reads as video noise), with a little colour, strongest in the
      midtones.

   And then the fade: a rounded rectangle, its outline wandering a
   little, dissolved into the page on a long tail, so there's no line
   where the court ends. The canvas is transparent and premultiplied;
   the white page shows through the fade.

   And, once, the drawing-in (u_draw, 0 to 1), as if in watercolour
   pencil on the page: first the scene's outlines sketched in, working
   across the sheet patch by patch; then its colours laid over them in
   hatched pencil strokes, the paper showing between; then water taken
   to it, the strokes dissolving into the full picture behind a wet
   edge. At 1 it's the scene itself and none of this runs. */

export const POST_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_scene;
uniform vec2 u_size;       // output px
uniform float u_grainFrame;
uniform float u_feather;   // px
uniform float u_blur;      // px at the very edge
uniform float u_draw;      // the drawing-in: 0 blank page .. 1 the scene

${COMMON}

float grainAt(vec2 p) {
  return (hash12(floor(p)) + hash12(floor(p) + 17.0) - 1.0);
}

void main() {
  vec2 px = v_uv * u_size;
  // distance inside a rounded rectangle, its edge roughened a little
  vec2 half_ = u_size * 0.5;
  float inset = u_feather * 0.25, rad = min(u_size.x, u_size.y) * 0.09;
  vec2 q = abs(px - half_) - (half_ - inset - rad);
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
  // only a slow wander: the koi pond's edge is soft, not torn
  float wobble = (fbm3(px / min(u_size.x, u_size.y) * 2.2 + 3.0) - 0.5) * u_feather * 0.35;
  float inside = -(sd + wobble);

  // 1. soft focus, more toward the edge
  float k = 1.0 - smoothstep(0.0, u_feather * 2.2, inside);
  float radius = u_blur * k * k;
  // the scene texture is stored bottom-up
  vec2 suv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 col = texture(u_scene, suv).rgb;
  if (radius > 0.4) {
    vec3 sum = col;
    for (int i = 1; i < 17; i++) {
      float fi = float(i);
      float a = fi * 2.39996;
      vec2 off = vec2(cos(a), sin(a)) * sqrt(fi / 16.0) * radius / u_size;
      sum += texture(u_scene, suv + off).rgb;
    }
    col = sum / 17.0;
  }

  // 2. the film look
  col = col / (1.0 + col * 0.18) * 1.12;        // soft shoulder
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.4);   // and some depth in the mids
  col = mix(vec3(0.035, 0.03, 0.03), vec3(1.0), col);   // lifted blacks
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col += vec3(0.012, 0.004, -0.01) * (1.0 - l);  // warm in the shadows

  // 3. grain, a new frame of it ~12 times a second
  vec2 gp = px / 1.4 + hash22(vec2(u_grainFrame, 3.0)) * 400.0;
  vec3 grain = vec3(grainAt(gp)) * 0.8 + vec3(grainAt(gp + 41.3), grainAt(gp + 83.1), grainAt(gp + 127.9)) * 0.2;
  col += grain * 0.055 * mix(0.5, 1.0, 4.0 * l * (1.0 - l));

  // the drawing-in
  if (u_draw < 1.0) {
    float unit = min(u_size.x, u_size.y) / 700.0;
    vec2 n = px / min(u_size.x, u_size.y);
    // the order it's worked in: across the sheet from the top left, in patches
    float area = fbm3(n * 3.1 + 7.0);
    float s = clamp(0.5 * (n.x * 0.55 + (1.0 - v_uv.y) * 0.75) / 1.0 + 0.5 * area, 0.0, 1.0);
    // the outlines: where the picture's tone changes, in a soft dark pencil
    vec2 e = vec2(2.0 * unit) / u_size;
    vec3 W = vec3(0.299, 0.587, 0.114);
    float gx = dot(texture(u_scene, suv + vec2(e.x, 0.0)).rgb - texture(u_scene, suv - vec2(e.x, 0.0)).rgb, W);
    float gy = dot(texture(u_scene, suv + vec2(0.0, e.y)).rgb - texture(u_scene, suv - vec2(0.0, e.y)).rgb, W);
    float tooth = hash12(floor(px / (1.3 * unit)));
    float line = smoothstep(0.05, 0.2, length(vec2(gx, gy))) * (0.55 + 0.45 * tooth);
    float sketch = smoothstep(0.0, 0.1, clamp(u_draw / 0.42, 0.0, 1.0) * 1.1 - s);
    // the colour, in pencil: strokes all slanting the one way, as a hand
    // lays them (not quite straight, not quite evenly spaced), filling
    // in as more are laid, the paper's tooth left showing through
    vec2 dir = vec2(0.731, 0.682);
    float across = dot(px, vec2(-dir.y, dir.x)) / (3.6 * unit) + (fbm3(px / (90.0 * unit) + 5.0) - 0.5) * 1.6;
    float stroke = abs(fract(across) - 0.5) * 2.0;
    float thr = mix(stroke, tooth, 0.38);
    float laid = clamp((clamp((u_draw - 0.2) / 0.46, 0.0, 1.0) * 1.3 - s) * 2.6, 0.0, 1.0) * 0.9;
    float cover = smoothstep(thr - 0.22, thr + 0.22, laid) * step(0.001, laid);
    vec3 pencil = mix(col, vec3(1.0), 0.16);
    vec3 pic = mix(vec3(1.0), pencil, cover);
    vec3 lead = mix(vec3(0.3, 0.29, 0.32), col * 0.4, 0.45);
    // the water: spreading in soft-edged pools, the pencil going to paint
    // behind its front, a little pigment gathered along it
    float pool = clamp(0.55 * fbm3(n * 2.3 + 40.0) + 0.45 * s, 0.0, 1.0);
    float wet = smoothstep(0.0, 0.2, clamp((u_draw - 0.58) / 0.42, 0.0, 1.0) * 1.2 - pool);
    pic = mix(pic, lead, line * sketch * 0.7 * (1.0 - wet));
    pic = mix(pic, col, wet);
    pic *= 1.0 - 0.1 * wet * (1.0 - wet) * 4.0;
    col = pic;
  }

  // the fade into the page, on a long gentle tail
  float alpha = pow(smoothstep(0.0, 1.0, clamp(inside / u_feather, 0.0, 1.0)), 1.3);
  o = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}
`;
