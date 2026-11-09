// Render a frame-exact contact sheet of the launch splash with preview/lab.html in headless Chrome.
//   node tools/lab-shot.mjs "<lab.html query>" <out.png> [--dpr 1|2] [--timeout 120000]
// e.g. node tools/lab-shot.mjs "dir=pulsar&scene=pulsar&times=3.2:4.6:0.05&crop=240,260,800,300&cols=3&cw=600" out.png
// Needs a static server for the project root on http://localhost:8765. Prints the frame-cost
// stats (ms of script per frame, virtual clock; idle and during the exit).
// Each run uses a throwaway Chrome profile under .cache/labshot/ in this project (never the system drive's
// temp folder) and deletes it once Chrome has exited; profiles left by killed runs are swept on the next run.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const query = args[0], out = args[1];
if (!query || !out) { console.error('usage: lab-shot.mjs "<query>" <out.png> [--dpr N] [--timeout ms]'); process.exit(2); }
const dpr = Number(opt('--dpr', 1));
const timeout = Number(opt('--timeout', 120000));
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9400 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'labshot');
fs.mkdirSync(profRoot, { recursive: true });
for (const d of fs.readdirSync(profRoot)) {
  const p = path.join(profRoot, d);
  try { if (Date.now() - fs.statSync(p).mtimeMs > 30 * 60e3) fs.rmSync(p, { recursive: true, force: true }); } catch {}
}
const prof = fs.mkdtempSync(path.join(profRoot, 'p-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=' + prof,
  '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-component-update',
  '--disable-background-networking', '--disable-sync', '--disk-cache-size=1', '--disable-gpu-shader-disk-cache',
  'about:blank'], { stdio: 'ignore' });
const exited = new Promise((r) => proc.once('exit', r));
let ws = null;
async function finish(code) {
  try { if (ws) ws.close(); } catch {}
  proc.kill();
  await Promise.race([exited, sleep(8000)]);
  try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 }); } catch {}
  process.exit(code);
}

let targets;
for (let i = 0; i < 100; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(150); }
}
if (!targets) { console.error('chrome did not start'); await finish(1); }
const page = targets.find((t) => t.type === 'page');
ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') console.error('EXC', JSON.stringify(msg.params.exceptionDetails).slice(0, 800));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: dpr, mobile: false });
await send('Page.navigate', { url: `http://localhost:8765/preview/lab.html?${query}` });
const t0 = Date.now();
let done = null;
while (Date.now() - t0 < timeout) {
  await sleep(250);
  const r = await send('Runtime.evaluate', { expression: 'window.__labDone ? JSON.stringify({perf: __labDone.perf, scan: __labDone.scan, exitStart: __labDone.exitStart, w: __labDone.w, h: __labDone.h}) : null', returnByValue: true });
  if (r.result && r.result.result && r.result.result.value) { done = JSON.parse(r.result.result.value); break; }
}
if (!done) { console.error('timed out'); await finish(1); }
const img = await send('Runtime.evaluate', { expression: '__labDone.dataURL', returnByValue: true });
const data = img.result.result.value.replace(/^data:image\/png;base64,/, '');
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, Buffer.from(data, 'base64'));
console.log(JSON.stringify(done.scan ? { exitStart: done.exitStart, perf: done.perf, scan: done.scan } : { out, sheet: `${done.w}x${done.h}`, exitStart: done.exitStart, perf: done.perf }));
await finish(0);
