// ===== scene: CONSTRUCT — compass-and-ruler construction, whale traced by a single pen ======
SCENES.construct = (() => {
  let whale = null;
  let sweepDeg = 0;
  // Orbiting nodes: [ring radius, speed rad/s, phase]
  const NODES = [
    [120, 0.55, 0.3], [170, -0.38, 1.9], [228, 0.24, 3.4],
    [120, 0.55, 3.4], [170, -0.38, 5.0], [228, 0.24, 0.6],
  ];

  // Point on a regular n-gon (vertex at top) at perimeter parameter u ∈ [0,1).
  function ngon(n, u, r, rot) {
    if (n >= 48) {
      const a = rot - Math.PI / 2 + u * TAU;
      return [Math.cos(a) * r, Math.sin(a) * r];
    }
    const f = u * n;
    const i = Math.floor(f) % n;
    const k = f - Math.floor(f);
    const a1 = rot - Math.PI / 2 + (i / n) * TAU;
    const a2 = rot - Math.PI / 2 + ((i + 1) / n) * TAU;
    return [lerp(Math.cos(a1), Math.cos(a2), k) * r, lerp(Math.sin(a1), Math.sin(a2), k) * r];
  }

  function polygon(x, y, nA, nB, m, r, rot, progress, a, w = 1) {
    if (a <= 0.003 || progress <= 0 || r <= 0) return;
    const N = 240;
    const end = Math.max(1, Math.round(N * progress));
    ctx.strokeStyle = col(a);
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = 0; i <= end; i++) {
      const u = (i % N) / N;
      const p = ngon(nA, u, r, rot);
      const q = ngon(nB, u, r, rot);
      const px = x + lerp(p[0], q[0], m);
      const py = y + lerp(p[1], q[1], m);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  return {
    label: 'CONSTRUCT',
    readyAt: 3.0,
    layout() { whale = makeWhale(CX, CY, 112 * S); },
    readout: () => `θ ${sweepDeg.toFixed(1).padStart(5, '0')}°\nR ${(228 * S).toFixed(2)}`,
    frame(t, ex, ek) {
      const fade = 1 - seg(ex, 0, 0.55);
      const cx = lerp(CX, HX, ek);
      const cy = lerp(CY, HY, ek);

      // dot grid with radial reveal wave
      {
        const step = 32 * S;
        const front = (t - 0.15) * 1100 * S;
        const a0 = 0.055 * fade;
        if (a0 > 0.002 && front > 0) {
          for (let y = CY % step; y < H; y += step) {
            for (let x = CX % step; x < W; x += step) {
              const d = Math.hypot(x - CX, y - CY);
              if (d > front) continue;
              const band = Math.max(0, 1 - Math.abs(front - d) / (90 * S));
              const r = 0.8 + band * 1.2;
              ctx.fillStyle = col(a0 * (1 + band * 5));
              ctx.fillRect(x - r / 2, y - r / 2, r, r);
            }
          }
        }
      }

      // crosshair and rulers
      {
        const k = outExpo(seg(t, 0.15, 0.95)) * (1 - ek);
        const a = 0.16 * (exiting ? 1 - seg(ex, 0.1, 0.8) : 1);
        line(cx - k * W, cy, cx + k * W, cy, a);
        line(cx, cy - k * H, cx, cy + k * H, a);
        const reach = seg(t, 0.35, 1.3) * Math.max(W, H) * 0.55 * (1 - ek);
        for (let d = 20 * S; d < reach; d += 20 * S) {
          const major = Math.round(d / (20 * S)) % 5 === 0;
          const len = (major ? 7 : 3.5) * S;
          const aa = a * (major ? 1.6 : 1) * (1 - d / (Math.max(W, H) * 0.6));
          line(cx + d, cy - len, cx + d, cy + len, aa);
          line(cx - d, cy - len, cx - d, cy + len, aa);
          line(cx - len, cy + d, cx + len, cy + d, aa);
          line(cx - len, cy - d, cx + len, cy - d, aa);
        }
        const dk = outCubic(seg(t, 0.9, 1.6));
        for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
          line(x, y, lerp(x, cx, dk * 0.82), lerp(y, cy, dk * 0.82), 0.07 * fade);
        }
      }

      // centre point + birth pulse
      {
        dot(cx, cy, 2.2 * S, 0.9 * seg(t, 0, 0.3) * fade);
        const pk = seg(t, 0.05, 0.9);
        if (pk > 0 && pk < 1) arc(cx, cy, outExpo(pk) * 60 * S, 0, TAU, 0.5 * (1 - pk));
      }

      // construction circles (converge into the spinner track on exit)
      const circles = [
        { r: 120, t: 0.35, a: 0.42, dash: null },
        { r: 170, t: 0.5, a: 0.22, dash: [2, 5] },
        { r: 228, t: 0.65, a: 0.3, dash: null },
        { r: 284, t: 0.8, a: 0.1, dash: [1, 7] },
      ];
      circles.forEach((c, i) => {
        const k = inOutSine(seg(t, c.t, c.t + 0.8));
        const r = lerp(c.r * S, SPIN_R, ek);
        const a = lerp(c.a, RING_ALPHA, ek) * (!exiting || i === 0 ? 1 : 1 - seg(ex, 0.75, 1));
        const start = -Math.PI / 2 + (i % 2 ? 1 : -1) * t * 0.15;
        arc(cx, cy, r, start, (exiting ? 1 : k) * TAU, a, lerp(1, 2, ek), ek > 0.6 ? null : c.dash);
      });

      // protractor ticks on the outer ring
      {
        const n = Math.floor(72 * seg(t, 1.0, 1.8));
        const a = 0.22 * fade;
        for (let i = 0; i < n; i++) {
          const ang = t * 0.05 + (i / 72) * TAU;
          const major = i % 6 === 0;
          const r1 = 284 * S, r2 = r1 + (major ? 10 : 4) * S;
          line(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1, cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2, a * (major ? 1.4 : 0.8));
        }
      }

      // polygons drawn edge by edge, rotating, morphing while idle
      {
        const idle = Math.max(0, t - 2.4);
        const cyc = (period, off) => inOutCubic(clamp01(((Math.sin((idle * TAU) / period + off) + 1) / 2) * 1.4 - 0.2));
        const shrink = lerp(1, 0.02, ek);
        polygon(cx, cy, 3, 6, cyc(6, 0), 228 * S * shrink, t * 0.12, outCubic(seg(t, 0.6, 1.4)), 0.34 * fade);
        polygon(cx, cy, 6, 3, cyc(6, 0), 228 * S * shrink, -t * 0.12 + Math.PI, outCubic(seg(t, 0.8, 1.6)), 0.14 * fade);
        polygon(cx, cy, 4, 64, cyc(5, 1.5), 170 * S * shrink, -t * 0.2 + Math.PI / 4, outCubic(seg(t, 0.75, 1.5)), 0.3 * fade);
        polygon(cx, cy, 6, 4, cyc(7, 3), 120 * S * shrink, t * 0.3, outCubic(seg(t, 0.9, 1.6)), 0.2 * fade);
        const sk = seg(t, 1.2, 1.9);
        for (let i = 0; i < 6; i++) {
          const ang = t * 0.3 - Math.PI / 2 + (i / 6) * TAU;
          const r = 120 * S * shrink;
          line(cx + Math.cos(ang) * r * (1 - sk * 0.35), cy + Math.sin(ang) * r * (1 - sk * 0.35), cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 0.3 * fade * sk);
        }
      }

      // radar sweep with fading trail
      const sweep = t * 0.95 - Math.PI / 2;
      sweepDeg = (((sweep + Math.PI / 2) * 180) / Math.PI) % 360;
      {
        const k = seg(t, 1.7, 2.3) * fade;
        const R = 228 * S * lerp(1, 0.05, ek);
        for (let i = 0; i < 18; i++) {
          const ang = sweep - i * 0.035;
          line(cx, cy, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, (0.32 - i * 0.017) * k);
        }
        dot(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R, 2, 0.8 * k);
      }

      // orbiting nodes + constellation links
      {
        const k = seg(t, 1.4, 2.1) * fade;
        if (k > 0) {
          const pts = NODES.map(([r, sp, ph]) => {
            const ang = ph + t * sp;
            const rr = lerp(r * S, SPIN_R, ek);
            return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, ang];
          });
          for (let i = 0; i < pts.length; i++) {
            const j = (i + 1) % pts.length;
            line(pts[i][0], pts[i][1], pts[j][0], pts[j][1], 0.13 * k);
          }
          line(pts[0][0], pts[0][1], pts[3][0], pts[3][1], 0.09 * k);
          for (const p of pts) {
            const diff = (((sweep - p[2]) % TAU) + TAU) % TAU;
            const flare = diff < 0.6 ? 1 - diff / 0.6 : 0;
            dot(p[0], p[1], 2 + flare * 1.2, (0.55 + 0.45 * flare) * k);
            arc(p[0], p[1], 6 + flare * 6, 0, TAU, (0.25 + 0.35 * flare) * k);
          }
        }
      }

      // whale: traced as a single pen line, then a comet keeps running along it
      {
        const tk = inOutSine(seg(t, 1.0, 2.25));
        const a = 0.9 * (1 - seg(ex, 0, 0.4));
        const sc = lerp(1, 0.3, ek);
        const offX = cx - CX, offY = cy - CY;
        const fk = seg(t, 2.2, 2.9) * (1 - seg(ex, 0, 0.35));
        if (fk > 0) {
          ctx.save();
          ctx.translate(CX + offX, CY + offY);
          ctx.scale(sc, sc);
          ctx.translate(-CX, -CY);
          ctx.globalAlpha = fk;
          ctx.fillStyle = BG;
          ctx.fill(whale.fill);
          ctx.globalAlpha = 1;
          ctx.fillStyle = col(0.05 * fk + 0.02 * Math.sin(t * 2) * fk);
          ctx.fill(whale.fill);
          ctx.restore();
        }
        const traced = tk >= 1;
        drawWhale(whale, {
          progress: tk,
          a: a * (traced ? 0.55 + 0.1 * Math.sin(t * 1.8) : 1),
          w: 1.3,
          map: (p) => [CX + (p[0] - CX) * sc + offX, CY + (p[1] - CY) * sc + offY],
          hiAt: traced ? ((t - 2.25) * 0.28) % 1 : -1,
          hiA: a,
        });
      }
    },
  };
})();
