# Color Game

Gioco "colora con i numeri" con generatore automatico di disegni.

| Cartella | Cosa contiene | Dove gira |
|---|---|---|
| `app/` | App per i giocatori (React + Vite, poi iOS/Android con Capacitor) | Vercel + store |
| `web/` | Studio del team (Next.js): caricamento, passi, rigenera, pubblicazione | Vercel |
| `engine/` | Motore Python che genera i disegni (worker sui PC del team) | PC del team |
| `supabase/` | Schema e migrazioni del progetto Supabase `color-game` | Supabase |

Dettagli dell'app in [`app/README.md`](app/README.md).
