/* ══ Growing the trees ════════════════════════════════════
   Every plane tree's branches are grown once, in JavaScript, and drawn
   into a texture the shader reads. Doing it here rather than in the
   shader is what lets them look like trees: real recursion, five or six
   levels deep, which a shader can't afford per pixel.

   How a plane grows, seen from above (the references in the folder):
   - a few big limbs leave the trunk, each spreading into its own fan,
     so the crown's outline is lobed, not round;
   - every branch is a chain of short segments that changes direction at
     each node, a slight zig-zag, rather than one straight stick;
   - side branches fork off at the nodes, at 20–45°, shorter and
     thinner than their parent, and fork again, and again, down to a
     fine fuzz of twigs at the crown's edge;
   - thickness tapers all the way, so a limb thins into its twigs.

   The texture has two channels:
     R  branch coverage, sharp (thin twigs drawn faint, not thick)
     G  where leaves grow: soft blots at the tips of the smaller
        branches. The leaf shader uses it, so leaves cluster where the
        twigs are, and the canopy's masses follow the tree's own shape.

   Each tree has its own seed, so it's the same tree every visit and in
   every season. */

type Crown = [number, number, number];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Seg = { x0: number; y0: number; x1: number; y1: number; w0: number; w1: number };

function growTree(cx: number, cy: number, R: number, ft: number, seed: number) {
  const rand = rng(seed * 9973 + 17);
  const segs: Seg[] = [];
  const tips: [number, number, number][] = [];
  const minW = 0.035 * ft;
  /* a small street tree is a smaller tree, not a big one squeezed: its
     limbs are thinner and it forks fewer times, so it reads as the same
     kind of branching at its own scale instead of a dense knot */
  const size = Math.min(1, R / 0.3);
  const maxDepth = size > 0.7 ? 7 : size > 0.4 ? 6 : 5;
  const twigN = size > 0.5 ? 1 : 0.6;
  let budget = Math.round(16000 * Math.max(0.25, size));

  /* the fuzz at a crown's edge: where a small branch ends, a spray of
     short, thin, kinked twigs fanning forward */
  const spray = (x: number, y: number, ang: number, len: number) => {
    const n = Math.max(2, Math.round((3 + Math.floor(rand() * 3)) * twigN));
    for (let k = 0; k < n; k++) {
      let a = ang + (rand() - 0.5) * 1.6, px = x, py = y;
      const parts = 2 + Math.floor(rand() * 2);
      for (let j = 0; j < parts; j++) {
        a += (rand() - 0.5) * 0.6;
        const l = len * (0.35 + rand() * 0.4) / parts;
        const nx = px + Math.cos(a) * l, ny = py + Math.sin(a) * l;
        segs.push({ x0: px, y0: py, x1: nx, y1: ny, w0: minW * 1.1, w1: minW * 0.7 });
        px = nx; py = ny;
      }
    }
  };

  /* a branch: a chain of kinked segments, forking at its nodes */
  const branch = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
    const nodes = 3 + Math.floor(rand() * 3);
    const step = len / nodes;
    let px = x, py = y, a = ang, pw = w;
    for (let i = 0; i < nodes && budget > 0; i++) {
      budget--;
      /* the zig-zag: each node turns a little, alternating mostly */
      a += (rand() - 0.5) * 0.7 + (i % 2 ? 0.12 : -0.12);
      /* and a gentle pull outward, so limbs fan away from the trunk */
      const out = Math.atan2(py - cy, px - cx);
      const d0 = Math.hypot(px - cx, py - cy);
      if (d0 > R * 0.15) a += Math.atan2(Math.sin(out - a), Math.cos(out - a)) * 0.12;
      const sl = step * (0.75 + rand() * 0.5);
      const nx = px + Math.cos(a) * sl, ny = py + Math.sin(a) * sl;
      const nw = pw * 0.86;
      /* the crown has an edge: nothing grows far past it */
      if (Math.hypot(nx - cx, ny - cy) > R * (0.92 + rand() * 0.12)) {
        tips.push([px, py, depth]);
        if (depth >= 2) spray(px, py, a, step * 1.4);
        return;
      }
      segs.push({ x0: px, y0: py, x1: nx, y1: ny, w0: pw, w1: nw });
      /* fork: a side branch off this node, to one side or the other */
      if (depth < maxDepth && nw > minW && rand() < (depth < 2 ? 0.85 : 0.72)) {
        const side = rand() < 0.5 ? -1 : 1;
        branch(nx, ny, a + side * (0.35 + rand() * 0.45), len * (0.5 + rand() * 0.2), nw * 0.68, depth + 1);
      }
      px = nx; py = ny; pw = nw;
    }
    /* the end of a branch carries on as a smaller one, or ends in twigs */
    if (depth < maxDepth && pw > minW && budget > 0) {
      branch(px, py, a + (rand() - 0.5) * 0.5, len * 0.72, pw * 0.75, depth + 1);
      if (rand() < 0.75) branch(px, py, a + (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.4), len * 0.58, pw * 0.62, depth + 1);
    } else {
      tips.push([px, py, depth]);
      spray(px, py, a, len * 0.6);
    }
  };

  /* the big limbs: four to six, spread round the trunk unevenly */
  const limbs = 4 + Math.floor(rand() * 3);
  const a0 = rand() * Math.PI * 2;
  const w0 = 1.15 * ft * Math.pow(size, 0.8);
  for (let i = 0; i < limbs; i++) {
    const a = a0 + (i / limbs) * Math.PI * 2 + (rand() - 0.5) * 0.7;
    branch(cx, cy, a, R * (0.36 + rand() * 0.12), w0 * (0.8 + rand() * 0.4), 0);
  }
  /* and the middle of the crown: from above, a plane's centre isn't
     empty, it's the limbs rising up and out of the trunk, seen end on,
     forking straight away into a mesh of smaller branches. Short limbs
     that start a few feet out along each big one and branch at once */
  const inner = Math.round((11 + Math.floor(rand() * 5)) * size * size);
  for (let i = 0; i < inner; i++) {
    const a = (i / Math.max(1, inner)) * Math.PI * 2 + (rand() - 0.5) * 0.6;
    const r0 = R * (0.05 + rand() * 0.3);
    branch(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, a + (rand() - 0.5) * 0.8, R * (0.2 + rand() * 0.14), w0 * (0.4 + rand() * 0.2), 2);
  }
  return { segs, tips };
}

