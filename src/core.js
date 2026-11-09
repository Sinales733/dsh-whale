// ===== core: shared environment for every launch scene =====================================
// A scene is { label, layout(), frame(t, ex, ek), readout(t)?, titleAt?, exitDur? }.
//   t  — seconds since the splash started
//   ex — exit progress 0→1 (0 while idle), ek — eased exit progress
// Contract: at ex = 1 a scene must leave exactly one ring of radius SPIN_R, alpha RING_ALPHA,
// width 2 at (HX, HY) — the web app's boot spinner track — and nothing else.

const WHALE_PATH = '__WHALE_PATH__';
const WB = { x: 145.4, y: 11.5, w: 23.3, h: 17.1 }; // glyph bbox in source SVG units

const params = new URLSearchParams(location.search);
const zh = (params.get('lang') || navigator.language || '').toLowerCase().startsWith('zh');
const light = params.get('theme') === 'light';
const version = params.get('v') || '';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (light) document.documentElement.classList.add('light');

const FG = light ? '15,17,21' : '249,250,251';
const BG = light ? '#ffffff' : '#151517';
const RING_ALPHA = light ? 0.1 : 0.12; // web app boot spinner track (--dsh-boot-border)
let SPIN_R = 9;                        // spinner track centre-line radius; replaced by the measured value at hand-off
const MONO = 'Consolas, "Cascadia Mono", monospace';

const STATUS = zh
  ? ['初始化运行时', '装载智能体', '建立工作区', '同步插件', '即将就绪']
  : ['Initializing runtime', 'Loading agents', 'Building workspace', 'Syncing plugins', 'Almost ready'];

const canvas = document.getElementById('fx');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const hudTL = document.getElementById('hud-tl');
const hudTR = document.getElementById('hud-tr');
const hudBL = document.getElementById('hud-bl');
const hudBR = document.getElementById('hud-br');
const titleBox = document.getElementById('title');
const titleText = document.getElementById('title-text');
const statusEl = document.getElementById('status');
const handoff = document.getElementById('handoff');

// ---------------------------------------------------------------- math
const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const outExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
const outCubic = (k) => 1 - Math.pow(1 - k, 3);
const inOutCubic = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const inOutSine = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
const smooth = (k) => k * k * (3 - 2 * k);
const fract = (v) => v - Math.floor(v);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const col = (a) => `rgba(${FG},${a < 0 ? 0 : a > 1 ? 1 : a})`;
const pad = (n, w) => String(n).padStart(w, '0');

// ---------------------------------------------------------------- layout
let W = 0, H = 0, DPR = 1, S = 1;
let CX = 0, CY = 0; // composition centre
let HX = 0, HY = 0; // hand-off centre (web app spinner)
let exiting = false;
let frameNo = 0;
let handoffSpec = null; // measurements of the main window's boot card (see boot.js)

function baseLayout() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  S = Math.max(0.6, Math.min(W / 1280, H / 820));
  CX = W / 2;
  CY = H * 0.42;
  if (!handoffSpec) {
    HX = W / 2;
    HY = H / 2 + 3;
  }
  titleBox.style.top = `${CY + 318 * S}px`;
}

// ---------------------------------------------------------------- whale glyph
let whaleSubs = null;
function whaleSubpaths() {
  if (whaleSubs) return whaleSubs;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'fixed';
  svg.style.left = '-10px';
  document.body.appendChild(svg);
  whaleSubs = (WHALE_PATH.match(/M[^M]+/g) || [WHALE_PATH]).map((d) => {
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return { el: p, len: p.getTotalLength() };
  });
  return whaleSubs;
}

/** Whale centred at (cx, cy) with the given pixel height: fill path + sampled outline polylines. */
function makeWhale(cx, cy, height, step = 1.6) {
  const k = height / WB.h;
  const ox = cx - (WB.x + WB.w / 2) * k;
  const oy = cy - (WB.y + WB.h / 2) * k;
  const fill = new Path2D();
  fill.addPath(new Path2D(WHALE_PATH), new DOMMatrix().translateSelf(ox, oy).scaleSelf(k, k));
  const polys = [];
  let total = 0;
  for (const { el, len } of whaleSubpaths()) {
    const n = Math.max(8, Math.ceil((len * k) / step));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const q = el.getPointAtLength((len * i) / n);
      pts.push([ox + q.x * k, oy + q.y * k]);
    }
    polys.push(pts);
    total += pts.length;
  }
  polys.sort((a, b) => b.length - a.length); // body first, details after
  return { cx, cy, height, width: WB.w * k, k, fill, polys, total };
}

/** Whale outline resampled to exactly N points; `breaks` holds indices that start a new subpath. */
function whaleContour(wh, N) {
  const pts = [];
  const breaks = new Set();
  let remaining = N;
  wh.polys.forEach((poly, pi) => {
    const n = pi === wh.polys.length - 1 ? remaining : Math.max(4, Math.round((N * poly.length) / wh.total));
    remaining -= n;
    if (pts.length) breaks.add(pts.length);
    for (let i = 0; i < n; i++) {
      const f = (i / Math.max(1, n - 1)) * (poly.length - 1);
      const a = Math.floor(f);
      const b = Math.min(poly.length - 1, a + 1);
      const k = f - a;
      pts.push([lerp(poly[a][0], poly[b][0], k), lerp(poly[a][1], poly[b][1], k)]);
    }
  });
  return { pts, breaks };
}

