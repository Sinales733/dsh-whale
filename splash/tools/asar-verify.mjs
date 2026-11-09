// Compare two asars: every file must match byte-for-byte except the listed paths.
import crypto from 'node:crypto';
import { readAsar, walk, readEntry } from './asar-ls.mjs';

const [, , a, b, ...changed] = process.argv;
const A = readAsar(a), B = readAsar(b);
const mapB = new Map([...walk(B.header)].filter(([, , d]) => !d).map(([p, e]) => [p, e]));
let same = 0, diff = [], missing = [];
const h = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
for (const [p, e, d] of walk(A.header)) {
  if (d) continue;
  const eb = mapB.get(p);
  if (!eb) { missing.push(p); continue; }
  mapB.delete(p);
  if (e.unpacked) { if (!eb.unpacked) diff.push(p); else same++; continue; }
  if (changed.includes(p)) continue;
  if (h(readEntry(A, e)) !== h(readEntry(B, eb))) diff.push(p); else same++;
}
console.log({ same, diff, missing, added: [...mapB.keys()] });
