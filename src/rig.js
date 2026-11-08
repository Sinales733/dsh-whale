// 3D whale-tail rig. RIG_MODEL (rig-model.js) holds the built-in outline lifted into 3D: 46 cubic
// control points of a mirror-symmetric tail (x span, y down, z depth) whose rest pose projects exactly
// onto the original 2D icon. Poses rotate / bend / flex that model and project it orthographically.

const RIG_TAU = Math.PI * 2;

/** Default pose = the original icon. All angles in radians, lengths in 16-unit viewBox units. */
function restPose() {
  const r = RIG_MODEL.rest;
  return {
    yaw: r.yaw, pitch: r.pitch, rollB: r.rollB, rollT: r.rollT,
    twist: 0,        // extra yaw at the flukes relative to the base (stock twists like a rope)
    flexP: 0,        // flukes pitch about their span axis (fluke stroke)
    dihed: 0,        // flukes fold toward (+) / away from (−) the viewer (wing dihedral)
    curl: 0,         // tips curl, grows with |x|
    tx: 0, ty: 0, sx: 1, sy: 1,
    pivotY: 0,       // squash/stretch & whole-body roll pivot height above the base (units)
    tumble: 0,       // somersault angle about a horizontal screen axis
    pivotP: 0,       // tumble pivot height (negative = above the base)
    spin: 0,         // whole-body rotation in the screen plane about the pivot
  };
}

function rigProject(pose) {
  const { base, knee, points, s } = RIG_MODEL;
  const out = new Array(points.length);
  const cP = Math.cos(pose.pitch), sP = Math.sin(pose.pitch);
  const cS = Math.cos(pose.spin), sS = Math.sin(pose.spin);
  for (let i = 0; i < points.length; i++) {
    let [x, y, z] = points[i];
    const si = s[i];
    const w = Math.min(1, Math.max(0, (si - knee[0]) / (knee[1] - knee[0])));   // stock → fluke
    const fl = Math.min(1, Math.max(0, (si - 0.42) / 0.2));                     // fluke membership
    if (fl > 0) {
      const ax = Math.min(1, Math.abs(x) / 7);
      // dihedral: each fluke hinges about a vertical line at its root
      if (pose.dihed) {
        const a = pose.dihed * fl * Math.sign(x) * Math.pow(ax, 0.5);
        const c = Math.cos(a), sn = Math.sin(a);
        const x0 = x, z0 = z;
        x = x0 * c + z0 * sn;
        z = -x0 * sn + z0 * c;
      }
      // chordwise flex: flukes pitch about the span axis through the root (y ≈ -6)
      const f = (pose.flexP + pose.curl * ax * ax) * fl;
      if (f) {
        const yr = -6.2, dy = y - yr, c = Math.cos(f), sn = Math.sin(f);
        y = yr + dy * c - z * sn;
        z = dy * sn + z * c;
      }
    }
    // yaw (with twist along the height), pitch, then roll bending from base to flukes
    const yaw = pose.yaw + pose.twist * (si - 0.8);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    let X = x * cy + z * sy, Z = -x * sy + z * cy, Y = y;
    const Y2 = Y * cP - Z * sP;
    Z = Y * sP + Z * cP; Y = Y2;
    const roll = pose.rollB + (pose.rollT - pose.rollB) * w;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    let px = X * cr - Y * sr, py = X * sr + Y * cr;
    // tumble: extra rotation about a horizontal screen axis at height pivotP (somersaults)
    if (pose.tumble) {
      const ct = Math.cos(pose.tumble), st = Math.sin(pose.tumble), dy = py - pose.pivotP;
      py = pose.pivotP + dy * ct - Z * st;
    }
    // squash / stretch and screen-plane spin about the pivot, then translate
    const pv = -pose.pivotY;
    px *= pose.sx; py = pv + (py - pv) * pose.sy;
    const qx = px * cS - (py - pv) * sS, qy = pv + px * sS + (py - pv) * cS;
    out[i] = [base[0] + qx + pose.tx, base[1] + qy + pose.ty];
  }
  return out;
}

function rigPath(pts) {
  const f = (v) => Math.round(v * 1000) / 1000;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i += 3) d += `C${f(pts[i][0])} ${f(pts[i][1])} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])} ${f(pts[i + 2][0])} ${f(pts[i + 2][1])}`;
  return d;
}

