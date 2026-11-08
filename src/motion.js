// dsh-motion — livelier running indicators for the DeepSeek Harness chat.
//  1. "Deep diving" status: the built-in whale-tail animation stays, joined by the three newer official
//     loops (spin, sway, stroke) and two surface loops of our own drawn on a 3D rig of the same tail
//     (fluke: a fluke-up dive; spout: the head surfaces and blows). The icon's flat cut is the waterline,
//     so the whale only ever shows above the water. A shuffled rotation picks one per loop (or one per turn).
//  2. Tool rows: while a call runs, its 16px leading icon is replaced by a per-variant line
//     animation; on completion a ring closes around the icon (ok) or breaks with a shake (error).
// Built from: orig-frames.js, official-frames.js (OFFICIAL), rig-model.js + rig.js + surface.js + surface-anims.js (SURF),
// tool-art.js (TOOL_ART), this file.

const NS = 'http://www.w3.org/2000/svg';
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================================ whale tail
// Frame-sequence loops (28x28 alpha masks), shown through one masked span like the built-in icon.
const SEQS = {
  original: { frames: ORIG_FRAMES, seq: ORIG_SEQ, frameMs: ORIG_FRAME_MS },
  spin: OFFICIAL.spin,
  sway: OFFICIAL.sway,
  stroke: OFFICIAL.stroke,
};
const SURF_NAMES = Object.keys(SURF.SF_DEFS);               // fluke, spout
const POOL = ['original', 'spin', 'sway', 'stroke', ...SURF_NAMES];
const periodOf = (name) => (SEQS[name] ? (SEQS[name].seq.length * SEQS[name].frameMs) / 1000 : SURF.SF_DEFS[name].period);

/** Shuffle-bag order: every loop plays once per round, never the same one twice in a row. */
function createBag(first) {
  let bag = [];
  let last = null;
  return () => {
    if (first) { last = first; first = null; return last; }
    if (!bag.length) {
      bag = POOL.slice();
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag[bag.length - 1] === last) bag.unshift(bag.pop());
    }
    last = bag.pop();
    return last;
  };
}
const sharedBag = createBag(null);

// The surface loops are rasterised like the masks: a 2x canvas (1.75 px per viewBox unit, the same density
// as the 28 px official frames) that reaches 6 units past every edge for blows, splashes and drops.
const CV_PAD = 6, CV_K = 1.75, CV_SIZE = Math.round((16 + 2 * CV_PAD) * CV_K);

/**
 * @param only - pin one loop by name
 * @param perTurn - keep one randomly chosen loop for the whole appearance instead of switching each loop
 */
function createWhale(only, perTurn = false) {
  const el = document.createElement('span');
  el.className = 'dshm-whale';
  el.setAttribute('aria-hidden', 'true');
  const mask = document.createElement('span');
  mask.className = 'dshm-orig';
  const canvas = document.createElement('canvas');
  canvas.className = 'dshm-rig';
  canvas.width = canvas.height = CV_SIZE;
  const ctx = canvas.getContext('2d');
  el.append(mask, canvas);

  let next;
  if (only) next = () => only;
  else if (perTurn) { const pick = sharedBag(); next = () => pick; }
  else next = createBag('original');
  let name = null, start = 0, lastFrame = null, color = '', colorAt = -1;

  function show(n) {
    name = n;
    const seq = !!SEQS[n];
    mask.style.display = seq ? '' : 'none';
    canvas.style.display = seq ? 'none' : '';
    lastFrame = null;
  }

  function draw(fr, nowS) {
    if (nowS - colorAt > 0.5 || colorAt < 0) { color = getComputedStyle(el).color; colorAt = nowS; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CV_SIZE, CV_SIZE);
    ctx.setTransform(CV_K, 0, 0, CV_K, CV_PAD * CV_K, CV_PAD * CV_K);
    SURF.sfDraw(ctx, fr, color);
  }

  function render(nowS) {
    if (name === null) { show(next()); start = nowS; }
    while (nowS - start >= periodOf(name)) { start += periodOf(name); show(next()); }
    const t = nowS - start;
    const S = SEQS[name];
    if (S) {
      const src = S.frames[S.seq[Math.min(S.seq.length - 1, Math.floor((t * 1000) / S.frameMs))]];
      if (src !== lastFrame) { lastFrame = src; mask.style.setProperty('--dshm-frame', `url("${src}")`); }
      return;
    }
    draw(SURF.sfFrame(name, t), nowS);
  }

  function still() {
    show('original');
    mask.style.setProperty('--dshm-frame', `url("${ORIG_FRAMES[ORIG_SEQ[0]]}")`);
  }
  return { el, render, still };
}