/* draw every tree into one texture covering the frame and a margin round
   it: trees reach past the frame's edge, and their shadows are cast from
   the parts you can't see, so those have to exist too */
export const MARGIN = 0.45;
export function branchTexture(crowns: Crown[], world: [number, number], ft: number, pxPerUnit = 900) {
  const W = Math.round((world[0] + MARGIN * 2) * pxPerUnit), H = Math.round((world[1] + MARGIN * 2) * pxPerUnit);
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    return c;
  };
  const rc = mk(), gc = mk();
  const r = rc.getContext("2d")!, g = gc.getContext("2d")!;
  r.lineCap = "round"; r.lineJoin = "round";
  r.strokeStyle = "#fff";
  g.globalCompositeOperation = "lighter";

  /* world → texture: shifted by the margin */
  r.translate(MARGIN * pxPerUnit, MARGIN * pxPerUnit);
  g.translate(MARGIN * pxPerUnit, MARGIN * pxPerUnit);
  crowns.forEach(([x, y, R], i) => {
    const { segs, tips } = growTree(x, y, R, ft, i + 1);
    const rand = rng(i * 31 + 7);
    for (const s of segs) {
      const wpx = ((s.w0 + s.w1) / 2) * pxPerUnit;
      /* anything under a pixel wide is drawn a pixel wide, but faint:
         that's what reads as fine twigs rather than a thick scribble */
      r.globalAlpha = Math.min(1, wpx);
      r.lineWidth = Math.max(1, wpx);
      r.beginPath();
      r.moveTo(s.x0 * pxPerUnit, s.y0 * pxPerUnit);
      r.lineTo(s.x1 * pxPerUnit, s.y1 * pxPerUnit);
      r.stroke();
    }
    /* leaves gather round the tips of the smaller branches */
    for (const [tx, ty, depth] of tips) {
      if (depth < 2) continue;
      const rad = (2.6 + rand() * 1.8) * ft * pxPerUnit;
      const grd = g.createRadialGradient(tx * pxPerUnit, ty * pxPerUnit, 0, tx * pxPerUnit, ty * pxPerUnit, rad);
      grd.addColorStop(0, "rgba(255,255,255,0.32)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(tx * pxPerUnit - rad, ty * pxPerUnit - rad, rad * 2, rad * 2);
    }
  });

  const rd = r.getImageData(0, 0, W, H).data, gd = g.getImageData(0, 0, W, H).data;
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    out[i * 4] = rd[i * 4 + 3];
    out[i * 4 + 1] = gd[i * 4 + 3];
    out[i * 4 + 2] = 0;
    out[i * 4 + 3] = 255;
  }
  return { W, H, data: out };
}
