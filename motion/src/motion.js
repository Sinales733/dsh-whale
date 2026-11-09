// dsh-motion — livelier running indicators for the DeepSeek Harness chat.
//  1. "Deep diving" status: the built-in whale-tail loop, the three newer official loops (spin, sway, stroke)
//     and two surface loops of our own on a 3D rig of the same tail (fluke, spout), in a shuffled rotation
//     with seamless changes between them (see the whale tail section).
//  2. Tool rows: while a call runs, the 16px leading icon plays a per-variant line animation; on completion a
//     ring closes around it (ok) or breaks with a shake (error).
// build.mjs concatenates src/* into one scope: frame data (ORIG_*, OFFICIAL), rig-model.js (RIG_MODEL),
// surface.js + noto-blow*.js + surface-anims.js (sf*, SF_DEFS), tool-art.js (TOOL_ART), this file.

const NS = 'http://www.w3.org/2000/svg';
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================================ whale tail
// Everything is drawn into one canvas: the built-in and official loops as tinted 28x28 alpha frames, the
// surface loops and the transition frames as vector strokes. Loops follow each other without a visible cut:
//  * the built-in loop and the surface loops all start and end on the built-in icon's resting frame;
//  * the official loops never pass through that pose, so they are played from a hand-off frame k round to
//    k-1, and joined to the rest pose by transition frames drawn on the 3D rig (fitted to frames k-1 / k
//    with tools/fit-official.html), blended into the real frames over a few frames;
//  * between an official loop and a diving loop the hand-off happens under water: the official tail rises
//    out of / sinks into the water in its own pose, and the diving loop is left or entered while its tail
//    is fully submerged (its water keeps rippling on after the cut).
const OFF_NAMES = ['spin', 'sway', 'stroke'];
const SURF_NAMES = Object.keys(SF_DEFS);                     // fluke, spout
const POOL = ['original', ...OFF_NAMES, ...SURF_NAMES];
const ORIG_PERIOD = (ORIG_SEQ.length * ORIG_FRAME_MS) / 1000;
const OFF_PERIOD = 4.2;                                      // official loops retimed to the surface loops' pace
// spin starts and ends on frame 39, one of its turning points (see SPIN_STOPS), so one pose serves both ends
const SPIN_POSE = { yaw: -0.815, pitch: -0.252, rollB: -0.027, rollT: 0.203, twist: -0.169, flexP: -0.072, dihed: 0, curl: 0.013, asym: 0.069, tx: 0.065, ty: -0.75, sx: 1.029, sy: 0.887, ang: -0.009 };
const HANDOFF = {
  sway: {
    k: 28,
    in: { yaw: -0.715, pitch: -0.521, rollB: -0.333, rollT: 0.353, twist: -0.198, flexP: 0.057, dihed: 0.086, curl: -0.015, asym: -0.169, tx: -0.051, ty: -0.017, sx: 1.082, sy: 1.076, ang: 0.043 },
    out: { yaw: -0.715, pitch: -0.521, rollB: -0.291, rollT: 0.353, twist: -0.05, flexP: 0.048, dihed: 0.086, curl: -0.062, asym: -0.096, tx: -0.023, ty: -0.017, sx: 1.065, sy: 1.076, ang: 0.043 },
  },
  stroke: {
    k: 7,
    in: { yaw: -0.815, pitch: -0.436, rollB: -0.164, rollT: 0.203, twist: -0.08, flexP: 0.029, dihed: 0.006, curl: 0.028, asym: -0.159, tx: 0.13, ty: -0.475, sx: 1.042, sy: 0.972, ang: 0 },
    out: { yaw: -0.815, pitch: -0.436, rollB: -0.12, rollT: 0.203, twist: -0.042, flexP: 0.068, dihed: 0, curl: 0.016, asym: -0.15, tx: 0, ty: -0.346, sx: 1.115, sy: 0.983, ang: 0 },
  },
  spin: { in: SPIN_POSE, out: SPIN_POSE },
};
// Spin: the official frames with their motion-blur trails taken out, in their own order. The official spin
// turns one whole turn, comes round to face front and turns back the other way, every 22 frames: frames 17,
// 39, 61 and 83 are those turning points (no trails, and the frames around each mirror each other). Each turn
// is played on an ease-in-out curve: quick through the middle, slowing right down into every change of
// direction and picking up again out of it, never standing still. Frame numbers past 86 wrap round; frame 39
// faces the way the icon rests.
const SPIN_STOPS = [39, 61, 83, 104, 126];
const SPIN_TURN = 0.9 / 0.7;                                 // seconds per turn (0.7x of 0.9 s)
const SPIN_PERIOD = SPIN_TURN * (SPIN_STOPS.length - 1);
const spinEase = (u) => (1 - Math.cos(Math.PI * u)) / 2;    // sine in-out: slows into a turn, never lingers
/** spin frame (fractional) at phase t, wrapping round the loop */
function spinFrameAt(t) {
  const P = SPIN_PERIOD;
  t = ((t % P) + P) % P;
  const i = Math.min(SPIN_STOPS.length - 2, Math.floor(t / SPIN_TURN));
  const u = (t - i * SPIN_TURN) / SPIN_TURN;
  return SPIN_STOPS[i] + (SPIN_STOPS[i + 1] - SPIN_STOPS[i]) * spinEase(u);
}
const offPeriod = (n) => (n === 'spin' ? SPIN_PERIOD : OFF_PERIOD);
const DIVE_CUT = { fluke: 3.3, spout: 3.12 };     // the tail is fully under water here (hand-off out)
const DIVE_ENTER = { fluke: 3.3, spout: 0.98 };   // and here (hand-off in, after an official loop sank)
const isOff = (n) => OFF_NAMES.includes(n);
const isDive = (n) => n in DIVE_CUT;

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

