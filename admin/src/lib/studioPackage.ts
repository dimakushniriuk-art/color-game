// Importa il pacchetto .zip scaricato dallo Studio ("⬇ Scarica pacchetto per app") e lo
// trasforma nel formato che l'app dei giocatori legge (app/src/data/packageLoader.ts):
//   palette.json       [{color_id, color_number, hex, rgb}]
//   regions.json       [{region_id, color_id}]
//   regions_idmap.png  = dati/mappa_zone.png (id = R + G*256 + B*65536)
//   outline.png        = immagini/sketch.png (linee nere)
// In più: zone.json originale, colorata.png e thumb.jpg per la galleria.
import { unzipSync } from 'fflate';
import { upload } from './supabase';

interface StudioZone { id: number; colore: number }
interface StudioPalette { numero: number; hex: string; rgb: [number, number, number] }
interface StudioData { formato?: string; nome?: string; larghezza: number; altezza: number; palette: StudioPalette[]; zone: StudioZone[] }

export interface ParsedPackage {
  name: string;
  width: number;
  height: number;
  colors: number;
  zones: number;
  files: Record<string, Uint8Array>;
  original?: Uint8Array;
  colored: Uint8Array;
}

const find = (files: Record<string, Uint8Array>, suffix: string) => {
  const k = Object.keys(files).find((n) => n.replace(/\\/g, '/').toLowerCase().endsWith(suffix));
  return k ? files[k] : undefined;
};

export async function parseStudioZip(file: File): Promise<ParsedPackage> {
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const zj = find(files, 'dati/zone.json');
  const map = find(files, 'dati/mappa_zone.png');
  if (!zj || !map) throw new Error('Questo zip non sembra un pacchetto dello Studio (mancano dati/zone.json o dati/mappa_zone.png).');
  const d: StudioData = JSON.parse(new TextDecoder().decode(zj));
  if (!Array.isArray(d.palette) || !Array.isArray(d.zone)) throw new Error('zone.json senza tavolozza o zone.');
  const sketch = find(files, 'immagini/sketch.png');
  const colored = find(files, 'immagini/colorata_piatta.png') ?? find(files, 'immagini/colorata_morbida.png');
  if (!colored) throw new Error('Nel pacchetto manca l\'immagine colorata.');

  const enc = new TextEncoder();
  const palette = d.palette.map((p, i) => ({ color_id: i, color_number: p.numero ?? i + 1, hex: p.hex, rgb: p.rgb }));
  const regions = d.zone.map((z) => ({ region_id: z.id, color_id: z.colore - 1 }));
  const out: Record<string, Uint8Array> = {
    'palette.json': enc.encode(JSON.stringify(palette)),
    'regions.json': enc.encode(JSON.stringify(regions)),
    'regions_idmap.png': map,
    'zone.json': zj,
    'colorata.png': colored,
    'thumb.jpg': await thumbnail(colored, 480),
  };
  if (sketch) out['outline.png'] = sketch;
  return {
    name: d.nome || file.name.replace(/(_pacchetto)?\.zip$/i, ''),
    width: d.larghezza, height: d.altezza, colors: palette.length, zones: regions.length,
    files: out, original: find(files, 'immagini/originale.jpg'), colored,
  };
}

const TYPES: Record<string, string> = { json: 'application/json', png: 'image/png', jpg: 'image/jpeg' };

/** Carica il pacchetto in una cartella nuova (opere/<id>/pacchetto/<data>) così la cache non serve file vecchi. */
export async function uploadPackage(artworkId: string, pkg: ParsedPackage, onStep?: (msg: string) => void): Promise<string> {
  const folder = `opere/${artworkId}/pacchetto/${Date.now().toString(36)}`;
  for (const [name, data] of Object.entries(pkg.files)) {
    onStep?.(`Carico ${name}…`);
    await upload(`${folder}/${name}`, data, TYPES[name.split('.').pop()!] ?? 'application/octet-stream');
  }
  return folder;
}

export async function thumbnail(src: Blob | Uint8Array, max: number, quality = 0.85): Promise<Uint8Array> {
  const blob = src instanceof Blob ? src : new Blob([src as BlobPart]);
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  const out = await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('Anteprima non creata'))), 'image/jpeg', quality));
  return new Uint8Array(await out.arrayBuffer());
}
