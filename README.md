# Color Game

Gioco "colora con i numeri" con generatore automatico di disegni. **Un solo sito** (un progetto Vercel), un solo database (Supabase `color-game`), un solo login del team.

| Indirizzo | Cartella | Cosa contiene | Chi lo usa |
|---|---|---|---|
| `/` | `app/` | App dei giocatori (React + Vite, poi iOS/Android con Capacitor) | tutti |
| `/admin/` | `admin/` | Archivio opere (schede, foto vere, pacchetti), "Arrivati dallo Studio", calendario delle pubblicazioni | team |
| `/studio/` | `studio/public/` | Studio "Arte da colorare": Laboratorio con Gemini, puzzle, App Colora di prova | team |
| `/api/*` | `api/proxy.js` → `studio/src/worker.js` | Proxy Gemini e condivisione | team |
| — | `supabase/migrations/` | Tabelle opere/calendario, `get_catalog()`, bucket | — |

## Come comunicano
1. **Studio → Admin:** nello Studio "📤 Invia all'admin" carica un pacchetto leggero nel bucket privato `coloring/inbox/`; nell'admin compare in "Arrivati dallo Studio" → Importa.
2. **Admin → App:** l'admin salva opere (`artworks`), pacchetti (bucket pubblico `artworks`) e calendario (`publications`); l'app chiama `get_catalog()` e vede solo le opere già uscite, aggiornandosi da sola all'ora della prossima uscita.
3. **Login unico:** Studio e Admin usano lo stesso account Supabase (email in `team_members`); entri una volta e passi da uno all'altro. Le API dello Studio accettano il token del team (o, come riserva, `APP_PASSWORD`).

## Vercel (un solo progetto)
- Root Directory: **vuota** (radice del repository). `vercel.json` alla radice fa tutto: `npm run build` → `scripts/build-site.mjs` costruisce `app` e `admin` e copia lo Studio in `dist/`.
- Variabili d'ambiente: **`GEMINI_API_KEY`** (obbligatoria). Facoltative: `APP_PASSWORD` (riserva al login), `SUPABASE_URL` / `SUPABASE_ANON_KEY` (predefiniti: progetto `color-game`).
- Supabase → Authentication → URL Configuration: Site URL = indirizzo del sito; Redirect URLs = `<sito>/admin/` (per il link via email).

## In locale
- Tutto il sito: `npm run build` e servi `dist/` (le API servono Vercel o `studio/avvia.bat`).
- Solo Studio (Windows): `studio/avvia.bat` (serve `studio/.dev.vars` con `GEMINI_API_KEY` e `APP_PASSWORD`).
- Solo Admin: `admin/avvia_admin.bat` → http://localhost:5180/admin/
- Solo App: `cd app && npm install && npm run dev`. App mobile: vedi [`app/README.md`](app/README.md).
