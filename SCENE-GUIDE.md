# Launch splash scenes: guide for writing a new one

DeepSeek Harness (DSH) shows a launch splash while its runtime boots. The splash is one random scene,
never the same as the previous launch, then it hands off to the web app's boot card ("HARNESS",
a 20 px spinner, "Loading plugins…"). Sources: `splash/src/core.js` (shared helpers),
`splash/src/scenes/*.js` (one file per scene), `splash/src/boot.js` (frame loop, exit protocol).
`tools/build-splash.mjs` concatenates them into `splash/splash.js`.

## Look

- One colour only: the foreground `col(alpha)` (near-white `rgb(249,250,251)` on `#151517` in the dark
  theme, near-black on white in the light theme). The background `BG` is used only to occlude.
  No other colours, gradients only as alpha.
- Thin hairline drawing: mostly 1 px strokes at alpha 0.05–0.6, highlights up to ~0.95, small dots.
  Precise, quiet and scientific. Every scene is a technical or scientific object rendered as line art:
  - CONSTRUCT: compass-and-ruler construction.
  - ORBIT: wireframe globe with satellites.
  - SIGNAL: X-Y oscilloscope.
  - WEAVE: modular string art.
  - PULSAR: ridgeline height map.
  - CURRENT: flow field around an obstacle.
- The hero is the DeepSeek whale glyph. Scenes reveal it from their own medium; it should be clearly
  readable by about 2.0–2.8 s. Helpers:
  - `makeWhale(cx, cy, heightPx)` gives `{fill: Path2D, polys, total, width}`.
  - `drawWhale(wh, {progress, a, w, map, hiAt, hiLen, hiA, tip})` draws the outline: traced or full,
    with a comet highlight.
  - `whaleContour(wh, N)` gives N evenly spaced outline points, with `breaks` marking subpath starts.
  - `whaleMask(wh, blurPx)` gives a coverage lookup (x, y) → 0..1. Call it once, in `layout()`.
  - Primitives: `line`, `arc`, `dot`, `text`, `strokePath(path2d, a, w)`; all take an alpha and skip it below 0.003.
  - Math: `seg`, `lerp`, `clamp01`, the eases, `hash`, `fract`, `wrapPi` (angle into (−π, π]), `cumLen(points)`,
    `TAU`, `DEG`, `pad`.
- Telemetry: `boot.js` draws the corner brackets and the HUD corners for you: scene label and index,
  version, window size, time and frame. Your scene supplies `readout(t)`: two short lines of monospace
  data in the lower right, e.g. `PSR B1919+21\nROW 12/52`. It should change while the scene runs.
- The DOM title "D E E P S E E K   H A R N E S S" fades in at `titleAt` (about 2.0 s). Its top edge is
  at `CY + 318*S`, and the status line sits under it. Keep the main graphic above roughly `CY + 290*S`.

## Space and time

- `W, H` are the window size (typically 1280×820, but any size). `S = clamp(min(W/1280, H/820), 0.6, …)`
  is the scale. `CX = W/2, CY = 0.42*H` is the composition centre. The main graphic fits in about
  ±300·S horizontally and ±230·S vertically around it.
- `HX, HY` is the web app spinner's centre (about `W/2, H/2+3`). `SPIN_R = 9` is its track radius.
  The track is 2 px wide, at `RING_ALPHA`.
- `frame(t, ex, ek)`:
  - `t` is seconds since the splash started.
  - `ex` is exit progress, 0 → 1. It is 0 until the app is ready.
  - `ek = inOutCubic(ex)`. The global `exiting` is true once the exit has begun.
- Timeline:
  - The scene builds over 0–1.5 s and the whale is readable by about 2.5 s.
  - It keeps living, gently moving, until the app is ready. That is never before 3 s; often later,
    up to many seconds.
  - The exit starts at `max(app ready, scene.readyAt)`. Set `readyAt` (3.0–3.9 s) so the whale has
    been on screen long enough to read.
  - The exit lasts `EXIT_DUR = 1.05 s`, or `scene.exitDur`.
  - The scene must hold up if the app takes 10 s to be ready. Any loop must stay alive and keep
    varying, never freeze.

## Exit contract (strict)

- By `ex = 0.8` everything must have collapsed into the spinner area: within about 14 px of
  `(HX, HY)`. At that point the boot card's text fades in: "HARNESS" 35 px above the spinner,
  "Loading plugins…" 38 px below. Nothing may run through that text.
- At `ex = 1`, leave exactly one ring of radius `SPIN_R`, alpha `RING_ALPHA`, width 2, at `(HX, HY)`,
  and nothing else.
