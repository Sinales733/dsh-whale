// Rebuild an asar, replacing/adding selected files while copying everything else verbatim.
// usage: node asar-patch.mjs <in.asar> <out.asar> <archivePath=localFile> ...
import fs from 'node:fs';
import crypto from 'node:crypto';
import { readAsar, walk } from './asar-ls.mjs';

const [, , input, output, ...specs] = process.argv;
const replacements = new Map(specs.map((s) => {
  const i = s.indexOf('=');
  return [s.slice(0, i), s.slice(i + 1)];
}));

const src = readAsar(input);
const header = structuredClone(src.header);

function integrity(buf) {
  const blockSize = 4 * 1024 * 1024;
  const blocks = [];
  for (let i = 0; i < buf.length; i += blockSize) {
    blocks.push(crypto.createHash('sha256').update(buf.subarray(i, i + blockSize)).digest('hex'));
  }
  return { algorithm: 'SHA256', hash: crypto.createHash('sha256').update(buf).digest('hex'), blockSize, blocks };
}

// Insert new files into the tree.
for (const [p] of replacements) {
  const parts = p.split('/');
  let node = header;
  for (const dir of parts.slice(0, -1)) {
    node.files[dir] ??= { files: {} };
    node = node.files[dir];
  }
  node.files[parts.at(-1)] ??= { size: 0, offset: '0' };
}

// Lay out data: walk in tree order, assign new offsets.
const chunks = [];
let offset = 0;
for (const [p, entry, dir] of walk(header)) {
  if (dir || entry.unpacked || entry.link) continue;
  let buf;
  if (replacements.has(p)) {
    buf = fs.readFileSync(replacements.get(p));
    entry.integrity = integrity(buf);
    chunks.push({ buf });
  } else {
    chunks.push({ from: src.base + Number(entry.offset), size: entry.size });
  }
  entry.size = buf ? buf.length : entry.size;
  entry.offset = String(offset);
  offset += entry.size;
}

const json = Buffer.from(JSON.stringify(header), 'utf8');
const pad = (4 - (json.length % 4)) % 4;
const headerPickle = Buffer.alloc(8 + json.length + pad);
headerPickle.writeUInt32LE(4 + json.length + pad, 0);
headerPickle.writeInt32LE(json.length, 4);
json.copy(headerPickle, 8);
const sizePickle = Buffer.alloc(8);
sizePickle.writeUInt32LE(4, 0);
sizePickle.writeUInt32LE(headerPickle.length, 4);

const out = fs.openSync(output, 'w');
fs.writeSync(out, sizePickle);
fs.writeSync(out, headerPickle);
const copyBuf = Buffer.alloc(8 * 1024 * 1024);
for (const c of chunks) {
  if (c.buf) { fs.writeSync(out, c.buf); continue; }
  let left = c.size, pos = c.from;
  while (left > 0) {
    const n = fs.readSync(src.fd, copyBuf, 0, Math.min(left, copyBuf.length), pos);
    fs.writeSync(out, copyBuf, 0, n);
    left -= n; pos += n;
  }
}
fs.closeSync(out);
console.log(`wrote ${output}: ${chunks.length} files, ${replacements.size} replaced/added`);
