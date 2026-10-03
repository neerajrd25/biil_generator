// Stages a clean Lambda package in .build/lambda: source + production deps only.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.build', 'lambda');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

cpSync(join(root, 'src'), join(out, 'src'), {
  recursive: true,
  filter: (p) => !p.includes(`${join('src', 'tests')}`),
});
cpSync(join(root, 'package.json'), join(out, 'package.json'));
cpSync(join(root, 'package-lock.json'), join(out, 'package-lock.json'));

execSync('npm ci --omit=dev --no-audit --no-fund', { cwd: out, stdio: 'inherit' });
console.log(`Lambda package staged in ${out}`);
