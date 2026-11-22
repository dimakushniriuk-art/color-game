# Admin — archivio opere e calendario

Pannello per il team: archivio delle opere (scheda tipo Wikipedia, foto vere, pacchetto da colorare) e calendario delle uscite nell'app.

- **Avvio locale:** `cd admin && npm install && npm run dev`
- **Login:** account Supabase Auth del progetto `color-game`; entrano solo le email in `team_members`.
- **Vercel:** nuovo progetto da questo repository, Root Directory `admin`, framework Vite. Le variabili (`.env.example`) sono facoltative: i valori predefiniti puntano al Supabase `color-game` e agli indirizzi attuali di Studio e App.
- **Supabase → Authentication → URL Configuration:** aggiungi l'indirizzo dell'admin ai Redirect URLs per il "link per email".

## Flusso
1. Nello Studio prepari l'opera e premi **⬇ Scarica pacchetto per app (.zip)**.
2. Nell'admin: **Importa pacchetti dallo Studio** (anche più zip insieme). L'admin converte il pacchetto nel formato dell'app (`palette.json`, `regions.json`, `regions_idmap.png`, `outline.png`, `thumb.jpg`) e lo carica nel bucket pubblico `artworks`.
3. Completi la scheda (pittore, anno, tecnica, museo, descrizione, foto vere).
4. Nel **Calendario** scegli giorno e ora esatta. L'app chiama `get_catalog()` e vede solo le opere già uscite; ricarica da sola all'ora della prossima uscita.

## Database (`supabase/migrations/20261122_admin_opere_calendario.sql`)
- `artworks`: scheda, foto (`images` jsonb), percorso del pacchetto, stato (bozza/pronta/archiviata).
- `publications`: `artwork_id`, `publish_at` (timestamptz), `featured` = disegno del giorno.
- `get_catalog()`: funzione pubblica con le sole uscite passate + `next_at` + `daily_id`.
- Bucket `artworks` pubblico in lettura (per URL), scrittura solo team.
