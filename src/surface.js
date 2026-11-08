// Surface loops for the "Deep diving" whale tail: the whale always stays in the water.
// The flat cut at the bottom of the built-in icon is the waterline (SF_WATER). The tail model's stock is
// continued below it and everything of the whale under the line is clipped, so the tail can only rise
// out of / slide into the water and its cut never shows in the air. The water itself is not drawn; it
// only shows where something touches it (ripples, collars, streaks, drips, bubbles, blows).
// Uses RIG_MODEL (rig-model.js) and restPose() (rig.js). Loops live in surface-anims.js (SF_DEFS); the
// spout's blow is noto-blow.js.

const SF_WATER = 13.742;
const SF_TAU = Math.PI * 2;
const SF_SR = 120;
const sfClamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sfSeg = (t, a, b) => sfClamp((t - a) / (b - a));
const sfSmooth = (k) => k * k * (3 - 2 * k);
const sfEaseIn = (k) => k * k;
const sfEaseOut = (k) => 1 - (1 - k) * (1 - k);
const sfEaseOut3 = (k) => 1 - Math.pow(1 - k, 3);
const sfEaseInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const sfBackOut = (k, s = 1.70158) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
const sfBump = (t, a, b) => Math.sin(Math.PI * sfSeg(t, a, b));
const sfLerp = (a, b, k) => a + (b - a) * k;
/** 0 outside [a, b], eases in and out inside: envelope for small "alive" motions during holds */
const sfEnv = (t, a, b, edge = 0.25) => sfSmooth(sfSeg(t, a, a + edge)) * (1 - sfSmooth(sfSeg(t, b - edge, b)));

// ---------------------------------------------------------------- tail model (stock continued under water)
const SF_MODEL = (() => {
  const P = RIG_MODEL.points, S = RIG_MODEL.s;
  // right line: deep → just below p0 (keeps the tangent at p0); left line: just below p45 → deep
  const r = [[2.9, 7.2, 0], [2.24, 3.4, 0], [2.012, 0.602, 0]];
  const l = [[-2.345, 0.664, 0], [-2.66, 3.4, 0], [-3.2, 7.2, 0]];
  return { points: [...r, ...P, ...l], s: [-0.5, -0.3, -0.1, ...S, -0.1, -0.3, -0.5] };
})();
// indices into the projected outline: fluke tips, trailing-edge notch, a point on each lower (leading) edge
const SF_TIP_R = 3 + 13, SF_TIP_L = 3 + 32, SF_NOTCH = 3 + 22, SF_EDGE_R = 3 + 9, SF_EDGE_L = 3 + 37;

function sfRestPose() {
  return Object.assign(restPose(), { ang: 0, pvx: 0, pvy: 0, asym: 0 });
}

/** Project the extended tail. Same deformation chain as rigProject, plus `asym` (both flukes roll the same
 *  way about the stock, so one tip rises while the other drops), then squash/stretch about the base,
 *  rotation `ang` about the pivot (pvx, pvy) given relative to the base, and translation. */
function sfProject(p) {
  const { base, knee } = RIG_MODEL;
  const { points, s } = SF_MODEL;
  const out = new Array(points.length);
  const cP = Math.cos(p.pitch), sP = Math.sin(p.pitch);
  const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
  for (let i = 0; i < points.length; i++) {
    let [x, y, z] = points[i];
    const si = s[i];
    const w = Math.min(1, Math.max(0, (si - knee[0]) / (knee[1] - knee[0])));
    const fl = Math.min(1, Math.max(0, (si - 0.42) / 0.2));
    if (fl > 0) {
      const ax = Math.min(1, Math.abs(x) / 7);
      const fold = p.dihed * Math.sign(x) + p.asym;
      if (fold) {
        const a = fold * fl * Math.pow(ax, 0.5);
        const c = Math.cos(a), sn = Math.sin(a);
        const x0 = x, z0 = z;
        x = x0 * c + z0 * sn;
        z = -x0 * sn + z0 * c;
      }
      const f = (p.flexP + p.curl * ax * ax) * fl;
      if (f) {
        const yr = -6.2, dy = y - yr, c = Math.cos(f), sn = Math.sin(f);
        y = yr + dy * c - z * sn;
        z = dy * sn + z * c;
      }
    }
    const yaw = p.yaw + p.twist * (si - 0.8);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    let X = x * cy + z * sy, Z = -x * sy + z * cy, Y = y;
    const Y2 = Y * cP - Z * sP;
    Z = Y * sP + Z * cP; Y = Y2;
    const roll = p.rollB + (p.rollT - p.rollB) * w;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    let px = X * cr - Y * sr, py = X * sr + Y * cr;
    px *= p.sx; py *= p.sy;
    const dx = px - p.pvx, dy = py - p.pvy;
    out[i] = [base[0] + p.pvx + dx * ca - dy * sa + p.tx, base[1] + p.pvy + dx * sa + dy * ca + p.ty];
  }
  return out;
}

