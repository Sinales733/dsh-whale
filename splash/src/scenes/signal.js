// ===== scene: SIGNAL — X-Y oscilloscope, 3D Lissajous with phosphor persistence ===============
// The trace periodically "locks" into the whale outline and lets go again; on exit the beam
// winds itself into the spinner ring.
SCENES.signal = (() => {
  const N = 960;
  const RATIOS = [[3, 2, 5], [5, 4, 3], [3, 4, 7], [1, 2, 5], [5, 6, 2], [2, 3, 4]];
  let DIV = 0, GW = 0, GH = 0, AX = 0, AY = 0;
  let target = null; // whale contour
  const history = []; // recent trace snapshots, newest first
  const beam = [];
  let ratioTxt = '3:2:5', phaseDeg = 0;
  const pts = Array.from({ length: N }, () => [0, 0, 0, 0]); // x, y, depth, lock

  function liss(rs, s, t, cy, sy, out) {
    const x = Math.sin(rs[0] * s + t * 0.35);
    const y = Math.sin(rs[1] * s);
    const z = Math.cos(rs[2] * s + t * 0.2);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const f = 3 / (3 - z1 * 0.6);
    out[0] = CX + x1 * AX * f;
    out[1] = CY + y * AY * f;
    out[2] = z1;
  }

  // whale lock envelope: 0 = free signal, 1 = locked to the outline
  // The first lock starts as soon as the pen finishes the first trace, so the whale is readable
  // by ~2.8 s; once the splash starts leaving, the lock is held (never released mid-collapse).
  let exitLock = null; // lock value and time when the exit began
  function lockAt(t) {
    const raw = lockAtRaw(t);
    if (!exiting) return raw;
    if (!exitLock) exitLock = { v: raw, t };
    if (exitLock.v < 0.15) return raw;                       // whale not up: leave as a free signal
    return Math.max(raw, lerp(exitLock.v, 1, smooth(seg(t, exitLock.t, exitLock.t + 0.35))));
  }
  function lockAtRaw(t) {
    const u = t - 1.7;
    if (u < 0) return 0;
    const v = u % 7.5;
    return smooth(seg(v, 0, 1.05)) - smooth(seg(v, 4.2, 5.4));
  }

  return {
    label: 'SIGNAL',
    readyAt: 3.9,
    titleAt: 2.0,
    layout() {
      DIV = 48 * S; GW = DIV * 10; GH = DIV * 8;
      AX = GW * 0.36; AY = GH * 0.4;
      target = whaleContour(makeWhale(CX, CY, 232 * S), N);
      history.length = 0;
    },
    readout: () => `F ${ratioTxt}\nφ ${phaseDeg.toFixed(1).padStart(5, '0')}°`,
    frame(t, ex, ek) {
      const fade = 1 - seg(ex, 0, 0.6);
      const cx = lerp(CX, HX, ek), cy = lerp(CY, HY, ek);
      const gs = lerp(1, 0.04, ek);
      const gw = GW * gs, gh = GH * gs, gx = cx - gw / 2, gy = cy - gh / 2, dv = DIV * gs;

      // ---- graticule
      {
        const fk = outExpo(seg(t, 0.05, 0.85));
        const a = 0.34 * fade;
        // frame sides grow from the four corners
        line(gx, gy, gx + gw * fk, gy, a);
        line(gx + gw, gy, gx + gw, gy + gh * fk, a);
        line(gx + gw, gy + gh, gx + gw - gw * fk, gy + gh, a);
        line(gx, gy + gh, gx, gy + gh - gh * fk, a);
        ctx.setLineDash([1, 3]);
        for (let j = 1; j < 10; j++) {
          if (j === 5) continue;
          const k = outCubic(seg(t, 0.3 + Math.abs(j - 5) * 0.05, 0.75 + Math.abs(j - 5) * 0.05));
          line(gx + j * dv, cy - (gh / 2) * k, gx + j * dv, cy + (gh / 2) * k, 0.16 * fade);
        }
        for (let j = 1; j < 8; j++) {
          if (j === 4) continue;
          const k = outCubic(seg(t, 0.35 + Math.abs(j - 4) * 0.05, 0.8 + Math.abs(j - 4) * 0.05));
          line(cx - (gw / 2) * k, gy + j * dv, cx + (gw / 2) * k, gy + j * dv, 0.16 * fade);
        }
        ctx.setLineDash([]);
        const ak = outExpo(seg(t, 0.2, 0.9));
        line(cx - (gw / 2) * ak, cy, cx + (gw / 2) * ak, cy, 0.26 * fade);
        line(cx, cy - (gh / 2) * ak, cx, cy + (gh / 2) * ak, 0.26 * fade);
        const tk = seg(t, 0.6, 1.2) * fade;
        for (let i = 1; i < 50; i++) {
          const x = gx + (i * gw) / 50;
          if (Math.abs(x - cx) > (gw / 2) * tk) continue;
          const len = (i % 5 === 0 ? 5 : 2.5) * S * gs;
          line(x, cy - len, x, cy + len, 0.3 * fade);
        }
        for (let i = 1; i < 40; i++) {
          const y = gy + (i * gh) / 40;
          if (Math.abs(y - cy) > (gh / 2) * tk) continue;
          const len = (i % 5 === 0 ? 5 : 2.5) * S * gs;
          line(cx - len, y, cx + len, y, 0.3 * fade);
        }
        // instrument annotations
        const lk = seg(t, 1.1, 1.6) * fade;
        text('CH1  X  200mV', gx + 8, gy + gh - 12, 0.4 * lk);
        text('CH2  Y  200mV', gx + 118, gy + gh - 12, 0.4 * lk);
        text('X—Y   1.00ms', gx + gw - 8, gy + gh - 12, 0.4 * lk, 9.5, 'right');
        text('TRIG ▲', gx + gw - 8, gy + 12, 0.4 * lk, 9.5, 'right');
        // trigger marker on the left edge
        if (lk > 0) {
          const ty = cy - AY * 0.3 * gs;
          ctx.fillStyle = col(0.55 * lk);
          ctx.beginPath();
          ctx.moveTo(gx - 1, ty - 4);
          ctx.lineTo(gx + 6, ty);
          ctx.lineTo(gx - 1, ty + 4);
          ctx.fill();
        }
      }

      // ---- channel strips (CH1 above, CH2 to the right)
      const ci = Math.floor(Math.max(0, t - 0.4) / 4.6);
      const local = Math.max(0, t - 0.4) - ci * 4.6;
      const mr = smooth(seg(local, 3.4, 4.6));
      const RA = RATIOS[ci % RATIOS.length], RB = RATIOS[(ci + 1) % RATIOS.length];
      ratioTxt = (mr < 0.5 ? RA : RB).join(':');
      phaseDeg = ((t * 0.35 * 180) / Math.PI) % 360;
      {
        const k = seg(t, 1.0, 1.7) * fade;
        if (k > 0) {
          const y0 = gy - 26 * S, x0 = gx + gw + 26 * S;
          ctx.strokeStyle = col(0.45 * k);
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i <= 160; i++) {
            const s = (i / 160) * TAU * 1.5 + t * 1.2;
            const v = Math.sin(lerp(RA[0], RB[0], mr) * s + t * 0.35);
            const x = gx + (i / 160) * gw * k;
            if (i) ctx.lineTo(x, y0 + v * 8 * S); else ctx.moveTo(x, y0 + v * 8 * S);
          }
          ctx.stroke();
          ctx.beginPath();
          for (let i = 0; i <= 140; i++) {
            const s = (i / 140) * TAU * 1.5 + t * 1.2;
            const v = Math.sin(lerp(RA[1], RB[1], mr) * s);
            const y = gy + (i / 140) * gh * k;
            if (i) ctx.lineTo(x0 + v * 8 * S, y); else ctx.moveTo(x0 + v * 8 * S, y);
          }
          ctx.stroke();
          text('CH1', gx - 10, y0, 0.4 * k, 9.5, 'right');
          text('CH2', x0, gy - 12, 0.4 * k, 9.5, 'center');
        }
      }

      // ---- compute the trace
      const lock = lockAt(t);
      const yaw = t * 0.45;
      const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
      const a1 = [0, 0, 0], b1 = [0, 0, 0];
      for (let i = 0; i < N; i++) {
        const s = (i / N) * TAU;
        liss(RA, s, t, cyaw, syaw, a1);
        let x = a1[0], y = a1[1], z = a1[2];
        if (mr > 0) {
          liss(RB, s, t, cyaw, syaw, b1);
          x = lerp(x, b1[0], mr); y = lerp(y, b1[1], mr); z = lerp(z, b1[2], mr);
        }
        const li = inOutCubic(clamp01(lock * 1.5 - (i / N) * 0.5));
        if (li > 0) {
          const jitter = Math.sin(i * 12.9898 + t * 47) * 0.7 * S * li;
          x = lerp(x, target.pts[i][0], li) + jitter;
          y = lerp(y, target.pts[i][1], li) - jitter;
          z = lerp(z, 0.6, li);
        }
        if (ek > 0) {
          const ang = (i / N) * TAU - Math.PI / 2;
          x = lerp(x, HX + Math.cos(ang) * SPIN_R, ek);
          y = lerp(y, HY + Math.sin(ang) * SPIN_R, ek);
        }
        const p = pts[i];
        p[0] = x; p[1] = y; p[2] = z; p[3] = li;
      }

      // ---- phosphor persistence from explicit history (no canvas feedback → no residue)
      const draw = Math.floor(N * seg(t, 0.55, 1.75));
      const isJump = (i, q) => (i === 0 ? draw >= N && lock > 0.05 : target.breaks.has(i) && q[3] > 0.05);
      if (draw > 1) {
        const snap = new Float32Array(draw * 2);
        for (let i = 0; i < draw; i++) { snap[i * 2] = pts[i][0]; snap[i * 2 + 1] = pts[i][1]; }
        if (frameNo % 2 === 0) { history.unshift(snap); if (history.length > 7) history.pop(); }
        const life = lerp(1, 0.6, ex);
        ctx.lineJoin = 'round';
        history.forEach((h, g) => {
          if (g === 0) return;
          const n = h.length / 2;
          const path = new Path2D();
          for (let i = 1; i < n; i++) {
            if (isJump(i, pts[i])) continue;
            path.moveTo(h[i * 2 - 2], h[i * 2 - 1]);
            path.lineTo(h[i * 2], h[i * 2 + 1]);
          }
          ctx.lineWidth = 1;
          ctx.strokeStyle = col(0.2 * Math.pow(0.68, g) * life * (1 - seg(ex, 0.75, 1)));
          ctx.stroke(path);
        });
        const buckets = [new Path2D(), new Path2D(), new Path2D()];
        const jumps = new Path2D();
        const segment = (i, p, q) => {
          const z = (p[2] + q[2]) / 2;
          const path = isJump(i, q) ? jumps : buckets[z < -0.35 ? 0 : z < 0.35 ? 1 : 2];
          path.moveTo(p[0], p[1]);
          path.lineTo(q[0], q[1]);
        };
        for (let i = 1; i < draw; i++) segment(i, pts[i - 1], pts[i]);
        if (draw >= N) segment(0, pts[N - 1], pts[0]);
        const base = lerp(1, 0.45, ek) * (1 - seg(ex, 0.8, 1));
        ctx.lineWidth = 1.15;
        [0.22, 0.5, 0.9].forEach((a, b) => { ctx.strokeStyle = col(a * base); ctx.stroke(buckets[b]); });
        ctx.strokeStyle = col(0.5 * base * (1 - lock));
        ctx.stroke(jumps);
        ctx.lineJoin = 'miter';
        // beam spot with a short streak
        const bi = draw < N ? draw - 1 : Math.floor((t * 240) % N);
        beam.unshift([pts[bi][0], pts[bi][1]]);
        if (beam.length > 16) beam.pop();
        for (let j = 1; j < beam.length; j++) {
          const p = beam[j - 1], q = beam[j];
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 60 * S) continue;
          line(p[0], p[1], q[0], q[1], (1 - j / beam.length) * 0.8 * fade, 2);
        }
        dot(beam[0][0], beam[0][1], 2.3, fade);
        arc(beam[0][0], beam[0][1], 7, 0, TAU, 0.35 * fade);
      }
      // crisp spinner track takes over from the phosphor at the very end
      arc(HX, HY, SPIN_R, 0, TAU, RING_ALPHA * seg(ex, 0.7, 1), 2);
    },
  };
})();
