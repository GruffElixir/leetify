import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
const root = path.resolve('dist');
const result = spawnSync(
  process.execPath,
  ['node_modules/addons-linter/bin/addons-linter', root, '--output', 'json'],
  {
    encoding: 'utf8',
    maxBuffer: 10485760,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  }
);
if (!result.stdout || result.error)
  throw result.error || new Error(result.stderr || 'Mozilla validation did not return a report.');
const report = JSON.parse(result.stdout);
const reviewed = [];
const unknown = [];
for (const warning of report.warnings) {
  // Older Firefox ignores the new declaration. Source transmission still requires the UI's
  // explicit runner consent, or the user's reviewed Codeforces submission.
  if (
    [
      'KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION',
      'KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION',
    ].includes(warning.code) &&
    warning.file === 'manifest.json' &&
    warning.description.includes('data_collection_permissions')
  ) {
    reviewed.push(`${warning.code}: declaration ignored on older Firefox; minimum remains 128.`);
    continue;
  }
  if (warning.code === 'UNSAFE_VAR_ASSIGNMENT' && warning.file === 'content.js') {
    const sourceMap = JSON.parse(readFileSync(path.join(root, `${warning.file}.map`), 'utf8'));
    const position = originalPositionFor(new TraceMap(sourceMap), {
      line: warning.line,
      column: warning.column - 1,
    });
    const index = sourceMap.sources.indexOf(position.source);
    const source = sourceMap.sourcesContent[index]
      ?.split('\n')
      .slice(position.line - 1, position.line + 2)
      .join('')
      .replace(/\s+/g, '');
    // Only DOMPurify's inert-document fallback is allowed. Application sinks and all
    // other dependency warnings fail. The actual source line is checked via its map.
    if (
      (position.source?.endsWith('node_modules/dompurify/src/purify.ts') ||
        position.source?.endsWith('node_modules/dompurify/dist/purify.es.mjs')) &&
      source?.startsWith('doc.documentElement.innerHTML=IS_EMPTY_INPUT?emptyHTML:dirtyPayload;')
    ) {
      reviewed.push(`DOMPurify inert-document fallback: ${position.source}:${position.line}`);
      continue;
    }
  }
  unknown.push(warning);
}
if (report.errors.length || unknown.length || result.status !== 0) {
  console.error(JSON.stringify({ errors: report.errors, unreviewedWarnings: unknown }, null, 2));
  process.exit(1);
}
console.log(
  `Mozilla validation: 0 errors, 0 unreviewed warnings (${reviewed.length} documented compatibility/vendor notices).`
);
for (const item of reviewed) console.log(`  ${item}`);
