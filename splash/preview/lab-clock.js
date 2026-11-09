// Virtual clock for lab builds of the launch splash (loaded before splash.js by preview/lab/*/splash.html).
// Nothing moves until the parent steps it: window.__lab.step(ms) advances the clock, runs due timeouts,
// then runs the queued animation frame callbacks and returns the real milliseconds they took.
(() => {
  const realNow = performance.now.bind(performance);
  let vt = 0;
  let raf = [];
  let timers = [];
  let nextId = 1;
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { raf.push(cb); return raf.length; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = (fn, ms = 0, ...args) => { const id = nextId++; timers.push({ id, at: vt + Number(ms || 0), fn, args }); return id; };
  window.clearTimeout = (id) => { timers = timers.filter((x) => x.id !== id); };
  window.__lab = {
    now: () => vt,
    started: () => raf.length > 0,
    step(ms) {
      vt += ms;
      timers.sort((a, b) => a.at - b.at);
      while (timers.length && timers[0].at <= vt) {
        const x = timers.shift();
        if (typeof x.fn === 'function') x.fn(...x.args);
      }
      const q = raf;
      raf = [];
      const t0 = realNow();
      for (const cb of q) cb(vt);
      return realNow() - t0;
    },
  };
})();