// Canvas: 1.75 px per viewBox unit (the 28 px frames' density); the 16-unit icon box sits on whole pixels
// at (10, 10), so frames are drawn 1:1, with 40/7 units of room on every side for water and blows.
const CV_K = 1.75, CV_PAD = 40 / 7, CV_BOX = 10, CV_SIZE = 48;
const WATER_PX = SF_WATER * CV_K;                // the waterline, in box pixels
const FADE = 0.1;                                // rig ↔ real frames blend at a hand-off
const RISE = 0.62, SINK = 0.5, DEPTH = 13.2;     // an official tail rising out of / sinking into the water
const RIG_DUR = 0.46;                            // a transition on the rig (rest ↔ hand-off pose)
// The official loops come from a video in which the tail is drawn about 1/7 smaller than the built-in icon
// and its cut sits 1-2 px above the waterline. Each is scaled up about the icon's base and moved down to
// match the built-in resting frame (fitted with test/size-check.html; canvas px), then cut at the waterline.
const OFF_FIT = {
  spin: { s: 1.17, x: -0.5, y: 2.5 },
  sway: { s: 1.14, x: -0.25, y: 2 },
  stroke: { s: 1.14, x: -0.125, y: 2 },
};
const FIT_AX = CV_BOX + RIG_MODEL.base[0] * CV_K, FIT_AY = CV_BOX + WATER_PX;
const smoother = (k) => k * k * k * (k * (k * 6 - 15) + 10);

let IMGS = null;
function frameImages() {
  if (IMGS) return IMGS;
  const mk = (src) => { const im = new Image(); im.src = src; if (im.decode) im.decode().catch(() => {}); return im; };
  IMGS = { original: ORIG_FRAMES.map(mk) };
  for (const n of OFF_NAMES) IMGS[n] = OFFICIAL[n].frames.map(mk);
  // spin's frames keep only their solid line: the faint motion-blur trails are dropped
  IMGS.spin = IMGS.spin.map((im) => {
    const c = document.createElement('canvas');
    c.width = c.height = 28;
    c.ready = false;
    const clean = () => {
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, 28, 28);
      for (let i = 3; i < d.data.length; i += 4) {
        const k = sfClamp((d.data[i] / 255 - 0.38) / 0.24);
        d.data[i] = Math.round(255 * k * k * (3 - 2 * k));
      }
      x.putImageData(d, 0, 0);
      c.ready = true;
    };
    if (im.complete && im.naturalWidth) clean(); else im.addEventListener('load', clean, { once: true });
    return c;
  });
  return IMGS;
}

/**
 * @param only - pin one loop by name
 * @param perTurn - keep one randomly chosen loop for the whole appearance instead of switching each loop
 * @param order - (tests) play these loops in this order, round and round
 */
