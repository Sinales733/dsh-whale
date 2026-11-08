// Draws the blow from Google's animated spouting-whale emoji (shapes in noto-blow-data.js, CC BY 4.0) as
// solid water at a blowhole: the burst rises out of the blowhole, a column shoots up and its top opens into
// two lobes, which then break into curling pieces and drops that shrink away. Uses surface.js helpers.

/** CSS-style cubic-bezier easing: y at x */
function nbBezier(x1, y1, x2, y2, x) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  let u = x;
  for (let i = 0; i < 8; i++) {
    const err = ((ax * u + bx) * u + cx) * u - x;
    const slope = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(err) < 1e-6 || !slope) break;
    u -= err / slope;
  }
  u = Math.min(1, Math.max(0, u));
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return ((ay * u + by) * u + cy) * u;
}
const nbEase = (k) => nbBezier(0.167, 0.167, 0.833, 0.833, k);   // the emoji's keyframe easing

/** path keyframes → shape at local frame lt (held before the first and after the last key) */
function nbShapeAt(keys, lt) {
  if (lt <= keys[0].t) return keys[0];
  const last = keys[keys.length - 1];
  if (lt >= last.t) return last;
  let j = 0;
  while (keys[j + 1].t <= lt) j++;
  const a = keys[j], b = keys[j + 1];
  const k = nbEase((lt - a.t) / (b.t - a.t));
  const mix = (A, B) => A.map((p, n) => [p[0] + (B[n][0] - p[0]) * k, p[1] + (B[n][1] - p[1]) * k]);
  return { v: mix(a.v, b.v), i: mix(a.i, b.i), o: mix(a.o, b.o) };
}
/** [[t, value], ...] (or [[t, dx, dy], ...]) → value(s) at t */
function nbTrack(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last.slice(1);
  let j = 0;
  while (keys[j + 1][0] <= t) j++;
  const a = keys[j], b = keys[j + 1], k = nbEase((t - a[0]) / (b[0] - a[0]));
  return a.slice(1).map((v, n) => v + (b[n + 1] - v) * k);
}

/** the emoji's blow at blowhole (x, y), starting at t0. o.scale = viewBox units per emoji pixel,
 *  o.lean = shear with height (wind), o.clipY / o.hole = what hides the water (default: below the blowhole) */
function sfNotoBlow(fr, t, t0, x, y, o = {}) {
  const tau = 16 + (t - t0) * NOTO_BLOW.fps;     // clock of the column comp; the burst/drops comp runs +24
  if (t < t0 || tau > 92) return;
  const S = o.scale || 0.03, lean = o.lean || 0;
  const [ax, ay] = NOTO_BLOW.anchor;
  for (const sh of NOTO_BLOW.shapes) {
    const lt = sh.comp === 1 ? tau : tau + 24;
    if (lt < sh.ip || lt >= sh.op) continue;
    const k = nbShapeAt(sh.keys, lt);
    const py = sh.py ? nbTrack(sh.py, lt)[0] : 0;
    const [ox, oy] = nbTrack(NOTO_BLOW.off[sh.comp], tau);
    const P = (px, pY) => {
      const X = (px + ox - ax) * S, Y = (pY + py + oy - ay) * S;
      return `${sfR(x + X - lean * Y)} ${sfR(y + Y)}`;                // lean: shear with height (wind)
    };
    const n = k.v.length;
    let d = `M${P(k.v[0][0], k.v[0][1])}`;
    for (let m = 1; m <= n; m++) {
      const a = k.v[m - 1], b = k.v[m % n], ao = k.o[m - 1], bi = k.i[m % n];
      d += `C${P(a[0] + ao[0], a[1] + ao[1])} ${P(b[0] + bi[0], b[1] + bi[1])} ${P(b[0], b[1])}`;
    }
    fr.fills.push({ d: d + 'Z', a: 1, clipY: o.clipY != null ? o.clipY : y, hole: o.hole || null });
  }
}
