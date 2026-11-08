// Bundle src/* into the DSH lazy client-module format (lib/client.js).
// orig-frames.js + official-frames.js + rig-model.js, rig.js, surface.js, noto-blow*.js, surface-anims.js (scoped as SURF) + tool-art.js (scoped as TOOL_ART) + motion.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scoped = (name, src, names) => `const ${name} = (() => {\n${src.replace(/^export /gm, '')}\nreturn { ${names} };\n})();\n`;
const body = [
  read('orig-frames.js'),
  read('official-frames.js'),
  `const SURF = (() => {\n${read('rig-model.js')}\n${read('rig.js')}\n${read('surface.js')}\n${read('noto-blow-data.js')}\n${read('noto-blow.js')}\n${read('surface-anims.js')}\nreturn { SF_DEFS, SF_WATER, sfFrame, sfDraw, sfProject, sfRestPose };\n})();\n`,
  `const TOOL_ART = (() => {\n${read('tool-art.js')}\nreturn TOOL_ART;\n})();\n`,
  read('motion.js'),
].join('\n');
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