const sfR = (v) => Math.round(v * 1000) / 1000;
function sfPath(pts) {
  let d = `M${sfR(pts[0][0])} ${sfR(pts[0][1])}`;
  for (let i = 1; i + 2 < pts.length; i += 3) d += `C${sfR(pts[i][0])} ${sfR(pts[i][1])} ${sfR(pts[i + 1][0])} ${sfR(pts[i + 1][1])} ${sfR(pts[i + 2][0])} ${sfR(pts[i + 2][1])}`;
  return d;
}
function sfPoly(pts) {
  let d = '';
  for (let i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + sfR(pts[i][0]) + ' ' + sfR(pts[i][1]);
  return d;
}
/** x positions where the outline crosses the waterline */
function sfCrossings(pts) {
  const xs = [];
  const bez = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };
  let px = pts[0][0], py = pts[0][1];
  for (let i = 1; i + 2 < pts.length; i += 3) {
    for (let k = 1; k <= 8; k++) {
      const u = k / 8;
      const x = bez(pts[i - 1][0], pts[i][0], pts[i + 1][0], pts[i + 2][0], u), y = bez(pts[i - 1][1], pts[i][1], pts[i + 1][1], pts[i + 2][1], u);
      if ((py - SF_WATER) * (y - SF_WATER) < 0) xs.push(px + ((SF_WATER - py) / (y - py)) * (x - px));
      px = x; py = y;
    }
  }
  return xs;
}
// ---------------------------------------------------------------- water fx
// Everything is a pure function of t, so any frame can be drawn on its own.

/** ripple ring on the water: grows from r0 to r1 and fades; rings weaken as they spread */
function sfRipple(fr, t, t0, dur, cx, r0, r1, a0, flat = 0.2, w = 0.55, dash = null) {
  const k = (t - t0) / dur;
  if (k <= 0 || k >= 1) return;
  const rx = r0 + (r1 - r0) * sfEaseOut3(k);
  fr.ripples.push({ cx, cy: SF_WATER + 0.12, rx, ry: Math.max(0.2, rx * flat), a: a0 * Math.pow(1 - k, 1.4), w, dash });
}
/** the calm, smooth patch a diving tail leaves behind (a "flukeprint"), drawn as a faint dashed oval */
function sfPrint(fr, t, t0, dur, cx, w0) {
  const k = (t - t0) / dur;
  if (k <= 0 || k >= 1) return;
  const rx = w0 * (1 + 0.55 * sfEaseOut(k));
  fr.ripples.push({ cx, cy: SF_WATER + 0.15, rx, ry: rx * 0.17, a: 0.42 * Math.sin(Math.PI * Math.pow(k, 0.6)), w: 0.42, dash: [0.5, 0.75] });
}
function sfLand(y, vy, g) {
  const c = y - SF_WATER - 0.25, disc = vy * vy - 2 * g * c;
  return (-vy + Math.sqrt(Math.max(0, disc))) / g;
}
/** ballistic drop with air drag; shrinks a little as it flies and leaves a tiny ring where it lands */
function sfDrop(fr, t, t0, x, y, vx, vy, r = 0.45, g = 40, ring = 0.5) {
  const k = t - t0;
  if (k <= 0) return;
  const tl = sfLand(y, vy, g);
  if (k < tl) {
    fr.drops.push({ x: x + vx * k, y: y + vy * k + 0.5 * g * k * k, r: r * (1 - 0.25 * k / tl), a: 1 });
    return;
  }
  if (ring) sfRipple(fr, t, t0 + tl, 0.42, x + vx * tl, 0.25, 1.5 * ring, 0.5 * ring, 0.25, 0.45);
}
/** water running off an edge: a drip hangs and stretches, pinches off, falls (with a short streak while
 *  it is fast) and lands with a tiny ring. A drip that could not land (ring included) before `until` is
 *  never started, so nothing is cut off at the end of a loop. */
