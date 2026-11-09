// ===== scene: SPLINE — a drafting batten bent into the whale by spline weights ('ducks', 'whales') ======
// A bentwood loop lies on a lofting table: the whale's own body circle. Twelve spline weights (draftsmen's
// ducks, also called whales) set down: five hold the head, seven pull the chin, back, and tail out of the
// circle in two waves that run into the tail. A ruling pen inks the line from the fluke tip round, a second
// pen inks the curl and the fin, a pin marks the eye. On exit the weights lift, the loop eases back to its
// circle, which shrinks onto the spinner track while its ink gathers into the progress arc.
SCENES.spline = (() => {
  const HW = 200;          // whale height × S
  const NB = 400;          // batten samples (closed)
  const EXD = 1.05;        // exit duration (s)
  const SIG_LO = 16;       // smoothing of the bulge displacement (samples): the tail swells as one round bud
  // weights: u on the body outline (u = 0 at the right fluke tip, increasing anticlockwise on screen)
  const DU = [0.06, 0.135, 0.25, 0.345, 0.43, 0.50, 0.57, 0.64, 0.71, 0.775, 0.87, 0.975];
  const ND = DU.length;
  const HEAD = [4, 5, 6, 7, 8];
  const T_HEAD = [0.79, 0.63, 0.55, 0.71, 0.87];        // head weights set down (hold only)
  // arrival time of the pull along u (knots, u may exceed 1 to wrap): two waves (chin → right side, head top →
  // bay) run into the tail, which swells nearly all at once as one bud, notch last
  const TB = [[0.74, 1.0], [0.775, 1.0], [0.87, 1.12], [0.922, 1.22], [0.975, 1.26], [1.06, 1.29], [1.135, 1.26],
    [1.197, 1.24], [1.25, 1.22], [1.30, 1.16], [1.345, 1.1], [1.40, 1.0], [1.74, 1.0]];
  // release (exit progress) along u: the reverse, from the notch outwards
  const TR = [[0.74, 0.06], [0.775, 0.055], [0.87, 0.045], [0.922, 0.035], [0.975, 0.025], [1.06, 0.012], [1.135, 0.025],
    [1.197, 0.035], [1.25, 0.045], [1.345, 0.055], [1.40, 0.06], [1.74, 0.06]];
  // each sample eases back (no overshoot) over REL of exit progress: the detail first, the bulge DLY later, so the
  // flukes melt into a bud before the bud draws in; all of it is round by ex ≈ 0.39
  const REL = 0.28, DLY = 0.05;
  // the pens (s). The ruling pen sets down at the fluke tip (u = U0) once the tail has settled and goes once round
  // the body, so the intricate tail falls in its slow start and finish; a second pen inks the inner curl, then the
  // fin. Each pen sets down and lifts at rest, and slows where the line turns tightly.
  const U0 = 0;
  const PEN_B = [1.64, 2.56], PEN_C = [2.34, 2.84], PEN_F = [2.76, 2.98];
  const PACE = 0.9;        // how much a tight turn slows a pen
  const T_PIN = 2.92;      // eye pin pressed in
  const T_COMB = 2.8;      // curvature comb starts
  const COMB_SPAN = 0.125, QL = 10;
  const Gx = new Float32Array(NB), Gy = new Float32Array(NB);   // glyph body outline
  const Cx = new Float32Array(NB), Cy = new Float32Array(NB);   // rest circle
  const TH = new Float64Array(NB);                              // circle angle of each sample (decreasing)
  const Nx = new Float32Array(NB), Ny = new Float32Array(NB);   // outward normal of the glyph
  const Kc = new Float32Array(NB);                              // smoothed signed curvature (convex > 0)
  const Kq = new Float32Array(NB);                              // comb curvature (heavier smoothing)
  const DLx = new Float32Array(NB), DLy = new Float32Array(NB); // bulge displacement (low frequency)
  const DHx = new Float32Array(NB), DHy = new Float32Array(NB); // detail displacement (the rest)
  const Tb = new Float32Array(NB), Tr = new Float32Array(NB), TailW = new Float32Array(NB);
  const Bx = new Float32Array(NB), By = new Float32Array(NB);   // batten now
  const PB = new Float64Array(NB + 1);                          // body pen: cumulative effort from U0
  const node = new Int16Array(ND), tLand = new Float32Array(ND), exLift = new Float32Array(ND);
  const aR = new Float32Array(ND), aG = new Float32Array(ND);   // weight heading: on the circle, on the glyph
  const isHead = DU.map((_, j) => HEAD.includes(j));
  const I0 = Math.round(U0 * NB);
  const NECK = 22;                                              // tail neck arc on the circle (deg)
  let wh = null, P = 0, R0 = 0, C0x = 0, C0y = 0, Lcurl = 0, Lfin = 0, orient = 1, eyeX = 0, eyeY = 0;
  let curlPts = null, finPts = null, eyePts = null, PC = null, PF = null;
  let duckBody = null, duckArm = null;
  let ro1 = '', ro2 = '';

  const spring = (tau, z, w) => {
    if (tau <= 0) return 0;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + ((z * w) / wd) * Math.sin(wd * tau));
  };
  const cyc = (d) => d - Math.round(d);
  const wrapPI = (a) => a - TAU * Math.round(a / TAU);
  // ease with a cruise: sine ramps over the first and last fraction a, constant speed between
  const glide = (k, a) => {
    if (k <= 0) return 0;
    if (k >= 1) return 1;
    const v = 1 / (1 - a), ramp = (x) => v * (x / 2 - (a / TAU) * Math.sin((Math.PI * x) / a));
    return k < a ? ramp(k) : k > 1 - a ? 1 - ramp(1 - k) : (v * a) / 2 + v * (k - a);
  };
  const paceF = (kap) => 1 + PACE * Math.tanh(Math.abs(kap) * S * 10);
  // fractional index where a cumulative effort table reaches p (0..1)
  function paceInv(cum, p) {
    const n = cum.length - 1;
    if (p <= 0) return 0;
    if (p >= 1) return n;
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= p) lo = m; else hi = m; }
    return lo + (p - cum[lo]) / (cum[hi] - cum[lo] || 1);
  }
  // cumulative effort along a polyline: arc length weighted by how tightly it turns (smoothed over ≈8 px)
  function paceOf(pts) {
    const n = pts.length, kap = new Float64Array(n), f = new Float64Array(n), cum = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [qx, qy] = pts[i + 1];
      let d = Math.atan2(qy - by, qx - bx) - Math.atan2(by - ay, bx - ax);
      while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      kap[i] = d / (0.5 * (Math.hypot(bx - ax, by - ay) + Math.hypot(qx - bx, qy - by)) || 1);
    }
    for (let i = 0; i < n; i++) {
      let s = 0, w = 0;
      for (let j = -15; j <= 15; j++) {
        const ii = i + j;
        if (ii < 0 || ii >= n) continue;
        const ww = Math.exp(-(j * j) / 50);
        s += Math.abs(kap[ii]) * ww; w += ww;
      }
      f[i] = paceF(s / w);
    }
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * 0.5 * (f[i] + f[i - 1]);
    for (let i = 1; i < n; i++) cum[i] /= cum[n - 1];
    return cum;
  }

  // piecewise-linear knots over u in [0.74, 1.74), sampled per batten index, then smoothed (periodic)
  function knotTable(knots, out, sm) {
    const raw = new Float32Array(NB);
    for (let i = 0; i < NB; i++) {
      let u = i / NB;
      if (u < 0.74) u += 1;
      let j = 0;
      while (j < knots.length - 2 && knots[j + 1][0] < u) j++;
      const [ua, va] = knots[j], [ub, vb] = knots[j + 1];
      raw[i] = va + (vb - va) * clamp01((u - ua) / (ub - ua));
    }
    for (let i = 0; i < NB; i++) {
      let s = 0, w = 0;
      for (let j = -3 * sm; j <= 3 * sm; j++) {
        const ww = Math.exp(-(j * j) / (2 * sm * sm));
        s += raw[(((i + j) % NB) + NB) % NB] * ww; w += ww;
      }
      out[i] = s / w;
    }
  }

  // batten coordinate u (0..1) whose circle angle is th
  function uAt(th) {
    const t0 = TH[0];
    const x = (((t0 - th) % TAU) + TAU) % TAU, target = t0 - x;
    let lo = 0, hi = NB;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TH[m] >= target) lo = m; else hi = m; }
    const a = TH[lo], b = hi < NB ? TH[hi] : TH[0] - TAU;
    return (lo + (a - target) / (a - b || 1)) / NB;
  }

  function cumLen(p) { const c = [0]; for (let i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return c; }
  // polyline points 0..s (fractional index), mapped through (tx, ty), into path; returns the pen point while
  // it is partial. (The points are mapped, so the details need no context transform during the exit.)
  function tracePoly(path, pts, s, tx, ty) {
    if (s <= 0) return null;
    const n = pts.length - 1, m = Math.min(n, Math.floor(s));
    path.moveTo(tx(pts[0][0]), ty(pts[0][1]));
    for (let i = 1; i <= m; i++) path.lineTo(tx(pts[i][0]), ty(pts[i][1]));
    if (m >= n) return null;
    const f = s - m, x = tx(lerp(pts[m][0], pts[m + 1][0], f)), y = ty(lerp(pts[m][1], pts[m + 1][1], f));
    path.lineTo(x, y);
    return [x, y];
  }
  // a pen's dot: it fades in and out by time, while the pen is at rest
  const penA = (t, [t0, t1]) => smooth(seg(t, t0, t0 + 0.09)) * (1 - smooth(seg(t, t1 - 0.09, t1)));

  return {
    label: 'SPLINE',
    readyAt: 3.4,
    titleAt: 2.0,
    exitDur: EXD,
    spinnerIn: 0.86,
    layout() {
      wh = makeWhale(CX, CY, HW * S);
      const body = wh.polys[0], cum = cumLen(body);
      P = cum[cum.length - 1];
      let k = 1;
      for (let i = 0; i < NB; i++) {
        const s = (i / NB) * P;
        while (k < cum.length - 1 && cum[k] < s) k++;
        const f = (s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
        Gx[i] = lerp(body[k - 1][0], body[k][0], f);
        Gy[i] = lerp(body[k - 1][1], body[k][1], f);
      }
      curlPts = wh.polys[1];
      finPts = wh.polys[2];
      eyePts = wh.polys[3];
      Lcurl = cumLen(curlPts).pop();
      Lfin = cumLen(finPts).pop();
      PC = paceOf(curlPts);
      PF = paceOf(finPts);
      eyeX = 0; eyeY = 0;
      for (const q of eyePts) { eyeX += q[0]; eyeY += q[1]; }
      eyeX /= eyePts.length; eyeY /= eyePts.length;
      let area = 0;
      for (let i = 0; i < NB; i++) { const j = (i + 1) % NB; area += Gx[i] * Gy[j] - Gx[j] * Gy[i]; }
      orient = area < 0 ? 1 : -1;
      // rest circle: least-squares fit to the head arc (u 0.42–0.72)
      {
        let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0, n = 0;
        for (let i = Math.round(0.42 * NB); i <= Math.round(0.72 * NB); i++) {
          const x = Gx[i], y = Gy[i], z = x * x + y * y;
          sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; n++;
        }
        const M = [[sxx, sxy, sx, sxz], [sxy, syy, sy, syz], [sx, sy, n, sz]];
        for (let i = 0; i < 3; i++) for (let r = 0; r < 3; r++) {
          if (r === i) continue;
          const f = M[r][i] / M[i][i];
          for (let c = i; c < 4; c++) M[r][c] -= f * M[i][c];
        }
        C0x = M[0][3] / M[0][0] / 2; C0y = M[1][3] / M[1][1] / 2;
        R0 = Math.sqrt(M[2][3] / M[2][2] + C0x * C0x + C0y * C0y);
      }
      // correspondence u -> angle on the circle (decreasing): the head keeps its own polar angle, the
      // bumps take the arc under them, the tail grows out of a short arc at its neck
      {
        const phi = (u) => { const i = Math.round(u * NB) % NB; return Math.atan2(Gy[i] - C0y, Gx[i] - C0x); };
        const deg = Math.PI / 180;
        const a40 = phi(0.40);
        let a74 = phi(0.74);
        while (a74 > a40) a74 -= TAU;
        const knots = [];
        for (let u = 0.40; u <= 0.7401; u += 0.01) {
          let a = phi(u);
          while (a > (knots.length ? knots[knots.length - 1][1] : a40 + 0.5)) a -= TAU;
          knots.push([u, a]);
        }
        knots.push([0.82, a74 - 18 * deg], [0.922, a74 - 65 * deg], [1.197, a74 - (65 + NECK) * deg],
          [1.30, a40 - TAU + 57 * deg], [1.40, a40 - TAU]);
        const raw = new Float64Array(NB);
        for (let i = 0; i < NB; i++) {
          let u = i / NB;
          if (u < 0.40) u += 1;
          let j = 0;
          while (j < knots.length - 2 && knots[j + 1][0] < u) j++;
          const [ua, aa] = knots[j], [ub, ab] = knots[j + 1];
          raw[i] = aa + (ab - aa) * clamp01((u - ua) / (ub - ua));
          if (i / NB < 0.40) raw[i] += TAU;
        }
        const sm = 5;
        for (let i = 0; i < NB; i++) {
          let s = 0, w = 0;
          for (let j = -3 * sm; j <= 3 * sm; j++) {
            const ii = i + j, wrap = Math.floor(ii / NB);
            const ww = Math.exp(-(j * j) / (2 * sm * sm));
            s += (raw[((ii % NB) + NB) % NB] - wrap * TAU) * ww; w += ww;
          }
          TH[i] = s / w;
          Cx[i] = C0x + Math.cos(TH[i]) * R0;
          Cy[i] = C0y + Math.sin(TH[i]) * R0;
        }
      }
      // displacement circle -> outline, split into a smooth bulge and the detail on top of it
      for (let i = 0; i < NB; i++) {
        let sx = 0, sy = 0, w = 0;
        for (let j = -3 * SIG_LO; j <= 3 * SIG_LO; j++) {
          const ii = (((i + j) % NB) + NB) % NB, ww = Math.exp(-(j * j) / (2 * SIG_LO * SIG_LO));
          sx += (Gx[ii] - Cx[ii]) * ww; sy += (Gy[ii] - Cy[ii]) * ww; w += ww;
        }
        DLx[i] = sx / w; DLy[i] = sy / w;
        DHx[i] = Gx[i] - Cx[i] - DLx[i]; DHy[i] = Gy[i] - Cy[i] - DLy[i];
      }
      // outward normals + curvature of the glyph outline (smoothed)
      const ang = new Float32Array(NB);
      for (let i = 0; i < NB; i++) {
        const a = (i - 1 + NB) % NB, b = (i + 1) % NB;
        const tx = Gx[b] - Gx[a], ty = Gy[b] - Gy[a], l = Math.hypot(tx, ty) || 1;
        Nx[i] = (-ty / l) * orient; Ny[i] = (tx / l) * orient;
        ang[i] = Math.atan2(Gy[(i + 1) % NB] - Gy[i], Gx[(i + 1) % NB] - Gx[i]);
      }
      const ds = P / NB, raw = new Float32Array(NB);
      for (let i = 0; i < NB; i++) {
        let d = ang[i] - ang[(i - 1 + NB) % NB];
        while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        raw[i] = (-d / ds) * orient;
      }
      for (let i = 0; i < NB; i++) {
        let s = 0, w = 0;
        for (let j = -6; j <= 6; j++) { const ww = Math.exp(-(j * j) / 18); s += raw[(i + j + NB) % NB] * ww; w += ww; }
        Kc[i] = s / w;
      }
      for (let i = 0; i < NB; i++) {
        let s = 0, w = 0;
        for (let j = -30; j <= 30; j++) { const ww = Math.exp(-(j * j) / 200); s += raw[(i + j + NB) % NB] * ww; w += ww; }
        Kq[i] = s / w;
      }
      // body pen effort from U0 once round (slower through the tight turns of the tail and the hooks)
      {
        const f = new Float64Array(NB);
        for (let i = 0; i < NB; i++) {
          let s = 0, w = 0;
          for (let j = -12; j <= 12; j++) { const ww = Math.exp(-(j * j) / 32); s += paceF(Kc[(i + j + NB) % NB]) * ww; w += ww; }
          f[i] = s / w;
        }
        PB[0] = 0;
        for (let q = 1; q <= NB; q++) PB[q] = PB[q - 1] + 0.5 * (f[(I0 + q - 1) % NB] + f[(I0 + q) % NB]);
        for (let q = 1; q <= NB; q++) PB[q] /= PB[NB];
      }
      // choreography tables
      knotTable(TB, Tb, 6);
      knotTable(TR, Tr, 4);
      knotTable([[0.74, 0], [0.87, 0], [0.922, 1], [1.197, 1], [1.25, 0], [1.74, 0]], TailW, 6);
      for (let j = 0; j < ND; j++) {
        const n = (node[j] = Math.round(DU[j] * NB) % NB);
        const h = HEAD.indexOf(j);
        tLand[j] = h >= 0 ? T_HEAD[h] : Tb[n] - 0.08;
        exLift[j] = h >= 0 ? 0.06 + 0.025 * Math.abs(h - 2) + 0.03 : Tr[n];
        // heading: the circle's outward normal where the weight lands, the glyph's (averaged) where it ends up
        aR[j] = Math.atan2(Cy[n] - C0y, Cx[n] - C0x);
        let sx = 0, sy = 0;
        for (let q = -8; q <= 8; q++) { const c = (n + q + NB) % NB; sx += Nx[c]; sy += Ny[c]; }
        aG[j] = Math.atan2(sy, sx);
      }
      // weight glyph (local units ≈ px at S = 1): nose at the origin, body along +x (outward)
      duckBody = new Path2D();
      duckBody.ellipse(12, 0, 4.8, 3.1, 0, 0, TAU);
      duckArm = new Path2D();
      duckArm.moveTo(7.2, 0); duckArm.lineTo(0.9, 0);
    },
    readout: () => `${ro1}\n${ro2}`,
    frame(t, ex, ek) {
      const L = light ? 1.12 : 1;
      // ---- exit transform: zoom about the spinner, log-scaled
      const sigE = SPIN_R / R0;
      const sig = exiting ? Math.exp(Math.log(sigE) * inOutSine(seg(ex, 0.12, 0.8))) : 1;
      const kz = (sig - sigE) / (1 - sigE);
      const ox = HX + (C0x - HX) * kz, oy = HY + (C0y - HY) * kz;
      const TX = (x) => ox + (x - C0x) * sig, TY = (y) => oy + (y - C0y) * sig;

      // ---- batten: circle + bulge + detail, each on its own spring per sample; on exit each eases back
      const ovalA = 0.055 * (1 - spring(t - 0.1, 0.45, 12));
      const kill = exiting ? 1 - smooth(seg(ex, 0.62, 0.85)) : 1;
      for (let i = 0; i < NB; i++) {
        let lam = spring(t - Tb[i], 0.7, lerp(14, 15, TailW[i]));
        let lamH = spring(t - Tb[i] - 0.22, 0.75, 18);
        if (exiting) {
          lamH *= (1 - inOutSine(seg(ex, Tr[i], Tr[i] + REL))) * kill;
          lam *= (1 - inOutSine(seg(ex, Tr[i] + DLY, Tr[i] + DLY + REL))) * kill;
        }
        let cx = Cx[i], cy = Cy[i];
        if (Math.abs(ovalA) > 1e-4) {
          const dx = cx - C0x, dy = cy - C0y;
          const c2 = (dx * dx - dy * dy) / (R0 * R0);
          cx += dx * ovalA * c2; cy += dy * ovalA * c2;
        }
        Bx[i] = TX(cx + lam * DLx[i] + lamH * DHx[i]);
        By[i] = TY(cy + lam * DLy[i] + lamH * DHy[i]);
      }

      const combA = smooth(seg(t, T_COMB, T_COMB + 0.6)) * (1 - smooth(seg(ex, 0, 0.15)));
      const tc = Math.max(0, t - T_COMB);
      const combU = fract(0.42 - 0.17 * tc - 0.02 * Math.sin((TAU * tc) / 2.95));   // a lap ≈ 5.9 s, speed ±25%
      // ---- table grid: stations ST 0–10 over the whale's length, waterlines over its height
      {
        const fade = 1 - smooth(seg(ex, 0, 0.3));
        const a0 = 0.07 * L * fade;
        if (a0 > 0.003) {
          const half = wh.width / 2, dSt = wh.width / 10, dWl = (HW * S) / 6;
          const yb = CY + (HW * S) / 2;
          const uc = combU * NB, ic = Math.floor(uc) % NB, xc = lerp(Gx[ic], Gx[(ic + 1) % NB], uc - Math.floor(uc));
          for (let k = 0; k <= 10; k++) {
            const x = CX - half + k * dSt;
            const g = outExpo(seg(t, 0.05 + Math.abs(k - 5) * 0.035, 0.75 + Math.abs(k - 5) * 0.035));
            const hl = 175 * S * g;
            const near = smooth(Math.max(0, 1 - Math.abs(x - xc) / dSt));   // no cusp as the comb crosses a station
            line(TX(x), TY(CY - hl), TX(x), TY(CY + hl), a0 * (k % 5 === 0 ? 1.43 : 1) * (1 + 1.6 * near * near * combA));
          }
          for (let m = 0; m <= 6; m++) {
            const y = yb - m * dWl;
            const g = outExpo(seg(t, 0.1 + Math.abs(m - 3) * 0.04, 0.8 + Math.abs(m - 3) * 0.04));
            const hl = 200 * S * g;
            line(TX(CX - hl), TY(y), TX(CX + hl), TY(y), a0 * (m === 0 ? 1.43 : 1));
          }
          const la = 0.24 * L * smooth(seg(t, 0.3, 0.6)) * (1 - smooth(seg(ex, 0, 0.15)));
          for (let k = 0; k <= 10; k += 2) text(String(k), CX - half + k * dSt, CY + 188 * S, la, 9, 'center');
          text('ST', CX - half - 22 * S, CY + 188 * S, la, 9, 'center');
          for (let m = 0; m <= 6; m++) text(m ? String(m) : 'BL', CX - 214 * S, yb - m * dWl, la, 9, 'center');
        }
      }

      // ---- plotted marks (offsets) where the bump weights will pull to
      for (let j = 0; j < ND; j++) {
        if (isHead[j]) continue;
        const s0 = 0.3 + ((tLand[j] - 0.9) / 0.5) * 0.25;
        const kIn = smooth(seg(t, s0, s0 + 0.25));
        const a = 0.42 * L * kIn * (1 - smooth(seg(t, tLand[j] + 0.25, tLand[j] + 0.55)));
        if (a <= 0.003) continue;
        const i = node[j], x = Gx[i], y = Gy[i], s = 2.6 * S * (0.4 + 0.6 * kIn);
        line(x - s, y, x + s, y, a);
        line(x, y - s, x, y + s, a);
      }

      // ---- the pens: progress along the body (fractional samples from U0), the curl and the fin (points)
      const sB = paceInv(PB, glide(seg(t, PEN_B[0], PEN_B[1]), 0.28));
      const sC = paceInv(PC, glide(seg(t, PEN_C[0], PEN_C[1]), 0.35));
      const sF = paceInv(PF, glide(seg(t, PEN_F[0], PEN_F[1]), 0.35));

      // ---- batten: double hairline (a bent strip); faded where the pen has inked it
      {
        const aB = 0.5 * L * smooth(seg(t, 0.06, 0.45)) * (1 - smooth(seg(ex, 0, 0.25)));
        if (aB > 0.003) {
          const aInked = aB * (1 - 0.86 * smooth(seg(t, PEN_B[0], PEN_B[1] + 0.3)));
          // never closer than 2.3 px: below S = 1 the two 1 px hairlines would merge into a beaded band
          const hb = 1.15 * Math.max(1, S);
          const kPen = Math.min(NB, Math.floor(sB));
          const pa = new Path2D(), pb = new Path2D();
          for (const side of [1, -1]) {
            for (let k = 0; k <= NB; k++) {
              const c = (I0 + k) % NB, a = (c - 1 + NB) % NB, b = (c + 1) % NB;
              const tx = Bx[b] - Bx[a], ty = By[b] - By[a], l = Math.hypot(tx, ty) || 1;
              const x = Bx[c] - (ty / l) * hb * side, y = By[c] + (tx / l) * hb * side;
              if (k <= kPen) { if (k === 0) pa.moveTo(x, y); else pa.lineTo(x, y); }
              if (k >= kPen) { if (k === kPen) pb.moveTo(x, y); else pb.lineTo(x, y); }
            }
          }
          ctx.lineWidth = 1;
          if (kPen > 0 && aInked > 0.003) { ctx.strokeStyle = col(aInked); ctx.stroke(pa); }
          if (kPen < NB) { ctx.strokeStyle = col(aB); ctx.stroke(pb); }
        }
      }

      // ---- curvature comb (porcupine) sweeping clockwise round the inked outline: quills on the convex side
      {
        const A = combA;
        if (A > 0.003) {
          const quills = new Path2D(), env = new Path2D();
          // walk the window in u order from one edge to the other, so the envelope is one line across u = 0
          const c0 = 2 * Math.round((combU * NB) / 2), K = 2 * Math.ceil((COMB_SPAN * NB) / 2);
          let first = true;
          for (let k = -K; k <= K; k += 2) {
            const i = (((c0 + k) % NB) + NB) % NB;
            const d = cyc(i / NB - combU);
            if (Math.abs(d) >= COMB_SPAN) continue;
            const w = 0.5 + 0.5 * Math.cos((Math.PI * d) / COMB_SPAN);
            const breathe = 0.86 + 0.14 * Math.sin(t * 1.7 - (i * TAU * 3) / NB);
            const rel = exiting ? 1 - smooth(seg(ex, Tr[i], Tr[i] + 0.1)) : 1;   // retracts as its section lets go
            const lq = QL * S * sig * Math.tanh((640 * S * Math.max(0, Kq[i])) / QL) * w * A * breathe * rel;
            const x = Bx[i], y = By[i], qx = x + Nx[i] * lq, qy = y + Ny[i] * lq;
            if (lq > 0.05) { quills.moveTo(x, y); quills.lineTo(qx, qy); }
            if (first) { env.moveTo(qx, qy); first = false; } else env.lineTo(qx, qy);
          }
          ctx.lineWidth = 1;
          ctx.strokeStyle = col(0.16 * L * A);
          ctx.stroke(quills);
          ctx.strokeStyle = col(0.4 * L * A);
          ctx.stroke(env);
        }
      }

      // ---- ink: the body rides on the batten; the details are inked by the second pen
      let penB = null, penC = null, penF = null;
      {
        const aInk = 0.86 * L;
        const sweep = spinnerSweep();
        const aRing = exiting ? lerp(aInk, RING_ALPHA, smooth(seg(ex, 0.3, 0.78))) : aInk;
        const wInk = exiting ? lerp(1.3, 2, smooth(seg(ex, 0.4, 0.8))) : 1.3;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (sB > 0) {
          const path = new Path2D();
          const n = Math.floor(sB);
          path.moveTo(Bx[I0], By[I0]);
          for (let k = 1; k <= Math.min(n, NB - 1); k++) { const c = (I0 + k) % NB; path.lineTo(Bx[c], By[c]); }
          if (sB >= NB) path.closePath();
          else {
            const f = sB - n, a = (I0 + n) % NB, b = (I0 + n + 1) % NB;
            penB = [lerp(Bx[a], Bx[b], f), lerp(By[a], By[b], f)];
            path.lineTo(penB[0], penB[1]);
          }
          ctx.strokeStyle = col(aRing);
          ctx.lineWidth = wInk;
          ctx.stroke(path);
        }
        // the progress arc: the ring's ink gathers into a 72° run that spins up and locks to the spinner
        if (exiting && ex > 0.3) {
          const ws = handoffSpec ? (TAU * 1000) / handoffSpec.dur : TAU / 0.8;
          const Tr0 = 0.3 * EXD, v = seg(ex, 0.3, 0.6);
          const head = spinnerAngle(t) + sweep + (ws * Tr0 * (1 - v) * (1 - v)) / 2;
          const cK = smooth(seg(ex, 0.3, 0.6));
          const aRun = aRing + (1 - aRing) * cK;
          const x = 1 - (1 - aRun) / (1 - aRing);
          if (x > 0.003) {
            const path = new Path2D();
            const steps = 48;
            for (let s = 0; s <= steps; s++) {
              const u = uAt(head - sweep + (sweep * s) / steps) * NB;
              const a = Math.floor(u) % NB, b = (a + 1) % NB, f = u - Math.floor(u);
              const px = lerp(Bx[a], Bx[b], f), py = lerp(By[a], By[b], f);
              if (s) path.lineTo(px, py); else path.moveTo(px, py);
            }
            ctx.lineCap = 'butt';   // square ends, like the spinner's own arc
            ctx.strokeStyle = col(x);
            ctx.lineWidth = wInk;
            ctx.stroke(path);
            ctx.lineCap = 'round';
          }
        }
        // details: inner curl, then the fin — inked by the second pen; they fade at the exit
        const dA = aInk * 0.92 * (1 - smooth(seg(ex, 0, 0.18)));
        if (dA > 0.003) {
          const path = new Path2D();
          penC = tracePoly(path, curlPts, sC, TX, TY);
          penF = tracePoly(path, finPts, sF, TX, TY);
          ctx.strokeStyle = col(dA);
          ctx.lineWidth = 1.2;
          ctx.stroke(path);
        }
        // the eye: a pin pressed in, then its ring
        const pinA = smooth(seg(t, T_PIN, T_PIN + 0.24)) * (1 - smooth(seg(ex, 0, 0.16)));
        if (pinA > 0.003) {
          const sc = (1 + 0.8 * (1 - outCubic(seg(t, T_PIN, T_PIN + 0.3)))) * (1 + 0.6 * smooth(seg(ex, 0, 0.16)));
          dot(TX(eyeX), TY(eyeY), 1.5 * S * sc * sig, 0.95 * L * pinA);
        }
        const ra = aInk * 0.85 * smooth(seg(t, T_PIN + 0.05, T_PIN + 0.3)) * (1 - smooth(seg(ex, 0, 0.18)));
        if (ra > 0.003) {
          const rp = new Path2D();
          eyePts.forEach((q, i) => (i ? rp.lineTo(TX(q[0]), TY(q[1])) : rp.moveTo(TX(q[0]), TY(q[1]))));
          ctx.strokeStyle = col(ra);
          ctx.lineWidth = 1.1;
          ctx.stroke(rp);
        }
        ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
        if (penB) dot(penB[0], penB[1], 2.1 * S, 0.9 * L * penA(t, PEN_B));
        if (penC) dot(penC[0], penC[1], 2.1 * S, 0.9 * L * penA(t, PEN_C));
        if (penF) dot(penF[0], penF[1], 2.1 * S, 0.9 * L * penA(t, PEN_F));
      }

      // ---- the spline weights: set down, turn with the strip as it bends, nod as the comb passes, lift
      for (let j = 0; j < ND; j++) {
        const ta = tLand[j];
        const kIn = seg(t, ta - 0.1, ta + 0.22);
        if (kIn <= 0) continue;
        const set = smooth(kIn);
        const lift = exiting ? inOutSine(seg(ex, exLift[j], exLift[j] + 0.24)) : 0;
        const keep = (1 - lift) * (1 - lift);
        const i = node[j];
        let w = 0, rock = 0;
        if (combA > 0) {
          const d = cyc(i / NB - combU);
          if (Math.abs(d) < COMB_SPAN) {
            w = (0.5 + 0.5 * Math.cos((Math.PI * d) / COMB_SPAN)) * combA;
            rock = Math.sin((Math.PI * d) / COMB_SPAN) * w;
          }
        }
        const a = 0.36 * L * set * keep * (1 + 0.9 * w);
        if (a <= 0.003) continue;
        let ang = aG[j];
        if (!isHead[j]) ang = aR[j] + wrapPI(aG[j] - aR[j]) * smooth(seg(t, Tb[i] - 0.02, Tb[i] + 0.55));
        ang += 0.06 * rock;
        const nx = Math.cos(ang), ny = Math.sin(ang);
        const off = (0.8 * w + 6 * lift) * S * sig;
        const x = (exiting ? TX(Gx[i]) : Bx[i]) + nx * off, y = (exiting ? TY(Gy[i]) : By[i]) + ny * off;
        const sc = S * sig * (1 + 0.2 * (1 - outCubic(kIn)) + 0.25 * lift);
        ctx.save();
        ctx.translate(x, y);
        ctx.transform(nx, ny, -ny, nx, 0, 0);
        ctx.scale(sc, sc);
        ctx.globalAlpha = set * keep;
        ctx.fillStyle = BG;
        ctx.fill(duckBody);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1 / sc;
        ctx.strokeStyle = col(a);
        ctx.stroke(duckBody);
        ctx.stroke(duckArm);
        ctx.restore();
        dot(x, y, 1.1 * S * sig, a * 1.6);
      }

      // ---- readout
      {
        const stwl = (x, y) => `ST ${((x - (CX - wh.width / 2)) / (wh.width / 10)).toFixed(1).padStart(4, '0')} WL ${((CY + (HW * S) / 2 - y) / ((HW * S) / 6)).toFixed(1)}`;
        let landed = 0;
        for (let j = 0; j < ND; j++) if (t > tLand[j] + 0.25) landed++;
        if (t < 0.55) { ro1 = 'LOFT 1:1'; ro2 = `R ${(R0 / S).toFixed(1)}`; }
        else if (t < PEN_B[0]) {
          let jl = 6;
          for (let j = 0; j < ND; j++) if (t > tLand[j] && tLand[j] >= tLand[jl]) jl = j;
          ro1 = `WHALE ${pad(landed, 2)}/${ND}`; ro2 = `κ ${Math.abs(Kc[node[jl]] * S).toFixed(4)}`;
        } else if (t < PEN_F[1]) {
          const inked = (P * Math.min(1, sB / NB) + Lcurl * (sC / (curlPts.length - 1)) + Lfin * (sF / (finPts.length - 1))) / (P + Lcurl + Lfin);
          const p = penF || penC || penB || [Gx[I0], Gy[I0]];
          ro1 = `INK ${pad(Math.round(inked * 100), 3)}%`;
          ro2 = stwl(p[0], p[1]);
        } else {
          const i = Math.floor(combU * NB) % NB;
          ro1 = `FAIR Δκ ${(Math.abs(Kc[i] - Kc[(i + 6) % NB]) * S).toFixed(4)}`;
          ro2 = stwl(Gx[i], Gy[i]);
        }
      }
    },
  };
})();
