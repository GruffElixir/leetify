import { build } from 'esbuild';
import { mkdir, readFile, writeFile, cp, access, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
if (dist !== path.resolve(root, 'dist') || path.dirname(dist) !== root)
  throw new Error('Unsafe build directory.');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
manifest.version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
for (const name of ['content', 'background', 'options']) {
  await build({
    entryPoints: [path.join(root, `src/${name}.js`)],
    outfile: path.join(dist, `${name}.js`),
    bundle: true,
    format: 'iife',
    target: ['firefox128'],
    minify: true,
    legalComments: 'eof',
    sourcemap: 'external',
  });
}
await mkdir(path.join(dist, 'local-cpp'), { recursive: true });
for (const name of ['compiler', 'execution']) {
  await build({
    entryPoints: [path.join(root, `src/runner/${name}-worker.js`)],
    outfile: path.join(dist, `local-cpp/${name}-worker.js`),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['firefox128'],
    define: { process: 'undefined' },
    minify: true,
    legalComments: 'eof',
    sourcemap: 'external',
  });
}
for (const name of ['clang.wasm', 'lld.wasm', 'sysroot.tar'])
  await cp(
    path.join(root, 'node_modules/browsercc/dist', name),
    path.join(dist, 'local-cpp', name)
  );
manifest.content_scripts[0].js = ['content.js'];
const css = await readFile(path.join(root, 'src/ui/workspace.css'), 'utf8');
const mathStyles = postcss.parse(
  await readFile(path.join(root, 'node_modules/katex/dist/katex.min.css'), 'utf8')
);
mathStyles.walkRules((rule) => {
  rule.selectors = rule.selectors.map((selector) => `#leetify-workspace ${selector}`);
});
const mathCss = mathStyles.toString();
await writeFile(path.join(dist, 'styles.css'), `${mathCss}\n${css}`);
await cp(path.join(root, 'node_modules/katex/dist/fonts'), path.join(dist, 'fonts'), {
  recursive: true,
});
for (const name of ['options.html', 'options.css']) {
  await cp(path.join(root, `src/ui/${name}`), path.join(dist, name));
}
manifest.web_accessible_resources = [
  { resources: ['fonts/*'], matches: ['*://codeforces.com/*', '*://www.codeforces.com/*'] },
];
await cp(path.join(root, 'src/ui/icon.svg'), path.join(dist, 'icon.svg'));
manifest.icons = { 48: 'icon.svg', 96: 'icon.svg' };
await writeFile(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
await cp(path.join(root, 'LICENSE'), path.join(dist, 'LICENSE'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const seen = new Set();
const notices = ['# Bundled third-party software\n'];
async function license(name, base = root) {
  if (seen.has(name)) return;
  let dir = path.join(base, 'node_modules', name);
  if (
    !(await access(dir).then(
      () => true,
      () => false
    ))
  )
    dir = path.join(root, 'node_modules', name);
  let dependency;
  try {
    dependency = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    return;
  }
  seen.add(name);
  const files = await readdir(dir);
  const licenseFiles = files.filter((file) => /^licen[cs]e(?:[.-]|$)/i.test(file));
  notices.push(
    `## ${name} ${dependency.version}\nLicense: ${dependency.license || 'See package license'}\n${(await Promise.all(licenseFiles.map((file) => readFile(path.join(dir, file), 'utf8')))).join('\n\n')}`
  );
  for (const child of Object.keys(dependency.dependencies || {})) await license(child, dir);
}
for (const name of Object.keys(pkg.dependencies || {})) await license(name);
for (const file of await readdir(path.join(root, 'vendor/licenses')))
  notices.push(
    `## C++ toolchain: ${file}\n${await readFile(path.join(root, 'vendor/licenses', file), 'utf8')}`
  );
await writeFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), notices.join('\n\n'));
await cp(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(dist, 'THIRD_PARTY_NOTICES.md'));
console.log('Built extension in dist/.');
