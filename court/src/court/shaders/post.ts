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
   the white page shows through the fade. */

export const POST_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_scene;
uniform vec2 u_size;       // output px
uniform float u_grainFrame;
uniform float u_feather;   // px
uniform float u_blur;      // px at the very edge

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

  // the fade into the page, on a long gentle tail
  float alpha = pow(smoothstep(0.0, 1.0, clamp(inside / u_feather, 0.0, 1.0)), 1.3);
  o = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}
`;
