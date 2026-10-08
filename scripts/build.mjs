import { build } from 'esbuild';
import { mkdir, readFile, writeFile, cp, access, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
if (dist !== path.resolve(root, 'dist') || path.dirname(dist) !== root)
  throw new Error('Unsafe build directory.');
const exists = async (file) => {
  try {
    await access(path.join(root, file));
    return true;
  } catch {
    return false;
  }
};
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
manifest.version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
for (const name of ['content', 'background', 'options']) {
  if (await exists(`src/${name}.js`))
    await build({
      entryPoints: [path.join(root, `src/${name}.js`)],
      outfile: path.join(dist, `${name}.js`),
      bundle: true,
      format: 'iife',
      target: ['firefox128'],
      minify: true,
      legalComments: 'eof',
    });
  else if (await exists(`${name}.js`))
    await cp(path.join(root, `${name}.js`), path.join(dist, `${name}.js`));
}
const modernContent = await exists('src/content.js');
manifest.content_scripts[0].js = modernContent ? ['content.js'] : ['core.js', 'content.js'];
if (!modernContent) await cp(path.join(root, 'core.js'), path.join(dist, 'core.js'));
const css = modernContent
  ? await readFile(path.join(root, 'src/ui/workspace.css'), 'utf8')
  : await readFile(path.join(root, 'styles.css'), 'utf8');
const mathCss = await readFile(path.join(root, 'node_modules/katex/dist/katex.min.css'), 'utf8');
await writeFile(path.join(dist, 'styles.css'), `${mathCss}\n${css}`);
await cp(path.join(root, 'node_modules/katex/dist/fonts'), path.join(dist, 'fonts'), {
  recursive: true,
});
for (const name of ['options.html', 'options.css']) {
  const source = (await exists(`src/ui/${name}`)) ? `src/ui/${name}` : name;
  await cp(path.join(root, source), path.join(dist, name));
}
manifest.web_accessible_resources = [
  { resources: ['fonts/*'], matches: ['*://codeforces.com/*', '*://www.codeforces.com/*'] },
];
if (await exists('src/ui/icon.svg')) {
  await cp(path.join(root, 'src/ui/icon.svg'), path.join(dist, 'icon.svg'));
  manifest.icons = { 48: 'icon.svg', 96: 'icon.svg' };
}
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
  const licenseFile = files.find((file) => /^licen[cs]e(?:\.|$)/i.test(file));
  notices.push(
    `## ${name} ${dependency.version}\nLicense: ${dependency.license || 'See package license'}\n${licenseFile ? await readFile(path.join(dir, licenseFile), 'utf8') : ''}`
  );
  for (const child of Object.keys(dependency.dependencies || {})) await license(child, dir);
}
for (const name of Object.keys(pkg.dependencies || {})) await license(name);
await writeFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), notices.join('\n\n'));
await cp(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(dist, 'THIRD_PARTY_NOTICES.md'));
console.log('Built extension in dist/.');
