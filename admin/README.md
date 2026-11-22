# Admin — archivio opere e calendario

Pannello per il team: archivio delle opere (scheda tipo Wikipedia, foto vere, pacchetto da colorare) e calendario delle uscite nell'app.

- **Nel sito unico:** `/admin/` (vedi README principale). **In locale:** `avvia_admin.bat` oppure `cd admin && npm install && npm run dev` → http://localhost:5180/admin/
- **Login:** account Supabase Auth del progetto `color-game`; entrano solo le email in `team_members`.
- **Supabase → Authentication → URL Configuration:** aggiungi l'indirizzo dell'admin ai Redirect URLs per il "link per email".

## Flusso
1. Nello Studio prepari l'opera e premi **📤 Invia all'admin** (oppure scarichi lo zip).
2. Nell'admin: **Arrivati dallo Studio → Importa** (oppure **Importa pacchetti dallo Studio** per gli zip). L'admin converte il pacchetto nel formato dell'app (`palette.json`, `regions.json`, `regions_idmap.png`, `outline.png`, `thumb.jpg`) e lo carica nel bucket pubblico `artworks`.
3. Completi la scheda (pittore, anno, tecnica, museo, descrizione, foto vere).
4. Nel **Calendario** scegli giorno e ora esatta. L'app chiama `get_catalog()` e vede solo le opere già uscite; ricarica da sola all'ora della prossima uscita.

## Database (`supabase/migrations/20261122_admin_opere_calendario.sql`)
- `artworks`: scheda, foto (`images` jsonb), percorso del pacchetto, stato (bozza/pronta/archiviata).
- `publications`: `artwork_id`, `publish_at` (timestamptz), `featured` = disegno del giorno.
- `get_catalog()`: funzione pubblica con le sole uscite passate + `next_at` + `daily_id`.
- Bucket `artworks` pubblico in lettura (per URL), scrittura solo team.
