import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const vite = path.join(root, 'apps/web/node_modules/vite/bin/vite.js');
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const [name, args, cwd] of [
  ['API', ['apps/api/server.mjs'], root],
  ['Web', [vite, '--host', '127.0.0.1', '--port', '5174', '--strictPort'], path.join(root, 'apps/web')],
]) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', (error) => { console.error(`${name}: ${error.message}`); stop(1); });
  child.on('exit', (code) => { if (!stopping) { console.error(`${name} se ha detenido.`); stop(code || 1); } });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