/** Rasterised whale coverage lookup in screen space (0..1), optionally blurred for soft edges. */
function whaleMask(wh, blur = 0) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(W));
  c.height = Math.max(1, Math.ceil(H));
  const o = c.getContext('2d', { willReadFrequently: true });
  if (blur) o.filter = `blur(${blur}px)`;
  o.fillStyle = '#fff';
  o.fill(wh.fill);
  const data = o.getImageData(0, 0, c.width, c.height).data;
  const w = c.width, h = c.height;
  return (x, y) => {
    const xi = x | 0, yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 0;
    return data[(yi * w + xi) * 4 + 3] / 255;
  };
}

// ---------------------------------------------------------------- primitives
function line(x1, y1, x2, y2, a, w = 1) {
  if (a <= 0.003) return;
  ctx.strokeStyle = col(a);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function arc(x, y, r, a0, sweep, a, w = 1, dash = null) {
  if (a <= 0.003 || sweep <= 0 || r <= 0) return;
  ctx.strokeStyle = col(a);
  ctx.lineWidth = w;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a0 + sweep);
  ctx.stroke();
  if (dash) ctx.setLineDash([]);
}

function dot(x, y, r, a) {
  if (a <= 0.003) return;
  ctx.fillStyle = col(a);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function text(str, x, y, a, size = 9.5, align = 'left') {
  if (a <= 0.003) return;
  ctx.font = `${size}px ${MONO}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = col(a);
  ctx.fillText(str, x, y);
}

/** Outline traced from 0..progress, with a pen tip and an optional comet running along it. */
function drawWhale(wh, { progress = 1, a = 0.9, w = 1.3, map = null, hiAt = -1, hiLen = 0.14, hiA = 0, tip = true } = {}) {
  if (!wh || a <= 0.003) return;
  const P = map || ((p) => p);
  const limit = Math.floor(wh.total * progress);
  let seen = 0;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const poly of wh.polys) {
    if (seen >= limit) break;
    const n = Math.min(poly.length, limit - seen);
    ctx.strokeStyle = col(a);
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const q = P(poly[i]);
      if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
    }
    ctx.stroke();
    if (tip && n < poly.length && n > 0) {
      const q = P(poly[n - 1]);
      dot(q[0], q[1], 2.2, a);
    }
    seen += poly.length;
  }
  if (hiAt >= 0 && hiA > 0) {
    const start = Math.floor(hiAt * wh.total);
    const len = Math.floor(hiLen * wh.total);
    let base = 0;
    for (const poly of wh.polys) {
      const s = Math.max(0, start - base);
      const e = Math.min(poly.length, start + len - base);
      for (let i = s + 1; i < e; i++) {
        const k = (i - s) / (e - s);
        const p0 = P(poly[i - 1]), p1 = P(poly[i]);
        ctx.strokeStyle = col(hiA * k);
        ctx.lineWidth = w + 0.8 * k;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }
      base += poly.length;
    }
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

/** Shared frame furniture: corner brackets. */
function drawCorners(t, ex) {
  const k = outExpo(seg(t, 0.3, 0.9));
  const m = 28, L = 18 * k;
  const a = 0.5 * (1 - seg(ex, 0, 0.55));
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    line(x, y, x + sx * L, y, a);
    line(x, y, x, y + sy * L, a);
  }
}

// The web app spinner (web-index.css `_spinner`): a 2px track with a solid progress arc on it, drawn from
// 12 o'clock clockwise by --dsh-boot-arc (72° by default), the whole thing turning once every 0.8 s.
/** canvas angle where the spinner's arc starts, now: from the measured spinner when there is one */
function spinnerAngle(t) {
  if (handoffSpec) return TAU * (handoffSpec.phase + (Date.now() - handoffSpec.at) / handoffSpec.dur) - Math.PI / 2;
  return ((t % 0.8) / 0.8) * TAU - Math.PI / 2;
}
/** the arc's sweep, in radians */
function spinnerSweep() {
  const m = handoffSpec && /([\d.]+)deg/.exec(handoffSpec.after.background || '');
  return ((m ? Number(m[1]) : 72) * Math.PI) / 180;
}
/** The spinner's arc, fading in from exit progress `from` (when no measured spinner takes over). */
function drawSpinnerHead(t, ex, from = 0.55) {
  if (ex <= from) return;
  arc(HX, HY, SPIN_R, spinnerAngle(t), spinnerSweep(), seg(ex, from, 1), 2);
}

// ---------------------------------------------------------------- title, status, hud
const TITLE = 'DEEPSEEK HARNESS';
const spans = [...TITLE].map((ch) => {
  const s = document.createElement('span');
  s.textContent = ch === ' ' ? '\u00a0' : ch;
  titleText.appendChild(s);
  return s;
});
let titleShown = false;
function showTitle() {
  titleShown = true;
  titleBox.classList.add('on');
  const mid = (spans.length - 1) / 2;
  spans.forEach((s, i) => setTimeout(() => s.classList.add('on'), 40 + Math.abs(i - mid) * 55));
}

let statusIdx = -1, statusTyped = 0, statusTimer = 0;
function tickStatus(t) {
  const idx = Math.min(STATUS.length - 1, Math.floor(Math.max(0, t - 2.2) / 2.4));
  if (idx !== statusIdx) { statusIdx = idx; statusTyped = 0; }
  const target = STATUS[statusIdx];
  if (statusTyped < target.length && t - statusTimer > 0.028) { statusTyped++; statusTimer = t; }
  const caret = Math.floor(t * 2.5) % 2 ? '▍' : ' ';
  const dots = '.'.repeat(1 + (Math.floor(t * 2) % 3)).padEnd(3, ' ');
  statusEl.textContent = target.slice(0, statusTyped) + (statusTyped < target.length ? caret : ` ${dots}`);
}

const SCENES = {};
