// Launch splash for DeepSeek Harness, patched into whichever DSH release is installed (Windows).
//
// DSH keeps its main-process code in resources/app.asar, and the splash has to appear before any plugin can run, so
// it is a patch to that file: main-splash.js.txt goes into lib/main.js at fixed places, and splash.html / .css / .js
// go into renderer/. This script finds those places in the release that is installed instead of shipping a prebuilt
// app.asar, so it keeps working across DSH updates; if a release moves them, it changes nothing and says so.
//
// Runs under any Node 18+, and under DSH's own executable with ELECTRON_RUN_AS_NODE=1, so users need nothing else.
//   status   what is installed
//   install  patch now (DSH must be closed)
//   restore  put this release's original app.asar back (DSH must be closed)
//   stage    if this person installed the splash before and it is now missing or out of date (a DSH update), build
//            the patch now and swap it in once every DSH process has exited; dsh-motion runs this when DSH starts
// Options: --dir <install dir> (default: the DSH this runs under, else the one Windows has registered) or
//          --asar <path to app.asar>.
// Exit codes: 0 done or nothing to do, 2 this DSH release is not supported (nothing changed), 3 DSH is running,
//             1 any other error.
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Under Electron, fs would treat app.asar as a folder; this process needs the archive itself.
process.noAsar = true;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARK = '//#region launch splash (custom)';
const RENDERER = ['splash.html', 'splash.css', 'splash.js'];
const LOG = path.join(os.tmpdir(), 'dsh-splash', 'patch.log');
// Present once the splash has been installed here and not restored away since: `stage` only puts back a splash
// this person chose to have.
const WANTED = path.join(process.env.LOCALAPPDATA || os.homedir(), 'dsh-splash', 'wanted');
const want = (on) => {
  try { if (on) { fs.mkdirSync(path.dirname(WANTED), { recursive: true }); fs.writeFileSync(WANTED, new Date().toISOString()); } else fs.rmSync(WANTED, { force: true }); } catch { }
};

class Unsupported extends Error {}
class Busy extends Error {}

