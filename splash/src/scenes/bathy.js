// ===== scene: BATHY — a living depth chart; the whale rises as an island of contours ============
// A drop falls in the middle of an empty chart: rings spread from it, the isolines of one round seamount, and as its
// front passes it uncovers the frame, the ticks and the compass. The rings relax into a slowly drifting sea floor
// (marching squares); then the whale's blurred silhouette is added to the field, so the contours crowd along its
// outline, and a pen inks the shore. A survey cursor wanders over the chart reading depths. On exit the film runs
// backwards: the chart relaxes into the rings of a round seamount under the spinner, which sinks; ring after ring
// closes on the centre, and the last isoline is the spinner track, lighting up and gathering into the progress arc.
SCENES.bathy = (() => {
  const NL = 18, LV = Array.from({ length: NL }, (_, l) => 0.05 + l * 0.062);
  const A0 = 1.15, A1 = 0.1;                    // seamount height: all levels inside it … only the lowest
  const KR = Math.sqrt(Math.log(A1 / LV[0]));   // the last ring's radius, in seamount widths
  let cs = 0, nx = 0, ny = 0, x0 = 0, y0 = 0, hw = 0, hh = 0, RX = 0, RY = 0, RR = 0, W0 = 0;
  let whale = null, BR = null, SH = null, F = null, depthNow = 0, curU = 0, curV = 0;
  const px = [0, 0, 0, 0], py = [0, 0, 0, 0];
  const SND = Array.from({ length: 18 }, (_, i) => [0.06 + 0.88 * hash(i * 2 + 5.3), 0.08 + 0.84 * hash(i * 2 + 6.1), 300 + Math.round(hash(i + 40.5) * 330) * 10]);

  function level(L) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const k = j * nx + i, a = F[k], b = F[k + 1], c = F[k + nx + 1], d = F[k + nx];
        const A = a > L, B = b > L, C = c > L, D = d > L;
        if (A === B && B === C && C === D) continue;
        const X = x0 + i * cs, Y = y0 + j * cs;
        let n = 0;
        if (A !== B) { px[n] = X + (cs * (L - a)) / (b - a); py[n++] = Y; }
        if (B !== C) { px[n] = X + cs; py[n++] = Y + (cs * (L - b)) / (c - b); }
        if (C !== D) { px[n] = X + (cs * (L - d)) / (c - d); py[n++] = Y + cs; }
        if (D !== A) { px[n] = X; py[n++] = Y + (cs * (L - a)) / (d - a); }
        ctx.moveTo(px[0], py[0]); ctx.lineTo(px[1], py[1]);
        if (n === 4) { ctx.moveTo(px[2], py[2]); ctx.lineTo(px[3], py[3]); }
      }
    }
  }

  return {
    label: 'BATHY',
    readyAt: 3.5,
    titleAt: 2.05,
    exitDur: 1.2,
    spinnerIn: 0.88,   // the last isoline gathers into the spinner's arc
    layout() {
      cs = 7 * S; hw = 301 * S; hh = 224 * S; W0 = 118 * S;
      nx = Math.round((2 * hw) / cs) + 1; ny = Math.round((2 * hh) / cs) + 1;
      x0 = CX - hw; y0 = CY - hh;
      RR = 27 * S; RX = CX - hw + 46 * S; RY = CY + hh - 46 * S;
      whale = makeWhale(CX + 8 * S, CY - 4 * S, 228 * S);
      const mb = whaleMask(whale, 24 * S), ms = whaleMask(whale, 5 * S);
      BR = new Float32Array(nx * ny); SH = new Float32Array(nx * ny); F = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        BR[j * nx + i] = mb(x0 + i * cs, y0 + j * cs);
        SH[j * nx + i] = ms(x0 + i * cs, y0 + j * cs);
      }
    },
    readout: () => `38°${pad(Math.floor(12 + 48 * (1 - curV)), 2)}′N 121°${pad(Math.floor(72 * curU), 2)}′E\nDEPTH ${pad(Math.round(depthNow / 10) * 10, 4)} M`,
    frame(t, ex, ek) {
      const Lx = x0, Rx = x0 + 2 * hw, Ty = y0, By = y0 + 2 * hh;
      const labels = 1 - smooth(seg(ex, 0, 0.15));

      // ---- the round seamount: its share of the field (mix), height, width and centre; and how much of the picture
      // is drawn as exact circles instead of marched contours (circ). Both hand-overs happen while the field is the
      // seamount alone, so the two drawings coincide.
      let mix = 0, mA = A0, mw = W0, mx = CX, my = CY, circ = 0;
      if (exiting) {
        // it sinks and narrows under the spinner; the lowest level's ring ends on the track
        const pe = inOutSine(seg(ex, 0.26, 0.76)), c = smooth(seg(ex, 0.26, 0.62));
        mA = Math.exp(lerp(Math.log(A0), Math.log(A1), pe));
        mw = Math.exp(lerp(Math.log(W0), Math.log(SPIN_R / KR), pe));
        mx = lerp(CX, HX, c); my = lerp(CY, HY, c);
        mix = inOutCubic(seg(ex, 0.02, 0.36)); circ = smooth(seg(ex, 0.32, 0.38));
      } else if (t < 1.5) {
        // the drop: it rises and widens from nothing, its rings born one after another at the centre
        const po = outCubic(seg(t, 0.1, 0.9));
        mA = Math.exp(lerp(Math.log(0.045), Math.log(A0), po));
        mw = Math.exp(lerp(Math.log(9 * S), Math.log(W0), po));
        mix = 1 - inOutCubic(seg(t, 0.74, 1.45)); circ = 1 - smooth(seg(t, 0.68, 0.78));
      }
      // how far the drop's front has run: it uncovers the frame and its furniture, and takes them back on exit
      const rho = 400 * S * (exiting ? 1 - inOutCubic(seg(ex, 0, 0.36)) : outCubic(seg(t, 0.12, 1.0)));
      const seen = (x, y) => smooth(clamp01((rho - Math.hypot(x - CX, y - CY)) / (24 * S)));

      // ---- field
      const rise = inOutCubic(seg(t, 1.1, 2.4)) * (1 + 0.03 * Math.sin(t * 1.1)) * (1 + 0.07 * Math.sin(Math.PI * seg(ex, 0, 0.2)));
      const march = circ < 1;
      if (march) {
        const q = 1 / S, iw2 = 1 / (mw * mw);
        for (let j = 0; j < ny; j++) {
          const y = j * cs * q, dy = y0 + j * cs - my;
          for (let i = 0; i < nx; i++) {
            const x = i * cs * q, k = j * nx + i;
            const T = 0.5 + 0.28 * Math.sin(x * 0.011 + 0.2 * t) * Math.cos(y * 0.013 - 0.17 * t)
              + 0.16 * Math.sin(x * 0.021 + y * 0.017 + 1.3 + 0.13 * t) + 0.08 * Math.sin(x * 0.04 - y * 0.05 - 0.3 * t);
            let f = T * 0.42 * (1 - 0.8 * rise * SH[k]) + rise * (0.5 * BR[k] + 0.28 * SH[k]);
            if (mix > 0) { const dx = x0 + i * cs - mx; f = lerp(f, mA * Math.exp(-(dx * dx + dy * dy) * iw2), mix); }
            F[k] = f;
          }
        }
      }
      // survey cursor: a slow Lissajous walk over the chart
      curU = 0.5 + 0.4 * Math.sin(0.23 * t + 1.0); curV = 0.5 + 0.38 * Math.sin(0.31 * t + 0.4);
      const ux = curU * (nx - 1), uy = curV * (ny - 1);
      if (!exiting) {
        const i = Math.min(nx - 2, Math.floor(ux)), j = Math.min(ny - 2, Math.floor(uy)), fx = ux - i, fy = uy - j, k = j * nx + i;
        depthNow = 4200 * (1 - lerp(lerp(F[k], F[k + 1], fx), lerp(F[k + nx], F[k + nx + 1], fx), fy));
      }

      // ---- frame: each edge shows as far as the front has passed it
      for (const [h1, h2, a] of [[hw, hh, 0.32], [hw + 7 * S, hh + 7 * S, 0.12]]) {
        const ex1 = Math.min(h1, Math.sqrt(Math.max(0, rho * rho - h2 * h2))), ey1 = Math.min(h2, Math.sqrt(Math.max(0, rho * rho - h1 * h1)));
        if (ex1 > 0) { line(CX - ex1, CY - h2, CX + ex1, CY - h2, a); line(CX - ex1, CY + h2, CX + ex1, CY + h2, a); }
        if (ey1 > 0) { line(CX - h1, CY - ey1, CX - h1, CY + ey1, a); line(CX + h1, CY - ey1, CX + h1, CY + ey1, a); }
      }
      // graticule, ticks, labels, soundings
      for (let i = 1; i < 6; i++) {
        const x = Lx + (2 * hw * i) / 6, v = seen(x, By);
        line(x, Ty, x, By, 0.05 * v);
        line(x, By, x, By + 7 * S * v, 0.4 * v);
        text(i < 5 ? `121°${pad(i * 12, 2)}′E` : '122°00′E', x, By + 18 * S, 0.3 * v * labels, 9, 'center');
      }
      for (let i = 1; i < 4; i++) {
        const y = Ty + (2 * hh * i) / 4, v = seen(Lx, y);
        line(Lx, y, Rx, y, 0.05 * v);
        line(Lx, y, Lx - 7 * S * v, y, 0.4 * v);
        text(`38°${pad(60 - i * 12, 2)}′N`, Lx - 14 * S, y, 0.3 * v * labels, 9, 'right');
      }
      for (let i = 0; i < SND.length; i++) {
        const gi = Math.floor(SND[i][0] * (nx - 1)), gj = Math.floor(SND[i][1] * (ny - 1));
        const sx = x0 + gi * cs, sy = y0 + gj * cs;
        if (BR[gj * nx + gi] > 0.12 || (Math.abs(sx - RX) < RR + 22 * S && Math.abs(sy - RY) < RR + 16 * S)) continue;
        text(String(SND[i][2]), sx, sy, 0.3 * seg(t, 1.2 + i * 0.03, 1.7 + i * 0.03) * labels, 8.5, 'center');
      }

      // ---- isolines, deepest first
      if (march) {
        ctx.lineJoin = 'round';
        for (let l = 0; l < NL; l++) {
          const a = (l % 4 === 0 ? 0.5 : 0.2) * (1 - circ);
          if (a <= 0.003) continue;
          ctx.strokeStyle = col(a);
          ctx.lineWidth = l % 4 === 0 ? 1.1 : 0.8;
          ctx.beginPath();
          level(LV[l]);
          ctx.stroke();
        }
        ctx.lineJoin = 'miter';
      }
      // the same isolines as exact circles, while the seamount is all there is
      if (circ > 0) {
        const land = smooth(seg(ex, 0.55, 0.78));
        for (let l = NL - 1; l >= 0; l--) {
          if (mA <= LV[l]) continue;
          const r = mw * Math.sqrt(Math.log(mA / LV[l]));
          if (l === 0 && exiting) arc(mx, my, r, 0, TAU, lerp(0.5, RING_ALPHA, land) * circ, lerp(1.1, 2, land));
          else arc(mx, my, r, 0, TAU, (l % 4 === 0 ? 0.5 : 0.2) * circ * smooth(seg(r, 0.4, 3)), l % 4 === 0 ? 1.1 : 0.8);
        }
      }
      // the drop itself, and its front running out to the frame
      if (!exiting && t < 1.1) {
        dot(CX, CY, 1.6, smooth(seg(t, 0.06, 0.12)) * (1 - smooth(seg(t, 0.2, 0.5))));
        ctx.save(); ctx.beginPath(); ctx.rect(Lx, Ty, 2 * hw, 2 * hh); ctx.clip();
        arc(CX, CY, rho, 0, TAU, 0.34 * (1 - seg(rho, 60 * S, 385 * S)) * smooth(seg(t, 0.12, 0.2)));
        ctx.restore();
      }

      // ---- survey cursor: two hairlines slide in from the frame and a ring locks on where they cross
      {
        const cx = x0 + ux * cs, cy = y0 + uy * cs, g = 9 * S;
        const e = inOutCubic(seg(t, 1.5, 2.1)), lock = outCubic(seg(t, 1.95, 2.4));
        const off = 1 - smooth(seg(ex, 0, 0.22));
        const hx = lerp(Lx, cx, e), hy = lerp(Ty, cy, e), la = 0.1 * smooth(seg(t, 1.5, 1.7)) * off;
        line(Lx, hy, hx - g * lock, hy, la); line(hx + g * lock, hy, Rx, hy, la);
        line(hx, Ty, hx, hy - g * lock, la); line(hx, hy + g * lock, hx, By, la);
        line(hx, By, hx, By + 7 * S, 8 * la, 1.2); line(Lx, hy, Lx - 7 * S, hy, 8 * la, 1.2);
        if (lock > 0) {
          const ph = fract(t * 0.7);
          arc(cx, cy, 5 * S * (1 + 3 * (1 - lock)), 0, TAU, 0.75 * lock * off);
          arc(cx, cy, (5 + 9 * ph) * S, 0, TAU, 0.4 * lock * off * (1 - ph) * smooth(seg(ph, 0, 0.15)));
          dot(cx, cy, 1.2, 0.9 * lock * off);
          text(`${Math.round(depthNow / 10) * 10} M`, cx + 11 * S, cy - 11 * S, 0.55 * lock * off * labels, 9);
        }
      }

      // ---- shoreline: inked by a pen, then a survey light keeps running round it; on exit it melts into the rings
      {
        const wk = 1 - smooth(seg(ex, 0.02, 0.24));
        drawWhale(whale, { progress: inOutSine(seg(t, 1.8, 2.7)), a: 0.85 * wk, w: 1.3, hiAt: (t * 0.14) % 1, hiA: 0.9 * wk * smooth(seg(t, 2.7, 3.1)) });
      }

      // ---- compass rose: uncovered by the front; its needle swings in and settles, and spins away on exit
      {
        const k = smooth(clamp01((rho - Math.hypot(RX - CX, RY - CY)) / (60 * S)));
        if (k > 0.003) {
          const r = RR * k;
          ctx.globalAlpha = k; ctx.fillStyle = BG;
          ctx.beginPath(); ctx.arc(RX, RY, r + 6 * S * k, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
          arc(RX, RY, r, 0, TAU, 0.45 * k);
          arc(RX, RY, r * 0.8, 0, TAU, 0.14 * k);
          for (let i = 0; i < 36; i++) {
            const a = (TAU * i) / 36, c = Math.cos(a), s = Math.sin(a), r1 = r * (i % 9 === 0 ? 0.8 : 0.9);
            line(RX + c * r1, RY + s * r1, RX + c * r * 0.98, RY + s * r * 0.98, 0.32 * k);
          }
          for (let i = 0; i < 8; i++) {
            const a = (TAU * i) / 8, c = Math.cos(a), s = Math.sin(a), r1 = r * (i % 2 ? 0.42 : 0.72);
            line(RX + c * r * 0.12, RY + s * r * 0.12, RX + c * r1, RY + s * r1, 0.3 * k);
          }
          const na = -Math.PI / 2 + 0.14 * Math.sin(t * 0.9) + 0.05 * Math.sin(t * 2.3 + 1) + 7 * Math.pow(1 - seg(t, 0.7, 2.0), 3) - 9 * Math.pow(seg(ex, 0, 0.4), 2);
          line(RX - Math.cos(na) * r * 0.5, RY - Math.sin(na) * r * 0.5, RX + Math.cos(na) * r * 0.74, RY + Math.sin(na) * r * 0.74, 0.85 * k, 1.2);
          dot(RX, RY, 1.6 * k, 0.9 * k);
          text('N', RX, RY - r - 9 * S, 0.42 * k * labels, 9, 'center');
        }
      }

      // ---- the last isoline lights up and gathers into the progress arc
      {
        const k = seg(ex, 0.7, 0.88);
        if (k > 0) arc(HX, HY, SPIN_R, spinnerAngle(t), lerp(TAU, spinnerSweep(), inOutCubic(k)), smooth(k), 2);
      }
    },
  };
})();
