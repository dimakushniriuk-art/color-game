// Copia nell'app il motore di colorazione dello Studio (blocco 4): studio/public/app.html → public/gioco/.
// Una sola fonte: ogni modifica al blocco 4 dello Studio arriva anche nell'app (web e iOS/Android).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const app = new URL('..', import.meta.url).pathname;
const src = join(app, '..', 'studio', 'public');
const dst = join(app, 'public', 'gioco');
if (!existsSync(join(src, 'app.html'))) { console.warn('copia-gioco: studio/public/app.html non trovato, salto'); process.exit(0); }
mkdirSync(dst, { recursive: true });
for (const f of ['app.html', 'icona-192.png', 'manifest.webmanifest']) if (existsSync(join(src, f))) copyFileSync(join(src, f), join(dst, f));
console.log('copia-gioco: motore del blocco 4 copiato in public/gioco/');