- The spinner's progress arc is a solid 72° arc on the track. It turns clockwise once every 0.8 s;
  `spinnerAngle(t)` gives its start angle and `spinnerSweep()` its sweep.
  - By default `boot.js` fades it in from `ex = 0.55`.
  - A scene that turns part of itself into that arc sets `spinnerIn: <ex where it lands>` (PULSAR uses
    0.89). From that point it draws the arc exactly at `spinnerAngle(t)` / `spinnerSweep()`, solid, with
    flat (butt) ends, through `ex = 1`; boot then draws no arc of its own, so there is never a second one.
- In the real app the canvas fades out over `ex` from `max(0.86, spinnerIn)` to 0.99, and a DOM replica
  of the spinner takes over, so the ring must be exactly in place by then.

## Motion quality (the bar is high)

The user checks every 0.1 s and every 0.05 s. They rejected every glitch.

- **No jumps between consecutive frames.** Positions, sizes, alphas and counts change continuously.
  Nothing pops in or out: fade it, grow it, draw it on. A quantity that switches mode must be blended,
  for example a stream that turns into a vortex.
- **Ease everything.** Use `inOutCubic`, `inOutSine`, `smooth` and `outExpo`. Avoid linear starts and
  stops and sudden reversals.
- **No frozen holds.** Rhythm comes from speed curves: slow into and out of a moment, never a dead stop.
  灵动 (liveliness) is refined secondary motion, not speed.
- **No flicker or shimmer.** Never use per-frame `Math.random()`; use `hash(n)` and time-based noise.
  Avoid dense moiré from many near-parallel hairlines, and very thin lines crawling sub-pixel.
- **Brightness stays steady.** Do not let many overlapping strokes pile up into white blobs. Scale alpha
  with density.
- **Collapse onto the spinner gracefully.** Shrink in log scale (a constant ratio per frame) rather than
  linearly, so there is no "snap" at the end.

## Performance

- The budget is a script cost per frame of p95 ≤ 6 ms at 1280×820, DPR 1, in the lab tool (headless
  Chrome, software canvas). Real machines run DPR 1–2.
- Precompute in `layout()`. Do not use `getImageData`, `filter` or `shadowBlur` per frame.
- Batch strokes into a few `Path2D` or `beginPath` runs. Keep it to roughly 20k line segments per frame
  or fewer.

## File shape

```js
// ===== scene: NAME — one-line description ==========================================
// What it shows, how the whale appears, how it leaves.
SCENES.name = (() => {
  // state …
  return {
    label: 'NAME',          // upper-case word shown in the HUD
    readyAt: 3.4,
    titleAt: 2.0,
    // exitDur, spinnerIn: optional
    layout() { /* sizes from S, CX, CY; precompute; reset state (called again on resize) */ },
    readout: (t) => `…\n…`,
    frame(t, ex, ek) { /* draw everything; no ctx.clearRect (boot clears) */ },
  };
})();
```

Scene names are lower-case letters only. Use only `core.js` helpers and the 2D canvas. Do not edit
`core.js`, `boot.js` or other scenes; if you need something there, say so in your report.

## Tools

- `node tools/build-splash.mjs --lab <name>` builds `preview/lab/<name>/`, with only your scene.
- `node tools/lab-shot.mjs "dir=<name>&scene=<name>&times=0.2:4.8:0.2&cols=5&cw=380" out.png` writes a
  frame-exact contact sheet on a virtual clock. It needs the preview server on `localhost:8765`, which
  is running. Look at the PNG with the Read tool. It prints the frame cost:
  `perf.idle/exit {avg,p95,max}` in ms.
  - `times=a:b:step` lists the capture times. Use 0.1 s, then 0.05 s, around builds and the exit.
  - `exitAt=3.0` is when the app is ready (the default). Try `exitAt=6` too, so the scene holds while
    waiting.
  - `crop=x,y,w,h` zooms (CSS px of the 1280×820 splash). `theme=light` checks the light theme.
    `--dpr 2` checks 2× density.
  - The labels show `t` and `exit+` (seconds since the exit began).
- `node tools/lab-shot.mjs "dir=<name>&scene=<name>&scan=0.3:5.0" scan.png` is the jump detector. It
  steps the clock at 60 fps and measures how much the picture changes from each frame to the next. It
  reports these, each with its time and exit offset:
  - `spikes`: frames whose change is more than 2.2× their neighbours'. These are pops, snaps and flicker.
  - `frozen`: runs of more than 0.3 s with no change at all.
  Aim for no spikes and no frozen runs, with `exitAt=3` and with `exitAt=8`. A spike is a candidate, not
  proof: look at those frames on a sheet with steps of 1/60 s (`times=a:b:0.0167`). For sparse hairline
  scenes scan a sharper copy with `&sw=640` (default 320); `&floor=` sets the smallest change that can count
  as a spike (default 0.0002).
- `preview/splash-viewer.html` plays the splash live in a browser. It needs a full build, not a lab
  build.
