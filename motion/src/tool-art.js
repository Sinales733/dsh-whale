// Tool-row leading-icon animations. They move the parts of the host's own icon (a clone of its <svg>), so
// size, stroke and detail are exactly DSH's. Every motion is scaled by an amplitude a (0..1): it eases in
// from the still icon when the call starts and eases back to the still icon when it ends.
// Each mover gets the clone's elements (in document order), the time t (s) and a; it sets attributes.
const TA_TAU = Math.PI * 2;
const taF = (v) => Math.round(v * 1000) / 1000;
const taSet = (el, tf, op = 1) => { el.setAttribute('transform', tf); el.setAttribute('opacity', taF(op)); };
const taAbout = (x, y, s = 1, r = 0, dx = 0, dy = 0) =>
  `translate(${taF(x + dx)} ${taF(y + dy)}) rotate(${taF(r)}) scale(${taF(s)}) translate(${taF(-x)} ${taF(-y)})`;
const taSx = (x, y, sx) => `translate(${taF(x)} ${taF(y)}) scale(${taF(sx)} 1) translate(${taF(-x)} ${taF(-y)})`;

const TOOL_ART = {
  // [lens, handle]: the magnifier sweeps a small circle as if scanning; the lens breathes, the handle trails
  search(p, t, a) {
    if (p.length !== 2) return false;
    const w = t * 3.1, dx = 1.15 * Math.cos(w) * a, dy = 1.15 * Math.sin(w) * a;
    taSet(p[0], taAbout(6.59, 6.49, 1 + 0.05 * Math.sin(w * 2) * a, 0, dx, dy));
    taSet(p[1], taAbout(10.3, 10.39, 1, 7 * Math.sin(w - 0.7) * a, dx, dy));
  },
  // [line, short line, page]: the two text lines are read in turn (a soft highlight runs across them,
  // the short one grows as if being written), the page lifts a hair
  read(p, t, a) {
    if (p.length !== 3) return false;
    const k = (t * 0.9) % 1;
    const lit = (c) => Math.exp(-(((k - c) / 0.22) ** 2)) + Math.exp(-(((k - c + 1) / 0.22) ** 2));
    taSet(p[0], '', 1 - a * 0.55 * (1 - lit(0.3)));
    taSet(p[1], taSx(4.94, 9.03, 1 - a * 0.45 * (0.5 + 0.5 * Math.cos(TA_TAU * k))), 1 - a * 0.55 * (1 - lit(0.7)));
    taSet(p[2], `translate(0 ${taF(-0.35 * a * Math.sin(TA_TAU * k))})`);
  },
  // [chevron, cursor]: the prompt nudges forward on each keystroke, the cursor line breathes and stretches
  bash(p, t, a) {
    if (p.length !== 2) return false;
    const w = t * 4.2, beat = Math.pow(0.5 + 0.5 * Math.sin(w), 3);
    taSet(p[0], `translate(${taF(1.3 * beat * a)} 0)`);
    taSet(p[1], taSx(9, 12, 1 - a * 0.4 * (0.5 + 0.5 * Math.sin(w * 0.5 - 1))), 1 - a * 0.6 * (0.5 + 0.5 * Math.cos(w * 0.5)));
  },
  // [frame, pen]: the pen line writes small loops around its tip; the frame stays put
  write(p, t, a) {
    if (p.length !== 2) return false;
    const w = t * 5.2;
    const dx = (1.0 * Math.sin(w) + 0.3 * Math.sin(w * 2.1)) * a, dy = 0.75 * Math.sin(w * 2) * a;
    taSet(p[1], taAbout(7.78, 8.24, 1, 6 * Math.sin(w + 0.6) * a, dx, dy));
  },
  // [two slanted strokes, two bars]: the four strokes of # slide in a travelling wave
  code(p, t, a) {
    if (p.length !== 4) return false;
    const w = t * 3.6;
    taSet(p[0], `translate(0 ${taF(1.2 * Math.sin(w) * a)})`);
    taSet(p[1], `translate(0 ${taF(1.2 * Math.sin(w + 1.6) * a)})`);
    taSet(p[2], `translate(${taF(1.2 * Math.sin(w + 0.8) * a)} 0)`);
    taSet(p[3], `translate(${taF(1.2 * Math.sin(w + 2.4) * a)} 0)`);
  },
  // [big sparkle, top, bottom]: the big sparkle swells and turns, the small ones twinkle in turn
  others(p, t, a) {
    if (p.length !== 3) return false;
    const w = t * 3.4;
    taSet(p[0], taAbout(5.875, 8, 1 + 0.12 * Math.sin(w) * a, 14 * Math.sin(w * 0.5) * a));
    taSet(p[1], taAbout(12.375, 4.31, 1 - 0.45 * (0.5 + 0.5 * Math.sin(w * 1.3)) * a));
    taSet(p[2], taAbout(12.375, 12.44, 1 - 0.45 * (0.5 + 0.5 * Math.sin(w * 1.3 + Math.PI)) * a));
  },
};
// edit, same icon as write: the pen pushes in and pulls back along its own axis, revising, while the
// frame stretches open a touch from its far corner each time the pen draws back
TOOL_ART.edit = (p, t, a) => {
  if (p.length !== 2) return false;
  const w = t * 3.6, s = Math.sin(w), back = Math.max(0, -s);
  const along = 1.5 * s * a;
  taSet(p[1], `translate(${taF(-along * 0.707)} ${taF(along * 0.707)})`);
  taSet(p[0], taAbout(1.7, 14.3, 1 + 0.045 * back * back * a));
};

// any other icon: its parts breathe in turn about their own centres
function taGeneric(p, t, a) {
  p.forEach((el, i) => {
    let b; try { b = el.getBBox(); } catch { return; }
    taSet(el, taAbout(b.x + b.width / 2, b.y + b.height / 2, 1 + 0.08 * Math.sin(t * 3.4 - i * 0.9) * a));
  });
}

const taParts = (svg) => [...svg.querySelectorAll('path,circle,ellipse,line,polyline,polygon,rect')];
function taPose(variant, parts, t, a) {
  const f = TOOL_ART[variant];
  if (!f || f(parts, t, a) === false) taGeneric(parts, t, a);
}
