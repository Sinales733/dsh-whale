// Concatenate src/* (in this order, one shared scope) into the DSH lazy client-module format (lib/client.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const FILES = ['orig-frames.js', 'official-frames.js', 'rig-model.js', 'surface.js', 'noto-blow-data.js', 'noto-blow.js', 'surface-anims.js', 'tool-art.js', 'motion.js'];
const body = FILES.map((f) => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
const out = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkg.name)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body.split('\n').map((l) => (l ? '\t\t' + l : l)).join('\n')}
\t\treturn module.exports;
\t}
});
`;
fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
fs.writeFileSync(path.join(root, 'lib/client.js'), out);
console.log(`lib/client.js built (${out.length} bytes)`);

// The launch splash, which lib/index.js puts back into DSH after its updates: from dsh-whale's splash/ folder
// (or DSH_SPLASH_DIR).
const splashDir = process.env.DSH_SPLASH_DIR ?? path.join(root, '..', 'splash');
const SPLASH = ['patch-app.mjs', 'main-splash.js.txt', 'splash.html', 'splash.css', 'splash.js'];
if (SPLASH.every((f) => fs.existsSync(path.join(splashDir, f)))) {
  fs.mkdirSync(path.join(root, 'lib/splash'), { recursive: true });
  for (const f of SPLASH) fs.copyFileSync(path.join(splashDir, f), path.join(root, 'lib/splash', f));
  console.log(`lib/splash/ copied from ${splashDir}`);
} else console.warn(`no launch splash at ${splashDir}; lib/splash/ left as it is`);
