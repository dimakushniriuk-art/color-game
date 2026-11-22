import { useMemo, useRef, useState } from 'react';
import { go } from '../App';
import { createArtwork, fetchArtworks, fetchPublications, updateArtwork, useLoad } from '../lib/data';
import { fmtDateTime } from '../lib/dates';
import { parseStudioZip, uploadPackage } from '../lib/studioPackage';
import { publicUrl, upload } from '../lib/supabase';
import { STATUS_LABEL, type Artwork, type Status } from '../lib/types';

export function coverOf(a: Artwork) { return publicUrl(a.images[0]?.path ?? a.thumb_path); }

/** Crea un'opera nuova partendo da uno zip dello Studio (pacchetto + originale come prima foto). */
export async function importZip(file: File, onStep: (m: string) => void): Promise<Artwork> {
  onStep(`Leggo ${file.name}…`);
  const pkg = await parseStudioZip(file);
  const art = await createArtwork({ title: pkg.name });
  const folder = await uploadPackage(art.id, pkg, onStep);
  const images = [];
  if (pkg.original) {
    const p = `opere/${art.id}/foto/${Date.now().toString(36)}-originale.jpg`;
    await upload(p, pkg.original, 'image/jpeg');
    images.push({ path: p, caption: 'Originale usato nello Studio' });
  }
  return updateArtwork(art.id, {
    package_path: folder, thumb_path: `${folder}/thumb.jpg`, width: pkg.width, height: pkg.height,
    colors: pkg.colors, zones: pkg.zones, images, status: 'pronta',
  });
}

export function Archive() {
  const arts = useLoad(fetchArtworks);
  const pubs = useLoad(() => fetchPublications(new Date().toISOString()));
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status | 'tutte'>('tutte');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const nextPub = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pubs.data ?? []) if (!m.has(p.artwork_id)) m.set(p.artwork_id, p.publish_at);
    return m;
  }, [pubs.data]);

  const shown = (arts.data ?? []).filter((a) => {
    if (status !== 'tutte' && a.status !== status) return false;
    const s = q.trim().toLowerCase();
    return !s || [a.title, a.artist, a.year, a.location, a.movement, ...a.tags].some((v) => v?.toLowerCase().includes(s));
  });

  async function newArtwork() {
    try { const a = await createArtwork(); go('opere/' + a.id + '?modifica'); } catch (e: any) { setErr(e.message); }
  }
  async function importFiles(list: FileList | null) {
    const files = Array.from(list ?? []); // copia: svuotare l'input svuota anche la FileList
    if (!files.length) return;
    setErr(null);
    let last: Artwork | null = null;
    try {
      for (const f of files) last = await importZip(f, setBusy);
      arts.reload();
      if (files.length === 1 && last) go('opere/' + last.id);
    } catch (e: any) { setErr(e.message); }
    setBusy(null);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Archivio opere</h1>
          <p className="muted">{arts.data ? `${arts.data.length} opere` : 'Caricamento…'} · ogni opera ha la sua scheda, le foto vere e il pacchetto per l'app.</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => zipInput.current?.click()} disabled={!!busy}>⬆ Importa pacchetti dallo Studio (.zip)</button>
          <button onClick={newArtwork}>＋ Nuova opera</button>
          <input ref={zipInput} type="file" accept=".zip,application/zip" multiple hidden onChange={(e) => { importFiles(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      {busy && <div className="notice">{busy}</div>}
      {(err || arts.error) && <div className="notice err">{err || arts.error}</div>}

      <div className="filters">
        <input className="search" placeholder="Cerca per titolo, pittore, anno, museo, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg">
          {(['tutte', 'bozza', 'pronta', 'archiviata'] as const).map((s) => (
            <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s === 'tutte' ? 'Tutte' : STATUS_LABEL[s]}</button>
          ))}
        </div>
      </div>

      {arts.data && !arts.data.length && (
        <div className="empty">
          <h3>L'archivio è vuoto</h3>
          <p>Nello Studio prepara un'opera e scarica il <b>pacchetto per app (.zip)</b>, poi importalo qui. Oppure crea una scheda vuota con <b>＋ Nuova opera</b>.</p>
        </div>
      )}

      <div className="cards">
        {shown.map((a) => {
          const cover = coverOf(a), next = nextPub.get(a.id);
          return (
            <a key={a.id} className="art-card" href={`#/opere/${a.id}`}>
              <div className="art-img">{cover ? <img src={cover} alt="" loading="lazy" /> : <span>Nessuna immagine</span>}</div>
              <div className="art-body">
                <div className="art-title">{a.title}</div>
                <div className="muted small">{[a.artist, a.year].filter(Boolean).join(', ') || '—'}</div>
                <div className="art-tags">
                  <span className={`badge st-${a.status}`}>{STATUS_LABEL[a.status]}</span>
                  {!a.package_path && <span className="badge warn">senza pacchetto</span>}
                  {next && <span className="badge cal">📅 {fmtDateTime(next)}</span>}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
