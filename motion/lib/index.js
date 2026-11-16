// Host half of dsh-motion. The whale tail and tool icons are all in lib/client.js; this half only keeps the launch
// splash (lib/splash/, copied from dsh-whale's splash/ folder by build.mjs) in DeepSeek Harness across DSH updates.
// An update replaces resources/app.asar and the splash with it, so shortly after DSH starts this runs
// `patch-app.mjs stage` in a process of its own: if the splash was installed on this PC before and is now missing or
// older than the one shipped here, it builds the patch from the installed release at once and swaps it in after DSH
// has quit. The first launch after an update has no splash; every one after it does. A release the patch does not
// fit is left untouched.
// Off with `autoSplash: false` in this plugin's config, or DSH_SPLASH_AUTO=0 in the environment.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-motion';

const PATCHER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'splash', 'patch-app.mjs');
const DELAY_MS = 15000;              // let DSH finish starting first

export function apply(ctx, config = {}) {
  if (process.platform !== 'win32' || config?.autoSplash === false || process.env.DSH_SPLASH_AUTO === '0') return;
  const asar = desktopAsar();
  if (!asar || !fs.existsSync(PATCHER)) return;       // not the desktop app (web or command-line DSH), or no splash shipped
  const log = typeof ctx.logger === 'function' ? ctx.logger('dsh-motion') : undefined;
  const timer = setTimeout(() => {
    try {
      const child = spawn(process.execPath, [PATCHER, 'stage', '--asar', asar], {
        detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      });
      child.on('error', (e) => log?.warn?.('launch splash check failed to start: %s', e.message));
      child.unref();
    } catch (e) { log?.warn?.('launch splash check failed to start: %s', e?.message ?? e); }
  }, DELAY_MS);
  ctx.effect?.(() => () => clearTimeout(timer));
}

/** The desktop app's resources/app.asar, from the path of the Host entry DSH started this process with. */
function desktopAsar() {
  const mark = `${path.sep}app.asar${path.sep}`;
  for (const arg of process.argv) {
    const i = arg.toLowerCase().indexOf(mark);
    if (i > 0) return arg.slice(0, i + mark.length - 1);
  }
  return null;
}
