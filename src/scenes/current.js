// ===== scene: CURRENT — a flow field streaming around the whale ==================================
// The whale is the obstacle the current bends around, read as the negative space between streamlines and echoed by
// pulsing isobars. On exit the stream winds into a vortex that settles onto the spinner track.
SCENES.current = (() => {
  const NP = 950;          // tracer particles
  const TRAIL = 14;        // positions kept per tracer
  const LEVELS = 11;       // precomputed isobars
  let speed = 0, top = 0, bottom = 0, blurField = null, hard = null, whale = null;
  let isobars = [];        // per level: Float32Array of segment endpoints
  let needles = [];        // vector-field glyphs: [x, y, randomAngle]
  const px = new Float32Array(NP), py = new Float32Array(NP);
  const hist = new Float32Array(NP * TRAIL * 2);
  const head = new Int32Array(NP), filled = new Int32Array(NP);
  let exitCaptured = false, lastT = 0, reynolds = 0, r0 = 0;

  function spawn(i, anywhere) {
    px[i] = anywhere ? lerp(-0.2 * W, 0.25 * W, Math.random()) : -10 - Math.random() * 40 * S;
    // half the tracers enter near the axis so the hull is wrapped by a dense bundle
    if (i % 2) py[i] = lerp(top, bottom, Math.random());
    else {
      const gauss = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      py[i] = Math.max(top, Math.min(bottom, CY + gauss * 170 * S));
    }
    filled[i] = 0;
  }

  // velocity at (x, y): uniform stream + gentle swell, deflected around the whale (slip boundary: the component
  // heading into the hull is removed, so streamlines slide along the isobars and close up behind)
  function field(x, y, t, out) {
    const h = 3 * S;
    const b = blurField(x, y);
    let ux = speed;
    let uy = speed * 0.2 * Math.sin(x * 0.006 / S + t * 0.8 + y * 0.004 / S);
    if (b > 0.01) {
      const gx = (blurField(x + h, y) - blurField(x - h, y)) / (2 * h);
      const gy = (blurField(x, y + h) - blurField(x, y - h)) / (2 * h);
      const gl = Math.hypot(gx, gy) || 1e-9;
      const nx = gx / gl, ny = gy / gl;          // points into the hull
      const into = ux * nx + uy * ny;
      const w = smooth(clamp01(b / 0.42));
      if (into > 0) { ux -= nx * into * w; uy -= ny * into * w; }
      else { ux -= nx * into * w * 1.05; uy -= ny * into * w * 1.05; } // rear: hug the hull and close up
      const boost = 1 + 0.55 * w;                // squeeze speeds the flow up along the flanks
      ux *= boost; uy *= boost;
      if (b > 0.45) { ux -= nx * speed * 1.4 * (b - 0.45) * 4; uy -= ny * speed * 1.4 * (b - 0.45) * 4; }
    }
    out[0] = ux;
    out[1] = uy;
  }

  function marching(grid, cols, rows, step, ox, oy, level) {
    const segs = [];
    const at = (c, r) => grid[r * cols + c];
    const lerpPt = (x1, y1, v1, x2, y2, v2) => {
      const k = (level - v1) / (v2 - v1 || 1e-6);
      return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k];
    };
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = at(c, r), b = at(c + 1, r), d = at(c, r + 1), e = at(c + 1, r + 1);
        const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (e > level ? 2 : 0) | (d > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x0 = ox + c * step, y0 = oy + r * step, x1 = x0 + step, y1 = y0 + step;
        const T = () => lerpPt(x0, y0, a, x1, y0, b);
        const R = () => lerpPt(x1, y0, b, x1, y1, e);
        const B = () => lerpPt(x0, y1, d, x1, y1, e);
        const L = () => lerpPt(x0, y0, a, x0, y1, d);
        const pairs = {
          1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[T, R]], 5: [[T, L], [B, R]], 6: [[T, B]], 7: [[T, L]],
          8: [[T, L]], 9: [[T, B]], 10: [[T, R], [L, B]], 11: [[T, R]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]],
        }[idx];
        for (const [p, q] of pairs) { const u = p(), v = q(); segs.push(u[0], u[1], v[0], v[1]); }
      }
    }
    return new Float32Array(segs);
  }

  return {
    label: 'CURRENT',
    readyAt: 3.5,
    titleAt: 2.1,
    layout() {
      speed = 270 * S;
      top = CY - 250 * S;
      bottom = CY + 250 * S;
      whale = makeWhale(CX, CY, 210 * S);
      blurField = whaleMask(whale, 26 * S);
      hard = whaleMask(whale, 0);
      // isobars from the blurred coverage field
      const step = 5 * S;
      const ox = CX - 300 * S, oy = CY - 240 * S;
      const cols = Math.ceil((600 * S) / step) + 1, rows = Math.ceil((480 * S) / step) + 1;
      const grid = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r * cols + c] = blurField(ox + c * step, oy + r * step);
      isobars = [];
      for (let i = 0; i < LEVELS; i++) isobars.push(marching(grid, cols, rows, step, ox, oy, 0.5 - i * 0.043));
      // vector-field needles
      needles = [];
      const gs = 30 * S;
      for (let y = top + gs / 2; y < bottom; y += gs) {
        for (let x = (W % gs) / 2; x < W; x += gs) needles.push([x, y, Math.random() * TAU]);
      }
      for (let i = 0; i < NP; i++) spawn(i, true);
      exitCaptured = false;
    },
    readout: () => `RE ${reynolds.toExponential(2).toUpperCase()}\nU∞ ${(1).toFixed(2)}`,
    frame(t, ex, ek) {
      const dt = Math.min(0.05, Math.max(0, t - lastT));
      lastT = t;
      const fade = 1 - seg(ex, 0, 0.5);
      const v = [0, 0];
      reynolds = 2.4e5 * (1 + 0.04 * Math.sin(t * 1.3));

      // ---- vector-field needles align, then recede behind the stream
      {
        const a = 0.28 * (1 - 0.75 * seg(t, 1.6, 2.6)) * fade;
        if (a > 0.003) {
          ctx.lineWidth = 1;
          const refresh = frameNo % 4 === 0;
          for (const nd of needles) {
            const [x, y, r0] = nd;
            const appear = seg(t, 0.05 + (x / W) * 0.5, 0.35 + (x / W) * 0.5);
            if (appear <= 0) continue;
            if (nd[5] === undefined) nd[5] = hard(x, y) > 0.5;
            if (nd[5]) continue;
            if (refresh || nd[3] === undefined) {   // field sampled every 4th frame
              field(x, y, t, v);
              nd[3] = Math.atan2(v[1], v[0]);
              nd[4] = Math.hypot(v[0], v[1]);
            }
            const fa = nd[3];
            v[0] = nd[4]; v[1] = 0;
            const k = outCubic(seg(t, 0.3 + (x / W) * 0.5, 0.95 + (x / W) * 0.5));
            const an = r0 + (((fa - r0 + Math.PI * 3) % TAU) - Math.PI) * k;
            const len = (4 + 3.5 * Math.min(1.6, Math.hypot(v[0], v[1]) / speed)) * S;
            const dx = Math.cos(an) * len, dy = Math.sin(an) * len;
            ctx.strokeStyle = col(a * appear);
            ctx.beginPath();
            ctx.moveTo(x - dx, y - dy);
            ctx.lineTo(x + dx, y + dy);
            ctx.stroke();
            dot(x + dx, y + dy, 0.9, a * appear);
          }
        }
      }

      // ---- isobars pulsing outward from the hull
      {
        const k = seg(t, 1.1, 1.9) * (1 - seg(ex, 0, 0.45));
        if (k > 0) {
          ctx.lineWidth = 1;
          isobars.forEach((segs, i) => {
            const reveal = seg(t, 1.1 + i * 0.06, 1.5 + i * 0.06);
            const pulse = Math.pow(Math.max(0, Math.sin(t * 2.1 - i * 0.62)), 4);
            const a = (0.05 + 0.22 * pulse) * (1 - i / (LEVELS + 2)) * k * reveal;
            if (a <= 0.003) return;
            ctx.strokeStyle = col(a);
            ctx.beginPath();
            for (let j = 0; j < segs.length; j += 4) { ctx.moveTo(segs[j], segs[j + 1]); ctx.lineTo(segs[j + 2], segs[j + 3]); }
            ctx.stroke();
          });
        }
      }

      // ---- advect tracers
      if (exiting && !exitCaptured) {
        exitCaptured = true;
        r0 = 0;
        for (let i = 0; i < NP; i++) r0 += Math.hypot(px[i] - HX, py[i] - HY) / NP;
      }
      // the stream bends into the vortex over the first third of the exit instead of turning on the spot
      const bend = exiting ? smooth(seg(ex, 0, 0.32)) : 0;
      const emit = seg(t, 0.55, 1.1);
      let rSum = 0;
      for (let i = 0; i < NP; i++) {
        if (!exiting) {
          field(px[i], py[i], t, v);
          px[i] += v[0] * dt;
          py[i] += v[1] * dt;
          if (px[i] > W + 20 || py[i] < top - 60 * S || py[i] > bottom + 60 * S || hard(px[i], py[i]) > 0.6) spawn(i, false);
        } else {
          // the stream winds into a vortex: radius decays exponentially, spin grows toward the eye
          const dx = px[i] - HX, dy = py[i] - HY;
          let r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
          const rate = 0.6 + 7 * ek;
          r = SPIN_R + (r - SPIN_R) * Math.exp(-dt * rate);
          th += dt * (1.5 + 9 * ek) * (1 + (90 * S) / (r + 30 * S));
          if (ex > 0.85) r = lerp(r, SPIN_R, seg(ex, 0.85, 1));
          let qx = HX + Math.cos(th) * r, qy = HY + Math.sin(th) * r;
          if (bend < 1) {
            field(px[i], py[i], t, v);
            qx = lerp(px[i] + v[0] * dt, qx, bend);
            qy = lerp(py[i] + v[1] * dt, qy, bend);
          }
          px[i] = qx;
          py[i] = qy;
          rSum += Math.hypot(qx - HX, qy - HY);
        }
        const h = head[i] = (head[i] + 1) % TRAIL;
        hist[(i * TRAIL + h) * 2] = px[i];
        hist[(i * TRAIL + h) * 2 + 1] = py[i];
        if (filled[i] < TRAIL) filled[i]++;
      }

      // ---- draw trails (bright head, faint tail) in two batches
      {
        // as the vortex tightens the trails pile into a smaller disc: thin them out with it
        const dense = exiting ? Math.min(1, Math.max(0.16, (1.4 * rSum) / NP / (r0 || 1))) : 1;
        // while the stream turns only the newest few positions are drawn (no hooks); the trails grow back after
        const len = exiting ? Math.round(lerp(lerp(TRAIL, 8, seg(ex, 0, 0.1)), TRAIL, seg(ex, 0.3, 0.5))) : TRAIL;
        const base = (light ? 0.5 : 0.42) * emit * dense * Math.sqrt(TRAIL / len) * (1 - seg(ex, 0.72, 1));
        if (base > 0.003) {
          const near = new Path2D(), far = new Path2D();
          for (let i = 0; i < NP; i++) {
            const n = Math.min(len, filled[i]);
            if (n < 3) continue;
            const x = px[i];
            const edge = Math.min(1, x / (120 * S), (W - x) / (120 * S));
            if (!exiting && edge <= 0) continue;
            const h = head[i];
            const path = (exiting || edge > 0.6) && i % 3 !== 0 ? near : far;
            for (let j = 0; j < n; j++) {
              const idx = (i * TRAIL + ((h - j + TRAIL) % TRAIL)) * 2;
              const hx = hist[idx], hy = hist[idx + 1];
              if (j === 0) path.moveTo(hx, hy);
              else {
                const pidx = (i * TRAIL + ((h - j + 1 + TRAIL) % TRAIL)) * 2;
                if (Math.abs(hist[pidx] - hx) > 80 * S) break; // respawn jump
                path.lineTo(hx, hy);
              }
            }
          }
          ctx.lineCap = 'round';
          ctx.lineWidth = 1;
          ctx.strokeStyle = col(base * 0.45);
          ctx.stroke(far);
          ctx.strokeStyle = col(base);
          ctx.stroke(near);
          ctx.lineCap = 'butt';
        }
      }

      // ---- the hull itself: only a faint outline with a comet tracing its edge
      {
        const k = seg(t, 1.45, 2.1) * (1 - seg(ex, 0, 0.35));
        if (k > 0) { ctx.fillStyle = col(0.045 * k); ctx.fill(whale.fill); }
        drawWhale(whale, {
          a: 0.5 * k,
          w: 1,
          tip: false,
          hiAt: ((t - 1.45) * 0.25) % 1,
          hiLen: 0.1,
          hiA: 0.85 * k,
        });
      }

      // inlet and outlet rails
      {
        const k = outExpo(seg(t, 0.1, 0.8)) * fade;
        const mid = (top + bottom) / 2, half = ((bottom - top) / 2 + 30 * S) * k;
        for (const x of [70 * S, W - 70 * S]) {
          line(x, mid - half, x, mid + half, 0.22 * fade);
          for (let y = mid - half; y <= mid + half; y += 20 * S) line(x - 3 * S, y, x + 3 * S, y, 0.22 * fade);
        }
        text('INLET', 70 * S, bottom + 46 * S, 0.35 * k, 9, 'center');
        text('OUTLET', W - 70 * S, bottom + 46 * S, 0.35 * k, 9, 'center');
      }

      // spinner track takes over from the vortex
      arc(HX, HY, SPIN_R, 0, TAU, RING_ALPHA * seg(ex, 0.6, 1), 2);
    },
  };
})();