function log(msg) {
  try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`); } catch { }
}
const lf = (s) => s.replace(/\r\n/g, '\n');

// ---------------------------------------------------------------- asar (the Electron archive format)
function openAsar(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = Buffer.alloc(8);
    fs.readSync(fd, size, 0, 8, 0);
    const pickle = Buffer.alloc(size.readUInt32LE(4));
    fs.readSync(fd, pickle, 0, pickle.length, 8);
    const header = JSON.parse(pickle.subarray(8, 8 + pickle.readUInt32LE(4)).toString('utf8'));
    return { file, fd, header, base: 8 + pickle.length };
  } catch (e) { fs.closeSync(fd); throw e; }
}
function* walk(node, prefix = '') {
  for (const [name, child] of Object.entries(node.files || {})) {
    const p = prefix ? `${prefix}/${name}` : name;
    if (child.files) { yield [p, child, true]; yield* walk(child, p); } else yield [p, child, false];
  }
}
function entry(a, p) {
  let node = a.header;
  for (const part of p.split('/')) { node = node.files?.[part]; if (!node) return null; }
  return node.files ? null : node;
}
function read(a, p) {
  const e = entry(a, p);
  if (!e || e.unpacked) return null;
  const buf = Buffer.alloc(e.size);
  fs.readSync(a.fd, buf, 0, e.size, a.base + Number(e.offset));
  return buf;
}
function integrity(buf) {
  const blockSize = 4 * 1024 * 1024, blocks = [];
  for (let i = 0; i < buf.length; i += blockSize) blocks.push(crypto.createHash('sha256').update(buf.subarray(i, i + blockSize)).digest('hex'));
  return { algorithm: 'SHA256', hash: crypto.createHash('sha256').update(buf).digest('hex'), blockSize, blocks };
}
/** Write a copy of archive `a` with `files` (path -> Buffer) replaced or added; everything else copied verbatim. */
function writeAsar(a, out, files) {
  const header = structuredClone(a.header);
  for (const p of files.keys()) {
    let node = header;
    const parts = p.split('/');
    for (const dir of parts.slice(0, -1)) node = (node.files[dir] ??= { files: {} });
    node.files[parts.at(-1)] ??= { size: 0, offset: '0' };
  }
  const chunks = [];
  let offset = 0;
  for (const [p, e, dir] of walk(header)) {
    if (dir || e.unpacked || e.link) continue;
    const buf = files.get(p);
    if (buf) { e.integrity = integrity(buf); chunks.push({ buf }); e.size = buf.length; }
    else chunks.push({ from: a.base + Number(e.offset), size: e.size });
    e.offset = String(offset);
    offset += e.size;
  }
  const json = Buffer.from(JSON.stringify(header), 'utf8');
  const pad = (4 - (json.length % 4)) % 4;
  const pickle = Buffer.alloc(8 + json.length + pad);
  pickle.writeUInt32LE(4 + json.length + pad, 0);
  pickle.writeInt32LE(json.length, 4);
  json.copy(pickle, 8);
  const size = Buffer.alloc(8);
  size.writeUInt32LE(4, 0);
  size.writeUInt32LE(pickle.length, 4);
  const fd = fs.openSync(out, 'w');
  try {
    fs.writeSync(fd, size);
    fs.writeSync(fd, pickle);
    const copy = Buffer.alloc(8 * 1024 * 1024);
    for (const c of chunks) {
      if (c.buf) { fs.writeSync(fd, c.buf); continue; }
      for (let left = c.size, pos = c.from; left > 0;) {
        const n = fs.readSync(a.fd, copy, 0, Math.min(left, copy.length), pos);
        if (n <= 0) throw new Error(`short read in ${a.file}`);
        fs.writeSync(fd, copy, 0, n);
        left -= n; pos += n;
      }
    }
  } finally { fs.closeSync(fd); }
}

// ---------------------------------------------------------------- what the splash is, and what is installed
function assets() {
  // text files go in with LF line ends, whatever a git checkout gave them
  const files = new Map(RENDERER.map((f) => [`renderer/${f}`, Buffer.from(lf(fs.readFileSync(path.join(HERE, f), 'utf8')), 'utf8')]));
  const block = lf(fs.readFileSync(path.join(HERE, 'main-splash.js.txt'), 'utf8')).replace(/\n*$/, '\n');
  return { files, block, stamp: stamp(RENDERER.map((f) => files.get(`renderer/${f}`)), block) };
}
// Same splash = same renderer files and same main-process block, whatever line endings a checkout gave them.
function stamp(renderer, block) {
  const h = crypto.createHash('sha256');
  for (const b of renderer) h.update(lf(b.toString('utf8'))).update('\0');
  return h.update(lf(block)).digest('hex').slice(0, 16);
}
function blockOf(main) {
  const i = main.indexOf(MARK);
  if (i < 0) return null;
  const j = main.indexOf('//#endregion', i);
  return j < 0 ? null : main.slice(i, j + '//#endregion'.length) + '\n';
}
/** One app.asar: the DSH version inside it, whether it carries a splash, and which. */
function inspect(file) {
  if (!fs.existsSync(file)) return null;
  const a = openAsar(file);
  try {
    const version = JSON.parse(read(a, 'package.json')?.toString('utf8') ?? '{}').version ?? '?';
    const main = read(a, 'lib/main.js')?.toString('utf8') ?? '';
    const block = blockOf(main);
    const renderer = RENDERER.map((f) => read(a, `renderer/${f}`));
    const patched = block !== null;
    return { file, version, patched, stamp: patched && renderer.every(Boolean) ? stamp(renderer, block) : null };
  } finally { fs.closeSync(a.fd); }
}
function paths(asar) {
  return { asar, orig: `${asar}.orig`, next: `${asar}.splash-new`, lock: `${asar}.splash-lock` };
}
/** Where things stand: `current` = the installed splash is this one. */
export function splashState(asar) {
  const p = paths(asar), want = assets().stamp;
  const cur = inspect(p.asar), orig = inspect(p.orig);
  if (!cur) throw new Error(`no app.asar at ${asar}`);
  return { version: cur.version, installed: cur.patched, current: cur.patched && cur.stamp === want, orig: orig && { version: orig.version, patched: orig.patched } };
}

// ---------------------------------------------------------------- the patch to lib/main.js
const EDITS = [
  { label: 'a crash closes the splash', required: true,
    find: ['function reportFatal(error, source) {\n\tconsole.error(error);\n'],
    add: (m) => `${m}\tlaunchSplashHandle?.dismiss(true);\n` },
  { label: 'the splash code, opened first thing in main()', required: true,
    find: ['\nasync function main() {\n'],
    add: (m, block) => `\n${block}async function main() {\n\tlaunchSplashHandle = openLaunchSplash(resolveDesktopStartupLocale(null, app.getPreferredSystemLanguages()).id);\n` },
  { label: 'the theme picked in the app is remembered for the next splash', required: false,
    find: [
      '\t\tif (source !== "light" && source !== "dark" && source !== "system") return;\n\t\tnativeTheme.themeSource = source;\n',   // 0.2.2
      '\t\tif (source === "light" || source === "dark" || source === "system") nativeTheme.themeSource = source;\n',                    // 0.2.1
    ],
    add: (m) => (m.includes('return;')
      ? `${m}\t\trememberLaunchSplashTheme(source);\n`
      : '\t\tif (source === "light" || source === "dark" || source === "system") {\n\t\t\tnativeTheme.themeSource = source;\n\t\t\trememberLaunchSplashTheme(source);\n\t\t}\n') },
];
// What the splash block calls from the rest of main.js.
const NEEDS = [/\bfunction resolveDesktopStartupLocale\(/, /import\b[^;]*\bBrowserWindow\b[^;]*from "electron"/, /import\b[^;]*\bnativeTheme\b[^;]*from "electron"/,
  /import\b[^;]*\breadFileSync\b[^;]*from "node:fs"/, /import\b[^;]*\bwriteFileSync\b[^;]*from "node:fs"/, /import\b[^;]*\bjoin\b[^;]*from "node:path"/];

function patchMain(main, block) {
  if (main.includes(MARK)) throw new Error('lib/main.js already carries a splash');
  const missing = NEEDS.filter((re) => !re.test(main));
  if (missing.length) throw new Unsupported(`lib/main.js lacks what the splash uses (${missing.map(String).join(', ')})`);
  let out = main;
  for (const e of EDITS) {
    const hits = e.find.map((f) => [f, out.split(f).length - 1]).filter(([, n]) => n > 0);
    if (hits.length === 1 && hits[0][1] === 1) { out = out.replace(hits[0][0], () => e.add(hits[0][0], block)); continue; }
    if (e.required) throw new Unsupported(`cannot place "${e.label}" in lib/main.js (${hits.length ? 'found more than once' : 'not found'})`);
    log(`skipped optional edit: ${e.label}`);
  }
  return out;
}
/** Syntax-check the patched main.js with the same JavaScript engine that will run it. */
function check(code) {
  const tmp = path.join(os.tmpdir(), `dsh-splash-main-${process.pid}.mjs`);
  fs.writeFileSync(tmp, code);
  try {
    const r = spawnSync(process.execPath, ['--check', tmp], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) throw new Unsupported(`patched lib/main.js does not parse: ${(r.stderr || '').split('\n').slice(0, 4).join(' ')}`);
  } finally { fs.rmSync(tmp, { force: true }); }
}

/** Build the patched archive into p.next from this release's original; returns the original it used. */
function build(p) {
  const want = assets();
  const cur = inspect(p.asar);
  let base = p.asar;
  if (cur.patched) {
    // an older splash: start again from this release's original
    const orig = inspect(p.orig);
    if (!orig || orig.patched || orig.version !== cur.version) {
      throw new Error(`app.asar carries an older splash, and ${path.basename(p.orig)} is not DSH ${cur.version}'s original; reinstall DSH, then install again`);
    }
    base = p.orig;
  }
  const a = openAsar(base);
  try {
    const main = patchMain(lf(read(a, 'lib/main.js').toString('utf8')), want.block);
    check(main);
    writeAsar(a, p.next, new Map([['lib/main.js', Buffer.from(main, 'utf8')], ...want.files]));
  } catch (e) { fs.rmSync(p.next, { force: true }); throw e; } finally { fs.closeSync(a.fd); }
  // read it back: the splash must be there and every other file where it was
  const got = inspect(p.next);
  if (!got?.patched || got.stamp !== want.stamp || got.version !== cur.version) { fs.rmSync(p.next, { force: true }); throw new Error('the patched app.asar did not read back correctly'); }
  return { from: base, patchedBefore: cur.patched, version: cur.version };
}
/** Swap p.next in. The release's original stays beside it as app.asar.orig. */
function swap(p, patchedBefore) {
  if (patchedBefore) fs.rmSync(p.asar);
  else fs.renameSync(p.asar, p.orig);           // replaces an older release's .orig
  try { fs.renameSync(p.next, p.asar); }
  catch (e) { if (!patchedBefore) fs.renameSync(p.orig, p.asar); throw e; }
}

