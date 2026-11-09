// ===== scene: SHADOW — a wire sculpture on a turntable: from the front the whale, from the side a circle ====
// The whale outline is lifted onto a horizontal cylinder (z = ±√(R² − y²)): its front projection is the glyph, its
// side projection one circle. A ring lifts off the turntable and prints the wire bottom-up while the turntable coasts
// in from −150° and the camera descends; at 0° the wire is the whale. On exit the details fade and the turntable turns
// on to +90°: the outline turns edge-on into the circle, which shrinks onto the spinner track, and one of two bands of
// light running round the cylinder axis spins up into the spinner's progress arc.
SCENES.shadow = (() => {
  const N = 900, NB = 10, Q = 10;
  // wire groups inside each depth bin: 0 solid, 1..NL−1 the print's soft front (alpha l/NL), NL the details fading out
  const NL = 8, G = NL + 1, NGL = 6;
  const PSI0 = -150 * DEG, PITCH0 = 24 * DEG, PITCH_REST = 1.6 * DEG, T_COAST = 2.8;
  const XD = 1.1, TURN = 0.5, SWAP = 0.5;
  const W_I = TAU / 4.8, W_S = TAU / 0.8;
  // exit spin-up of the bands: a ramp of length L_UP from 75 to 450°/s whose start (A0..A1) is chosen on the first
  // exit frame so that one band arrives exactly on the spinner's arc; the lock then only absorbs drift
  const K_UP = (W_S - W_I) * XD, L_UP = 0.3, A0 = 0.04, A1 = 0.48, LOCK = 0.86;
  const WIRE_W = 1.1, HALO_W = 3.6, TRIM = 0.5;
  const A_W = light ? 0.66 : 0.6, BACK = 0.3, S_REST = 0.25, MEET = 0.65;
  const LEN_I = 36 * DEG, A_BAND = 0.9;
  const SIGNS = [0, -1, 1, 1];        // by length rank: body (split), belly back, cheek front, eye front
  const LW = 26, LH = 14;             // dial label cell, css px

  let R = 0, OX = 0, OY = 0, RT = 0, YT = 0, RIM = 0, DMAX = 1, HF = 1;
  let X, Y, Z, B, sx, sy, sd;
  let lowF, lowB, highF, highB;       // per point: ends of its monotone stretch, walking forward / backward round its loop
  let subs = [], labels = null;
  let psiNow = 0, phiNow = 0, prNow = 0;
  let spinU = 0, lastSpin = 0, lock = null;

  const E = (u) => 1 - Math.pow(1 - u, 3) * (1 + 1.5 * u);   // coast: lands with v = a = 0
  // ∫₀ˣ smooth(seg(e, a, a + L_UP)) de: how far the spin-up has carried a band beyond its idle pace
  const upInt = (x, a) => {
    if (x <= a) return 0;
    if (x >= a + L_UP) return x - a - L_UP / 2;
    const u = (x - a) / L_UP;
    return L_UP * (u * u * u - (u * u * u * u) / 2);
  };

  function yawLive(t) {
    const rock = (0.85 * Math.sin(0.61 * t + 0.3) + 0.35 * Math.sin(1.37 * t + 2.0)) * DEG;
    return PSI0 * (1 - E(seg(t, 0, T_COAST))) + rock * smooth(seg(t, 1.8, 3.3));
  }
  function pitchLive(t) {
    return lerp(PITCH0, PITCH_REST + 0.5 * DEG * Math.sin(0.83 * t + 1.1), E(seg(t, 0, 2.6)));
  }
  // depth-shading strength: full in the tangle and while the camera is high, a residue at the front view, none at
  // the level side view
  function shade(psi, phi) {
    const s2 = Math.sin(2 * psi) ** 2, c4 = Math.cos(psi) ** 4;
    return Math.min(1, s2 + S_REST * c4 * (1 - s2) + smooth(seg(phi, 3 * DEG, 12 * DEG)));
  }
  // the print plane: lifts off the turntable, slows into the wire's lowest point (y = R), then sweeps up through it
  function planeY(t) {
    return YT - (YT - R - 2 * S) * smooth(seg(t, 0.35, 0.74)) - (2 * R + 16 * S) * inOutSine(seg(t, 0.7, 1.45));
  }
  // nozzle dot at a cut of segment i: fades with the plane's distance from the two ends of the monotone stretch the
  // cut lies on, so a dot grows out of every new piece and is gone before its cut meets another
  function tipFade(i, yP) {
    const fwd = Y[i + 1] >= yP;                  // the printed side lies ahead of the cut
    const dep = fwd ? lowF[i + 1] - yP : lowB[i] - yP, gap = fwd ? yP - highB[i] : yP - highF[i + 1];
    return smooth(clamp01(dep / HF)) * smooth(clamp01(gap / HF));
  }

  return {
    label: 'SHADOW',
    readyAt: 3.3,
    titleAt: 2.1,
    exitDur: XD,
    spinnerIn: 0.86,
    layout() {
      OX = CX; OY = CY - 26 * S;
      const { pts, breaks } = whaleContour(makeWhale(OX, OY, 212 * S), N);
      X = new Float32Array(N); Y = new Float32Array(N); Z = new Float32Array(N); B = new Float32Array(N);
      sx = new Float32Array(N); sy = new Float32Array(N); sd = new Float32Array(N);
      let y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      OY = (y0 + y1) / 2;                          // the cylinder axis passes through the sculpture centre
      R = (y1 - y0) / 2;
      for (let i = 0; i < N; i++) { X[i] = pts[i][0] - OX; Y[i] = pts[i][1] - OY; }
      const starts = [0, ...[...breaks].sort((a, b) => a - b)];
      subs = starts.map((s, k) => {
        const e = k + 1 < starts.length ? starts[k + 1] : N;
        return { s, e, closed: Math.hypot(X[e - 1] - X[s], Y[e - 1] - Y[s]) < 0.5 * S };
      });
      const zr = (i) => Math.sqrt(Math.max(0, R * R - Y[i] * Y[i]));
      {
        // body loop: split at its topmost and bottommost points (z = 0 there); the head side (smaller mean x) in front
        const { s, e } = subs[0];
        let iT = s, iB = s;
        for (let i = s; i < e; i++) { if (Y[i] < Y[iT]) iT = i; if (Y[i] > Y[iB]) iB = i; }
        const inA = (i) => (iT < iB ? i >= iT && i <= iB : i >= iT || i <= iB);
        let mA = 0, nA = 0, mB = 0, nB = 0;
        for (let i = s; i < e; i++) { if (inA(i)) { mA += X[i]; nA++; } else { mB += X[i]; nB++; } }
        const sA = mA / nA < mB / nB ? 1 : -1;
        for (let i = s; i < e; i++) Z[i] = (inA(i) ? sA : -sA) * zr(i);
      }
      for (let k = 1; k < subs.length; k++) for (let i = subs[k].s; i < subs[k].e; i++) Z[i] = SIGNS[k] * zr(i);
      DMAX = 0;
      for (let i = 0; i < N; i++) { B[i] = Math.atan2(Y[i], Z[i]); DMAX = Math.max(DMAX, Math.hypot(X[i], Z[i])); }
      // per point, walking forward and backward round its loop: the y reached while the wire keeps falling (low*) and
      // while it keeps rising (high*); a closed loop's last point repeats its first
      lowF = new Float32Array(N); lowB = new Float32Array(N); highF = new Float32Array(N); highB = new Float32Array(N);
      for (const { s, e, closed } of subs) {
        const n = closed ? e - 1 - s : e - s, at = (j) => s + (((j % n) + n) % n);
        const walk = (j, dir, sg) => {
          let k = j;
          for (let c = 0; c < n; c++) {
            if (!closed && (k + dir < 0 || k + dir >= n)) break;
            if (sg * (Y[at(k + dir)] - Y[at(k)]) < 0) break;
            k += dir;
          }
          return Y[at(k)];
        };
        for (let j = 0; j < n; j++) {
          const i = at(j);
          lowF[i] = walk(j, 1, 1); lowB[i] = walk(j, -1, 1); highF[i] = walk(j, 1, -1); highB[i] = walk(j, -1, -1);
        }
        if (closed) { lowF[e - 1] = lowF[s]; lowB[e - 1] = lowB[s]; highF[e - 1] = highF[s]; highB[e - 1] = highB[s]; }
      }
      RT = 186 * S; YT = R + 58 * S; RIM = 9 * S; HF = 28 * S;
      // dial and gizmo labels, rendered once (drawn as images they move by sub-pixel steps): cells 0–11 hold
      // 000…330, cells 12–14 X, Y, Z
      labels = document.createElement('canvas');
      labels.width = Math.ceil(LW * 15 * DPR); labels.height = Math.ceil(LH * DPR);
      const g = labels.getContext('2d');
      g.scale(DPR, DPR);
      g.font = `9px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col(1);
      for (let k = 0; k < 15; k++) g.fillText(k < 12 ? pad(k * 30, 3) : 'XYZ'[k - 12], LW * k + LW / 2, LH / 2);
    },
    readout: () => {
      const y = psiNow / DEG, p = phiNow / DEG;
      const l2 = prNow < 1 ? `PRINT ${pad(Math.round(prNow * 100), 3)}%` : `PIT ${p.toFixed(1).padStart(4, '0')}°`;
      return `YAW ${y < -0.05 ? '−' : '+'}${Math.abs(y).toFixed(1).padStart(5, '0')}°\n${l2}`;
    },
    frame(t, ex, ek) {
      // ---- view
      const kT = inOutSine(seg(ex, 0, TURN));
      const psi = lerp(yawLive(t), 90 * DEG, kT), phi = lerp(pitchLive(t), 0, kT);
      psiNow = psi; phiNow = phi;
      const fade = 1 - smooth(seg(ex, 0, 0.32));
      const fadeDial = 1 - smooth(seg(ex, 0, 0.15));    // the graduations leave before the turn is fast enough to strobe
      const kc = inOutCubic(seg(ex, 0.16, 0.8));
      const cx = lerp(OX, HX, kc), cy = lerp(OY, HY, kc);
      const sc = Math.exp(inOutSine(seg(ex, 0.3, 0.8)) * Math.log(SPIN_R / R));
      const cps = Math.cos(psi), sps = Math.sin(psi), cph = Math.cos(phi), sph = Math.sin(phi);
      const PW = (x, y, z) => [cx + sc * x, cy + sc * (y * cph + z * sph), -y * sph + z * cph];
      // a world-fixed horizontal circle of radius rr at height yy, drawn out from the front (a = 0) to ±span on a fixed
      // grid of angles plus exact end points (the grid holds ±π/2, so the front/back split is exact)
      const circle = (rr, yy, span, yLow) => {
        const front = new Path2D(), back = new Path2D(), lower = yLow === undefined ? null : new Path2D();
        if (span > 1e-4) {
          const angs = [-span];
          for (let i = 1; i < 96; i++) { const a = -Math.PI + (TAU * i) / 96; if (a > -span + 1e-6 && a < span - 1e-6) angs.push(a); }
          angs.push(span);
          let side = null, pv = null, qv = null;
          for (let k = 0; k < angs.length; k++) {
            const a = angs[k], sa = Math.sin(a), ca = Math.cos(a);
            const p = PW(rr * sa, yy, rr * ca), q = lower ? PW(rr * sa, yLow, rr * ca) : null;
            if (pv) {
              const isFront = Math.cos((a + angs[k - 1]) / 2) >= 0;
              const path = isFront ? front : back;
              if (side !== isFront) { path.moveTo(pv[0], pv[1]); if (isFront && lower) lower.moveTo(qv[0], qv[1]); side = isFront; }
              path.lineTo(p[0], p[1]);
              if (isFront && lower) lower.lineTo(q[0], q[1]);
            }
            pv = p; qv = q;
          }
        }
        return { front, back, lower };
      };

      // ---- print: a copy of the rim lifts off and rises through the sculpture; the wire exists below it
      const printing = t < 1.45;
      const yP = planeY(t);
      const pr = printing ? clamp01((YT - yP) / (YT + R + 14 * S)) : 1;
      prNow = pr;

      // ---- turntable, print ring, axis, gizmo
      let ringFront = null, ringFrontA = 0, posts = null;
      const draw = outExpo(seg(t, 0.05, 0.7)), fk = draw * fade;
      if (fade > 0.003) {
        ctx.lineWidth = 1;
        const rimA = smooth(seg(t, 0.05, 0.16)) * fade;
        const rim = circle(RT, YT, Math.PI * fk, YT + RIM);
        ctx.strokeStyle = col(0.11 * rimA); ctx.stroke(rim.back);
        ctx.strokeStyle = col(0.3 * rimA); ctx.stroke(rim.front);
        ctx.strokeStyle = col(0.2 * rimA); ctx.stroke(rim.lower);
        const sil = 0.2 * fade * smooth(seg(draw, 0.97, 1));
        for (const sgn of [-1, 1]) { const p = PW(sgn * RT, YT, 0), q = PW(sgn * RT, YT + RIM, 0); line(p[0], p[1], q[0], q[1], sil); }
        if (printing && pr > 0) {
          const ra = smooth(seg(pr, 0, 0.08)) * (1 - smooth(seg(pr, 0.85, 1))) * fade;
          const ring = circle(RT, yP, Math.PI);
          ctx.strokeStyle = col(0.1 * ra); ctx.stroke(ring.back);
          ringFront = ring.front; ringFrontA = 0.32 * ra;
        }
        const gk = smooth(seg(t, 0.25, 0.8)) * fadeDial;
        for (let v = 0; v < 360; v += 5) {
          const a = psi - v * DEG, c = Math.cos(a);
          if (c <= 0) continue;
          const vis = smooth(clamp01(c / 0.35)) * gk;
          if (vis <= 0.003) continue;
          const major = v % 30 === 0;
          const p = PW(RT * Math.sin(a), YT, RT * c), q = PW(RT * Math.sin(a), YT + RIM * (major ? 1 : 0.45), RT * c);
          line(p[0], p[1], q[0], q[1], (major ? 0.42 : 0.2) * vis);
          const la = major ? 0.34 * vis * smooth(clamp01((c - 0.5) / 0.3)) : 0;
          if (la > 0.003) {
            const lab = PW(RT * Math.sin(a), YT + RIM + 10 * S, RT * c);
            ctx.globalAlpha = la;
            ctx.drawImage(labels, (v / 30) * LW * DPR, 0, LW * DPR, LH * DPR, lab[0] - LW / 2, lab[1] - LH / 2, LW, LH);
            ctx.globalAlpha = 1;
          }
        }
        {
          const p = PW(0, YT + RIM + 21 * S, RT);
          const ia = 0.55 * smooth(seg(t, 0.5, 0.9)) * fadeDial;
          if (ia > 0.003) { ctx.fillStyle = col(ia); ctx.beginPath(); ctx.moveTo(p[0], p[1] - 4 * S); ctx.lineTo(p[0] + 3.5 * S, p[1] + 2 * S); ctx.lineTo(p[0] - 3.5 * S, p[1] + 2 * S); ctx.fill(); }
        }
        {
          const ak = outCubic(seg(t, 0.35, 0.9)) * fade;
          const hub = PW(0, YT, 0);
          dot(hub[0], hub[1], 1.6, 0.5 * ak);
          const lo = PW(0, lerp(YT, R + 10 * S, ak), 0);
          const t1 = PW(0, -R - 12 * S, 0), t2 = PW(0, -R - 12 * S - 34 * S * ak, 0);
          posts = () => { line(hub[0], hub[1], lo[0], lo[1], 0.16 * ak); line(t1[0], t1[1], t2[0], t2[1], 0.16 * ak); };
          const yr = -R - 34 * S, rr = 11 * S;
          const ind = new Path2D();
          for (let i = 0; i <= 40; i++) {
            const a = psi + (i / 40) * TAU * 0.8 * ak;
            const p = PW(rr * Math.sin(a), yr, rr * Math.cos(a));
            if (i) ind.lineTo(p[0], p[1]); else ind.moveTo(p[0], p[1]);
          }
          ctx.strokeStyle = col(0.18 * ak); ctx.stroke(ind);
          const hd = PW(rr * Math.sin(psi + TAU * 0.8 * ak), yr, rr * Math.cos(psi + TAU * 0.8 * ak));
          dot(hd[0], hd[1], 1.5, 0.5 * ak);
        }
        {
          const gz = outCubic(seg(t, 0.4, 1.0)) * fade;
          if (gz > 0.003) {
            const gx = CX - 262 * S, gy = CY + 150 * S, L = 20 * S * gz;
            const axes = [[12, cps, -sps * sph, -sps * cph], [13, 0, -cph, sph], [14, sps, cps * sph, cps * cph]];
            for (const [cell, ux, uy, d] of axes) {
              // brightness follows the axis depth; a label fades as its axis turns end-on
              const a = lerp(0.22, 0.5, smooth(clamp01(0.5 + d / 0.3))) * gz;
              line(gx, gy, gx + ux * L, gy + uy * L, a);
              const la = a * 0.9 * smooth(clamp01(Math.hypot(ux, uy) / 0.35));
              if (la > 0.003) {
                ctx.globalAlpha = la;
                ctx.drawImage(labels, cell * LW * DPR, 0, LW * DPR, LH * DPR, gx + ux * (L + 8 * S) - LW / 2, gy + uy * (L + 8 * S) - LH / 2, LW, LH);
                ctx.globalAlpha = 1;
              }
            }
            dot(gx, gy, 1.5, 0.5 * gz);
          }
        }
      }

      // ---- project the wire
      for (let i = 0; i < N; i++) {
        const x = X[i], y = Y[i], z = Z[i];
        const x1 = x * cps + z * sps, z1 = -x * sps + z * cps;
        sx[i] = cx + sc * x1;
        sy[i] = cy + sc * (y * cph + z1 * sph);
        sd[i] = clamp01(((-y * sph + z1 * cph) / DMAX + 1) / 2);
      }

      // ---- two bands of light running round the cylinder axis: pure functions of t and ex
      let hFree = W_I * t;
      const bandA = [1, 1].map(() => smooth(seg(t, 2.3, 3.1)));
      if (exiting) {
        const sl = spinnerAngle(t) + spinnerSweep();
        if (!lock) {
          // pick the band and the start of its spin-up so that it arrives exactly on the spinner's leading edge
          spinU = sl; lastSpin = sl;
          for (const j of [0, 1]) {
            const base = sl - W_I * t - j * Math.PI + K_UP * (L_UP / 2 - ex);
            const m0 = Math.round((K_UP * (A0 + A1) / 2 + base) / TAU);
            const a = Math.min(A1, Math.max(A0, ex, (m0 * TAU - base) / K_UP));
            const m = Math.round((base + K_UP * a) / TAU), c = base + K_UP * a - m * TAU;
            if (!lock || Math.abs(c) < Math.abs(lock.c)) lock = { j, m, a, c };
          }
        } else { spinU += wrapPi(sl - lastSpin); lastSpin = sl; }
        hFree += K_UP * upInt(ex, lock.a);
      }
      const heads = [hFree, hFree + Math.PI];
      if (exiting) {
        const hj = heads[lock.j];
        heads[lock.j] = hj + smooth(seg(ex, lock.a + L_UP, LOCK)) * (spinU - hj - lock.m * TAU);
        bandA[1 - lock.j] *= 1 - smooth(seg(ex, 0.12, 0.42));
        bandA[lock.j] = Math.max(bandA[lock.j], smooth(seg(ex, 0, 0.3)));
      }
      const blen = lerp(LEN_I, spinnerSweep(), smooth(seg(ex, 0.5, 0.86)));
      const kSolid = smooth(seg(ex, 0.55, 0.86));
      // the lit pieces of segment i (parameter range f0..f1), clipped at the exact head and tail angles; a band rises
      // over its first 22 % (soft attack)
      const bandSeg = (i, f0, f1, mlt, emit) => {
        const d = wrapPi(B[i + 1] - B[i]);
        for (let j = 0; j < 2; j++) {
          if (bandA[j] <= 0.003) continue;
          const ea = wrapPi(heads[j] - B[i]);
          let s0, s1;
          if (Math.abs(d) < 1e-9) { if (ea < 0 || ea > blen) continue; s0 = 0; s1 = 1; }
          else if (d > 0) { s0 = (ea - blen) / d; s1 = ea / d; }
          else { s0 = ea / d; s1 = (ea - blen) / d; }
          s0 = Math.max(s0, f0); s1 = Math.min(s1, f1);
          if (s1 <= s0) continue;
          const u = (ea - (d * (s0 + s1)) / 2) / blen;
          const prof = Math.min(1, (smooth(clamp01(u / 0.22)) * Math.pow(clamp01(1 - u), 1.6)) / 0.672);
          const lv = Math.round(bandA[j] * lerp(prof, 1, kSolid) * mlt * Q);
          if (lv > 0) emit(lerp(sx[i], sx[i + 1], s0), lerp(sy[i], sy[i + 1], s0), lerp(sx[i], sx[i + 1], s1), lerp(sy[i], sy[i + 1], s1), lv);
        }
      };

      // In the exit the depth fog is held through the turn. As the strands close in, near and far meet at one level;
      // from then on every bin has the same alpha and the wire is drawn as one union (no halo stubs where strands overlap).
      const s = exiting ? Math.max(shade(psi, phi), smooth(seg(ex, 0.04, 0.2))) : shade(psi, phi);
      const meet = smooth(seg(ex, 0.3, 0.42)), union = meet >= 1;
      const level = lerp(MEET, 1, smooth(seg(ex, 0.5, 0.8)));
      const aRing = lerp(A_W, RING_ALPHA, smooth(seg(ex, 0.42, 0.8)));
      const wRing = lerp(WIRE_W, 2, smooth(seg(ex, 0.42, 0.8)));
      const haloW = lerp(HALO_W, wRing + 0.3, smooth(seg(ex, 0.28, 0.42)));   // near-parallel strands merge, not dash
      const binA = (b) => aRing * lerp(lerp(1, BACK, s * (1 - (b + 0.5) / NB)), level, meet);
      const aBand = lerp(A_BAND, 1, smooth(seg(ex, 0.5, 0.86)));
      const bandW = (lv) => wRing + 0.5 * (lv / Q) * (1 - kSolid);
      const mSub = exiting ? 1 - smooth(seg(ex, 0.04, 0.24)) : 1;   // belly, cheek and eye leave: the outline turns alone

      if (ex < SWAP) {
        const ga = 1 - smooth(seg(pr, 0.9, 1));   // the print's glow and nozzles leave as the ring passes the top
        const fg = new Array(NB * G).fill(null), halo = new Array(NB * G).fill(null);
        const band = new Array(NB * Q).fill(null), glow = new Array(NGL + 1).fill(null);
        const gf = [1];
        for (let l = 1; l < NL; l++) gf.push(l / NL);
        gf.push(mSub);
        const tips = [];
        const path = (arr, k) => arr[k] || (arr[k] = new Path2D());
        // one run of segments in one bin and group: the wire whole; its halo trimmed by TRIM px at each open end, so a
        // bin boundary never erases the end of the neighbouring run of the same strand
        const emit = (run, key, closed) => {
          const p = path(fg, key);
          p.moveTo(run[0][0], run[0][1]);
          for (const r of run) p.lineTo(r[2], r[3]);
          if (closed) {
            p.closePath();
            const h = path(halo, key);
            h.moveTo(run[0][0], run[0][1]);
            for (const r of run) h.lineTo(r[2], r[3]);
            h.closePath();
            return;
          }
          let len = 0;
          for (const r of run) len += Math.hypot(r[2] - r[0], r[3] - r[1]);
          const end = len - TRIM;
          if (end <= TRIM) return;
          const h = path(halo, key);
          let acc = 0, open = false;
          for (const r of run) {
            const l = Math.hypot(r[2] - r[0], r[3] - r[1]), a0 = acc;
            acc += l;
            if (acc <= TRIM || l <= 0) continue;
            if (a0 >= end) break;
            const u0 = Math.max(0, (TRIM - a0) / l), u1 = Math.min(1, (end - a0) / l);
            if (!open) { h.moveTo(lerp(r[0], r[2], u0), lerp(r[1], r[3], u0)); open = true; }
            h.lineTo(lerp(r[0], r[2], u1), lerp(r[1], r[3], u1));
          }
        };
        for (let k = 0; k < subs.length; k++) {
          const { s: s0, e: e0, closed } = subs[k];
          if (k > 0 && mSub <= 0.003) continue;
          let run = [], key = -1, from0 = false, toEnd = false, held = null, flushed = 0;
          const flush = () => {
            if (run.length) {
              // a closed loop's first run waits: it may continue the last run across the loop's seam
              if (flushed === 0 && from0 && closed) held = { run, key };
              else emit(run, key, false);
              flushed++;
            }
            run = []; key = -1;
          };
          for (let i = s0; i < e0 - 1; i++) {
            let f0 = 0, f1 = 1, g = 0;
            if (printing) {
              const ina = Y[i] >= yP, inb = Y[i + 1] >= yP;
              if (!ina && !inb) { flush(); continue; }
              if (ina !== inb) {
                const f = (yP - Y[i]) / (Y[i + 1] - Y[i]);
                if (ina) f1 = f; else { f0 = f; flush(); }
                tips.push([lerp(sx[i], sx[i + 1], f), lerp(sy[i], sy[i + 1], f), tipFade(i, yP)]);
              }
            }
            const x1 = lerp(sx[i], sx[i + 1], f0), y1 = lerp(sy[i], sy[i + 1], f0);
            const x2 = lerp(sx[i], sx[i + 1], f1), y2 = lerp(sy[i], sy[i + 1], f1);
            if (printing) {
              // fresh wire condenses in over HF below the plane and glows until it has cooled 46S below it
              const h = (lerp(Y[i], Y[i + 1], f0) + lerp(Y[i], Y[i + 1], f1)) / 2 - yP;
              const fw = smooth(clamp01(h / HF));
              const lg = Math.round(fw * (1 - smooth(seg(h, 20 * S, 46 * S))) * NGL);
              if (lg > 0) { const p = path(glow, lg); p.moveTo(x1, y1); p.lineTo(x2, y2); }
              // the plane stops 14S above the wire: the front settles in with the glow, so the wire is solid when the print ends
              const l = Math.round((1 - (1 - fw) * ga) * NL);
              if (l === 0) { flush(); continue; }
              if (l < NL) g = l;
            } else if (k > 0 && mSub < 1) g = NL;
            const b = union ? 0 : Math.min(NB - 1, Math.floor(((sd[i] + sd[i + 1]) / 2) * NB));
            const kk = b * G + g;
            if (kk !== key) { flush(); key = kk; from0 = i === s0 && f0 === 0; }
            run.push([x1, y1, x2, y2]);
            toEnd = i === e0 - 2 && f1 === 1;
            bandSeg(i, f0, f1, gf[g], (ax, ay, bx, by, lv) => {
              const p = path(band, b * Q + lv - 1);
              p.moveTo(ax, ay); p.lineTo(bx, by);
            });
          }
          if (run.length && toEnd && closed && held && held.key === key) emit(run.concat(held.run), key, false);
          else if (run.length && toEnd && closed && flushed === 0 && from0) emit(run, key, true);
          else { if (run.length) emit(run, key, false); if (held) emit(held.run, held.key, false); }
        }
        ctx.lineJoin = 'bevel';
        for (let b = 0; b < NB; b++) {
          if (b === NB / 2 && posts) { posts(); ctx.lineJoin = 'bevel'; }
          ctx.strokeStyle = BG; ctx.lineWidth = haloW;
          for (let g = 0; g < G; g++) { const p = halo[b * G + g]; if (p) { ctx.globalAlpha = gf[g]; ctx.stroke(p); } }
          ctx.globalAlpha = 1;
          ctx.lineWidth = wRing;
          for (let g = 0; g < G; g++) { const p = fg[b * G + g]; if (p) { ctx.strokeStyle = col(binA(b) * gf[g]); ctx.stroke(p); } }
          for (let l = 1; l <= Q; l++) {
            const p = band[b * Q + l - 1];
            if (!p) continue;
            ctx.strokeStyle = col((l / Q) * aBand); ctx.lineWidth = bandW(l); ctx.stroke(p);
          }
        }
        ctx.lineJoin = 'miter';
        if (printing) {
          ctx.lineWidth = 1.6;
          for (let l = 1; l <= NGL; l++) if (glow[l]) { ctx.strokeStyle = col(0.35 * ga * (l / NGL)); ctx.stroke(glow[l]); }
        }
        if (ringFront) { ctx.lineWidth = 1; ctx.strokeStyle = col(ringFrontA); ctx.stroke(ringFront); }
        if (printing) for (const [x, y, f] of tips) dot(x, y, 1.2 * lerp(0.5, 1, f), 0.55 * ga * f);
      } else {
        if (posts) posts();
        // the wire lies exactly on one circle now: one ring stroke draws the same picture
        arc(cx, cy, R * sc, 0, TAU, aRing * level, wRing);
        const levels = new Array(Q).fill(null);
        for (let k = 0; k < subs.length; k++) {
          if (k > 0 && mSub <= 0.003) continue;
          const { s: s0, e: e0 } = subs[k];
          for (let i = s0; i < e0 - 1; i++) {
            bandSeg(i, 0, 1, k > 0 ? mSub : 1, (ax, ay, bx, by, lv) => {
              if (!levels[lv - 1]) levels[lv - 1] = new Path2D();
              levels[lv - 1].moveTo(ax, ay); levels[lv - 1].lineTo(bx, by);
            });
          }
        }
        ctx.lineJoin = 'bevel';
        levels.forEach((p, l) => { if (p) { ctx.strokeStyle = col(((l + 1) / Q) * aBand); ctx.lineWidth = bandW(l + 1); ctx.stroke(p); } });
        ctx.lineJoin = 'miter';
      }
    },
  };
})();
