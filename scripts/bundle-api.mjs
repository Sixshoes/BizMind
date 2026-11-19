import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('api', { recursive: true });

await build({
  entryPoints: ['vercel/api-entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'api/[[...path]].js',
  packages: 'external',
});