function sfStreak(fr, t, t0, x, y, len = 0.9, ring = 0.45, until = Infinity) {
  const k = t - t0;
  if (k <= 0) return;
  const hang = 0.12;
  if (t0 + hang + sfLand(y + len, 0, 38) + (ring ? 0.4 : 0) > until) return;
  if (k < hang) {
    const s = sfEaseIn(k / hang) * len;
    fr.strokes.push({ d: `M${sfR(x)} ${sfR(y)}L${sfR(x)} ${sfR(y + s)}`, a: 0.85, w: 0.5 });
    return;
  }
  const g = 38, kk = k - hang, y0 = y + len;
  const tl = sfLand(y0, 0, g);
  if (kk < tl) {
    const yy = y0 + 0.5 * g * kk * kk, v = g * kk;
    const tail = Math.min(1.6, 0.035 * v);
    if (tail > 0.15) fr.strokes.push({ d: `M${sfR(x)} ${sfR(yy - tail)}L${sfR(x)} ${sfR(yy)}`, a: 0.45, w: 0.4 });
    fr.drops.push({ x, y: yy, r: 0.36, a: 1 });
    return;
  }
  if (ring) sfRipple(fr, t, t0 + hang + tl, 0.4, x, 0.2, 1.3 * ring, 0.5 * ring, 0.25, 0.42);
}
/** bubble that rises to the surface, sits for a moment and pops */
function sfBubble(fr, t, t0, x, r = 0.5) {
  const k = t - t0;
  if (k <= 0 || k > 0.75) return;
  if (k < 0.5) {
    const g = sfBackOut(sfClamp(k / 0.2), 2.0);
    const wob = 1 + 0.06 * Math.sin(k * 40) * (1 - k / 0.5);
    fr.rings.push({ x, y: SF_WATER - r * g * 0.85, rx: r * g * wob, ry: r * g / wob, a: 0.95, w: 0.5 });
  } else {
    const q = (k - 0.5) / 0.25;
    fr.rings.push({ x, y: SF_WATER - r * 0.85, rx: r * (1 + 1.1 * q), ry: r * (1 + 0.6 * q), a: 0.75 * (1 - q), w: 0.4 });
    if (q < 0.6) for (const s of [-1, 1]) fr.drops.push({ x: x + s * r * (0.8 + 1.4 * q), y: SF_WATER - r - 0.9 * q + 1.2 * q * q, r: 0.2, a: 1 - q / 0.6 });
  }
}
/** water clinging to something crossing the surface: a lip pulled up beside it (k > 0, rising),
 *  or a little dimple pulled in (k < 0, sinking) */
function sfCollar(fr, xs, k) {
  const a = sfClamp((Math.abs(k) - 0.12) / 0.6);
  if (a <= 0) return;
  for (const x of xs) {
    for (const s of [-1, 1]) {
      const x1 = x + s * 0.12, x2 = x + s * (0.55 + 0.3 * a);
      const lift = k > 0 ? 0.5 * a : -0.25 * a;
      fr.strokes.push({ d: `M${sfR(x2)} ${sfR(SF_WATER + 0.05)}Q${sfR(x + s * 0.28)} ${sfR(SF_WATER + 0.02)} ${sfR(x1)} ${sfR(SF_WATER - lift)}`, a: 0.6 * a, w: 0.45 });
    }
  }
}

