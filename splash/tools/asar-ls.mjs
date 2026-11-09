// Minimal asar reader: list / extract files.
import fs from 'node:fs';
import path from 'node:path';

export function readAsar(file) {
  const fd = fs.openSync(file, 'r');
  const sizeBuf = Buffer.alloc(8);
  fs.readSync(fd, sizeBuf, 0, 8, 0);
  const headerPickleSize = sizeBuf.readUInt32LE(4);
  const headerBuf = Buffer.alloc(headerPickleSize);
  fs.readSync(fd, headerBuf, 0, headerPickleSize, 8);
  const strLen = headerBuf.readUInt32LE(4);
  const header = JSON.parse(headerBuf.subarray(8, 8 + strLen).toString('utf8'));
  const base = 8 + headerPickleSize;
  return { fd, header, base };
}

export function* walk(node, prefix = '') {
  for (const [name, child] of Object.entries(node.files || {})) {
    const p = prefix ? `${prefix}/${name}` : name;
    if (child.files) { yield [p, child, true]; yield* walk(child, p); }
    else yield [p, child, false];
  }
}

export function readEntry({ fd, base }, entry) {
  const buf = Buffer.alloc(entry.size);
  fs.readSync(fd, buf, 0, entry.size, base + Number(entry.offset));
  return buf;
}

const [, , cmd, asarFile, ...rest] = process.argv;
const isCli = import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isCli && cmd) {
  const a = readAsar(asarFile);
  if (cmd === 'ls') {
    const [prefix = '', depth = '99', filter = ''] = rest;
    const re = filter ? new RegExp(filter) : null;
    for (const [p, e, dir] of walk(a.header)) {
      if (!p.startsWith(prefix)) continue;
      const d = p.slice(prefix.length).split('/').filter(Boolean).length;
      if (d > Number(depth)) continue;
      if (re && !re.test(p)) continue;
      console.log(dir ? `${p}/` : `${p}\t${e.size}${e.unpacked ? '\tU' : ''}`);
    }
  } else if (cmd === 'extract') {
    const [prefix, outDir] = rest;
    let n = 0;
    for (const [p, e, dir] of walk(a.header)) {
      if (dir || !p.startsWith(prefix) || e.unpacked || p.includes('/node_modules/')) continue;
      const out = path.join(outDir, p);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, readEntry(a, e));
      n++;
    }
    console.log(`extracted ${n} files`);
  }
}
