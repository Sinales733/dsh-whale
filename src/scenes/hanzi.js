// ===== scene: HANZI — 鲸 written on a 米字格; its sixteen strokes swim into the whale ===========
// 鲸 is written stroke by stroke (single-line Fangsong, with stroke-order numbers); then each stroke swims (gliding,
// turning, scaling, bending) onto its own piece of the whale's outline. While waiting, a pen re-traces the whale in
// stroke order and the stroke it re-inks shows faintly in the grid. On exit the pieces gather into a dashed 〇 that
// closes into the spinner track, and the pen writes a seventeenth stroke: the progress arc.
SCENES.hanzi = (() => {
  // 鲸 in a 1000-unit em (y down), GB stroke order; skeleton of FangSong, serifs dropped
  const STROKES = [
    ['撇', [301, 62], [297, 126], [250, 213], [200, 297], [152, 368], [88, 446]],
    ['横撇', [248, 252], [374, 246], [362, 280], [338, 318], [306, 388]],
    ['竖', [205, 401], [205, 668]],
    ['横折', [205, 401], [436, 373], [421, 626]],
    ['横', [205, 512], [428, 501]],
    ['竖', [314, 388], [314, 642]],
    ['横', [205, 657], [448, 622]],
    ['提', [104, 837], [476, 718]],
    ['点', [626, 64], [664, 116], [686, 190]],
    ['横', [476, 272], [906, 219]],
    ['竖', [571, 396], [571, 566]],
    ['横折', [571, 396], [794, 371], [783, 541]],
    ['横', [571, 564], [806, 538]],
    ['竖钩', [684, 556], [684, 890], [588, 842]],
    ['撇', [558, 650], [563, 700], [530, 750], [490, 800], [450, 845], [418, 878]],
    ['点', [760, 656], [840, 724], [900, 796]],
  ];
  const CORNER = { '横撇': 1, '横折': 1, '竖钩': 1 };
  // each stroke's piece of the outline: [loop, from, to] as fractions of the loop's length (0 body, 1 crescent, 2 curl, 3 eye)
  const TARGET = [
    [0, 0.3003, 0.4833], [0, 0.1600, 0.3003], [0, 0.4833, 0.5523], [1, 0.4702, 0.9404],
    [2, 0.47, 1.47], [1, 0.1959, 0.4702], [1, 0.9404, 1.1959], [0, 0.5523, 0.6731],
    [0, 0.1036, 0.1600], [0, 0.9148, 1.1036], [3, 0.89, 1.10], [3, 0.10, 0.59],
    [3, 0.59, 0.89], [0, 0.7422, 0.8457], [0, 0.6731, 0.7422], [0, 0.8457, 0.9148],
  ];
  // stroke-order numbers, hand-placed clear of the lines (em units)
  const NUM = [[301, 38], [270, 228], [184, 426], [226, 380], [184, 514], [338, 366], [184, 659], [80, 846],
    [612, 46], [452, 276], [548, 416], [592, 374], [548, 574], [708, 580], [556, 626], [742, 638]];
  // pieces that swim as one rigid group: 口 → the eye, 田's frame → the belly crescent
  const GROUPS = [[10, 11, 12], [3, 5, 6]];
  const groupOf = (i) => GROUPS.findIndex((g) => g.includes(i));
  // departure slots, 50 ms apart, ordered so the paths never cross
  const SLOT = [1, 2, 3, 4, 8, 4, 4, 6, 9, 0, 5, 5, 5, 10, 11, 12];
  const N = STROKES.length;
  const ws = (i) => 0.30 + 0.066 * i - 0.0006 * i * i;           // writing start
  const swimAt = (i) => 1.44 + 0.05 * SLOT[i];
  const SWIM = 0.52;
  const PEN0 = 2.85;                                               // the idle pen's first pass
  const EXIT = 1.05;                                               // boot's exit duration (not overridden)
  const LAND = 0.58, ARC = 0.89;                                   // the 17th stroke: pen down, arc complete

  let G = 0, R0 = 0;
  let recs = [], pen = [], TP = 1;
  let readLine = '', lastStroke = 1;

  function catmull(kind, pts) {
    const c = CORNER[kind] || -1, out = [];
    const runs = c > 0 ? [pts.slice(0, c + 1), pts.slice(c)] : [pts];
    for (const pc of runs) {
      if (pc.length === 2) { if (!out.length) out.push(pc[0]); out.push(pc[1]); continue; }
      for (let i = 0; i < pc.length - 1; i++) {
        const p0 = pc[Math.max(0, i - 1)], p1 = pc[i], p2 = pc[i + 1], p3 = pc[Math.min(pc.length - 1, i + 2)];
        for (let s = out.length ? 1 : 0; s <= 12; s++) {
          const u = s / 12, u2 = u * u, u3 = u2 * u;
          const f = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u2 + (-a + 3 * b - 3 * cc + d) * u3);
          out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
        }
      }
    }
    return out;
  }
  function resample(p, n) {
    const cum = cumLen(p), L = cum[cum.length - 1], out = [];
    let j = 1;
    for (let i = 0; i < n; i++) {
      const s = (L * i) / (n - 1);
      while (j < p.length - 1 && cum[j] < s) j++;
      const k = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
      out.push([lerp(p[j - 1][0], p[j][0], k), lerp(p[j - 1][1], p[j][1], k)]);
    }
    return out;
  }
  function loopAt(poly) {
    const p = poly.slice();
    p.push(p[0]);
    const cum = cumLen(p), L = cum[cum.length - 1];
    return {
      L,
      at(s) {
        s = (((s % L) + L) % L);
        let lo = 0, hi = cum.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
        const k = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
        return [lerp(p[lo][0], p[hi][0], k), lerp(p[lo][1], p[hi][1], k)];
      },
    };
  }
  // minimum-cost assignment of rows to columns (Hungarian method); returns the column of each row
  function assign(c) {
    const n = c.length, u = new Float64Array(n + 1), v = new Float64Array(n + 1), p = new Int32Array(n + 1), way = new Int32Array(n + 1);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(n + 1).fill(Infinity), used = new Uint8Array(n + 1);
      do {
        used[j0] = 1;
        const i0 = p[j0];
        let d = Infinity, j1 = 0;
        for (let j = 1; j <= n; j++) {
          if (used[j]) continue;
          const cur = c[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < d) { d = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += d; v[j] -= d; } else minv[j] -= d; }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const col = new Array(n);
    for (let j = 1; j <= n; j++) col[p[j] - 1] = j - 1;
    return col;
  }
  // a group's frame: centroid and RMS radius
  function frameOf(P) {
    let cx = 0, cy = 0;
    for (const q of P) { cx += q[0]; cy += q[1]; }
    cx /= P.length; cy /= P.length;
    let ss = 0;
    for (const q of P) ss += (q[0] - cx) ** 2 + (q[1] - cy) ** 2;
    return { x: cx, y: cy, s: Math.sqrt(ss / P.length) || 1e-3 };
  }
  const local = (P, f) => P.map(([x, y]) => [(x - f.x) / f.s, (y - f.y) / f.s]);
  // a polyline as its edges: directions (unwrapped), their length-weighted mean, log lengths, centroid
  function edges(P) {
    const m = P.length - 1, ang = new Float64Array(m), ln = new Float64Array(m);
    let sl = 0, sa = 0, cx = 0, cy = 0;
    for (let j = 0; j < m; j++) {
      const dx = P[j + 1][0] - P[j][0], dy = P[j + 1][1] - P[j][1], l = Math.max(1e-3, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      ang[j] = j ? ang[j - 1] + wrapPi(a - ang[j - 1]) : a;
      ln[j] = Math.log(l);
      sl += l; sa += ang[j] * l;
    }
    for (const q of P) { cx += q[0]; cy += q[1]; }
    return { ang, ln, mean: sa / sl, cx: cx / P.length, cy: cy / P.length };
  }
  // A → B blended by edge direction and length (a line curls up, a loop opens, nothing collapses): the mean
  // direction is the heading, the deviations from it the bend
  function pair(A, B) {
    const a = edges(A), b = edges(B), m = a.ang.length;
    const dA = new Float64Array(m), dB = new Float64Array(m);
    for (let j = 0; j < m; j++) { dA[j] = a.ang[j] - a.mean; dB[j] = b.ang[j] - b.mean; }
    return { n: A.length, dA, dB, lA: a.ln, lB: b.ln, head: a.mean, turn: wrapPi(b.mean - a.mean), ax: a.cx, ay: a.cy, bx: b.cx, by: b.cy };
  }
  // pose: kc centroid (on a bowed path to bx, by), kt heading, kh bend, ks size
  function blend(M, kc, kt, kh, ks, bow, extra, bx, by, out) {
    const head = M.head + (M.turn + extra) * kt;
    let x = 0, y = 0, sx = 0, sy = 0;
    out[0][0] = 0; out[0][1] = 0;
    for (let j = 0; j < M.n - 1; j++) {
      const a = head + M.dA[j] + (M.dB[j] - M.dA[j]) * kh;
      const l = Math.exp(M.lA[j] + (M.lB[j] - M.lA[j]) * ks);
      x += l * Math.cos(a); y += l * Math.sin(a);
      out[j + 1][0] = x; out[j + 1][1] = y;
      sx += x; sy += y;
    }
    const dx = bx - M.ax, dy = by - M.ay;
    const mx = (M.ax + bx) / 2 - dy * bow, my = (M.ay + by) / 2 + dx * bow;
    const u = 1 - kc;
    const px = u * u * M.ax + 2 * kc * u * mx + kc * kc * bx - sx / M.n;
    const py = u * u * M.ay + 2 * kc * u * my + kc * kc * by - sy / M.n;
    for (let j = 0; j < M.n; j++) { out[j][0] += px; out[j][1] += py; }
  }
  // a group piece: the shared frame glides and scales (log), the shape blends inside it
  function morphGroup(r, k, kh, out) {
    const A = r.fa, B = r.fb;
    const cx = lerp(A.x, B.x, k), cy = lerp(A.y, B.y, k), s = Math.exp(lerp(Math.log(A.s), Math.log(B.s), k));
    for (let j = 0; j < r.n; j++) {
      out[j][0] = cx + lerp(r.la[j][0], r.lb[j][0], kh) * s;
      out[j][1] = cy + lerp(r.la[j][1], r.lb[j][1], kh) * s;
    }
  }

  // ---- drawing helpers
  function strokePart(P, cum, a, b, path) {      // sub-polyline between arc lengths a..b into path
    if (b - a < 0.05) return;
    let j = 1;
    while (j < P.length - 1 && cum[j] < a) j++;
    const k0 = (a - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    path.moveTo(lerp(P[j - 1][0], P[j][0], k0), lerp(P[j - 1][1], P[j][1], k0));
    while (j < P.length - 1 && cum[j] < b) { path.lineTo(P[j][0], P[j][1]); j++; }
    const k1 = (b - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    path.lineTo(lerp(P[j - 1][0], P[j][0], k1), lerp(P[j - 1][1], P[j][1], k1));
  }
  function pointAt(P, cum, s) {
    let j = 1;
    while (j < P.length - 1 && cum[j] < s) j++;
    const k = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    return [lerp(P[j - 1][0], P[j][0], k), lerp(P[j - 1][1], P[j][1], k)];
  }
  const iu = (z) => z * z * z - (z * z * z * z) / 2;               // ∫ smooth
  // a run's clock: speed rises (quarter sine) over its first `a` of time, holds, falls over its last `a`.
  // trap: raw time 0..1 → share of the run's time budget; trapInv: the inverse
  const rampI = (z) => (2 / Math.PI) * (1 - Math.cos((Math.PI / 2) * z));
  function trap(raw, a) {
    const r = clamp01(raw), m = 2 / Math.PI, T = 1 - 2 * a + 2 * a * m;
    return (r < a ? a * rampI(r / a) : r > 1 - a ? T - a * rampI((1 - r) / a) : a * m + r - a) / T;
  }
  function trapInv(u, a) {
    const m = 2 / Math.PI, T = 1 - 2 * a + 2 * a * m, f = clamp01(u) * T;
    const ramp = (g) => ((2 * a) / Math.PI) * Math.acos(Math.max(-1, Math.min(1, 1 - g / (a * m))));
    return f < a * m ? ramp(f) : f > T - a * m ? 1 - ramp(T - f) : f + a - a * m;
  }
  // arc length along an ink run at raw progress 0..1 (slowed into sharp corners)
  function sAt(run, raw) {
    const tt = trap(raw, run.a) * run.tw[run.K];
    let lo = 0, hi = run.K;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (run.tw[m] <= tt) lo = m; else hi = m; }
    return (run.L * (lo + (tt - run.tw[lo]) / (run.tw[hi] - run.tw[lo] || 1))) / run.K;
  }
  // pass time at which an ink run reaches arc length s (inverse of sAt)
  function timeAt(run, s) {
    const f = clamp01(s / run.L) * run.K, k = Math.min(run.K - 1, Math.floor(f));
    return run.t0 + trapInv(lerp(run.tw[k], run.tw[k + 1], f - k) / run.tw[run.K], run.a) * run.d;
  }
  // the idle pen at pass time tau: position, how far down (1 inking, 0 lifted), the stroke it inks
  function penAt(tau) {
    for (const ph of pen) {
      if (tau > ph.t0 + ph.d) continue;
      const raw = clamp01((tau - ph.t0) / ph.d);
      if (ph.ink) {
        const s = sAt(ph, raw), q = pointAt(ph.P, ph.cum, s);
        let k = 0;
        while (k + 1 < ph.segs.length && ph.offs[k + 1] <= s) k++;
        return { x: q[0], y: q[1], down: 1, i: ph.segs[k] };
      }
      const u = inOutSine(raw), { a, b } = ph;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const mx = (a[0] + b[0]) / 2 - dy * 0.2, my = (a[1] + b[1]) / 2 + dx * 0.2;
      return {
        x: (1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * mx + u * u * b[0],
        y: (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * my + u * u * b[1],
        down: 1 - smooth(seg(raw, 0, 0.3)) + smooth(seg(raw, 0.7, 1)), i: ph.next,
      };
    }
    return { x: recs[0].dst[0][0], y: recs[0].dst[0][1], down: 1, i: 0 };
  }

  return {
    label: 'HANZI',
    readyAt: 3.4,
    titleAt: 2.1,
    spinnerIn: ARC,
    layout() {
      G = 180 * S;
      R0 = 120 * S;
      lastStroke = 1;
      const E = ([u, v]) => [CX + ((u - 500) / 1000) * 2 * G, CY + ((v + 20 - 500) / 1000) * 2 * G];
      const wh = makeWhale(CX, CY, 226 * S);
      const loops = wh.polys.map(loopAt);
      recs = STROKES.map(([kind, ...pts], i) => {
        const raw = catmull(kind, pts.map(E));
        const [li, f0, f1] = TARGET[i];
        const L = loops[li];
        const lenA = cumLen(raw).pop();
        const n = Math.max(14, Math.round(Math.max(lenA, (f1 - f0) * L.L) / (2 * S)));
        const src = resample(raw, n);
        const fwd = [];
        for (let j = 0; j < n; j++) fwd.push(L.at((f0 + ((f1 - f0) * j) / (n - 1)) * L.L));
        const g = groupOf(i), head = edges(src).mean;
        // run along the outline in the direction that needs the smaller turn (then the shorter trip)
        const opts = [fwd, fwd.slice().reverse()].map((dst) => {
          const turn = g >= 0 ? 0 : wrapPi(edges(dst).mean - head);
          const trip = Math.hypot(src[0][0] - dst[0][0], src[0][1] - dst[0][1]) + Math.hypot(src[n - 1][0] - dst[n - 1][0], src[n - 1][1] - dst[n - 1][1]);
          return { dst, cost: Math.abs(turn) * 60 * S + trip * 0.25 };
        });
        const dst = (opts[0].cost <= opts[1].cost ? opts[0] : opts[1]).dst;
        const cumB = cumLen(dst);
        return { i, kind, n, src, dst, g, cumA: cumLen(src), cumB, lenA, lenB: cumB[n - 1], num: E(NUM[i]),
          w0: ws(i), wd: Math.min(0.28, Math.max(0.15, 0.11 + (0.001 * lenA) / S)), sw: swimAt(i),
          ms: g >= 0 ? null : pair(src, dst), pts: src.map((q) => [q[0], q[1]]) };
      });
      for (const grp of GROUPS) {
        const fa = frameOf(grp.flatMap((i) => recs[i].src)), fb = frameOf(grp.flatMap((i) => recs[i].dst));
        for (const i of grp) { const r = recs[i]; r.fa = fa; r.fb = fb; r.la = local(r.src, fa); r.lb = local(r.dst, fb); }
      }
      // exit: each segment gets a 1/16 sector of a ring (radius R0): the assignment and ring phase with the least
      // total travel, so no paths cross; each runs along its sector in the direction needing the smaller turn
      // (counting the ring's swirl, ≈0.3 rad by landing), then the shorter trip
      const dock = recs.map((r) => edges(r.dst));
      const D = TAU / N;
      let best = null, bestCost = Infinity;
      for (let s = 0; s < 32; s++) {
        const phi = (s / 32) * D;
        const cost = dock.map((e) => Array.from({ length: N }, (_, j) => {
          const a = phi - Math.PI + (j + 0.5) * D;
          return Math.hypot(e.cx - CX - Math.cos(a) * R0, e.cy - CY - Math.sin(a) * R0);
        }));
        const col = assign(cost);
        const c = col.reduce((acc, j, i) => acc + cost[i][j], 0);
        if (c < bestCost) { bestCost = c; best = { phi, col }; }
      }
      recs.forEach((r, ri) => {
        const a0 = best.phi - Math.PI + best.col[ri] * D;
        const ring = (dir) => { const q = []; for (let k = 0; k < r.n; k++) { const f = dir > 0 ? k / (r.n - 1) : 1 - k / (r.n - 1); q.push([CX + Math.cos(a0 + f * D) * R0, CY + Math.sin(a0 + f * D) * R0]); } return q; };
        const P = r.dst;
        const opts = [ring(1), ring(-1)].map((Q) => {
          const trip = Math.hypot(P[0][0] - Q[0][0], P[0][1] - Q[0][1]) + Math.hypot(P[r.n - 1][0] - Q[r.n - 1][0], P[r.n - 1][1] - Q[r.n - 1][1]);
          return { Q, cost: Math.abs(wrapPi(edges(Q).mean + 0.3 - dock[ri].mean)) * 60 * S + trip * 0.25 };
        });
        r.me = pair(P, (opts[0].cost <= opts[1].cost ? opts[0] : opts[1]).Q);
        r.grow = r.me.lB[0] > r.me.lA[0];
      });
      // launch order: the outline first, then the eye, curl and crescent fly out through the gaps it leaves
      const launch = [0, 1, 2, 7, 8, 9, 13, 14, 15, 3, 5, 6, 4, 10, 11, 12];
      launch.forEach((ri, j) => { recs[ri].ea = 0.03 + 0.013 * j; });
      // The idle pen inks the segments in stroke order; where one ends at the next one's start it carries on (one
      // run), otherwise it lifts and flies. Along a run it slows into tight bends.
      pen = [];
      let T = 0;
      for (let i = 0; i < N;) {
        const segs = [i];
        while (i + 1 < N) {
          const a = recs[i].dst[recs[i].n - 1], b = recs[i + 1].dst[0];
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 3 * S) break;
          segs.push(++i);
        }
        i++;
        const P = [], offs = [];
        for (const k of segs) {
          const d = recs[k].dst;
          offs.push(P.length ? cumLen(P).pop() : 0);
          for (let j = P.length ? 1 : 0; j < d.length; j++) P.push(d[j]);
        }
        const cum = cumLen(P), L = cum[cum.length - 1];
        // speed along the run (1 = cruising): halved by a 12 px radius or a 20° kink, 18% at a tip; the slowing
        // reaches 32 px ahead and behind on an S-curve. tw: relative time to each 1-px sample
        const K = Math.max(8, Math.ceil(L / S)), h = 4 * S, W = Math.max(1, Math.round((32 * S * K) / L));
        const vr = new Float64Array(K + 1).fill(1);
        for (let k = 0; k <= K; k++) {
          const s = (L * k) / K;
          if (s < h || s > L - h) continue;
          const a = pointAt(P, cum, s - h), b = pointAt(P, cum, s), c = pointAt(P, cum, s + h);
          const kap = Math.abs(wrapPi(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]))) / h;
          vr[k] = Math.max(0.18, 1 / (1 + (kap * 12 * S) ** 2));
        }
        const v = new Float64Array(K + 1), tw = new Float64Array(K + 1);
        for (let k = 0; k <= K; k++) {
          let m = 1;
          for (let j = Math.max(0, k - W); j <= Math.min(K, k + W); j++) m = Math.min(m, vr[j] + smooth(Math.abs(j - k) / W) * (1 - vr[j]));
          // near the run's ends its own start and stop do the slowing
          v[k] = lerp(Math.max(m, 0.5), m, smooth(Math.min(1, (Math.min(k, K - k) * L) / K / (12 * S))));
          if (k) tw[k] = tw[k - 1] + (2 * L) / K / (v[k - 1] + v[k]);
        }
        // cruise 420 px/s, up to 0.15 s to get up to speed and to stop
        const ramp = Math.min(0.15, 0.08 + L / (600 * S));
        const d = tw[K] / (420 * S) + 2 * ramp * (1 - 2 / Math.PI);
        const run = { ink: true, segs, offs, P, cum, L, K, tw, t0: T, d, a: Math.min(0.45, ramp / d) };
        segs.forEach((k, j) => {
          const r = recs[k];
          r.run = run;
          r.off = offs[j];
          r.len = (j + 1 < segs.length ? offs[j + 1] : L) - offs[j];
          r.ta = timeAt(run, r.off);
          r.tb = timeAt(run, r.off + r.len);
          // its stroke in the grid follows the pen, but never faster than 300 px/s on average
          r.gd = Math.max(r.tb - r.ta, r.lenA / (300 * S));
          r.gs = r.gd > r.tb - r.ta + 1e-6;
        });
        pen.push(run);
        T += run.d;
        const a = P[P.length - 1], next = i % N, b = recs[next].dst[0];
        const hop = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const air = 0.08 + 0.08 * smooth(Math.min(1, hop / (60 * S))) + hop / (520 * S);
        pen.push({ ink: false, a, b, t0: T, d: air, next });
        T += air;
      }
      TP = T;
    },
    readout: () => readLine,
    frame(t, ex, ek) {
      const out = 1 - smooth(seg(ex, 0, 0.25));     // grid, ghost, numbers, caption leave first
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const numSize = Math.max(7, 8.5 * S);

      // ---- 米字格: frame grows from its corners, guides from the centre; the guides dim once the whale forms
      {
        const k = outExpo(seg(t, 0.0, 0.55)), a = 0.3 * out;
        if (a > 0.003 && k > 0) {
          const p = new Path2D();
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            const x = CX + sx * G, y = CY + sy * G;
            p.moveTo(x - sx * G * k, y); p.lineTo(x, y); p.lineTo(x, y - sy * G * k);
          }
          ctx.lineJoin = 'miter';
          strokePath(p, a, 1);
          ctx.lineJoin = 'round';
        }
        ctx.setLineDash([3 * S, 4 * S]);
        const kc = outCubic(seg(t, 0.12, 0.62)), kd = outCubic(seg(t, 0.22, 0.75));
        const dim = smooth(seg(t, 1.4, 2.4));
        const cross = new Path2D(), diag = new Path2D();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { cross.moveTo(CX, CY); cross.lineTo(CX + dx * G * kc, CY + dy * G * kc); }
        for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { diag.moveTo(CX, CY); diag.lineTo(CX + dx * G * kd, CY + dy * G * kd); }
        ctx.lineCap = 'butt';
        if (kc > 0) strokePath(cross, 0.13 * lerp(1, 0.4, dim) * out, 1);
        if (kd > 0) strokePath(diag, 0.1 * lerp(1, 0.45, dim) * out, 1);
        ctx.setLineDash([]);
        ctx.lineCap = 'round';
        const ck = seg(t, 0.35, 0.8) * out;
        text('U+9CB8', CX - G, CY + G + 14 * S, 0.34 * ck, 9, 'left');
        text('鲸 · JĪNG · 16', CX + G, CY + G + 14 * S, 0.34 * ck, 9, 'right');
      }

      // ---- the idle pen's pass (whale space) and the ink it leaves
      const tau = t - PEN0;
      let tp = tau >= 0 ? tau % TP : 0;
      if (exiting) {
        // its clock runs down to a stop over ex 0–0.16, so the pen comes to rest before it flies to the ring
        const z = Math.min(1, ex / 0.16), te = t - ex * EXIT - PEN0;
        tp = Math.max(0, te + EXIT * 0.16 * (z - iu(z))) % TP;
      }
      const penOn = smooth(seg(t, PEN0 - 0.3, PEN0));
      // how far the pen has re-inked segment i this pass (p), how fresh (f), where the wet head starts (pw: the pen
      // 0.12 s ago); for its stroke in the grid: time since the pen reached it (ga), how far drawn (g), freshness (gf)
      const inkOf = (i) => {
        const r = recs[i], run = r.run;
        let best = null;
        for (const back of [0, TP]) {
          const tt = tp + back;
          if (tau - back < 0 || tt < r.ta) continue;
          const at = (x) => (x <= r.ta ? 0 : x >= r.tb ? 1 : clamp01((sAt(run, (x - run.t0) / run.d) - r.off) / r.len));
          const f = tt <= r.tb ? 1 : 1 - smooth(clamp01((tt - r.tb) / 0.9));
          const ga = tt - r.ta, gf = ga <= r.gd ? 1 : 1 - smooth(clamp01((ga - r.gd) / 0.9));
          if (f <= 0 && gf <= 0) continue;
          if (!best || Math.max(f, gf) > Math.max(best.f, best.gf)) {
            best = { p: at(tt), pw: at(tt - 0.12), f, ga, gf, g: r.gs ? inOutSine(clamp01(ga / r.gd)) : at(tt) };
          }
        }
        return best;
      };

      // ---- the stroke being re-inked shows in the grid, with its number (both come in over ≥ 0.15 s)
      if (tau >= 0 && out > 0) {
        for (const r of recs) {
          const k = inkOf(r.i);
          if (!k || k.gf <= 0) continue;
          const come = smooth(seg(k.ga, 0, 0.15));
          const hp = new Path2D();
          strokePart(r.src, r.cumA, 0, k.g * r.lenA, hp);
          strokePath(hp, (light ? 0.14 : 0.18) * k.gf * come * smooth(seg(k.g, 0, 0.12)) * out, 1.1);
          text(String(r.i + 1), r.num[0], r.num[1], 0.3 * k.gf * come * out, numSize, 'center');
        }
      }

      // ---- exit geometry: the composition shrinks (constant ratio per frame) onto the spinner
      const lnZ = Math.log(0.5) * inOutSine(seg(ex, 0.02, 0.44)) + Math.log(SPIN_R / (0.5 * R0)) * inOutSine(seg(ex, 0.38, 0.8));
      const Z = Math.exp(lnZ), R = R0 * Z;
      const mk = inOutCubic(seg(ex, 0.02, 0.7));
      const ox = lerp(CX, HX, mk), oy = lerp(CY, HY, mk);
      const map = (x, y, o) => { o[0] = ox + (x - CX) * Z; o[1] = oy + (y - CY) * Z; };
      const swirl = 0.6 * inOutSine(seg(ex, 0.04, 0.84));
      const cs = Math.cos(swirl), sn = Math.sin(swirl);
      const close = 1 - smooth(seg(ex, 0.6, 0.84));
      const dockA = 0.56 + 0.04 * Math.sin(t * 1.4);
      const exA = lerp(dockA, RING_ALPHA, smooth(seg(ex, 0.42, 0.86)));
      const exW = lerp(1.25, 2, smooth(seg(ex, 0.42, 0.84)));
      const hand = smooth(seg(ex, 0.84, 0.9));         // the polyline ring hands over to a true circle

      // ---- the strokes
      const ringPath = new Path2D();
      const docked = new Path2D();
      let anyDocked = false;
      for (const r of recs) {
        const i = r.i;
        const P = r.pts;
        if (t < r.sw) {
          // writing (and the written character, waiting)
          const p = inOutSine(seg(t, r.w0, r.w0 + r.wd));
          if (p <= 0) continue;
          const path = new Path2D();
          strokePart(r.src, r.cumA, 0, p * r.lenA, path);
          strokePath(path, 0.8 * smooth(seg(p, 0, 0.12)), 1.3);
          // wet ink: the last 0.1 s of travel is brighter
          const pw = inOutSine(seg(t - 0.1, r.w0, r.w0 + r.wd));
          if (p - pw > 0.002) {
            const wet = new Path2D();
            strokePart(r.src, r.cumA, pw * r.lenA, p * r.lenA, wet);
            strokePath(wet, 0.22 * smooth(seg(p, 0, 0.12)), 2);
          }
          text(String(i + 1), r.num[0], r.num[1], 0.42 * smooth(seg(t, r.w0, r.w0 + 0.15)) * out, numSize, 'center');
          continue;
        }
        const k = seg(t, r.sw, r.sw + SWIM);
        if (k < 1) {
          // swimming: glide on a bowed path, turn and scale, bending on the way (横 5 slides out level and curls up
          // round the eye only near the end)
          const ke = inOutSine(k);
          if (r.g >= 0) morphGroup(r, ke, smooth(seg(k, 0.1, 1)), P);
          else if (i === 4) blend(r.ms, ke, smooth(seg(k, 0.3, 1)), smooth(seg(k, 0.35, 1)), ke, 0.3, 0, r.ms.bx, r.ms.by, P);
          else blend(r.ms, ke, ke, smooth(seg(k, 0.12, 1)), ke, 0.2, 0, r.ms.bx, r.ms.by, P);
          const kd = smooth(seg(k, 0, 0.9));
          const path = new Path2D();
          path.moveTo(P[0][0], P[0][1]);
          for (let j = 1; j < r.n; j++) path.lineTo(P[j][0], P[j][1]);
          // in its last tenth it is drawn with the docked outline, so its round ends never double up on its neighbours'
          if (kd < 1) strokePath(path, lerp(0.8, dockA, kd), lerp(1.3, 1.25, kd));
          else { docked.addPath(path); anyDocked = true; }
          const gl = smooth(seg(k, 0.7, 1));
          if (gl > 0.003) strokePath(path, 0.26 * gl, 1.9);
          const na = 0.42 * (1 - smooth(seg(k, 0, 0.35))) * out;
          if (na > 0.003) text(String(i + 1), r.num[0], r.num[1], na, numSize, 'center');
          continue;
        }
        if (exiting) {
          // the segment flies onto its sector of the ring (which turns a little), all of it shrinking; a piece that
          // has to shrink does so early, one that has to grow (the eye's) lengthens near the ring
          const pe = seg(ex, r.ea, r.ea + 0.33), m = inOutSine(pe);
          const bx = CX + (r.me.bx - CX) * cs - (r.me.by - CY) * sn, by = CY + (r.me.bx - CX) * sn + (r.me.by - CY) * cs;
          const ks = r.grow ? inOutSine(seg(pe, 0.2, 1)) : inOutSine(seg(pe, 0, 0.85));
          blend(r.me, m, m, r.grow ? smooth(seg(pe, 0, 0.9)) : smooth(seg(pe, 0.1, 1)), ks, 0.15, swirl, bx, by, P);
          for (let j = 0; j < r.n; j++) map(P[j][0], P[j][1], P[j]);
          const gap = lerp(0.035 * smooth(seg(ex, 0, 0.16)), 0.1, m) * close;
          const cum = cumLen(P), L = cum[cum.length - 1];
          strokePart(P, cum, gap * L, (1 - gap) * L, ringPath);
          const kk = tau >= 0 ? inkOf(i) : null;
          const fadeInk = 1 - smooth(seg(ex, 0, 0.12));
          if (kk && fadeInk > 0) {
            const p = new Path2D();
            strokePart(P, cum, 0, kk.p * L, p);
            strokePath(p, 0.24 * kk.f * penOn * fadeInk, 1.6);
            if (kk.p - kk.pw > 0.002) {
              const wet = new Path2D();
              strokePart(P, cum, kk.pw * L, kk.p * L, wet);
              strokePath(wet, 0.3 * penOn * fadeInk, 2);
            }
          }
          continue;
        }
        strokePart(r.dst, r.cumB, 0, r.lenB, docked);
        anyDocked = true;
        // ink touches: a brief brightening right after docking
        const pulse = 1 - smooth(seg(t, r.sw + SWIM, r.sw + SWIM + 0.4));
        if (pulse > 0.01) {
          const p = new Path2D();
          strokePart(r.dst, r.cumB, 0, r.lenB, p);
          strokePath(p, 0.26 * pulse, 1.9);
        }
        // re-inked by the idle pen: fresh ink, with a wet head behind the nib
        if (tau >= 0) {
          const kk = inkOf(i);
          if (kk) {
            const p = new Path2D();
            strokePart(r.dst, r.cumB, 0, kk.p * r.lenB, p);
            strokePath(p, 0.24 * kk.f * penOn, 1.6);
            if (kk.p - kk.pw > 0.002) {
              const wet = new Path2D();
              strokePart(r.dst, r.cumB, kk.pw * r.lenB, kk.p * r.lenB, wet);
              strokePath(wet, 0.3 * penOn, 2);
            }
          }
        }
      }
      if (anyDocked) strokePath(docked, dockA, 1.25);
      if (exiting) {
        strokePath(ringPath, exA * (1 - hand), exW);
        if (hand > 0) arc(HX, HY, SPIN_R, 0, TAU, RING_ALPHA * hand, 2);
      }

      // ---- the pen: re-traces the whale while waiting. On exit it lifts and flies, in the whale's shrinking frame,
      //      to where it comes down on the ring, a little ahead of the spinner's head; it lands at rest and writes
      //      the seventeenth stroke, speeding up until it runs with the spinner exactly as its own arc
      const q = penAt(tp);
      {
        let x = q.x, y = q.y, down = q.down, a = penOn;
        if (exiting) {
          const sw = spinnerSweep(), a0 = spinnerAngle(t);
          const om = handoffSpec ? TAU / (handoffSpec.dur / 1000) : TAU / 0.8;
          const Tw = (ARC - LAND) * EXIT, xh = 0.35;                    // the head is at full speed by 35%
          const xt = clamp01(xh - 1 + (2 * sw) / (om * Tw));          // the tail starts when it must
          const land = a0 + sw + om * ((LAND - ex) * EXIT + (Tw * xh) / 2);   // where the head comes down (constant)
          if (ex < LAND) {
            const w = smooth(seg(ex, 0.12, LAND)), o = [0, 0];
            map(lerp(q.x, CX + Math.cos(land) * R0, w), lerp(q.y, CY + Math.sin(land) * R0, w), o);
            x = o[0]; y = o[1];
          } else {
            const u = (ex - LAND) / (ARC - LAND);                       // past 1 both ends run with the spinner
            const hd = land + om * Tw * (u <= xh ? xh * iu(u / xh) : u - xh / 2);
            const tl = land + om * Tw * (u <= 1 ? (1 - xt) * iu(seg(u, xt, 1)) : (1 - xt) / 2 + u - 1);
            x = ox + Math.cos(hd) * R; y = oy + Math.sin(hd) * R;
            ctx.lineCap = 'butt';
            if (hd - tl > 0.001) arc(ox, oy, R, tl, hd - tl, 1, lerp(1.4, 2, smooth(seg(ex, LAND, 0.85))));
            ctx.lineCap = 'round';
          }
          down = lerp(q.down * (1 - smooth(seg(ex, 0, 0.1))), 1, smooth(seg(ex, 0.5, LAND)));
          a *= 1 - smooth(seg(ex, 0.8, 0.88));
        }
        if (a > 0.003) dot(x, y, lerp(1.1, 1.7, down) * Math.sqrt(S), lerp(0.32, 0.9, down) * a);
      }
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';

      // ---- readout: the stroke being written, swum or re-inked (held through the exit)
      let now = lastStroke;
      if (!exiting) {
        if (t < swimAt(SLOT.indexOf(0))) { now = 1; for (const r of recs) if (t >= r.w0) now = r.i + 1; }
        else if (tau < 0) { let at = -1; for (const r of recs) if (t >= r.sw && r.sw > at) { at = r.sw; now = r.i + 1; } }
        else now = q.i + 1;
        lastStroke = now;
      }
      readLine = `U+9CB8 鲸 JĪNG\nSTROKE ${pad(now, 2)}/16 ${STROKES[now - 1][0].padEnd(2, '　')}`;
    },
  };
})();
