import fs from 'node:fs';
import path from 'node:path';

const root = 'apps/web/src';
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const errors = [];
for (const file of walk(root)) {
  if (!/\.(css|tsx)$/.test(file) || file.endsWith('tokens.css')) continue;
  const source = fs.readFileSync(file, 'utf8');
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '));
  const report = (index, message) => errors.push(`${file}:${clean.slice(0, index).split('\n').length}: ${message}`);
  if (file.endsWith('.css')) {
    for (const match of clean.matchAll(/(?:font-size|font-weight|letter-spacing|border-radius)\s*:\s*([^;}]+)/g)) {
      const prop = match[0].split(':')[0].trim();
      const value = match[1].trim().replace(/\s*!important$/, '');
      let valid = true;
      if (prop === 'font-size') valid = /^var\(--text-[a-z-]+\)$/.test(value) || /^clamp\(var\(--text-amount\),\s*calc\(var\(--home-donut\)\s*\*\s*\.17\),\s*var\(--text-display\)\)$/.test(value);
      if (prop === 'font-weight') valid = /^(400|500|600)$/.test(value);
      if (prop === 'letter-spacing') valid = /^(0|-?0?\.01em)$/.test(value);
      if (prop === 'border-radius') valid = !/\d+(?:\.\d+)?px/.test(value.replace(/var\(--radius-[sml]\)|999px/g, ''));
      if (!valid) report(match.index, `${prop}: ${value}`);
    }
  } else {
    for (const match of clean.matchAll(/\bfontSize\s*=\s*(?:\{\s*)?["']?\d+(?:\.\d+)?(?:px)?["']?/g)) report(match.index, match[0]);
    for (const match of clean.matchAll(/\bfontSize\s*:\s*\d+(?:\.\d+)?/g)) report(match.index, match[0]);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Tipografía y radios: sin valores fuera del estándar.');
