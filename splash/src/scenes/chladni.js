// ===== scene: CHLADNI — sand on a vibrating plate settles into the whale =======================
// A string of sand is drawn, hums, and opens into the plate, stretching its sand across it. Driven at one resonance
// and then another, the grains jump to the nodal lines; at the last frequency the nodal line is the whale. While
// waiting, the outline breathes and a ripple crosses the plate now and then. On exit the whale is reeled in like a
// thread: each loop of the outline runs off through its point nearest the spinner, down a taut feeder, and is wound
// onto the ring, which lights up and gathers into the progress arc.
SCENES.chladni = (() => {
  const NP = 3200, NW = 2000;
  const WIND = 44;         // px of ring a grain travels while it is taken up
  let Rp = 0, whale = null, hz = 180, modeTxt = '—';
  let P0, P1, P2, P3, NX, NY, KI, H1, H2, H3, ON, GD, GJ, GDIR;
  let pts = null, SUB = [], DMAX = 1;
  const fn = (x, y, n, m, s) => Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) + s * Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);
  // slide a point down |f| onto the nearest nodal line (damped Newton steps)
  function settle(x, y, n, m, s) {
    const e = 1e-3;
    for (let i = 0; i < 40; i++) {
      const v = fn(x, y, n, m, s);
      const gx = (fn(x + e, y, n, m, s) - fn(x - e, y, n, m, s)) / (2 * e);
      const gy = (fn(x, y + e, n, m, s) - fn(x, y - e, n, m, s)) / (2 * e);
      const g2 = gx * gx + gy * gy + 1e-4;
      let dx = (-0.6 * v * gx) / g2, dy = (-0.6 * v * gy) / g2;
      const d = Math.hypot(dx, dy);
      if (d > 0.04) { dx *= 0.04 / d; dy *= 0.04 / d; }
      x = Math.min(0.995, Math.max(0.005, x + dx));
      y = Math.min(0.995, Math.max(0.005, y + dy));
    }
    return [x, y];
  }
  const outBack = (k) => 1 + 2.3 * Math.pow(k - 1, 3) + 1.3 * Math.pow(k - 1, 2);   // lands with a small overshoot
  // the string's hum: it swells while the string waits, and dies out as the plate opens
  const humA = (t) => 11 * S * smooth(seg(t, 0.16, 0.5)) * (1 - smooth(seg(t, 0.5, 0.7)));
  const hum = (x, t) => humA(t) * Math.sin((TAU * (x - (CX - Rp))) / (2 * Rp)) * Math.sin(t * 34);

  return {
    label: 'CHLADNI',
    readyAt: 3.6,
    titleAt: 2.05,
    exitDur: 1.25,
    spinnerIn: 0.88,   // the wound ring gathers into the spinner's arc
    layout() {
      Rp = 214 * S;
      whale = makeWhale(CX, CY, 232 * S);
      const cont = whaleContour(whale, NW);
      pts = cont.pts;
      const inside = whaleMask(whale, 5 * S);
      const F32 = (n) => new Float32Array(n);
      P0 = F32(NP * 2); P1 = F32(NP * 2); P2 = F32(NP * 2); P3 = F32(NP * 2);
      NX = F32(NP); NY = F32(NP); KI = F32(NP); H1 = F32(NP); H2 = F32(NP); H3 = F32(NP); GD = F32(NP);
      ON = new Uint8Array(NP); GJ = new Uint8Array(NP); GDIR = new Int8Array(NP);
      const X = (u) => CX + (u - 0.5) * 2 * Rp, Y = (v) => CY + (v - 0.5) * 2 * Rp;

      // exit: the outline's loops, each cut at its point nearest the spinner, with a feeder tangent to the ring
      // (arriving clockwise, the way the spinner turns)
      const starts = [0, ...[...cont.breaks].sort((a, b) => a - b), NW];
      SUB = [];
      for (let j = 0; j + 1 < starts.length; j++) {
        const s = starts[j], n = starts[j + 1] - s;
        const closed = Math.hypot(pts[s][0] - pts[s + n - 1][0], pts[s][1] - pts[s + n - 1][1]) < 3 * S;
        const M = closed ? n - 1 : n;
        let per = 0, m = 0, best = 1e9;
        for (let i = 0; i < M; i++) {
          const a = pts[s + i], b = pts[s + ((i + 1) % M)];
          per += Math.hypot(b[0] - a[0], b[1] - a[1]);
          const d = Math.hypot(a[0] - HX, a[1] - HY);
          if (d < best) { best = d; m = i; }
        }
        const E = pts[s + m], d = Math.max(SPIN_R + 1, best);
        const beta = Math.atan2(E[1] - HY, E[0] - HX) + Math.acos(SPIN_R / d);
        SUB.push({ s, M, m, ds: per / M, ex: E[0], ey: E[1], beta, f: Math.sqrt(d * d - SPIN_R * SPIN_R), tx: HX + Math.cos(beta) * SPIN_R, ty: HY + Math.sin(beta) * SPIN_R });
      }
      const subOf = (k) => { let j = 0; while (j + 1 < SUB.length && k >= SUB[j + 1].s) j++; return j; };
      DMAX = 1;

      for (let i = 0; i < NP; i++) {
        H1[i] = hash(i * 3 + 1); H2[i] = hash(i * 3 + 2); H3[i] = hash(i * 3 + 3);
        const u = hash(i + 0.37), v = hash(i * 1.7 + 9.1);
        const a = settle(u, v, 3, 5, -1), b = settle(hash(i * 2.3 + 0.7), hash(i * 3.1 + 5.2), 2, 7, -1);
        P0[i * 2] = X(u); P0[i * 2 + 1] = Y(v);
        P1[i * 2] = X(a[0]); P1[i * 2 + 1] = Y(a[1]);
        P2[i * 2] = X(b[0]); P2[i * 2 + 1] = Y(b[1]);
        // the first NW grains, and any other that would be left lying inside the glyph, go to its outline
        if (i < NW || inside(P2[i * 2], P2[i * 2 + 1]) > 0.02) {
          const k = (i * 733) % NW;
          let k0 = Math.max(0, k - 2), k1 = Math.min(NW - 1, k + 2);
          for (let j = k0 + 1; j <= k1; j++) if (cont.breaks.has(j)) { if (j <= k) k0 = j; else { k1 = j - 1; break; } }
          const tx = pts[k1][0] - pts[k0][0], ty = pts[k1][1] - pts[k0][1], tl = Math.hypot(tx, ty) || 1;
          NX[i] = -ty / tl; NY[i] = tx / tl; KI[i] = k; ON[i] = 1;
          P3[i * 2] = pts[k][0] + (H1[i] - 0.5) * 2.6 * S; P3[i * 2 + 1] = pts[k][1] + (H2[i] - 0.5) * 2.6 * S;
          // its way out: the shorter way round its loop to the cut
          const j = subOf(k), sb = SUB[j], o = (((k - sb.s - sb.m) % sb.M) + sb.M) % sb.M;
          GJ[i] = j;
          if (o <= sb.M / 2) { GDIR[i] = -1; GD[i] = o * sb.ds; } else { GDIR[i] = 1; GD[i] = (sb.M - o) * sb.ds; }
          DMAX = Math.max(DMAX, GD[i] + sb.f);
        } else { P3[i * 2] = P2[i * 2]; P3[i * 2 + 1] = P2[i * 2 + 1]; }
      }
    },
    readout: () => `ƒ ${pad(Math.round(hz), 4)} HZ\nMODE ${modeTxt}`,
    frame(t, ex, ek) {
      const sA = seg(t, 0.75, 1.35), sB = seg(t, 1.35, 1.95), sC = seg(t, 2.0, 2.8);
      const A = inOutCubic(sA), B = inOutCubic(sB), C = inOutCubic(sC);
      hz = lerp(lerp(lerp(180, 742, A), 1586, B), 2954, C) + 3 * Math.sin(t * 2.3);
      modeTxt = C > 0.5 ? 'CETACEA' : B > 0.5 ? '2·7' : A > 0.5 ? '3·5' : '—';
      // how hard the plate is being driven: a burst at each change of frequency
      const drive = Math.sin(Math.PI * sA) + Math.sin(Math.PI * sB) + Math.sin(Math.PI * sC);
      // while waiting, a ripple crosses the plate from the centre every few seconds
      const PER = 3.4, tau = t > 3.2 && !exiting ? (t - 3.2) % PER : -1;
      const rEnv = tau < 0 ? 0 : smooth(seg(tau, 0, 0.18)) * (1 - smooth(seg(tau, 0.85, 1.3)));
      const front = tau * 360 * S, rw = 1 / (32 * S);
      const Lx = CX - Rp, Rx = CX + Rp, Ty = CY - Rp, By = CY + Rp;

      // opening: the string's half-length, and how far it has opened into the plate
      const half = Rp * inOutCubic(seg(t, 0.05, 0.42)), span = Rp * outBack(seg(t, 0.5, 0.98));
      // exit: every edge draws back to its midpoint, and takes its ticks with it
      const re = 1 - inOutCubic(seg(ex, 0, 0.32)), h = Rp * re, m = 10 * S;

      // ---- plate
      ctx.lineWidth = 1;
      if (t < 1.2 && !exiting) {
        ctx.strokeStyle = col(lerp(0.55, 0.3, smooth(seg(t, 0.5, 0.9))));
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (const sgn of span > 0.5 ? [-1, 1] : [1]) {
          for (let i = 0; i <= 72; i++) {
            const x = CX - half + (2 * half * i) / 72, y = CY + sgn * span + hum(x, t);
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
        }
        if (span > 0.5) { ctx.moveTo(Lx, CY - span); ctx.lineTo(Lx, CY + span); ctx.moveTo(Rx, CY - span); ctx.lineTo(Rx, CY + span); }
        ctx.stroke();
        ctx.lineJoin = 'miter';
        // the two pen tips that draw the string
        const pa = 0.9 * smooth(seg(t, 0.05, 0.1)) * (1 - smooth(seg(t, 0.36, 0.48)));
        dot(CX - half, CY, 2, pa); dot(CX + half, CY, 2, pa);
      } else if (re > 0.003) {
        line(CX - h, Ty, CX + h, Ty, 0.3); line(CX - h, By, CX + h, By, 0.3);
        line(Lx, CY - h, Lx, CY + h, 0.3); line(Rx, CY - h, Rx, CY + h, 0.3);
      }

      // ---- ticks, driver, frequency scale, drive signal
      {
        const tk = seg(t, 0.9, 1.25), yBot = CY + span;
        for (let i = 0; i <= 20; i++) {
          const d = (-1 + i / 10) * Rp, L = (i % 5 === 0 ? 7 : 3) * S * tk;
          line(CX + d, yBot, CX + d, yBot + L * smooth(clamp01((h + m * re - Math.abs(d)) / m)), 0.26);
          line(Lx, CY + d, Lx - L * smooth(clamp01((Math.min(span, h) + m * re - Math.abs(d)) / m)), CY + d, 0.26);
        }
        const dk = smooth(seg(t, 0.6, 1.0)) * (1 - 0.75 * C) * re;
        arc(CX, CY, 4 * S * re, 0, TAU, 0.4 * dk);
        arc(CX, CY, (11 + 2.5 * Math.sin(t * 9)) * S * re, 0, TAU, 0.16 * dk * (0.4 + 0.6 * Math.min(1, drive)));
        if (rEnv > 0) arc(CX, CY, Math.max(1, front), 0, TAU, 0.1 * rEnv);

        // the scale opens with the plate; its marker climbs with the frequency
        const sx = Rx + 34 * S, sh = span * re, sk = smooth(seg(t, 0.55, 0.85)) * re;
        if (sh > 0.5) {
          line(sx, CY - sh, sx, CY + sh, 0.24);
          for (let i = 0; i <= 12; i++) line(sx, CY - sh + (2 * sh * i) / 12, sx + (i % 3 === 0 ? 7 : 3) * S * sk, CY - sh + (2 * sh * i) / 12, 0.26);
          const my = CY + sh - 2 * sh * (hz / 3200);
          line(sx - 9 * S * sk, my, sx + 12 * S * sk, my, 0.8 * sk, 1.2);
          text(`${Math.round(hz / 2) * 2} Hz`, sx + 18 * S, my, 0.5 * sk * (1 - seg(ex, 0, 0.2)), 9.5);
        }

        // the drive signal: it leaves the bottom edge once the plate is open; its pitch rises with the frequency
        const dn = smooth(seg(t, 0.9, 1.3)), sa = 0.42 * dn;
        if (sa > 0.003 && re > 0.003) {
          const y0 = By + 30 * S * dn, amp = (2.5 + 5 * Math.min(1, drive) + 3 * rEnv) * S * re * dn, kx = (TAU * hz) / 200 / (2 * Rp);
          ctx.strokeStyle = col(sa);
          ctx.lineJoin = 'round';
          ctx.beginPath();
          for (let i = 0; i <= 220; i++) {
            const u = i / 220, x = CX - h + 2 * h * u;
            const y = y0 + amp * Math.sin(4 * u * (1 - u)) * Math.sin((x - CX) * kx - t * 14);
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke();
          ctx.lineJoin = 'miter';
        }
      }

      // ---- grains
      const shake = 2.4 * S * drive;
      // exit: how far the thread has been pulled; just before, it draws taut (the sandy line turns crisp)
      const adv = (DMAX + WIND + 6) * inOutCubic(seg(ex, 0.03, 0.74));
      const jit = lerp(1, 0.3, smooth(seg(ex, 0, 0.1))), keep = 1 - smooth(seg(ex, 0, 0.1));
      const lit = new Path2D(), dim = new Path2D();
      for (let i = 0; i < NP; i++) {
        const on = ON[i];
        let sz = 1 + 0.7 * H2[i];
        const d = 0.15 * H1[i];
        const a = inOutCubic(seg(t, 0.75 + d, 1.2 + d)), b = inOutCubic(seg(t, 1.35 + d, 1.8 + d)), c = inOutCubic(seg(t, 2.0 + d * 1.5, 2.55 + d * 1.5));
        let x = P0[i * 2], y = P0[i * 2 + 1];
        if (a < 1) {
          // the sand lies along the string, and is stretched over the plate as it opens
          const g = smooth(clamp01((half - Math.abs(x - CX)) / (12 * S)));
          if (g <= 0) continue;
          sz *= g;
          y = CY + (y - CY) * outBack(seg(t, 0.5 + 0.08 * H1[i], 0.98 + 0.08 * H1[i])) + hum(x, t);
        }
        x = lerp(lerp(lerp(x, P1[i * 2], a), P2[i * 2], b), P3[i * 2], c);
        y = lerp(lerp(lerp(y, P1[i * 2 + 1], a), P2[i * 2 + 1], b), P3[i * 2 + 1], c);
        let sh = shake;
        if (rEnv > 0) { const q = (Math.hypot(x - CX, y - CY) - front) * rw; sh += 1.7 * S * rEnv * Math.exp(-q * q); }
        x += sh * Math.sin(t * 21 + H2[i] * 40);
        y += sh * Math.cos(t * 19 + H3[i] * 40);
        if (on) { const bn = 1.1 * S * c * Math.sin(t * 1.3 - KI[i] * 0.011); x += NX[i] * bn; y += NY[i] * bn; }

        if (exiting && !on) {
          // the sand that is not the whale is shaken away
          sz *= 1 - smooth(seg(ex, 0.02 + 0.2 * H3[i], 0.26 + 0.2 * H3[i]));
          if (sz <= 0.02) continue;
        } else if (exiting) {
          const sb = SUB[GJ[i]], jx = (H1[i] - 0.5) * 2.6 * S, jy = (H2[i] - 0.5) * 2.6 * S;
          if (adv < GD[i]) {
            // still on its loop: it runs along the outline towards the cut
            const f = ((((KI[i] - sb.s + (GDIR[i] * adv) / sb.ds) % sb.M) + sb.M) % sb.M), i0 = Math.floor(f), fr = f - i0;
            const p = pts[sb.s + i0], q = pts[sb.s + ((i0 + 1) % sb.M)];
            const rx = (x - P3[i * 2]) * keep, ry = (y - P3[i * 2 + 1]) * keep;   // what is left of its breathing
            x = lerp(p[0], q[0], fr) + jx * jit + rx; y = lerp(p[1], q[1], fr) + jy * jit + ry;
          } else if (adv < GD[i] + sb.f) {
            const u = (adv - GD[i]) / sb.f, j2 = jit * (1 - 0.8 * u);
            x = lerp(sb.ex, sb.tx, u) + jx * j2; y = lerp(sb.ey, sb.ty, u) + jy * j2;
          } else {
            const wd = adv - GD[i] - sb.f;
            if (wd >= WIND) continue;
            const ang = sb.beta + wd / SPIN_R;
            x = HX + Math.cos(ang) * SPIN_R; y = HY + Math.sin(ang) * SPIN_R; sz *= 1 - wd / WIND;
          }
        }
        (on ? lit : dim).rect(x - sz / 2, y - sz / 2, sz, sz);
      }
      ctx.fillStyle = col(lerp(0.6, 0.2, C));
      ctx.fill(dim);
      ctx.fillStyle = col(lerp(0.6, 0.95, C));
      ctx.fill(lit);

      // the spool: the track comes up as the thread winds on, and the lit ring gathers into the progress arc
      if (exiting) {
        arc(HX, HY, SPIN_R, 0, TAU, RING_ALPHA * smooth(seg(ex, 0.22, 0.7)), 2);
        // (it is lit under the last of the thread, so the ring never goes dark between the two)
        const up = smooth(seg(ex, 0.48, 0.72));
        if (up > 0) arc(HX, HY, SPIN_R, spinnerAngle(t), lerp(TAU, spinnerSweep(), inOutCubic(seg(ex, 0.66, 0.88))), up, 2);
      }
    },
  };
})();
