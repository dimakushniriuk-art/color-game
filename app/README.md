# Color Game – app per i giocatori

Web app (React + Vite + TypeScript) da pubblicare su App Store e Google Play tramite **Capacitor**.
Stesso codice per web, iOS e Android.

## Avvio
```bash
cd app
npm install
npm run dev          # http://localhost:5173 (anche dal telefono sulla stessa rete: usa l'IP del PC)
npm run build        # versione di produzione in dist/
```

## Cosa c'è
- Onboarding (3 schermate), Galleria con "Disegno del giorno" e categorie, I miei lavori (in corso / completati), Impostazioni, Privacy (bozza).
- Gioco: zoom con due dita / rotellina / doppio tocco, trascinamento, tolleranza al tocco, zone del colore scelto a scacchi,
  numeri nitidi a ogni zoom, tavolozza con avanzamento per colore, colore successivo automatico, suggerimento (lampadina),
  suoni e vibrazione, salvataggio automatico.
- Fine disegno: coriandoli, replay del time-lapse, salva/condividi l'immagine, prossimo disegno.
- Tema chiaro/scuro/automatico. 8 disegni demo generati nell'app, così si gioca anche senza server.

## Premi, sfide e animazioni
- Monete 🪙, suggerimenti 💡, XP e livelli; premio giornaliero con serie di 7 giorni.
- 3 sfide al giorno e 1 a settimana (uguali per tutti nello stesso giorno), da riscuotere a mano.
- 12 trofei, negozio (monete → suggerimenti), disegno del giorno con premio ×2.
- Animazioni: riempimento circolare dal punto toccato, scintille, colore completato, popup trofei/sfide,
  "nuovo livello", conteggio dei premi a fine disegno, ingresso schermate e schede.
- Regole e valori in `src/state/rewards.ts` (tutto in locale; da spostare su Supabase quando ci saranno gli account,
  altrimenti si può barare modificando i dati del dispositivo).

## Disegni veri (dal motore Python)
Imposta `VITE_CATALOG_URL` (vedi `.env.example`) con l'URL di un JSON:
```json
{ "items": [ { "id": "madonna-01", "title": "Madonna", "category": "Arte", "difficulty": "difficile",
               "baseUrl": "https://.../packages/madonna-01/", "thumbnailUrl": "https://.../thumbnail.png", "isNew": true } ] }
```
`baseUrl` è la cartella del pacchetto: `palette.json`, `regions.json`, `regions_idmap.png`, `outline.png` (facoltativo).

⚠️ **Da verificare con `engine/`:** il caricatore (`src/data/packageLoader.ts`) presume che in `regions_idmap.png`
l'ID sia R + G·256 + B·65536 (alfa 0 = nessuna zona) e accetta più nomi di campo nei JSON. Se il motore esporta in modo diverso
si modifica solo quel file. Il bucket Supabase `coloring` è privato: per l'app serve un bucket pubblico per i pacchetti
pubblicati (o una funzione che firma gli URL).

## iOS (serve un Mac con Xcode)
```bash
npx cap add ios      # solo la prima volta
npm run cap:ios      # build + sync + apre Xcode
```
In Xcode: Team di firma (account Apple Developer), icona, poi Product → Archive → TestFlight.

## Android (anche dal PC Windows, con Android Studio)
```bash
npx cap add android  # solo la prima volta
npm run cap:android  # build + sync + apre Android Studio
```
Poi Build → Generate Signed Bundle (AAB) → Play Console, test interno.

## Prima della pubblicazione
- Cambiare `appId` in `capacitor.config.ts` (definitivo, non si cambia dopo la prima pubblicazione).
- Icone e splash vere (`npx @capacitor/assets generate`), screenshot per gli store.
- Privacy policy vera (anche pubblicata online) e contatti.
- Decidere monetizzazione e account (oggi: gratis, senza login, progressi solo sul dispositivo).
- Su Android, tasto Indietro: oggi usa la cronologia del WebView; per un controllo completo aggiungere `@capacitor/app`.

## Struttura
```
src/engine/   tipi, costruzione puzzle, rendering, segmentazione demo
src/data/     catalogo, disegni demo, caricatore pacchetti
src/state/    impostazioni e progressi (localStorage), suoni/vibrazione
src/screens/  Gallery, MyWorks, Play, Complete, Settings, Onboarding, Privacy
src/components GameCanvas (zoom/tocchi/numeri), Card, Thumb, Modal, Icons
```