// ============================================================================ runtime
const CSS = `
[data-chat-running] [class*="runningIcon"]{overflow:visible!important;contain:none!important}
[data-chat-running] [class*="runningIcon"]>[class*="runningWhale"]{display:none!important}
.dshm-whale{position:absolute;inset:0;pointer-events:none}
.dshm-rig{position:absolute;left:-37.5%;top:-37.5%;width:175%;height:175%}
.dshm-orig{position:absolute;inset:0;background:currentColor;-webkit-mask:var(--dshm-frame) 50%/100% 100% no-repeat;mask:var(--dshm-frame) 50%/100% 100% no-repeat alpha}
.dshm-lead{position:relative}
.dshm-lead.dshm-active>:not(.dshm-tool){opacity:0}
.dshm-tool{position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;overflow:visible;pointer-events:none;color:inherit}
[data-disclosure-row]:hover .dshm-lead.dshm-active>:not(.dshm-tool),
[data-disclosure-row][aria-expanded="true"] .dshm-lead.dshm-active>:not(.dshm-tool){opacity:1}
[data-disclosure-row]:hover .dshm-tool,[data-disclosure-row][aria-expanded="true"] .dshm-tool{opacity:0}
.dshm-ring{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;overflow:visible;pointer-events:none}
.dshm-ring circle{fill:none;stroke:currentColor;stroke-width:1;stroke-linecap:round}
.dshm-done .dshm-ring circle{stroke-dasharray:63;stroke-dashoffset:63;transform:rotate(-90deg);transform-origin:11px 11px;animation:dshm-close .42s cubic-bezier(.3,0,.2,1) forwards,dshm-fade .32s .48s ease forwards}
.dshm-done>:not(.dshm-ring){animation:dshm-pop .5s cubic-bezier(.3,1.6,.5,1)}
.dshm-fail{animation:dshm-shake .42s cubic-bezier(.36,.07,.19,.97)}
.dshm-fail .dshm-ring{color:var(--dsw-alias-state-error-primary,#e5484d)}
.dshm-fail .dshm-ring circle{stroke-dasharray:4 3;animation:dshm-burst .6s ease-out forwards}
@keyframes dshm-close{to{stroke-dashoffset:0}}
@keyframes dshm-fade{to{opacity:0}}
@keyframes dshm-pop{0%{transform:scale(.55)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes dshm-shake{20%,60%{transform:translateX(-2px)}40%,80%{transform:translateX(2px)}}
@keyframes dshm-burst{0%{transform:scale(.7) rotate(0);transform-origin:11px 11px;opacity:1}100%{transform:scale(1.25) rotate(40deg);transform-origin:11px 11px;opacity:0}}
@media (prefers-reduced-motion:reduce){.dshm-done>*,.dshm-fail,.dshm-ring circle{animation:none!important}}
`;

const ACTIVE_STATES = new Set(['running', 'preparing']);

