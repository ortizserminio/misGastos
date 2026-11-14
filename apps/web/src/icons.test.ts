// @ts-ignore Node types are available to Vitest but excluded from the app tsconfig.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const publicFile = (name: string) => new URL(`../public/${name}`, import.meta.url);
const pngSize = (name: string) => {
  const bytes = readFileSync(publicFile(name));
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

describe('app icons', () => {
  it.each([['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]] as const)('%s has the expected dimensions', (name, size) => {
    expect(pngSize(name)).toEqual([size, size]);
  });

  it('links the iPhone icon and replaces the M artwork', () => {
    expect(readFileSync(new URL('../index.html', import.meta.url), 'utf8')).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>');
    expect(readFileSync(publicFile('icon.svg'), 'utf8')).not.toContain('M44 123V70');
  });
});
