/* Serves a folder over HTTP for the browser tests of the examples. Usage: node e2e/serve-static.mjs <folder> <port> */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const [folder, port] = process.argv.slice(2);
const root = resolve(folder);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

createServer(async (request, response) => {
  const path = normalize(new URL(request.url ?? '/', 'http://localhost').pathname);
  const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(Number(port), '127.0.0.1');
