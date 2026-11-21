# Color Game

Gioco "colora con i numeri" con generatore automatico di disegni.

| Cartella | Cosa contiene | Dove gira |
|---|---|---|
| `studio/` | Studio, versione finale ("Arte da colorare"): Laboratorio con Gemini, puzzle senza AI fino a 500 colori, App Colora | Vercel (o Cloudflare Workers) |
| `app/` | App per i giocatori (React + Vite, poi iOS/Android con Capacitor) | Vercel + store |

## Studio
- In locale su Windows: doppio clic su `studio/avvia.bat` (serve `studio/.dev.vars`, vedi `.dev.vars.example`).
- **Vercel:** nuovo progetto da questo repository, Root Directory `studio`, nessun framework. Variabili d'ambiente:
  `GEMINI_API_KEY` e `APP_PASSWORD`. Le chiamate `/api/*` passano da `studio/api/proxy.js`, che riusa `src/worker.js`.
- **Cloudflare (alternativa):** `cd studio && npx wrangler deploy`, con i segreti messi via `npx wrangler secret put`.
- La chiave Gemini non va mai nel repository: `.dev.vars` è escluso dal `.gitignore`.

## App giocatori
Vercel: nuovo progetto, Root Directory `app`, framework Vite, output `dist`. Dettagli in [`app/README.md`](app/README.md).
