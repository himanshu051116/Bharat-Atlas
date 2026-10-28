import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const names = ['source.part00', 'source.part01', 'source.part02', 'source.part03'];
const data = Buffer.concat(names.map(n => readFileSync(resolve('release/source-parts', n))));
const hash = createHash('sha256').update(data).digest('hex');
if (hash !== '4689ac8875be8c05af0f8fcf9624edb8312374afaaa6dadbe667147468851e06') {
  throw new Error('Source archive failed SHA-256 verification: ' + hash);
}
const target = resolve('bharat-atlas-v1.11-public-safe-source.zip');
writeFileSync(target, data);
console.log('Reconstructed:', target, data.length, 'bytes. SHA-256:', hash);
