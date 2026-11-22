import { useEffect, useMemo, useRef, useState } from 'react';
import { go } from '../App';
import { createArtwork, fetchArtworks, fetchPublications, updateArtwork, useLoad } from '../lib/data';
import { fmtDateTime } from '../lib/dates';
import { parseStudioZip, uploadPackage } from '../lib/studioPackage';
import { INBOX_BUCKET, INBOX_DIR, publicUrl, supabase, upload } from '../lib/supabase';
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

      <Inbox busy={!!busy} setBusy={setBusy} setErr={setErr} onImported={(a) => go('opere/' + a.id)} />

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
          <p>Nello Studio prepara un'opera e premi <b>📤 Invia all'admin</b>: comparirà qui sopra in "Arrivati dallo Studio". Puoi anche importare uno zip scaricato o creare una scheda vuota con <b>＋ Nuova opera</b>.</p>
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

interface InboxItem { name: string; size: number; at: string }

/** Pacchetti inviati dallo Studio col pulsante "📤 Invia all'admin" (bucket privato, cartella inbox/). */
function Inbox({ onImported, setBusy, setErr, busy }: { onImported(a: Artwork): void; setBusy(m: string | null): void; setErr(m: string | null): void; busy: boolean }) {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const load = () => supabase.storage.from(INBOX_BUCKET).list(INBOX_DIR, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    .then(({ data }) => setItems((data ?? []).filter((f) => f.name.endsWith('.zip')).map((f) => ({
      name: f.name, size: (f.metadata as { size?: number } | null)?.size ?? 0, at: f.created_at ?? '' }))));
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  if (!items?.length) return null;

  const label = (n: string) => n.replace(/^[0-9TZ-]+_/, '').replace(/\.zip$/, '').replace(/-/g, ' ');
  async function importa(it: InboxItem) {
    setErr(null);
    try {
      setBusy(`Scarico ${label(it.name)}…`);
      const { data, error } = await supabase.storage.from(INBOX_BUCKET).download(`${INBOX_DIR}/${it.name}`);
      if (error || !data) throw new Error(error?.message ?? 'download non riuscito');
      const art = await importZip(new File([data], it.name, { type: 'application/zip' }), setBusy);
      await supabase.storage.from(INBOX_BUCKET).remove([`${INBOX_DIR}/${it.name}`]);
      setBusy(null); onImported(art);
    } catch (e: any) { setErr(e.message); setBusy(null); }
  }
  async function scarta(it: InboxItem) {
    if (!confirm(`Scartare "${label(it.name)}"? Il pacchetto inviato dallo Studio verrà cancellato.`)) return;
    await supabase.storage.from(INBOX_BUCKET).remove([`${INBOX_DIR}/${it.name}`]);
    load();
  }
  return (
    <section className="inbox panel">
      <h3>📥 Arrivati dallo Studio <span className="badge cal">{items.length}</span></h3>
      <p className="muted small">Inviati con "📤 Invia all'admin". Importa per creare la scheda dell'opera con il suo pacchetto.</p>
      <ul>
        {items.map((it) => (
          <li key={it.name}>
            <span><b>{label(it.name)}</b> <span className="muted small">{it.at && new Date(it.at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {(it.size / 1048576).toFixed(1)} MB</span></span>
            <button className="small" disabled={busy} onClick={() => importa(it)}>Importa</button>
            <button className="link danger" disabled={busy} onClick={() => scarta(it)}>Scarta</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