function createMotion(options = {}) {
  let style = null;
  let observer = null;
  let raf = 0;
  let scanQueued = false;
  let disposed = false;
  const reduced = reducedMotion();
  const only = POOL.includes(options.whale) ? options.whale : null;
  const perTurn = options.whaleMode === 'turn';
  const tails = new Map();     // running-status icon element → whale controller
  const tools = new Map();     // tool row root → { lead, svg, variant, t0 }
  const lastState = new WeakMap();

  function leadOf(row) {
    return row.querySelector('[data-disclosure-row] [class*="leading"]');
  }

  function startTool(row) {
    const lead = leadOf(row);
    if (!lead) return;
    const variant = TOOL_ART[row.getAttribute('data-variant')] ? row.getAttribute('data-variant') : 'others';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'dshm-tool');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    lead.classList.add('dshm-lead', 'dshm-active');
    lead.appendChild(svg);
    tools.set(row, { lead, svg, variant, t0: performance.now() });
    svg.innerHTML = TOOL_ART[variant](reduced ? 0.4 : 0);
  }

  function stopTool(row, outcome) {
    const entry = tools.get(row);
    tools.delete(row);
    const lead = entry ? entry.lead : leadOf(row);
    if (entry) {
      entry.svg.remove();
      lead.classList.remove('dshm-active');
    }
    if (!lead || !lead.isConnected || reduced) return;
    if (outcome !== 'ok' && outcome !== 'error') return;
    lead.classList.add('dshm-lead');
    const ring = document.createElementNS(NS, 'svg');
    ring.setAttribute('class', 'dshm-ring');
    ring.setAttribute('viewBox', '0 0 22 22');
    ring.setAttribute('aria-hidden', 'true');
    ring.innerHTML = '<circle cx="11" cy="11" r="10"/>';
    lead.appendChild(ring);
    const cls = outcome === 'ok' ? 'dshm-done' : 'dshm-fail';
    lead.classList.add(cls);
    setTimeout(() => {
      ring.remove();
      lead.classList.remove(cls);
    }, 900);
  }

  function scan() {
    scanQueued = false;
    if (disposed) return;
    for (const host of document.querySelectorAll('[data-chat-running] [class*="runningIcon"]')) {
      if (tails.has(host)) continue;
      const whale = createWhale(only, perTurn);
      host.appendChild(whale.el);
      if (reduced) whale.still(); else whale.render(performance.now() / 1000);
      tails.set(host, whale);
    }
    for (const [host, whale] of tails) {
      if (!host.isConnected || !whale.el.isConnected) { whale.el.remove(); tails.delete(host); }
    }
    for (const row of document.querySelectorAll('[data-tool][data-state]')) {
      const state = row.getAttribute('data-state');
      const prev = lastState.get(row);
      if (prev === state) continue;
      lastState.set(row, state);
      if (ACTIVE_STATES.has(state)) { if (!tools.has(row)) startTool(row); }
      else if (prev !== undefined && ACTIVE_STATES.has(prev)) stopTool(row, state);
    }
    for (const [row, entry] of tools) {
      if (!row.isConnected) tools.delete(row);
      else if (!entry.svg.isConnected) { tools.delete(row); lastState.delete(row); }
    }
    if (!reduced && (tails.size || tools.size) && !raf) raf = requestAnimationFrame(frame);
  }

  function queueScan() {
    if (scanQueued || disposed) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }

  function frame(now) {
    raf = 0;
    if (disposed) return;
    for (const whale of tails.values()) whale.render(now / 1000);
    for (const entry of tools.values()) entry.svg.innerHTML = TOOL_ART[entry.variant]((now - entry.t0) / 1000);
    if (tails.size || tools.size) raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      style = document.createElement('style');
      style.dataset.plugin = 'dsh-motion';
      style.textContent = CSS;
      document.head.appendChild(style);
      observer = new MutationObserver(queueScan);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state', 'data-chat-running'] });
      queueScan();
    },
    stop() {
      disposed = true;
      observer?.disconnect();
      cancelAnimationFrame(raf);
      for (const whale of tails.values()) whale.el.remove();
      for (const entry of tools.values()) { entry.svg.remove(); entry.lead.classList.remove('dshm-active', 'dshm-lead'); }
      document.querySelectorAll('.dshm-ring').forEach((e) => e.remove());
      document.querySelectorAll('.dshm-lead').forEach((e) => e.classList.remove('dshm-lead', 'dshm-done', 'dshm-fail', 'dshm-active'));
      tails.clear();
      tools.clear();
      style?.remove();
    },
  };
}

/**
 * Client plugin entry.
 * @param ctx - browser plugin context; the effect disposer removes every injected node.
 * @param config - optional { whale: name } to pin one loop, { whaleMode: 'turn' } to keep one loop per appearance.
 */
function apply(ctx, config) {
  const motion = createMotion(config || {});
  motion.start();
  ctx.effect(() => () => motion.stop());
}

exports.apply = apply;
exports.createMotion = createMotion;
exports.createWhale = createWhale;
exports.TOOL_ART = TOOL_ART;
exports.SURF = SURF;



