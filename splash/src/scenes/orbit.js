// ===== scene: ORBIT — wireframe globe, the whale as a continent, satellites on tilted orbits ====
SCENES.orbit = (() => {
  const CAM = 3.6;                         // camera distance in globe radii
  const SIL = CAM / Math.sqrt(CAM * CAM - 1); // silhouette radius / globe radius
  const MER = 12;
  const PARS = [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75].map((d) => (d * Math.PI) / 180);
  const yawAt = (t) => 0.36 * t + 2.4 * (1 - Math.exp(-1.4 * t)); // spin-up burst, then cruise
  const L0 = -yawAt(2.9);                  // whale faces the viewer around t = 2.9 s
  const ORBITS = [
    { r: 1.34, inc: 1.2, node: 0.35, prec: 0.05, sats: [[0, 0.95], [Math.PI, 0.95]], t0: 1.0 },
    { r: 1.6, inc: -0.42, node: 2.1, prec: -0.035, sats: [[1.2, -0.62]], t0: 1.25 },
  ];

  let R0 = 0;
  let whaleUnit = null; // polylines of unit vectors on the sphere
  let whaleTotal = 0;
  let yawNow = 0, scanLat = 0;

  // view state shared by the projection helpers
  let ca = 1, sa = 0, cb = 1, sb = 0, gx = 0, gy = 0, gr = 0, rs = 0;
  function setView(yaw, pitch, cx, cy, r) {
    ca = Math.cos(yaw); sa = Math.sin(yaw);
    cb = Math.cos(pitch); sb = Math.sin(pitch);
    gx = cx; gy = cy; gr = r; rs = r * SIL;
  }
  // globe-fixed point (rotates with yaw) → [sx, sy, depth]
  function proj(x, y, z) {
    const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
    return cam(x1, y, z1);
  }
  // space-fixed point (camera pitch only)
  function cam(x, y, z) {
    const y2 = y * cb - z * sb, z2 = y * sb + z * cb;
    const f = CAM / (CAM - z2);
    return [gx + x * gr * f, gy + y2 * gr * f, z2];
  }
  const latlon = (lat, lon) => [Math.cos(lat) * Math.sin(lon), -Math.sin(lat), Math.cos(lat) * Math.cos(lon)];

  /** Stroke a projected polyline: front-facing (or unoccluded) segments bright, the rest faint. */
  function strokeSplit(pts, aFront, aBack, w, occlusion = false) {
    const front = new Path2D(), back = new Path2D();
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const z = p[2] + q[2];
      let visible;
      if (occlusion) {
        const mx = (p[0] + q[0]) / 2 - gx, my = (p[1] + q[1]) / 2 - gy;
        visible = z >= 0 || mx * mx + my * my > rs * rs;
      } else visible = z >= 0;
      const path = visible ? front : back;
      path.moveTo(p[0], p[1]);
      path.lineTo(q[0], q[1]);
    }
    ctx.lineWidth = w;
    if (aBack > 0.003) { ctx.strokeStyle = col(aBack); ctx.stroke(back); }
    if (aFront > 0.003) { ctx.strokeStyle = col(aFront); ctx.stroke(front); }
  }

  function orbitPoint(o, theta, t) {
    const x = Math.cos(theta) * o.r, z0 = Math.sin(theta) * o.r;
    const y = -z0 * Math.sin(o.inc), z = z0 * Math.cos(o.inc);
    const n = o.node + t * o.prec;
    return cam(x * Math.cos(n) + z * Math.sin(n), y, -x * Math.sin(n) + z * Math.cos(n));
  }

  return {
    label: 'ORBIT',
    readyAt: 3.5,
    titleAt: 2.1,
    layout() {
      R0 = 182 * S;
      const wh = makeWhale(0, 0, 240, 1.4);
      whaleUnit = wh.polys.map((poly) => poly.map(([x, y]) => latlon(-(y / 120) * 0.64, L0 + (x / (wh.width / 2)) * 0.92)));
      whaleTotal = wh.total;
    },
    readout: () => {
      const lon = ((((yawNow * 180) / Math.PI) % 360) + 360) % 360;
      return `LON ${lon.toFixed(1).padStart(5, '0')}°\nLAT ${((scanLat * 180) / Math.PI).toFixed(1).padStart(5, ' ')}°`;
    },
    frame(t, ex, ek) {
      const fade = 1 - seg(ex, 0, 0.55);
      const cx = lerp(CX, HX, ek), cy = lerp(CY, HY, ek);
      const silR = lerp(R0 * SIL, SPIN_R, ek);      // silhouette lands exactly on the spinner track
      const yaw = yawAt(t) + 7 * ek * ek;            // spins up as it collapses
      yawNow = yaw;
      setView(yaw, -0.42 + 0.06 * Math.sin(t * 0.5), cx, cy, silR / SIL);

      // centre point, silhouette sweep
      dot(cx, cy, 2 * S, 0.9 * seg(t, 0, 0.25) * (1 - seg(t, 0.6, 1.0)));
      {
        const k = exiting ? 1 : inOutSine(seg(t, 0.08, 0.85));
        arc(cx, cy, rs, -Math.PI / 2, k * TAU, lerp(0.5, RING_ALPHA, ek), lerp(1, 2, ek));
        // outer bezel with longitude ticks counter-rotating
        const tk = seg(t, 0.6, 1.4) * fade;
        const n = Math.floor(120 * tk);
        for (let i = 0; i < n; i++) {
          const ang = -yaw * 0.25 + (i / 120) * TAU;
          const major = i % 10 === 0;
          const r1 = rs + 14 * S, r2 = r1 + (major ? 8 : 3) * S;
          line(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1, cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2, (major ? 0.32 : 0.14) * fade);
        }
      }

      // pole axis
      {
        const k = outCubic(seg(t, 0.5, 1.1)) * fade;
        if (k > 0) {
          const top = proj(0, -1.28, 0), bot = proj(0, 1.28, 0);
          const ctr = [cx, cy];
          line(lerp(ctr[0], top[0], k), lerp(ctr[1], top[1], k), lerp(ctr[0], bot[0], k), lerp(ctr[1], bot[1], k), 0.22);
          dot(top[0], top[1], 1.8, 0.6 * k);
          dot(bot[0], bot[1], 1.8, 0.3 * k);
        }
      }

      // meridians: great circles through the poles, each swept from the north pole
      for (let i = 0; i < MER; i++) {
        const p = inOutSine(seg(t, 0.3 + i * 0.06, 1.0 + i * 0.06));
        if (p <= 0) continue;
        const lon = (i * Math.PI) / MER;
        const n = Math.max(2, Math.round(96 * p));
        const pts = [];
        for (let j = 0; j <= n; j++) {
          const u = Math.PI / 2 + (j / 96) * TAU;
          pts.push(proj(Math.cos(u) * Math.sin(lon), -Math.sin(u), Math.cos(u) * Math.cos(lon)));
        }
        strokeSplit(pts, (i === 0 ? 0.42 : 0.26) * fade, 0.06 * fade, 1);
      }
      // parallels
      PARS.forEach((lat, j) => {
        const p = inOutSine(seg(t, 0.55 + j * 0.05, 1.15 + j * 0.05));
        if (p <= 0) return;
        const n = Math.max(2, Math.round(96 * p));
        const pts = [];
        for (let v = 0; v <= n; v++) {
          const lon = -yaw + (v / 96) * TAU;
          pts.push(proj(...latlon(lat, lon)));
        }
        strokeSplit(pts, (lat === 0 ? 0.42 : 0.24) * fade, 0.06 * fade, 1);
      });

      // the whale continent: knocked-out fill when facing us, outline traced on the sphere
      {
        const prog = inOutSine(seg(t, 1.3, 2.7));
        const wa = 1 - seg(ex, 0, 0.4);
        if (prog > 0 && wa > 0) {
          const projected = whaleUnit.map((poly) => poly.map((u) => proj(u[0], u[1], u[2])));
          const centre = proj(...latlon(0, L0));
          const face = seg(centre[2], 0.25, 0.75) * seg(t, 2.3, 3.0) * wa;
          if (face > 0) {
            const path = new Path2D();
            for (const poly of projected) {
              poly.forEach((q, i) => (i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])));
              path.closePath();
            }
            ctx.globalAlpha = face;
            ctx.fillStyle = BG;
            ctx.fill(path);
            ctx.globalAlpha = 1;
            ctx.fillStyle = col(0.06 * face);
            ctx.fill(path);
          }
          let budget = Math.floor(whaleTotal * prog);
          ctx.lineJoin = 'round';
          for (const poly of projected) {
            if (budget <= 1) break;
            const part = poly.slice(0, Math.min(poly.length, budget));
            budget -= poly.length;
            strokeSplit(part, 0.95 * wa, 0.1 * wa, 1.3);
            if (part.length < poly.length) {
              const tip = part[part.length - 1];
              dot(tip[0], tip[1], 2.2, tip[2] >= 0 ? 0.95 : 0.25);
            }
          }
          ctx.lineJoin = 'miter';
        }
      }

      // scanning latitude ring with flaring meridian crossings
      {
        const k = seg(t, 1.9, 2.5) * fade;
        if (k > 0) {
          scanLat = Math.sin(t * 0.85 - 1.7) * 1.15;
          const pts = [];
          for (let v = 0; v <= 96; v++) pts.push(proj(...latlon(scanLat, (v / 96) * TAU)));
          strokeSplit(pts, 0.75 * k, 0.12 * k, 1.2);
          for (let i = 0; i < MER * 2; i++) {
            const q = proj(...latlon(scanLat, (i * Math.PI) / MER));
            if (q[2] > 0) dot(q[0], q[1], 1.7, 0.85 * k * q[2]);
          }
        }
      }

      // tilted orbits, satellites with comet tails, occluded behind the globe
      for (const o of ORBITS) {
        const k = inOutSine(seg(t, o.t0, o.t0 + 0.9));
        if (k <= 0) continue;
        const pts = [];
        const n = Math.round(160 * (exiting ? 1 : k));
        for (let i = 0; i <= n; i++) pts.push(orbitPoint(o, (i / 160) * TAU, t));
        strokeSplit(pts, 0.26 * fade, 0.05 * fade, 1, true);
        const sk = seg(t, o.t0 + 0.6, o.t0 + 1.1) * fade;
        if (sk <= 0) continue;
        for (const [ph, sp] of o.sats) {
          const th = ph + t * sp;
          const tail = [];
          for (let j = 0; j < 28; j++) tail.push(orbitPoint(o, th - Math.sign(sp) * j * 0.022, t));
          for (let j = 1; j < tail.length; j++) {
            const p = tail[j - 1], q = tail[j];
            const hidden = p[2] < 0 && Math.hypot(p[0] - gx, p[1] - gy) < rs;
            line(p[0], p[1], q[0], q[1], (hidden ? 0.15 : 0.8) * sk * (1 - j / tail.length), 1.4);
          }
          const head = tail[0];
          const hidden = head[2] < 0 && Math.hypot(head[0] - gx, head[1] - gy) < rs;
          dot(head[0], head[1], 2.4, (hidden ? 0.25 : 1) * sk);
          if (!hidden) arc(head[0], head[1], 6, 0, TAU, 0.35 * sk);
        }
      }
    },
  };
})();
