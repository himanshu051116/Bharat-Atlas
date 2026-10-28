import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { inflateRawSync } from 'node:zlib';

// Dependency-free ZIP reader; expects the checked, public-safe bundle.
const archive = readFileSync(resolve('site.zip'));
const output = resolve('dist');
const eocdSignature = 0x06054b50;
const centralSignature = 0x02014b50;
const localSignature = 0x04034b50;
let eocd = -1;
for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65557); i--) {
  if (archive.readUInt32LE(i) === eocdSignature) { eocd = i; break; }
}
if (eocd < 0) throw new Error('ZIP end of central directory not found');
const total = archive.readUInt16LE(eocd + 10);
let pos = archive.readUInt32LE(eocd + 16);
let extracted = 0;
for (let i = 0; i < total; i++) {
  if (archive.readUInt32LE(pos) !== centralSignature) throw new Error('Invalid central ZIP header');
  const method = archive.readUInt16LE(pos + 10);
  const compressedSize = archive.readUInt32LE(pos + 20);
  const uncompressedSize = archive.readUInt32LE(pos + 24);
  const filenameLength = archive.readUInt16LE(pos + 28);
  const extraLength = archive.readUInt16LE(pos + 30);
  const commentLength = archive.readUInt16LE(pos + 32);
  const localOffset = archive.readUInt32LE(pos + 42);
  const name = archive.subarray(pos + 46, pos + 46 + filenameLength).toString('utf8');
  pos += 46 + filenameLength + extraLength + commentLength;
  if (name.endsWith('/')) continue;
  const dest = resolve(output, name);
  if (!dest.startsWith(output + '/') || name.includes('\\')) throw new Error('Unsafe ZIP path: ' + name);
  if (archive.readUInt32LE(localOffset) !== localSignature) throw new Error('Invalid local ZIP header: ' + name);
  const start = localOffset + 30 + archive.readUInt16LE(localOffset + 26) + archive.readUInt16LE(localOffset + 28);
  const raw = archive.subarray(start, start + compressedSize);
  const file = method === 8 ? inflateRawSync(raw) : method === 0 ? raw : null;
  if (!file || file.length !== uncompressedSize) throw new Error('Invalid size or compression for ' + name);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, file);
  extracted++;
}
if (extracted < 780) throw new Error('Incomplete public site: only ' + extracted + ' assets');
console.log('Bharat Atlas release extracted:', extracted, 'files');
