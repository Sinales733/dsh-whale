// ===== scene: WEAVE — modular times-table string art; the whale glows out of the weave =========
// Pin i is joined to pin i·k (mod N). k drifts continuously and lingers on integers, so the
// envelope breathes through cardioid → nephroid → 3-, 4-, 5-cusp epicycloids.
SCENES.weave = (() => {
  const N = 200;
  let R = 0, whale = null, kNow = 1;

  function kAt(t) {
    if (t < 2.0) return 1 + outCubic(seg(t, 0.9, 2.0));
    const kl = 2 + (t - 2.0) * 0.42;
    const f = kl - Math.floor(kl);
    return Math.floor(kl) + inOutCubic(clamp01((f - 0.28) / 0.72));
  }

  function chords(cx, cy, r, rot, k, t, alpha, width, grow) {
    ctx.lineWidth = width;
    ctx.strokeStyle = col(alpha);
    for (let i = 1; i < N; i++) {
      const g = grow ? outCubic(seg(t, 0.7 + 0.9 * (i / N), 1.2 + 0.9 * (i / N))) : 1;
      if (g <= 0) continue;
      const a0 = -Math.PI / 2 + rot + (TAU * i) / N;
      const a1 = -Math.PI / 2 + rot + (TAU * i * k) / N;
      const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
      const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(lerp(x0, x1, g), lerp(y0, y1, g));
      ctx.stroke();
    }
  }

  return {
    label: 'WEAVE',
    readyAt: 3.6,
    titleAt: 2.05,
    layout() {
      R = 212 * S;
      whale = makeWhale(CX, CY, 150 * S);
    },
    readout: () => `k ${kNow.toFixed(3)}\nN ${N}`,
    frame(t, ex, ek) {
      const fade = 1 - seg(ex, 0, 0.6);
      const cx = lerp(CX, HX, ek), cy = lerp(CY, HY, ek);
      const r = lerp(R, SPIN_R, ek);
      const rot = t * 0.07 + ek * ek * 5;
      const k = kAt(t);
      kNow = k;
      const pinAng = (i) => -Math.PI / 2 + rot + (TAU * i) / N;

      // loom ring
      arc(cx, cy, r, -Math.PI / 2 + rot, (exiting ? 1 : inOutSine(seg(t, 0.05, 0.8))) * TAU, lerp(0.42, RING_ALPHA, ek), lerp(1, 2, ek));

      // tick ring with a travelling wave + index labels
      {
        const tk = seg(t, 0.25, 1.0) * fade;
        const n = Math.floor(N * tk);
        for (let i = 0; i < n; i++) {
          const a = pinAng(i);
          const wave = 0.5 + 0.5 * Math.sin(i * 0.19 - t * 3.2);
          const r1 = r + 8 * S, r2 = r1 + (i % 10 === 0 ? 9 : 2.5 + 6 * wave * wave * seg(t, 1.2, 2.0)) * S;
          line(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2, (i % 10 === 0 ? 0.34 : 0.16) * fade);
        }
        const lk = seg(t, 1.0, 1.6) * fade;
        for (let i = 0; i < N; i += 25) {
          const a = pinAng(i);
          text(String(i).padStart(3, '0'), cx + Math.cos(a) * (r + 32 * S), cy + Math.sin(a) * (r + 32 * S), 0.32 * lk, 9, 'center');
        }
      }

      // pins appear in a sweep
      {
        const pk = seg(t, 0.2, 0.9);
        for (let i = 0; i < N * pk; i++) {
          const a = pinAng(i);
          dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.1, 0.5 * fade);
        }
      }

      // the weave
      const grow = t < 2.2;
      chords(cx, cy, r, rot, k, t, (light ? 0.17 : 0.15) * fade, 0.7, grow);

      // whale: the same chords re-drawn brighter inside the glyph, revealed by a radial wipe
      {
        const wk = seg(t, 2.05, 3.1) * (1 - seg(ex, 0, 0.45));
        if (wk > 0) {
          const sc = lerp(1, 0.3, ek);
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, outCubic(wk) * 190 * S, 0, TAU);
          ctx.clip();
          ctx.translate(cx, cy);
          ctx.scale(sc, sc);
          ctx.translate(-CX, -CY);
          ctx.clip(whale.fill);
          ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
          ctx.fillStyle = col(0.035 * wk);
          ctx.fillRect(0, 0, W, H);
          chords(cx, cy, r, rot, k, t, 0.62 * wk, 0.9, false);
          ctx.restore();
          drawWhale(whale, {
            a: 0.55 * wk,
            w: 1,
            tip: false,
            map: (p) => [cx + (p[0] - CX) * sc, cy + (p[1] - CY) * sc],
            hiAt: ((t - 2.6) * 0.22) % 1,
            hiA: 0.9 * wk,
          });
        }
      }

      // a bright "orbit" hopping i → i·k → i·k² … around the loom. A new orbit starts every PER seconds and
      // lives LIFE seconds: it fades in, each hop draws on with an eased pen, then the whole orbit fades out
      // while the next one is already being drawn, so nothing ever appears or vanishes in one frame.
      {
        const ok = smooth(seg(t, 2.6, 3.2)) * fade;
        if (ok > 0) {
          const PER = 0.9, LIFE = 1.8, HOPS = 9;
          const pin = (i) => { const a = pinAng(i); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
          for (let c = Math.floor((t - LIFE) / PER) + 1; c <= Math.floor(t / PER); c++) {
            const u = (t - c * PER) / LIFE;
            if (u < 0 || u >= 1) continue;
            const life = smooth(seg(u, 0, 0.06)) * (1 - smooth(seg(u, 0.62, 1)));
            if (life <= 0) continue;
            let idx = (((c * 7) % N) + N) % N;
            const path = [idx];
            for (let s = 0; s < HOPS; s++) { idx = (idx * k) % N; path.push(idx); }
            const p0 = pin(path[0]);
            arc(p0[0], p0[1], 6, 0, TAU, 0.5 * ok * life);
            for (let s = 0; s < HOPS; s++) {
              const g = inOutSine(seg(u, 0.03 + s * 0.055, 0.03 + s * 0.055 + 0.075));
              if (g <= 0) break;
              const a = pin(path[s]), b = pin(path[s + 1]);
              const fadeS = 1 - s / (HOPS + 1);
              const x = lerp(a[0], b[0], g), y = lerp(a[1], b[1], g);
              line(a[0], a[1], x, y, 0.75 * ok * fadeS * life, 1.2);
              dot(x, y, 2.2, 0.9 * ok * fadeS * life * (g < 1 ? 0.6 + 0.4 * g : 1));
            }
          }
        }
      }
    },
  };
})();
