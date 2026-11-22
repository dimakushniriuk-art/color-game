// Costruisce il sito unico in dist/:  /  = app giocatori,  /admin/ = pannello admin,  /studio/ = Studio.
// Le API (/api/*) sono la funzione api/proxy.js (riusa studio/src/worker.js).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist');
const run = (cmd, cwd) => { console.log(`\n▶ ${cmd}  (${cwd})`); execSync(cmd, { cwd: join(root, cwd), stdio: 'inherit' }); };

for (const app of ['app', 'admin']) {
  run(existsSync(join(root, app, 'package-lock.json')) ? 'npm ci --no-audit --no-fund' : 'npm install --no-audit --no-fund', app);
  run('npm run build', app);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'app', 'dist'), out, { recursive: true });
cpSync(join(root, 'admin', 'dist'), join(out, 'admin'), { recursive: true });
cpSync(join(root, 'studio', 'public'), join(out, 'studio'), { recursive: true });
console.log('\n✓ Sito pronto in dist/  (/, /admin/, /studio/)');