// ---------------------------------------------------------------- whale body above the water
/** top of a body that is mostly under water: a circle of radius r whose centre sits `depth` below the
 *  surface; only the part above the water shows (clipped by the waterline) */
function sfHump(cx, depth, r) {
  const cy = SF_WATER + depth, pts = [];
  for (let i = 0; i <= 40; i++) { const a = -Math.PI + (i / 40) * Math.PI; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}

// ---------------------------------------------------------------- baking
function sfBake(def) {
  const N = Math.round(def.period * SF_SR);
  const frames = new Array(N + 1);
  const springs = {}, prevv = {};
  const dt = 1 / SF_SR;
  const track = def.track || [];
  const events = [];
  let last = null;
  for (let n = 0; n <= N; n++) {
    const t = n * dt;
    const p = sfRestPose();
    const c = {
      spring(name, target, hz, zeta) {
        let s = springs[name];
        if (!s) s = springs[name] = { x: target, v: 0 };
        const w = SF_TAU * hz;
        for (let i = 0; i < 4; i++) {
          const h = dt / 4;
          s.v += (-w * w * (s.x - target) - 2 * zeta * w * s.v) * h;
          s.x += s.v * h;
        }
        return s.x;
      },
      vel(name, value) {
        const pv = prevv[name];
        prevv[name] = value;
        return pv === undefined ? 0 : (value - pv) / dt;
      },
    };
    def.drive(t, p, c);
    // last quarter second: ease whatever the springs still carry back onto the resting pose, so the next
    // loop starts exactly where this one ends
    const end = sfSmooth(sfSeg(t, def.period - 0.25, def.period));
    if (end > 0) { const r = sfRestPose(); for (const key in p) p[key] = sfLerp(p[key], r[key], end); }
    frames[n] = p;
    if (track.length) {
      const pts = sfProject(p);
      if (last) {
        for (const idx of track) {
          const y0 = last[idx][1], y1 = pts[idx][1];
          if ((y0 - SF_WATER) * (y1 - SF_WATER) < 0) events.push({ t, idx, x: pts[idx][0], dir: y1 > y0 ? 'in' : 'out' });
        }
      }
      last = pts;
    }
  }
  return { period: def.period, frames, def, events, cache: new Map() };
}
function sfPoseAt(baked, t) {
  const f = baked.frames;
  const x = Math.max(0, Math.min(f.length - 1.0001, t * SF_SR));
  const n = Math.floor(x), k = x - n;
  const a = f[n], b = f[n + 1];
  const p = {};
  for (const key in a) p[key] = a[key] + (b[key] - a[key]) * k;
  return p;
}
/** projected tail at time t, memoised (fx use it to launch drips from the flukes) */
function sfTailAt(baked, t) {
  const key = Math.round(t * 1000);
  let v = baked.cache.get(key);
  if (!v) { v = sfProject(sfPoseAt(baked, key / 1000)); baked.cache.set(key, v); }
  return v;
}

const SF_BAKED = {};
function sfAnims() {
  for (const [k, d] of Object.entries(SF_DEFS)) if (!SF_BAKED[k]) SF_BAKED[k] = sfBake(d);
  return SF_BAKED;
}

/** Everything needed to draw one frame of loop `name` at time t. */
function sfFrame(name, t) {
  const baked = sfAnims()[name];
  const def = baked.def;
  const fr = { tail: null, ghosts: [], shapes: [], ripples: [], drops: [], rings: [], strokes: [], fills: [], pts: null };
  const pose = sfPoseAt(baked, t);
  const main = sfProject(pose);
  if (!def.tail || def.tail(t)) {
    fr.tail = sfPath(main);
    fr.pts = main;
    let prev = main;
    for (let k = 1; k <= 3; k++) {
      const g = sfProject(sfPoseAt(baked, Math.max(0, t - k * 0.024)));
      let disp = 0;
      for (let i = 3; i < g.length - 3; i += 3) disp = Math.max(disp, Math.hypot(g[i][0] - prev[i][0], g[i][1] - prev[i][1]));
      const a = sfClamp((disp - 0.6) / 2.2) * [0.28, 0.15, 0.08][k - 1];
      if (a > 0.02) fr.ghosts.push({ d: sfPath(g), a });
      prev = g;
    }
    // water clinging to the tail where it crosses the surface, while it moves up or down
    if (def.collar !== false) {
      const vy = (pose.ty - sfPoseAt(baked, Math.max(0, t - 1 / 60)).ty) * 60;
      sfCollar(fr, sfCrossings(main), -vy / 9);
    }
  }
  // tracked points (fluke tips, notch) slipping in / popping out of the water: a small ring each, plus a
  // flicked drop on the way in unless the loop asks for rings only (tipFx: 'ring')
  for (const e of baked.events) {
    if (e.dir === 'in') {
      sfRipple(fr, t, e.t, 0.55, e.x, 0.25, 2.0, 0.6, 0.24, 0.45);
      if (def.tipFx !== 'ring') sfDrop(fr, t, e.t + 0.01, e.x, SF_WATER - 0.3, (e.idx === SF_TIP_L ? -1 : 1) * 0.9, -6.5, 0.32, 40, 0);
    } else {
      sfRipple(fr, t, e.t, 0.5, e.x, 0.25, 1.6, 0.45, 0.24, 0.42);
    }
  }
  if (def.fx) def.fx(t, fr, (tt) => sfTailAt(baked, tt));
  return fr;
}

/** Draw a frame; ctx must already map viewBox units. */
function sfDraw(ctx, fr, color) {
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineJoin = ctx.lineCap = 'round';
  for (const r of fr.ripples) {
    ctx.globalAlpha = r.a; ctx.lineWidth = r.w || 0.55;
    if (r.dash) ctx.setLineDash(r.dash);
    ctx.beginPath(); ctx.ellipse(r.cx, r.cy, r.rx, r.ry, 0, 0, SF_TAU); ctx.stroke();
    if (r.dash) ctx.setLineDash([]);
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(-40, -40, 96, 40 + SF_WATER); ctx.clip();
  ctx.lineWidth = 1;
  for (const g of fr.ghosts) { ctx.globalAlpha = g.a; ctx.stroke(new Path2D(g.d)); }
  for (const s of fr.shapes) { ctx.globalAlpha = s.a == null ? 1 : s.a; ctx.lineWidth = s.w || 1; ctx.stroke(new Path2D(s.d)); }
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
  if (fr.tail) ctx.stroke(new Path2D(fr.tail));
  ctx.restore();
  for (const s of fr.strokes) { ctx.globalAlpha = s.a; ctx.lineWidth = s.w || 0.75; ctx.stroke(new Path2D(s.d)); }
  for (const r of fr.rings) {
    ctx.globalAlpha = r.a; ctx.lineWidth = r.w || 0.5;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, SF_TAU); ctx.stroke();
  }
  for (const d of fr.drops) {
    if (d.r <= 0.03 || d.a <= 0.02) continue;
    ctx.globalAlpha = d.a;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, SF_TAU); ctx.fill();
  }
  // solid water (blows): optional clip to above a level (the blowhole) and a soft edge for mist
  for (const f of fr.fills || []) {
    if (f.a <= 0.02) continue;
    ctx.save();
    // keep it above clipY, and out of the hole (a circle: e.g. the head the blow comes out of)
    if (f.clipY != null) { ctx.beginPath(); ctx.rect(-40, -40, 96, 40 + f.clipY); ctx.clip(); }
    if (f.hole) {
      const cp = new Path2D();
      cp.rect(-40, -40, 96, 96);
      cp.moveTo(f.hole[0] + f.hole[2], f.hole[1]); cp.arc(f.hole[0], f.hole[1], f.hole[2], 0, SF_TAU);
      ctx.clip(cp, 'evenodd');
    }
    ctx.globalAlpha = f.a;
    if (f.blur) ctx.filter = `blur(${(f.blur * ctx.getTransform().a).toFixed(2)}px)`;
    ctx.fill(new Path2D(f.d));
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
