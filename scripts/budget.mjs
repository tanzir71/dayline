// Bundle budget for /app/: at most 200 KB of gzipped JavaScript, not counting the PDF code
// (it loads only when sharing). Run after a build with the app flag on.
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const LIMIT = 200 * 1024;
const dir = 'dist/_astro';
const files = (await readdir(dir)).filter((f) => f.endsWith('.js') && !f.startsWith('pdf.'));
let total = 0;
for (const f of files) total += gzipSync(await readFile(`${dir}/${f}`)).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`JavaScript (gzipped, excluding PDF code): ${kb(total)} of ${kb(LIMIT)}`);
if (total > LIMIT) process.exit(1);
