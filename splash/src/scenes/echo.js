// ===== scene: ECHO — a ring sonar on the seabed; the whale exists only as reflected sound ============
// The sonar sits exactly where the boot spinner will be. Its active sector fires directional pings; where a
// front crosses the whale the outline glints (brightest where it faces the sonar) and slowly fades, drifting
// particles sparkle except in the whale's acoustic shadow, and the near specular part of each echo slides
// back down the radials into the hub, which answers with a ripple round its staves. On exit the whole whale
// is the last echo: it swells, dives down its radials and is taken in by the hub, whose staves answer and
// fold away; the ring lights all round (listening), then dims back to the track and leaves the progress arc.
SCENES.echo = (() => {
  const DEG = Math.PI / 180;
  const N = 960, NST = 36, NP = 180, NBIN = 361, NB = 48, NG = 24, NF = 16;
  const BEAM = 36 * DEG, SIDE = 22 * DEG, SW0 = 72 * DEG, SW1 = 120 * DEG;
  const SCAN = 38 * DEG, SCAN_T = 6.4, PERIOD = 0.8;
  const P0 = [0.62, 1.12, 1.62];
  const RISE = 0.12, EXIT = 1.05, TR = 0.38;   // glint rise, exit length, an echo sliver's trip home (s)
  const DIVE = 0.68, BETA = 0.35;   // exit: each point's dive window (ex), and the share of radial squash kept

  let hx0 = 0, hy0 = 0, RH = 0, C = 0, soft = null;
  let X, Y, D, UX, UY, TH, AMP, FACE, N01, PP, EV, LQ;
  let breaks = null, dmin = 0, dmax = 1, n0 = N, DM = 1;
  const nearD = new Float32Array(NBIN);   // distance to the whale's first surface per 0.5° of bearing
  const ghosts = new Map();               // per ping: echo weights, far/mean range, mean bearing
  let tEx = -1, lastT = 0;
  let rngTxt = '---.-', pingNow = 0, brgNow = '000.0';

  const smoother = (k) => k * k * k * (k * (k * 6 - 15) + 10);
  const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
  const binOf = (b) => Math.max(0, Math.min(NBIN - 1, Math.round(b / DEG / 0.5) + 180));
  const pingT = (k) => (k < 3 ? P0[k] : P0[2] + PERIOD * (k - 2));
  function lastPingIdx(t) {
    if (t < P0[0]) return -1;
    if (t < P0[1]) return 0;
    if (t < P0[2]) return 1;
    return 2 + Math.floor((t - P0[2]) / PERIOD);
  }
  // beam axis, as a bearing (0 = straight up, positive = clockwise): centre, left, right, then a slow swing
  function steerAt(t) {
    if (t < 0.72) return 0;
    if (t < 1.12) return -SCAN * inOutSine(seg(t, 0.72, 1.12));
    if (t < 1.62) return -SCAN + 2 * SCAN * inOutSine(seg(t, 1.12, 1.62));
    return SCAN * Math.cos((TAU * (t - 1.62)) / SCAN_T);
  }
  // transmit beam pattern: cos² main lobe to zero at ±36°, one 0.14 sidelobe each side out to ±58°
  function beam(ph) {
    const a = Math.abs(ph);
    if (a <= BEAM) { const c = Math.cos((Math.PI / 2) * (a / BEAM)); return c * c; }
    if (a < BEAM + SIDE) { const s = Math.sin((Math.PI * (a - BEAM)) / SIDE); return 0.14 * s * s; }
    return 0;
  }
  // a front's light on the outline: a fast specular flash over a slow afterglow (×A, peak ≈ 0.85 at about 0.1 s
  // once eased in; see the outline pass)
  const glint = (u) => 0.75 * Math.exp(-u / 0.16) + 0.5 * Math.exp(-u / 1.6);
  // a particle's sparkle behind a front: swells over 0.12 s, then fades
  const spark = (u) => (u <= 0 ? 0 : smooth(Math.min(1, u / 0.12)) * Math.exp(-u / 0.35));
  // a swell with a rounded peak (zero slope at the start and at the top), normalised to peak at 1
  function mkPulse(rise, tau) {
    const f = (u) => (u <= 0 ? 0 : smooth(Math.min(1, u / rise)) * Math.exp(-u / tau));
    let m = 0;
    for (let k = 1; k <= 400; k++) m = Math.max(m, f((rise * k) / 400));
    return (u) => f(u) / m;
  }
  const txPulse = mkPulse(0.13, 0.2);   // the hub transmitting: peaks as the front clears the staves
  const rvPulse = mkPulse(0.14, 0.3);   // the hub hearing an echo
  // a dive's progress: eases in over the first half, then runs at a constant rate (C2 at the joint), so in
  // log radius every point keeps a constant ratio per frame until it is taken in
  const diveQ = (s) => { if (s < 0.5) { const u = 2 * s; return (2 / 3) * u * u * u * (1 - u / 2); } return (s - 0.25) / 0.75; };

  function ghostOf(k, st) {
    let g = ghosts.get(k);
    if (g) return g;
    const A0 = new Float32Array(N), A = new Float32Array(N);
    for (let i = 0; i < n0; i++) {   // outer silhouette only: near surfaces that face the sonar
      const a0 = beam(TH[i] - st) * AMP[i] * Math.pow(FACE[i], 1.5) * smooth(seg(N01[i], 0.55, 0.25));
      A0[i] = a0 * smooth(seg(a0, 0.08, 0.22));
    }
    // blurred along the closed silhouette (±6 points, triangular), so a sliver stays one stroke with tapered
    // ends instead of breaking at a concave corner into two marks
    const L = n0 - 1;   // the loop's last point repeats its first
    let far = 0, sw = 0, sd = 0, sth = 0;
    for (let i = 0; i < n0; i++) {
      let sa = 0;
      for (let q = -6; q <= 6; q++) sa += (7 - Math.abs(q)) * A0[(((i + q) % L) + L) % L];
      const a = sa / 49;
      if (a <= 0.001) continue;
      A[i] = a;
      if (D[i] > far) far = D[i];
      sw += a; sd += a * D[i]; sth += a * TH[i];
    }
    g = { A, far: far || 100 * S, dm: sw ? sd / sw : 100 * S, thm: sw ? sth / sw : st };
    ghosts.set(k, g);
    if (ghosts.size > 10) ghosts.delete(ghosts.keys().next().value);
    return g;
  }

  // how deep (0..1) range r at bearing b lies in the whale's acoustic shadow (full `ramp` past its first surface),
  // with a ±3° penumbra (triangular over the 0.5° bins), so a front grazing a flank fades along its arc and a
  // drifting particle eases in and out of the shadow instead of being cut at the tangent bearing
  function shadow(r, b, ramp) {
    const c = binOf(b);
    let s = 0;
    for (let q = -6; q <= 6; q++) s += (7 - Math.abs(q)) * smooth(seg(r - nearD[Math.max(0, Math.min(NBIN - 1, c + q))], 0, ramp));
    return s / 49;
  }

  // evidence: the strongest hit each point has had, which sets its resting brightness. A hit counts once its
  // light has fully risen (RISE after the front); until then the outline pass eases toward it
  function addEvidence(t, k) {
    const tk = pingT(k), st = steerAt(tk);
    for (let i = 0; i < N; i++) {
      if (t - tk - D[i] / C < RISE) continue;
      const e = beam(TH[i] - st) * AMP[i];
      if (e > EV[i]) EV[i] = e;
    }
  }

  // segment buckets: one stroke per alpha level; consecutive segments in a level continue one polyline.
  // Butt ends with round joins: where two levels meet, their ends abut at the shared vertex instead of
  // overlapping (round caps there would composite twice and leave a bright bead at every level change).
  const mk = (n) => Array.from({ length: n }, () => []);
  function strokeB(bk, amax, wOf) {
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    for (let b = 0; b < bk.length; b++) {
      const L = bk[b];
      if (!L.length) continue;
      const a = (amax * (b + 0.5)) / bk.length;
      if (a > 0.004) {
        ctx.strokeStyle = col(a);
        ctx.lineWidth = wOf ? wOf(b / bk.length) : 1;
        ctx.beginPath();
        for (let j = 0; j < L.length; j += 4) {
          if (j === 0 || L[j] !== L[j - 2] || L[j + 1] !== L[j - 1]) ctx.moveTo(L[j], L[j + 1]);
          ctx.lineTo(L[j + 2], L[j + 3]);
        }
        ctx.stroke();
      }
      L.length = 0;
    }
    ctx.lineJoin = 'miter';
  }
  const bW = mk(NB), bG = mk(NG), bF = mk(NF);
  // a horizontal alpha ramp: zero at both ends, aa between `inner` and 1 − inner
  function hRamp(x0, x1, aa, inner) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, col(0)); g.addColorStop(inner, col(aa)); g.addColorStop(1 - inner, col(aa)); g.addColorStop(1, col(0));
    return g;
  }

  return {
    label: 'ECHO',
    readyAt: 3.4,
    titleAt: 2.0,
    spinnerIn: 0.86,   // the lit ring dims back into the progress arc itself
    layout() {
      hx0 = HX; hy0 = HY;
      RH = 14 * S;
      C = 340 * S;
      const WHH = 190 * S;
      const wh = makeWhale(hx0, hy0 - 58 * S - WHH / 2, WHH);   // lowest point 58S above the hub centre
      const hard = whaleMask(wh, 0);
      soft = whaleMask(wh, 3 * S);
      const con = whaleContour(wh, N);
      breaks = con.breaks;
      X = new Float32Array(N); Y = new Float32Array(N); D = new Float32Array(N);
      UX = new Float32Array(N); UY = new Float32Array(N); TH = new Float32Array(N);
      AMP = new Float32Array(N); FACE = new Float32Array(N); N01 = new Float32Array(N);
      PP = new Float32Array(N); EV = new Float32Array(N); LQ = new Float32Array(N);
      dmin = 1e9; dmax = 0;
      for (let i = 0; i < N; i++) {
        const [x, y] = con.pts[i];
        X[i] = x; Y[i] = y;
        const dx = x - hx0, dy = y - hy0, d = Math.hypot(dx, dy);
        D[i] = d; UX[i] = dx / d; UY[i] = dy / d;
        TH[i] = Math.atan2(dx, -dy);
        dmin = Math.min(dmin, d); dmax = Math.max(dmax, d);
      }
      // the dive's log-radius slope per point: a shared ratio toward the hub, keeping BETA of the squash a
      // pure radial collapse would give (that turned the whale into a tulip, then a crown of radial hairs)
      DM = 0.5 * (dmin + dmax);
      for (let i = 0; i < N; i++) {
        N01[i] = (D[i] - dmin) / (dmax - dmin);
        LQ[i] = Math.log((3 * S) / DM) + BETA * Math.log(DM / D[i]);
      }
      // outward normals (tested against the glyph) → how squarely each point faces the sonar
      const starts = [0, ...[...breaks].sort((a, b) => a - b), N];
      n0 = starts[1];
      for (let s = 0; s < starts.length - 1; s++) {
        const s0 = starts[s], s1 = starts[s + 1];
        for (let i = s0; i < s1; i++) {
          const pv = i === s0 ? s1 - 2 : i - 1, nx_ = i === s1 - 1 ? s0 + 1 : i + 1;
          const tx = X[nx_] - X[pv], ty = Y[nx_] - Y[pv], l = Math.hypot(tx, ty) || 1;
          let nx = -ty / l, ny = tx / l;
          if (hard(X[i] + 2 * nx, Y[i] + 2 * ny) > 0.5) { nx = -nx; ny = -ny; }
          FACE[i] = Math.max(0, -(nx * UX[i] + ny * UY[i]));
          AMP[i] = (0.5 + 0.5 * Math.pow(FACE[i], 0.7)) * (1 - 0.2 * N01[i]);
        }
      }
      // acoustic shadow: march each bearing out from the hub to the first surface
      for (let b = 0; b < NBIN; b++) {
        const be = (b - 180) * 0.5 * DEG, sx = Math.sin(be), sy = -Math.cos(be);
        nearD[b] = 1e9;
        for (let r = 20 * S; r < 340 * S; r += 1) if (hard(hx0 + sx * r, hy0 + sy * r) > 0.5) { nearD[b] = r; break; }
      }
      ghosts.clear();
      // a resize must not dim the whale: replay the pings already heard
      for (let k = 0; k <= lastPingIdx(lastT); k++) if (tEx < 0 || pingT(k) < tEx) addEvidence(lastT, k);
    },
    readout: () => `PING ${pad(pingNow, 3)}  BRG ${brgNow}°\nRNG ${rngTxt} M`,
    frame(t, ex, ek) {
      lastT = t;
      if (exiting && tEx < 0) tEx = t - ex * EXIT;
      const eh = inOutCubic(seg(ex, 0, 0.3));
      const hx = lerp(hx0, HX, eh), hy = lerp(hy0, HY, eh);   // glide onto the measured spinner
      const fadeF = 1 - smooth(seg(ex, 0, 0.3));
      const steerNow = steerAt(t);
      brgNow = ((((steerNow / DEG) % 360) + 360) % 360).toFixed(1).padStart(5, '0');
      const LK = light ? 1.12 : 1;

      // live pings (none from the moment the exit begins)
      const kLast = lastPingIdx(t);
      const live = [];
      for (let k = Math.max(0, kLast - 4); k <= kLast; k++) {
        const tk = pingT(k);
        if (tEx >= 0 && tk >= tEx) continue;
        if (t - tk > 3.2) continue;
        live.push({ k, tk, st: steerAt(tk) });
      }
      if (live.length) pingNow = live[live.length - 1].k + 1;

      // ---- seabed: a hairline with a ground hatch and a range scale, drawn outward from the sonar over two
      // faint sub-bottom strata; on exit it all retracts into the sonar
      {
        const ysb = hy + 32 * S;
        const half = 300 * S * inOutSine(seg(t, 0.1, 0.9)) * (1 - inOutCubic(seg(ex, 0, 0.5)));
        const a = 0.2 * (1 - smooth(seg(ex, 0.25, 0.5)));
        if (half > 1 && a > 0.003) {
          // strata: static gentle undulations sampled at fixed x, so nothing crawls while they grow
          const aS = 1 - smooth(seg(ex, 0.1, 0.4));
          for (let k = 0; k < 2; k++) {
            const hs = half * [0.9, 0.78][k], ak = [0.07, 0.045][k] * aS, yk = ysb + [34, 70][k] * S, ph = [0.7, 2.3][k];
            if (hs < 2 || ak < 0.003) continue;
            ctx.strokeStyle = hRamp(hx - hs, hx + hs, ak, 0.3);
            ctx.lineWidth = 1;
            ctx.beginPath();
            const step = 12 * S, n = Math.ceil(hs / step);
            for (let m = -n; m <= n; m++) {
              const dx = Math.max(-hs, Math.min(hs, m * step));
              const y = yk + 2 * S * Math.sin(dx / (90 * S) + ph);
              if (m === -n) ctx.moveTo(hx + dx, y); else ctx.lineTo(hx + dx, y);
            }
            ctx.stroke();
          }
          ctx.strokeStyle = hRamp(hx - half, hx + half, a, 0.25);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(hx - half, ysb); ctx.lineTo(hx + half, ysb); ctx.stroke();
          // hatch: zero within 6S of the line's ends, so each tick fades in as the line passes it
          const hk = 0.085 * (1 - smooth(seg(ex, 0, 0.3)));
          if (hk > 0.003 && half > 6 * S) {
            const o1 = Math.min(0.5, (3 * S) / half), o2 = Math.min(0.5, Math.max(0.3, (12 * S) / half, o1));
            const g2 = ctx.createLinearGradient(hx - half, 0, hx + half, 0);
            g2.addColorStop(0, col(0)); g2.addColorStop(o1, col(0)); g2.addColorStop(o2, col(hk));
            g2.addColorStop(1 - o2, col(hk)); g2.addColorStop(1 - o1, col(0)); g2.addColorStop(1, col(0));
            ctx.strokeStyle = g2;
            ctx.beginPath();
            for (let x = 4.5 * S; x < half + 5 * S; x += 9 * S) {
              for (const sg of [-1, 1]) { ctx.moveTo(hx + sg * x, ysb + 2.5 * S); ctx.lineTo(hx + sg * x - 5 * S, ysb + 7.5 * S); }
            }
            ctx.stroke();
          }
          // range scale: a tick every 5 m (50S), taller every 10 m, labelled at 10 and 20 m. Each mark fades in
          // over 0.3 s once the growing line has passed it (its label 0.05 s behind); on exit the whole scale
          // fades out before the retracting line gets back to the outermost ticks (at ex ≈ 0.17)
          const aR = 1 - smooth(seg(ex, 0, 0.14));
          for (let m = 1; m <= 5; m++) {
            const x = 50 * S * m;
            const tR = 0.1 + (0.8 / Math.PI) * Math.acos(1 - (2 * (x + 4 * S)) / (300 * S));   // when half = x + 4S
            const vis = smooth(seg(t, tR, tR + 0.3)) * aR;
            if (vis <= 0.003) continue;
            const major = m % 2 === 0, len = (major ? 7 : 4) * S;
            for (const sg of [-1, 1]) line(hx + sg * x, ysb - 1, hx + sg * x, ysb - len, (major ? 0.24 : 0.16) * vis);
            const vl = smooth(seg(t, tR + 0.05, tR + 0.35)) * aR;
            if (major) for (const sg of [-1, 1]) text(`${m * 5} M`, hx + sg * x, ysb + 16 * S, 0.26 * vl, 9, 'center');
          }
        }
      }

      // ---- particles: drifting snow that sparkles as a front passes, never inside the whale's shadow
      {
        const pa = smooth(seg(t, 0.45, 1.2)) * fadeF;
        if (pa > 0) {
          for (let m = 0; m < NP; m++) {
            const L = 9 + 5 * hash(m * 5.13 + 2.1);
            const ph = hash(m * 3.71 + 1.3) * L;
            const age = (t + ph) % L, cyc = Math.floor((t + ph) / L);
            const h1 = hash(m * 13.7 + cyc * 7.31), h2 = hash(m * 5.33 + cyc * 3.17 + 0.5);
            const x = hx0 + (h1 * 2 - 1) * 290 * S + 3 * S * Math.sin(t * 0.37 + m * 1.7);
            const y = hy0 - lerp(66, 300, h2) * S + 4 * S * age;
            const dx = x - hx0, dy = y - hy0, d = Math.hypot(dx, dy), th = Math.atan2(dx, -dy);
            const env = smooth(seg(age, 0, 1.5)) * (1 - smooth(seg(age, L - 1.5, L))) *
              (1 - smooth(seg(Math.abs(th), 64 * DEG, 76 * DEG))) * (1 - smooth(seg(d, 260 * S, 300 * S))) * (1 - soft(x, y));
            if (env <= 0.01) continue;
            let g = 0;
            for (const p of live) { const u = t - p.tk - d / C; if (u > 0) g = Math.max(g, beam(th - p.st) * spark(u)); }
            if (g > 0) g *= 1 - shadow(d, th, 12 * S);
            dot(x, y, 0.75 + 0.45 * g, (0.085 + 0.55 * g) * env * pa * LK);
          }
        }
      }

      // ---- fronts: a packet of three arcs per ping, shaped by the beam pattern, dying out past the whale
      for (const p of live) {
        const R0 = C * (t - p.tk);
        for (let j = 0; j < 3; j++) {
          const r = R0 - j * 7 * S;
          if (r < RH) continue;
          const ar = smooth(seg(r, RH + 6 * S, RH + 30 * S)) * (1 - smooth(seg(r, 230 * S, 300 * S))) *
            (0.72 - 0.24 * seg(r, 40 * S, 300 * S)) * [1, 0.5, 0.25][j] * fadeF;
          if (ar < 0.004) continue;
          const lo = Math.max(-76 * DEG, p.st - BEAM - SIDE), hi = Math.min(76 * DEG, p.st + BEAM + SIDE);
          const ns = Math.ceil((hi - lo) / (1.5 * DEG));
          for (let s = 0; s < ns; s++) {
            const b0 = lo + (s * (hi - lo)) / ns, b1 = lo + ((s + 1) * (hi - lo)) / ns, bm = (b0 + b1) / 2;
            const edge = 1 - smooth(seg(Math.abs(bm), 62 * DEG, 76 * DEG));
            const a0 = ar * beam(bm - p.st) * edge;
            if (a0 < 0.004) continue;
            const a = a0 * (1 - 0.85 * shadow(r, bm, 14 * S));
            if (a < 0.004) continue;
            const bi = Math.min(NF - 1, Math.floor((a / 0.72) * NF));
            const c0 = b0 - Math.PI / 2, c1 = b1 - Math.PI / 2;
            bF[bi].push(hx + Math.cos(c0) * r, hy + Math.sin(c0) * r, hx + Math.cos(c1) * r, hy + Math.sin(c1) * r);
          }
        }
      }
      strokeB(bF, 0.72 * LK, (k) => 1 + 0.4 * k);

      // ---- whale outline: per-point glints over a resting floor that grows with the evidence
      // A hit is eased in over RISE (zero slope at the start) from the point's resting level before it toward
      // max(light, the resting level after it), so neither the flash nor the new level is switched on halfway up
      // an attack; at RISE the hit joins the evidence and the two forms meet exactly
      for (const p of live) addEvidence(t, p.k);
      for (let i = 0; i < N; i++) {
        const br = 0.52 * (0.9 + 0.1 * Math.sin(t * 0.7 + i * 0.05));
        const floor = br * Math.min(1, EV[i] / 0.3);
        let g = floor;
        for (const p of live) {
          const u = t - p.tk - D[i] / C;
          if (u <= 0) continue;
          const A = beam(TH[i] - p.st) * AMP[i];
          let w = A * glint(u);
          if (u < RISE) w = floor + (Math.max(w, floor, br * Math.min(1, A / 0.3)) - floor) * smooth(u / RISE);
          if (w > g) g = w;
        }
        PP[i] = Math.min(0.92, g);
      }

      // ---- echoes: the near, sonar-facing part of each echo slides back down the radials into the hub
      let rx = null;
      const ga0 = 0.42 * (1 - smooth(seg(ex, 0.1, 0.4)));
      for (const p of live) {
        const g = ghostOf(p.k, p.st);
        const tdep = p.tk + g.far / C;
        const u = (t - tdep) / TR;
        const tArr = tdep + TR * Math.pow(Math.max(0, 1 - (25 * S) / g.dm), 1 / 1.7);
        if (t > tArr) {
          rngTxt = ((g.dm / S) * 0.1).toFixed(1).padStart(5, '0');
          (rx || (rx = [])).push({ ta: tArr, th: g.thm });
        }
        if (u <= 0 || u >= 1 || ga0 <= 0) continue;
        const s = 1 - Math.pow(u, 1.7);
        const ga = ga0 * smooth(seg((1 - s) * g.dm, 6 * S, 18 * S));   // shows only once clear of the outline
        if (ga <= 0) continue;
        for (let i = 0; i < n0 - 1; i++) {
          const A = (g.A[i] + g.A[i + 1]) / 2;
          if (A <= 0.01) continue;
          const a = ga * A * smooth(seg(s * D[i], 12 * S, 48 * S));   // taken in at the stave tips
          if (a < 0.004) continue;
          const bi = Math.min(NG - 1, Math.floor((a / 0.42) * NG));
          bG[bi].push(hx + (X[i] - hx0) * s, hy + (Y[i] - hy0) * s, hx + (X[i + 1] - hx0) * s, hy + (Y[i + 1] - hy0) * s);
        }
      }
      strokeB(bG, 0.42 * LK, () => 1);

      // ---- the whale: in place while idle; on exit the last echo swells, dives down its radials and is taken
      // in by the hub before it reaches the staves
      {
        const WA = light ? 1 : 0.95;
        // the whole whale also fades as one piece once it is small (its mid-range scale 0.3 → 0.08, ex ≈ 0.41–0.58),
        // so its back and tail never linger above the hub as a fragment after the belly has been taken in
        const fW = ex > 0 ? smooth(seg(Math.exp(diveQ(seg(ex, 0.09, 0.09 + DIVE)) * Math.log((3 * S) / DM)), 0.08, 0.3)) : 1;
        let pa = -1, pxp = 0, pyp = 0;
        for (let i = 0; i < N; i++) {
          let x = X[i] + (hx - hx0), y = Y[i] + (hy - hy0), a = PP[i];
          if (ex > 0) {
            const dl = 0.03 + 0.12 * N01[i];   // near parts (the belly) leave first
            const r = D[i] * Math.exp(diveQ(seg(ex, dl, dl + DIVE)) * LQ[i]);
            const kb = smooth(seg(ex, dl - 0.02, dl + 0.26));   // eased from the point's own brightness
            a = lerp(a, Math.max(a, 0.64), kb) * smooth(seg(r, RH + 8 * S, RH + 36 * S)) * fW;
            x = hx + UX[i] * r; y = hy + UY[i] * r;
          }
          if (i > 0 && !breaks.has(i)) {
            const am = (a + pa) / 2;
            if (am > 0.006) bW[Math.min(NB - 1, Math.floor((am / 0.92) * NB))].push(pxp, pyp, x, y);
          }
          pa = a; pxp = x; pyp = y;
        }
        strokeB(bW, 0.92 * WA, (k) => 1.15 + 0.55 * smooth(seg(k, 0.35, 1)));
      }

      // ---- the sonar: ring, housing, 36 staves, the active sector on the ring
      {
        const kS = inOutCubic(seg(ex, 0.2, 0.72));
        const kR = inOutCubic(seg(ex, 0.3, 0.8));
        const kA = smooth(seg(ex, 0.35, 0.86));
        const ringR = Math.exp(lerp(Math.log(RH), Math.log(SPIN_R), kR));
        const build = exiting ? 1 : inOutSine(seg(t, 0.05, 0.5));
        arc(hx, hy, ringR, -Math.PI / 2, build * TAU, lerp(0.34, RING_ALPHA, kA), lerp(1, 2, kA));
        arc(hx, hy, 5 * S * lerp(1, 0.5, kS), 0, TAU, 0.2 * smooth(seg(t, 0.2, 0.5)) * (1 - smooth(seg(ex, 0.05, 0.35))));
        const secOn = smooth(seg(t, 0.35, 0.6));
        let txAll = 0;
        for (const p of live) txAll = Math.max(txAll, txPulse(t - p.tk));
        const sIn = ringR + 2.5 * S * (1 - kS);
        const stA = 1 - smooth(seg(ex, 0.5, 0.72));
        for (let j = 0; j < NST; j++) {
          const be = (j / NST) * TAU, off = Math.abs(wrapPi(be)) / Math.PI;
          const grow = outCubic(seg(t, 0.12 + 0.3 * off, 0.42 + 0.3 * off));
          if (grow <= 0 || stA <= 0) continue;
          const dA = wrapPi(be - steerNow);
          const act = Math.abs(dA) < BEAM ? Math.cos((Math.PI / 2) * (dA / BEAM)) ** 2 * secOn : 0;
          let tx = 0;
          for (const p of live) {
            const dp = wrapPi(be - p.st);
            if (Math.abs(dp) < BEAM) tx = Math.max(tx, Math.cos((Math.PI / 2) * (dp / BEAM)) ** 2 * txPulse(t - p.tk));
          }
          let rv = 0;
          if (rx) for (const q of rx) {
            const dq = Math.abs(wrapPi(be - q.th));
            rv = Math.max(rv, (0.35 + 0.65 * Math.exp(-((dq / 0.5) ** 2))) * rvPulse(t - q.ta - dq / 6));
          }
          // on exit the staves in the whale's bearings answer as it is taken in
          if (exiting) rv = Math.max(rv, Math.exp(-((wrapPi(be) / 0.75) ** 2)) * Math.sin(Math.PI * seg(ex, 0.22, 0.7)) ** 2);
          const len = (6 * S + 3.5 * S * act + 4 * S * tx + 2 * S * rv) * grow * (1 - kS);
          const a = Math.min(0.95, 0.14 + 0.22 * act + 0.3 * tx + 0.45 * rv) * grow * stA;
          const ca = be - Math.PI / 2;
          if (len > 0.05) line(hx + Math.cos(ca) * sIn, hy + Math.sin(ca) * sIn, hx + Math.cos(ca) * (sIn + len), hy + Math.sin(ca) * (sIn + len), a);
        }
        // the active sector: on exit it opens round the whole ring (listening for the last echo); then the lit
        // ring dims back to the track under the spinner arc's head, which brightens into the progress arc, so
        // nothing on the ring ever moves faster than the spinner
        const secW = lerp(1.4, 2, smooth(seg(ex, 0.3, 0.8)));
        if (ex < 0.42) {
          // opening: the whole ring lights up beneath the sector, which widens a little and melts into it, so no
          // edge sweeps round faster than the steer; at kOpen 1 it is the same full ring the close starts from
          const kOpen = smoother(seg(ex, 0.06, 0.4));
          const aU = 0.7 * kOpen;
          if (aU > 0.003) {
            ctx.strokeStyle = col(aU);
            ctx.lineWidth = secW;
            ctx.beginPath(); ctx.arc(hx, hy, ringR, 0, TAU); ctx.closePath(); ctx.stroke();
          }
          const sweep = lerp(SW0, SW1, kOpen);
          const aT = Math.min(1, lerp(0.42, 0.7, kOpen) + 0.18 * txAll * fadeF) * secOn;   // the sector reads aT
          arc(hx, hy, ringR, steerNow - Math.PI / 2 - sweep / 2, sweep, 1 - (1 - aT) / Math.max(1e-3, 1 - aU), secW);
        } else {
          const kClose = smoother(seg(ex, 0.44, 0.86));
          const aU = 0.7 * (1 - kClose), aH = lerp(0.7, 1, kClose);
          if (aU > 0.003) {   // the lit ring, closed (no seam), dimming evenly
            ctx.strokeStyle = col(aU);
            ctx.lineWidth = secW;
            ctx.beginPath(); ctx.arc(hx, hy, ringR, 0, TAU); ctx.closePath(); ctx.stroke();
          }
          // the head on top, so the two together read aH there: the ring alone at kClose 0, the arc alone at 1
          arc(hx, hy, ringR, spinnerAngle(t), spinnerSweep(), 1 - (1 - aH) / Math.max(1e-3, 1 - aU), secW);
        }
      }
    },
  };
})();
