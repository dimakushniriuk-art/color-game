# Arte da colorare

Trasforma un'opera d'arte in una pagina da colorare con i numeri, con colori presi dall'originale (anche su matite reali), e la colori sul telefono.

**Avvio su Windows:** doppio clic su `avvia.bat` (serve solo Node.js; al primo avvio installa da solo i componenti). Si apre `http://localhost:8787`.

## Pagine

| Pagina | A cosa serve |
|---|---|
| `/` **Laboratorio** | Il flusso completo (sotto) |
| `/app.html` **App Colora** | Colorare toccando le zone, su PC o telefono, anche offline |
| `/puzzle.html` | Segmentazione automatica senza AI (fino a 500 colori) |
| `/ai.html` | Versione AI semplice |

## Flusso del Laboratorio (4 passi)

1. **Carica la foto** — togli la cornice col rettangolo, se c'è.
2. **Sketch con Gemini** — 1–4 varianti, scegli con un clic (o carica uno sketch tuo). Si allinea da solo all'originale.
3. **Segmentazione e colori** (calcolo locale) — l'originale viene diviso in pezzi col colore prevalente dei pixel reali (nessun colore inventato); poi ogni zona dello sketch riceve il suo colore. Parte da solo.
4. **Colora** — direttamente nella pagina: tocca una zona col colore giusto e **appare il pezzo vero dell'immagine originale**. Menu ⋯: rivela l'originale / colore piatto, solo colore giusto, numeri.

Sotto, in **Opzioni avanzate**: allineamento manuale, linee aperte, sfumature, matite reali (Faber-Castell, Prismacolor, la mia scatola), numeri, PDF A4, SVG, pacchetto ZIP. Più in basso: legenda, galleria, elaborazione in serie, gestione prompt.

## App Colora
Tocca una zona per colorarla col colore scelto in basso. Due dita / rotella per lo zoom, trascina per spostarti, ↶ annulla, 👁 tieni premuto per vedere l'originale. Opzione "solo il colore giusto". I progressi si salvano da soli.
Sul telefono: metti online il progetto (sotto), apri `…/app.html` e scegli "Aggiungi a schermata Home": funziona come un'app, anche senza internet.

## Metterlo online (Cloudflare, gratis)
```
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put APP_PASSWORD
npx wrangler deploy
```

## Pacchetto ZIP (per app future)
`immagini/` originale, sketch, colorate, pagine · `vettoriale/` SVG (zone con `id` e `data-colore`) · `stampa/` PDF · `dati/zone.json` (tavolozza con matite, zone con colore/area/posizione numero, parametri, prompt) · `dati/mappa_zone.png` (id zona = R + G·256 + B·65536) · `dati/legenda.csv`.

## Note
- I codici colore delle matite sono approssimazioni da schermo (fonte: jennyscrayoncollection.com): verifica con una prova su carta.
- La chiave Gemini sta solo nel server (`.dev.vars` in locale, "secret" su Cloudflare). Non condividere lo zip del progetto se contiene `.dev.vars`.
