import { zipSync } from 'fflate';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = process.argv.indexOf('--output');
const output =
  index >= 0 && process.argv[index + 1]
    ? path.resolve(process.argv[index + 1])
    : path.join(root, 'leetify-3.0.0.zip');
const files = {};
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), `${name}/`);
    else files[name] = new Uint8Array(await readFile(path.join(directory, entry.name)));
  }
}
await collect(path.join(root, 'dist'));
if (!files['manifest.json']) throw new Error('Build the extension before packaging.');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, zipSync(files, { level: 9 }));
console.log(`Packaged ${Object.keys(files).length} files: ${output}`);
