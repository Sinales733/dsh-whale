// ===== scene: PULSAR — stacked ridgelines (after PSR B1919+21) with the whale embossed ===========
// Rows are painted back to front, each occluding the ones behind it. On exit the plot lies down into a
// skyline at the spinner's height, settles into one line, and curls into the spinner's progress arc.
SCENES.pulsar = (() => {
  const NR = 52, NP = 150;
  let top = 0, span = 0, half = 0, mask = null;
  let scanRow = 0;
  let headTo = null, lastA = 0;   // exit: the curl's target heading, followed without wrapping
  const rnd = Array.from({ length: NR * 8 }, (_, i) => hash(i + 1));

  function ridge(u, r, t) {
    const env = Math.exp(-u * u * 5.2);
    let h = 0;
    for (let j = 0; j < 3; j++) {
      const c = Math.sin(r * 0.73 + j * 2.1 + t * (0.32 + 0.14 * j)) * 0.3 + (rnd[r * 8 + j] - 0.5) * 0.24;
      const wd = 0.045 + 0.06 * rnd[r * 8 + 3 + j];
      const a = 0.5 + 0.5 * Math.sin(t * 1.15 + r * 0.37 + j * 1.7);
      const d = (u - c) / wd;
      h += a * Math.exp(-d * d);
    }
    h += 0.14 * Math.sin(u * 31 + r * 1.3 + t * 3.1) * Math.sin(u * 13 - t * 1.7);
    return Math.max(0, h) * env;
  }

  return {
    label: 'PULSAR',
    readyAt: 3.3,
    spinnerIn: 0.89,   // its line becomes the spinner's arc: the real one waits until it has landed
    titleAt: 2.0,
    layout() {
      headTo = null;
      span = 384 * S;
      top = CY - span / 2 + 8 * S;
      half = 300 * S;
      // The lift raises every row inside the glyph, which adds to its apparent height; widen the
      // mask to keep the embossed whale at its true proportions.
      const wh = makeWhale(CX, CY + 10 * S, 226 * S);
      const wide = new Path2D();
      wide.addPath(wh.fill, new DOMMatrix().translateSelf(CX, 0).scaleSelf(1.16, 1).translateSelf(-CX, 0));
      mask = whaleMask({ fill: wide }, 1.5 * S);
    },
    readout: () => `PSR B1919+21\nROW ${pad(Math.max(0, Math.min(NR, Math.round(scanRow))), 2)}/${NR}`,
    frame(t, ex, ek) {
      const breathe = 0.86 + 0.14 * Math.sin(t * 1.5);
      scanRow = ((t - 1.2) * 11) % (NR + 24) - 12;

      // Exit, in three moves. The plot is a height map: each row a profile across the ground, the rows
      // further back drawn higher up the screen.
      //  1. it lies down: the eye drops to the ground, so every row comes down onto one horizon at the
      //     spinner's height, the far ones smaller (perspective), and the relief stands up from it as a
      //     skyline, the near rows hiding the far ones except where those are higher;
      //  2. the relief settles until the skyline is one line;
      //  3. the line draws in and curls until it is the spinner's own progress arc, on the track and
      //     turning with it (where the measured spinner then takes over).
      const FRONT = NR - 1;
      const kL = inOutCubic(seg(ex, 0, 0.36));
      // the relief starts settling as the lie-down slows, and keeps settling into the curl (it rides on the
      // curling line), so no move starts from or ends in a standstill
      const kF = inOutSine(seg(ex, 0.3, 0.7));
      // the far rows fade out while the relief is still settling; gone before the curl takes the front row
      const kD = smooth(seg(ex, 0.36, 0.56));
      const kb = inOutCubic(seg(ex, 0.56, 0.89));
      const yp = HY;
      // x and height scale of a row (depth 0 back … 1 front) against the standing plot: lying down, the
      // back row ends up 0.42 of the front row's width
      const rowScale = (d) => lerp(1, (0.42 + 0.58 * d) / (0.8 + 0.2 * d), kL);
      // a point on the ground of the standing plot (the axes)
      const G = (x, y) => [CX + (x - CX) * rowScale(clamp01((y - top) / span)), lerp(y, yp, kL)];
      const seg2 = (x1, y1, x2, y2, a) => { const p = G(x1, y1), q = G(x2, y2); line(p[0], p[1], q[0], q[1], a); };

      // axes
      {
        const fade = 1 - smooth(seg(kL, 0.4, 1)), labels = 1 - smooth(seg(ex, 0, 0.16));
        const k = outExpo(seg(t, 0.1, 0.9));
        const ax = CX - half - 26 * S;
        seg2(ax, top + span / 2 - (span / 2) * k, ax, top + span / 2 + (span / 2) * k, 0.26 * fade);
        for (let r = 0; r < NR; r += 3) {
          const y = top + (r * span) / (NR - 1);
          if (Math.abs(y - (top + span / 2)) > (span / 2) * k) continue;
          const major = r % 12 === 0;
          seg2(ax - (major ? 6 : 3) * S, y, ax, y, 0.3 * fade);
          if (major) text(pad(r, 2), ax - 12 * S, y, 0.32 * fade * labels, 9, 'right');
        }
        const by = top + span + 24 * S;
        seg2(CX - half * k, by, CX + half * k, by, 0.26 * fade);
        for (let i = 0; i <= 20; i++) {
          const x = CX - half + (i / 20) * 2 * half;
          if (Math.abs(x - CX) > half * k) continue;
          seg2(x, by, x, by + (i % 5 === 0 ? 6 : 3) * S, 0.3 * fade);
          if (i % 5 === 0) text(((i - 10) / 10).toFixed(1), x, by + 16 * S, 0.3 * fade * labels, 9, 'center');
        }
      }

      // move 2: the front row as a curve of constant curvature, from the straight line it lies in to the
      // spinner's arc: its middle, heading, curvature and length all travel there together. The heading
      // follows the spinner's turn without wrapping, so the curl never flips.
      let curl = null, curlW = 1;
      if (exiting && kb > 0) {
        const a0 = spinnerAngle(t), sw = spinnerSweep(), thc = a0 + sw / 2;
        if (headTo === null) { headTo = ((((thc + Math.PI / 2 + Math.PI) % TAU) + TAU) % TAU) - Math.PI; lastA = a0; }
        headTo += ((((a0 - lastA + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
        lastA = a0;
        const mx = lerp(CX, HX + Math.cos(thc) * SPIN_R, kb), my = lerp(yp, HY + Math.sin(thc) * SPIN_R, kb);
        // length shrinks by the same ratio every frame (log scale), and the curve turns through a growing
        // share of the arc's sweep, so neither jumps; it stays level while long and turns once it is short
        const len = Math.exp(lerp(Math.log(2 * half), Math.log(sw * SPIN_R), inOutSine(seg(ex, 0.56, 0.89))));
        const psi = headTo * kb * kb * kb, kap = (sw * smooth(kb)) / len;
        curlW = lerp(1, 2, smooth(seg(kb, 0.3, 1)));
        // returns the point at u and the line's heading there; what is left of the relief stands on its normal
        curl = (u) => {
          const s = (u * len) / 2;
          if (kap < 1e-5) return [mx + Math.cos(psi) * s, my + Math.sin(psi) * s, psi];
          const rho = 1 / kap, ph = psi + kap * s;
          return [mx - Math.sin(psi) * rho + Math.sin(ph) * rho, my + Math.cos(psi) * rho - Math.cos(ph) * rho, ph];
        };
      }

      // ridgelines, back (top) to front (bottom)
      const xs = new Float32Array(NP), ys = new Float32Array(NP), ms = new Float32Array(NP);
      const bx = new Float32Array(NP), by = new Float32Array(NP);   // the row's baseline, for its fill
      // the occluding fills go once the far rows have gone (they hide nothing after that); the fill is opaque
      // paint on the canvas, so it fades rather than stops
      const fillA = 1 - smooth(seg(ex, 0.5, 0.68));
      ctx.lineJoin = 'round';
      for (let r = 0; r < NR; r++) {
        const depth = r / (NR - 1);
        const baseY = top + depth * span;
        const wr = 0.8 + 0.2 * depth;
        const grow = outCubic(seg(t, 0.15 + Math.abs(r - NR / 2) * 0.022, 0.75 + Math.abs(r - NR / 2) * 0.022));
        if (grow <= 0) continue;
        const amp = outCubic(seg(t, 0.9 + (NR - 1 - r) * 0.016, 1.6 + (NR - 1 - r) * 0.016)) * 30 * S;
        const liftK = smooth(seg(t, 1.6 + r * 0.013, 2.4 + r * 0.013));
        const lift = liftK * 27 * S * breathe;
        // once the relief has settled all the rows are in the one line: the front row takes over their light
        const scan = Math.exp(-(((r - scanRow) / 1.6) ** 2)) * seg(t, 1.2, 1.6) * (1 - kL);
        let a = (0.32 + 0.5 * depth + 0.45 * scan) * (light ? 0.95 : 1);
        if (r === FRONT) a = lerp(a, 1, smooth(seg(ex, 0.36, 0.62)));
        else a *= 1 - kD;
        // seen from the ground the relief stands taller than from above (heights are no longer foreshortened)
        const k = rowScale(depth), base = lerp(baseY, yp, kL), hk = k * lerp(1, 1.9, kL) * (1 - kF);
        if (a <= 0.003 && fillA <= 0.003) continue;
        const curling = r === FRONT && curl;
        let n = 0;
        for (let i = 0; i < NP; i++) {
          const u = -1 + (2 * i) / (NP - 1);
          if (Math.abs(u) > grow && !exiting) continue;
          const x0 = CX + u * half * wr;
          const m = mask(x0, baseY);
          const h = ridge(u, r, t) * amp * (1 - 0.8 * m * liftK) + m * lift + 0.6 * S * Math.sin(u * 50 + t * 6 + r);
          if (curling) {
            const c = curl(u), hh = h * hk, sn = Math.sin(c[2]), cs = Math.cos(c[2]);
            xs[n] = c[0] + sn * hh; ys[n] = c[1] - cs * hh;
            bx[n] = c[0] - sn * 1.5; by[n] = c[1] + cs * 1.5;
          } else { xs[n] = bx[n] = CX + (x0 - CX) * k; ys[n] = base - h * hk; by[n] = base + 1.5; }
          ms[n] = m * liftK; n++;
        }
        if (n < 2) continue;
        // occluding fill down to the row's own baseline: lying down, it is what hides the far rows
        if (fillA > 0.003) {
          ctx.beginPath();
          ctx.moveTo(xs[0], ys[0]);
          for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i]);
          for (let i = n - 1; i >= 0; i--) ctx.lineTo(bx[i], by[i]);
          ctx.closePath();
          ctx.globalAlpha = fillA;
          ctx.fillStyle = BG;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (a <= 0.003) continue;
        ctx.strokeStyle = col(a);
        ctx.lineWidth = curling ? curlW : 1;
        ctx.beginPath();
        ctx.moveTo(xs[0], ys[0]);
        for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i]);
        ctx.stroke();
        // the embossed whale reads brighter than the surrounding signal
        const glow = 0.45 * (1 - kF) * (r === FRONT ? 1 : 1 - kD);
        if (glow > 0.01) {
          const inside = new Path2D();
          let any = false;
          for (let i = 1; i < n; i++) {
            if (ms[i] + ms[i - 1] < 0.9) continue;
            inside.moveTo(xs[i - 1], ys[i - 1]);
            inside.lineTo(xs[i], ys[i]);
            any = true;
          }
          if (any) {
            ctx.strokeStyle = col(glow);
            ctx.lineWidth = 1.2;
            ctx.stroke(inside);
          }
        }
      }
      ctx.lineJoin = 'miter';
      // the spinner track comes up under the arriving arc (not before: the line runs through it)
      if (exiting) arc(HX, HY, SPIN_R, 0, TAU, RING_ALPHA * smooth(seg(ex, 0.74, 0.89)), 2);
    },
  };
})();
