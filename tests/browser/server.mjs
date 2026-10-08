import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') {
        res.end('ok');
        return;
      }
      if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html');
        res.end(
          '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/workspace.css"></head><body><script src="/harness.js"></script></body></html>'
        );
        return;
      }
      if (url.pathname === '/harness.js') {
        res.setHeader('Content-Type', 'application/javascript');
        try {
          const result = await build({
            entryPoints: [path.join(root, 'tests/browser/harness.js')],
            bundle: true,
            format: 'iife',
            write: false,
            logLevel: 'silent',
          });
          res.end(result.outputFiles[0].text);
        } catch (error) {
          res.end(`throw new Error(${JSON.stringify(error.message)});`);
        }
        return;
      }
      const target = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (!target.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader(
        'Content-Type',
        target.endsWith('.css')
          ? 'text/css'
          : target.endsWith('.js')
            ? 'application/javascript'
            : target.endsWith('.html')
              ? 'text/html'
              : target.endsWith('.svg')
                ? 'image/svg+xml'
                : 'application/octet-stream'
      );
      res.end(await readFile(target));
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(4173, '127.0.0.1');
