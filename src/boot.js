// ===== boot: pick a scene, run the frame loop, own the exit protocol ===========================
const SCENE_NAMES = Object.keys(SCENES);
const forced = params.get('scene');
const avoid = params.get('avoid');
const pool = SCENE_NAMES.filter((n) => n !== avoid);
const sceneName = SCENES[forced] ? forced : pool[Math.floor(Math.random() * pool.length)] || SCENE_NAMES[0];
const scene = SCENES[sceneName];
const sceneIndex = SCENE_NAMES.indexOf(sceneName);
window.__dshSplashScene = sceneName;

let t0 = 0;
let exitAt = -1;
let exitResolve = null;
const EXIT_DUR = scene.exitDur || 1.05;
// The boot card's text fades in only once the scene has collapsed onto the spinner ring (so nothing of
// the scene runs through it), and the exit is over when the text is fully in (its CSS transitions: CARD_IN).
const CARD_AT = 0.8, CARD_IN = 0.42;
let cardAt = -1;
// A scene that brings the spinner's arc in itself (scene.spinnerIn: exit progress where it lands) draws that
// arc through ex 1 and boot draws none; the DOM spinner only takes over from spinnerIn, so there are never two.
const SPIN_IN = scene.spinnerIn || 0;

function tickHud(t) {
  const ms = Math.floor(t * 1000);
  hudTL.textContent = `DSH—BOOT\n${pad(sceneIndex + 1, 2)}/${pad(SCENE_NAMES.length, 2)} ${scene.label}`;
  hudTR.textContent = `${version ? 'V ' + version.toUpperCase() : 'DEEPSEEK'}\n${pad(Math.round(W), 4)}×${pad(Math.round(H), 4)}`;
  hudBL.textContent = `T+${pad(Math.floor(ms / 1000), 2)}.${pad(ms % 1000, 3)}S\nFRAME ${pad(frameNo, 5)}`;
  hudBR.textContent = scene.readout ? scene.readout(t) : '';
}

function layout() {
  baseLayout();
  scene.layout();
}

function frame(now) {
  if (!t0) t0 = now;
  const t = (now - t0) / 1000;
  frameNo++;
  const ex = exitAt < 0 ? 0 : clamp01((t - exitAt) / EXIT_DUR);
  const ek = inOutCubic(ex);
  ctx.clearRect(0, 0, W, H);
  tintToSpinner(ex);
  drawCorners(t, ex);
  scene.frame(t, ex, ek);
  if (handoffSpec) {
    // the converged ring cross-fades into a DOM spinner that carries the main window's own CSS
    canvas.style.opacity = String(1 - seg(ex, Math.max(0.86, SPIN_IN), 0.99));
    spinEl.style.opacity = String(seg(ex, Math.max(0.78, SPIN_IN), 0.97));
  } else if (!SPIN_IN) drawSpinnerHead(t, ex, 0.55);   // a spinnerIn scene draws the arc itself through ex 1

  if (!titleShown && t > (scene.titleAt || 1.95) && !exiting) showTitle();
  if (titleShown) tickStatus(t);
  if (t > 0.3) {
    if (!hud.classList.contains('on')) hud.classList.add('on');
    tickHud(t);
  }
  if (exiting && cardAt < 0 && ex >= CARD_AT) { cardAt = t; handoff.classList.add('on'); }
  if (exiting && ex >= 1 && cardAt >= 0 && t - cardAt >= CARD_IN && exitResolve) { exitResolve(); exitResolve = null; }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- exact hand-off
// The main process measures the web app's boot card in the freshly shown main window (positions,
// computed fonts and colours, spinner geometry, its progress arc and rotation phase) and passes the
// record here. The splash then converges onto those exact coordinates and finishes on a replica
// built from the same computed CSS, so the final window fade swaps identical pixels.
const wordEl = handoff.querySelector('.wordmark');
const hintEl = handoff.querySelector('.hint');
const spinEl = document.getElementById('handoff-spin');
const spinArc = spinEl.firstElementChild;

function validSpec(spec) {
  return spec && spec.spinner && spec.wordmark && spec.hint &&
    Math.abs(spec.vw - window.innerWidth) <= 2 && Math.abs(spec.vh - window.innerHeight) <= 2;
}

function placeText(el, m) {
  el.textContent = m.text;
  el.style.left = `${m.x}px`;
  el.style.top = `${m.y}px`;
  el.style.width = `${m.w}px`;
  el.style.height = `${m.h}px`;
  el.style.font = m.font;
  el.style.letterSpacing = m.letterSpacing;
  el.style.color = m.color;
}

function applySpec(spec) {
  if (!validSpec(spec)) return false;
  handoffSpec = spec;
  adoptSpinnerColors(spec);
  const s = spec.spinner;
  HX = s.cx;
  HY = s.cy;
  SPIN_R = (s.size - s.bw) / 2;
  handoff.classList.add('exact');
  placeText(wordEl, spec.wordmark);
  placeText(hintEl, spec.hint);
  spinEl.style.left = `${s.cx - s.size / 2}px`;
  spinEl.style.top = `${s.cy - s.size / 2}px`;
  spinEl.style.width = spinEl.style.height = `${s.size}px`;
  spinEl.style.borderWidth = `${s.bw}px`;
  spinEl.style.borderColor = s.border;
  spinArc.style.inset = `${-s.bw}px`;
  spinArc.style.background = spec.after.background;
  spinArc.style.webkitMaskImage = spinArc.style.maskImage = spec.after.mask;
  // same rotation phase as the live spinner, corrected for the time the record spent in transit
  const elapsed = Math.max(0, Date.now() - spec.at);
  const offset = (spec.phase * spec.dur + elapsed) % spec.dur;
  spinEl.style.animation = `handoff-spin ${spec.dur}ms linear ${-offset}ms infinite`;
  if (spec.bg) document.body.style.background = spec.bg;
  return true;
}

function beginExit(spec, resolve) {
  exiting = true;
  applySpec(spec);
  exitAt = (performance.now() - t0) / 1000;
  window.__dshExitAt = exitAt;   // read by the preview lab (preview/lab.html)
  exitResolve = resolve;
  titleBox.classList.add('out');
  hud.classList.add('out');
}

let exitRequested = false;
// Main process: `await __dshSplashExit(record)` → the scene converges; then `__dshSplashSync(record)`
// refreshes the progress arc and phase just before the window fades.
window.__dshSplashExit = (spec) => new Promise((resolve) => {
  if (exitRequested) return resolve();
  exitRequested = true;
  // never leave before the scene's whale has been on screen long enough to be read
  const t = t0 ? (performance.now() - t0) / 1000 : 0;
  const wait = Math.max(0, (scene.readyAt || 0) - t);
  if (wait > 0) setTimeout(() => beginExit(spec, resolve), wait * 1000);
  else beginExit(spec, resolve);
});
window.__dshSplashSync = (spec) => { applySpec(spec); };

function start() {
  layout();
  window.addEventListener('resize', layout);
  if (reduced) {
    window.__dshSplashExit = (spec) => {
      if (applySpec(spec)) spinEl.style.opacity = '1';
      handoff.classList.add('on');
      titleBox.classList.add('out');
      return new Promise((r) => setTimeout(r, 300));
    };
    titleBox.classList.add('on');
    spans.forEach((s) => s.classList.add('on'));
    statusEl.textContent = STATUS[0];
    return;
  }
  requestAnimationFrame(frame);
}

const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 150))]).then(start);