function createWhale(only, perTurn = false, order = null) {
  const el = document.createElement('span');
  el.className = 'dshm-whale';
  el.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.className = 'dshm-cv';
  canvas.width = canvas.height = CV_SIZE;
  const ctx = canvas.getContext('2d');
  el.append(canvas);
  const imgs = frameImages();
  const scratch = () => { const c = document.createElement('canvas'); c.width = c.height = 28; return c; };
  const sA = scratch(), sB = scratch(), sM = scratch();
  const xA = sA.getContext('2d'), xB = sB.getContext('2d'), xM = sM.getContext('2d');

  let pick;
  if (order) { let i = 0; pick = () => order[i++ % order.length]; }
  else if (only) pick = () => only;
  else if (perTurn) { const one = sharedBag(); pick = () => one; }
  else pick = createBag('original');
  let color = '', colorAt = -1;

  // ---------------------------------------------------------------- drawing
  /** a 28x28 alpha frame filled with the current colour; the official frames are stacked twice, since they
   *  came out of a video lighter than the built-in frames */
  function tint(x, img, boost) {
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    x.clearRect(0, 0, 28, 28);
    if (!img || (img.getContext ? !img.ready : !img.complete || !img.naturalWidth)) return false;
    x.drawImage(img, 0, 0);
    if (boost) x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, 28, 28);
    x.globalCompositeOperation = 'source-over';
    return true;
  }
  /** a frame, or a blend of two neighbouring frames, into the box; fit (OFF_FIT) scales and moves an official
   *  frame onto the built-in icon's size, dy (viewBox units) moves it down, and then whatever falls below the
   *  waterline is cut away */
  function drawFrames(imgA, imgB, w, alpha, boost, dy = 0, fit = null) {
    if (alpha <= 0.002 || !tint(xA, imgA, boost)) return;
    let src = sA;
    if (imgB && w > 0.01 && tint(xB, imgB, boost)) {
      xM.globalCompositeOperation = 'source-over';
      xM.globalAlpha = 1;
      xM.clearRect(0, 0, 28, 28);
      xM.globalAlpha = 1 - w;
      xM.drawImage(sA, 0, 0);
      xM.globalCompositeOperation = 'lighter';
      xM.globalAlpha = w;
      xM.drawImage(sB, 0, 0);
      xM.globalCompositeOperation = 'source-over';
      xM.globalAlpha = 1;
      src = sM;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (dy || fit) { ctx.beginPath(); ctx.rect(0, 0, CV_SIZE, CV_BOX + WATER_PX); ctx.clip(); }
    ctx.globalAlpha = alpha;
    if (fit) ctx.setTransform(fit.s, 0, 0, fit.s, FIT_AX + fit.x - fit.s * FIT_AX, FIT_AY + fit.y - fit.s * FIT_AY + dy * CV_K);
    else ctx.translate(0, dy * CV_K);
    ctx.drawImage(src, CV_BOX, CV_BOX);
    ctx.restore();
  }
  const restImg = () => imgs.original[ORIG_SEQ[0]];
  const drawRest = (alpha) => drawFrames(restImg(), null, 0, alpha, false);
  /** official loop n at phase t (seconds; 0 = frame k; wraps round the loop). Sway and stroke are retimed with
   *  neighbouring frames blended; spin shows whole frames along its rhythm (no blending: no trails). */
  function drawOfficial(n, t, alpha, dy = 0) {
    const S = OFFICIAL[n], N = S.seq.length;
    const at = (i) => imgs[n][S.seq[((i % N) + N) % N]];
    if (n === 'spin') {
      // between two frames, a short cross-fade (only around the half-way mark, so no double image lingers)
      const f = spinFrameAt(t), i = Math.floor(f), w = sfClamp((f - i - 0.42) / 0.16);
      drawFrames(at(i), at(i + 1), w * w * (3 - 2 * w), alpha, false, dy, OFF_FIT.spin);
      return;
    }
    const f = HANDOFF[n].k + (t * N) / OFF_PERIOD;
    const i0 = Math.floor(f);
    drawFrames(at(i0), at(i0 + 1), f - i0, alpha, true, dy, OFF_FIT[n]);
  }
  function inBox(fn) {
    ctx.save();
    ctx.setTransform(CV_K, 0, 0, CV_K, CV_PAD * CV_K, CV_PAD * CV_K);
    fn();
    ctx.restore();
  }
  /** a surface frame; tailAlpha fades only the whale (water stays) */
  function drawSurf(fr, tailAlpha = 1) {
    inBox(() => {
      if (tailAlpha >= 0.999) { sfDraw(ctx, fr, color); return; }
      const only = Object.assign(sfEmptyFrame(), { tail: fr.tail, ghosts: fr.ghosts });
      fr.tail = null;
      fr.ghosts = [];
      sfDraw(ctx, fr, color);
      if (only.tail && tailAlpha > 0.002) sfDraw(ctx, only, color, tailAlpha);
    });
  }
  /** a rig pose, with afterimages where it moves fast (prevPoses: the poses 1, 2, 3 steps earlier) */
  function drawPose(pose, prevPoses, alpha) {
    if (alpha <= 0.002) return;
    const pts = sfProject(pose);
    const fr = Object.assign(sfEmptyFrame(), { tail: sfPath(pts) });
    sfGhosts(fr, pts, prevPoses.map(sfProject));
    inBox(() => sfDraw(ctx, fr, color, alpha));
  }
  /** rings where a tail breaks or closes the surface */
  function rings(t, t0, size = 1) {
    const fr = sfEmptyFrame();
    sfRipple(fr, t, t0, 0.85, 7.4, 1.6 * size, 6.5 * size, 0.6, 0.2);
    sfRipple(fr, t, t0 + 0.14, 0.7, 7.4, 1.0 * size, 4.2 * size, 0.4, 0.22);
    drawSurf(fr);
  }

  // ---------------------------------------------------------------- transition frames (3D rig)
  const REST = sfRestPose();
  // the fitted poses were fitted to the official frames as they came; move them with the frames (OFF_FIT:
  // scaled about the base, which is where the rig's pose scale and offset apply)
  const FITTED = {};
  for (const n of OFF_NAMES) {
    const { s, x, y } = OFF_FIT[n];
    const fitted = (F) => Object.assign({}, F, { sx: F.sx * s, sy: F.sy * s, tx: F.tx * s + x / CV_K, ty: F.ty * s + y / CV_K });
    FITTED[n] = { in: fitted(HANDOFF[n].in), out: fitted(HANDOFF[n].out) };
  }
  /** the rig between the resting pose and official loop n: dir 'in' (rest → frame k) or 'out'
   *  (frame k-1 → rest); u 0..1 */
  function handoffPose(n, dir, u) {
    const F = FITTED[n][dir];
    const k = dir === 'in' ? smoother(u) : 1 - smoother(u);          // 0 = resting, 1 = fitted pose
    const p = Object.assign({}, REST);
    for (const key in F) p[key] = REST[key] + (F[key] - REST[key]) * k;
    return p;
  }
  function rigClip(n, dir) {
    return {
      dur: RIG_DUR,
      kind: `rig-${dir}:${n}`,
      draw(t) {
        const u = sfClamp(t / RIG_DUR);
        const prev = [1, 2, 3].map((i) => handoffPose(n, dir, sfClamp((t - i * 0.024) / RIG_DUR)));
        // at the resting end, blend with the built-in resting frame, so the cut is the same pixels both sides
        const restSide = dir === 'in' ? 1 - sfClamp((t - 0.02) / 0.08) : sfClamp((t - RIG_DUR + 0.1) / 0.08);
        if (restSide > 0) drawRest(restSide);
        drawPose(handoffPose(n, dir, u), prev, 1 - restSide);
      },
    };
  }

  // ---------------------------------------------------------------- clips
  function origClip() {
    return {
      dur: ORIG_PERIOD,
      kind: 'original',
      draw(t) { drawFrames(imgs.original[ORIG_SEQ[Math.min(ORIG_SEQ.length - 1, Math.floor((t * 1000) / ORIG_FRAME_MS))]], null, 0, 1, false); },
    };
  }
  /** official loop n from phase p0 for dur seconds. fadeIn / fadeOut: blend from / into the rig's fitted pose;
   *  rise / sink: come up out of / go down into the water while playing */
  function offClip(n, p0, dur, o = {}) {
    // where the tail breaks / closes the surface: rings, which spread on after the clip is over
    const ringAt = o.rise ? 0.04 : dur * 0.55, ringSize = o.rise ? 1 : 0.9;
    return {
      dur,
      kind: `${o.rise ? 'rise' : o.sink ? 'sink' : 'loop'}:${n}`,
      draw(t) {
        let dy = 0;
        if (o.rise) dy = DEPTH * (1 - sfEaseOut3(sfClamp(t / dur)));
        if (o.sink) { const u = sfClamp(t / dur); dy = DEPTH * u * u; }
        if (o.rise || o.sink) rings(t, ringAt, ringSize);
        let a = 1;
        if (o.fadeIn && t < FADE) { a = t / FADE; drawPose(handoffPose(n, 'in', 1), [], 1 - a); }
        if (o.fadeOut && t > dur - FADE) { a = (dur - t) / FADE; drawPose(handoffPose(n, 'out', 0), [], 1 - a); }
        drawOfficial(n, p0 + t, a, dy);
      },
      after: o.rise || o.sink ? (start) => overlays.push({ start, dur: 1.1, draw: (t) => rings(dur + t, ringAt, ringSize) }) : null,
    };
  }
  /** surface loop n from t0 to t1 (its own clock). A resting end blends with the built-in resting frame;
   *  a loop cut off under water (o.cut) leaves its water rippling on as an overlay. */
  function surfClip(n, t0, t1, o = {}) {
    const P = SF_DEFS[n].period;
    return {
      dur: t1 - t0,
      kind: `surf:${n}:${t0}-${t1}`,
      draw(t) {
        const lt = t0 + t;
        let tailA = 1;
        // (the first and last few hundredths of a second are the built-in frame alone)
        if (t0 === 0 && lt < 0.24) { const k = sfClamp((lt - 0.03) / 0.2); drawRest(1 - k); tailA = k; }
        if (t1 >= P - 1e-6 && lt > P - 0.24) { const k = sfClamp((P - lt - 0.03) / 0.2); drawRest(1 - k); tailA = Math.min(tailA, k); }
        drawSurf(sfFrame(n, lt, { fxMin: o.fxMin }), tailA);
      },
      after: o.cut ? (start) => overlays.push({ start, dur: 1.4, draw: (t) => drawSurf(sfFrame(n, t1 + t, { noTail: true, fxMax: t1 })) }) : null,
    };
  }

  /** the clips that play loop `cur`, given the loops before and after it */
  function buildLoop(prev, cur, next) {
    if (cur === 'original') return [origClip()];
    const out = [];
    if (isOff(cur)) {
      const again = prev === cur, more = next === cur;            // the same loop again: just keep playing
      if (!again) out.push(isDive(prev) ? offClip(cur, -RISE, RISE, { rise: true }) : rigClip(cur, 'in'));
      out.push(offClip(cur, 0, offPeriod(cur), { fadeIn: !again && !isDive(prev), fadeOut: !more && !isDive(next) }));
      if (!more) out.push(isDive(next) ? offClip(cur, offPeriod(cur), SINK, { sink: true }) : rigClip(cur, 'out'));
      return out;
    }
    // a diving loop
    const P = SF_DEFS[cur].period;
    let t0 = 0;
    if (isOff(prev)) {
      // the official loop has just sunk: come in from under water (fluke rises to rest first, spout starts
      // where its own tail is already down)
      if (cur === 'fluke') out.push(surfClip('fluke', DIVE_ENTER.fluke, P, { fxMin: DIVE_ENTER.fluke }));
      else t0 = DIVE_ENTER[cur];
    }
    const t1 = isOff(next) ? DIVE_CUT[cur] : P;
    out.push(surfClip(cur, t0, t1, { fxMin: t0 > 0 ? t0 : undefined, cut: t1 < P }));
    return out;
  }

  // ---------------------------------------------------------------- player
  let queue = [], clip = null, clipStart = 0, overlays = [];
  let prevName = null, nextName = null;
  function enqueueLoop() {
    const cur = nextName || pick();
    nextName = pick();
    queue.push(...buildLoop(prevName, cur, nextName));
    prevName = cur;
  }

  function render(nowS) {
    if (nowS - colorAt > 0.5 || colorAt < 0) { color = getComputedStyle(el).color; colorAt = nowS; }
    if (!clip) { if (!queue.length) enqueueLoop(); clip = queue.shift(); clipStart = nowS; }
    for (let guard = 0; nowS - clipStart >= clip.dur && guard < 50; guard++) {
      clipStart += clip.dur;
      if (clip.after) clip.after(clipStart);
      if (!queue.length) enqueueLoop();
      clip = queue.shift();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CV_SIZE, CV_SIZE);
    overlays = overlays.filter((ov) => nowS - ov.start < ov.dur);
    for (const ov of overlays) ov.draw(nowS - ov.start);
    clip.draw(nowS - clipStart);
  }

  function still() {
    color = getComputedStyle(el).color;
    const img = restImg();
    const paint = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, CV_SIZE, CV_SIZE); drawRest(1); };
    if (img.complete) paint(); else img.addEventListener('load', paint, { once: true });
  }
  return { el, render, still, state: () => ({ clip: clip && clip.kind, clipStart, prevName, nextName }) };
}

// ============================================================================ runtime
const CSS = `
[data-chat-running] [class*="runningIcon"]{overflow:visible!important;contain:none!important}
[data-chat-running] [class*="runningIcon"]>[class*="runningWhale"]{display:none!important}
.dshm-whale{position:absolute;inset:0;pointer-events:none}
.dshm-cv{position:absolute;left:-35.7143%;top:-35.7143%;width:171.4286%;height:171.4286%}
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
// for the test pages
exports.createWhale = createWhale;
exports.whaleImages = frameImages;