// ---------------------------------------------------------------- is DSH running?
function isDshRunning() {
  if (process.platform !== 'win32') return false;
  let out = '';
  try { out = execFileSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }); } catch { return true; }
  return out.split(/\r?\n/).some((line) => {
    const m = /^"([^"]+)","(\d+)"/.exec(line);
    if (!m || Number(m[2]) === process.pid) return false;
    const name = m[1].toLowerCase();
    // the app itself, and its installer / uninstaller, which may be about to replace app.asar
    return name === 'deepseek harness.exe' || name.startsWith('deepseek-harness-') || name === 'uninstall deepseek harness.exe';
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

// ---------------------------------------------------------------- commands
function locate(args) {
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (opt('--asar')) return path.resolve(opt('--asar'));
  let dir = opt('--dir');
  if (!dir && /deepseek harness(\.exe)?$/i.test(path.basename(process.execPath))) dir = path.dirname(process.execPath);
  if (!dir && process.platform === 'win32') {
    for (const hive of ['HKCU', 'HKLM']) {
      try {
        const out = execFileSync('reg', ['query', `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall`, '/s', '/f', 'DeepSeek Harness', '/d'], { encoding: 'utf8', windowsHide: true });
        for (const key of out.split(/\r?\n/).filter((l) => l.startsWith('HKEY_'))) {
          const v = execFileSync('reg', ['query', key, '/v', 'InstallLocation'], { encoding: 'utf8', windowsHide: true });
          const m = /InstallLocation\s+REG_\w+\s+(.+)/.exec(v);
          if (m) { dir = m[1].trim(); break; }
        }
      } catch { }
      if (dir) break;
    }
  }
  if (!dir) throw new Error('DeepSeek Harness not found; pass --dir <its install folder>');
  return path.join(dir, 'resources', 'app.asar');
}

async function main(argv) {
  const [cmd, ...args] = argv;
  const p = paths(locate(args));
  // --ignore-running: for trying this on a copy of app.asar while DSH itself is open
  const dshRunning = args.includes('--ignore-running') ? () => false : isDshRunning;
  if (cmd === 'status') {
    const s = splashState(p.asar);
    console.log(`DSH ${s.version}: launch splash ${s.current ? 'installed' : s.installed ? 'installed, older than this one' : 'not installed'}`
      + (s.orig ? `; original kept (${s.orig.version}${s.orig.patched ? ', patched' : ''})` : '')
      + `; put back after DSH updates: ${fs.existsSync(WANTED) ? 'yes' : 'no'}`);
    return 0;
  }
  if (cmd === 'install') {
    if (splashState(p.asar).current) { want(true); console.log('The launch splash is already installed.'); return 0; }
    if (dshRunning()) throw new Busy('Quit DeepSeek Harness first (including its tray icon).');
    const b = build(p);
    if (dshRunning()) { fs.rmSync(p.next, { force: true }); throw new Busy('DeepSeek Harness was started meanwhile; quit it and run this again.'); }
    swap(p, b.patchedBefore);
    want(true);
    log(`installed into DSH ${b.version}`);
    console.log(`Launch splash installed into DSH ${b.version}. The original is kept as ${path.basename(p.orig)}.`);
    return 0;
  }
  if (cmd === 'restore') {
    const cur = inspect(p.asar), orig = inspect(p.orig);
    want(false);                                      // also stops dsh-motion from putting it back
    if (!cur.patched) { console.log('No launch splash installed; nothing to restore.'); return 0; }
    if (!orig || orig.patched || orig.version !== cur.version) throw new Error(`${path.basename(p.orig)} is missing or not DSH ${cur.version}'s original; reinstall DSH to get it back.`);
    if (dshRunning()) throw new Busy('Quit DeepSeek Harness first (including its tray icon).');
    fs.rmSync(p.asar);
    fs.renameSync(p.orig, p.asar);
    log(`restored DSH ${cur.version}`);
    console.log(`Original DSH ${cur.version} restored.`);
    return 0;
  }
  if (cmd === 'stage') {
    if (!fs.existsSync(WANTED) || splashState(p.asar).current) return 0;
    // one stager at a time (every DSH start may spawn one)
    try {
      const fd = fs.openSync(p.lock, 'wx'); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
    } catch {
      const other = Number(fs.readFileSync(p.lock, 'utf8'));
      if (other && alive(other)) return 0;
      fs.writeFileSync(p.lock, String(process.pid));
    }
    try {
      const b = build(p);
      const seen = fs.statSync(p.asar);
      log(`staged a splash for DSH ${b.version}; waiting for DSH to quit`);
      for (;;) {
        await sleep(3000);
        const now = fs.statSync(p.asar);
        if (now.size !== seen.size || now.mtimeMs !== seen.mtimeMs) { fs.rmSync(p.next, { force: true }); log('app.asar changed while waiting (a DSH update?); dropped'); return 0; }
        if (dshRunning()) continue;
        await sleep(4000);                            // an update's installer may start right after DSH quits
        if (dshRunning()) continue;
        swap(p, b.patchedBefore);
        log(`installed into DSH ${b.version} after it quit`);
        return 0;
      }
    } finally { fs.rmSync(p.lock, { force: true }); }
  }
  console.log('usage: patch-app.mjs status | install | restore | stage  [--dir <install dir> | --asar <app.asar>]');
  return 1;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
    log(`${process.argv[2]}: ${e.message}`);
    console.error(e instanceof Unsupported ? `This DeepSeek Harness release is not supported yet: ${e.message}. Nothing was changed.` : e.message);
    process.exit(e instanceof Unsupported ? 2 : e instanceof Busy ? 3 : 1);
  });
}
