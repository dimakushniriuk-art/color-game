import { useEffect, useRef, useState } from 'react';
import { go } from '../App';
import { updateArtwork, useLoad } from '../lib/data';
import { dayKey, fmtDateTime, fmtRelative, toIso } from '../lib/dates';
import { renderMarkdown } from '../lib/markdown';
import { parseStudioZip, uploadPackage } from '../lib/studioPackage';
import { publicUrl, removeFolder, supabase, upload } from '../lib/supabase';
import { DIFF_LABEL, STATUS_LABEL, type ArtImage, type Artwork, type Publication } from '../lib/types';

const FIELDS: [keyof Artwork, string, string?][] = [
  ['artist', 'Pittore'], ['year', 'Anno', 'es. 1503–1519'], ['technique', 'Tecnica', 'es. olio su tela'],
  ['dimensions', 'Dimensioni', 'es. 77 × 53 cm'], ['location', 'Ubicazione', 'museo, città'], ['movement', 'Corrente'],
];

async function loadArtwork(id: string) {
  const [a, p] = await Promise.all([
    supabase.from('artworks').select('*').eq('id', id).single(),
    supabase.from('publications').select('*').eq('artwork_id', id).order('publish_at'),
  ]);
  if (a.error) throw new Error(a.error.code === 'PGRST116' ? 'Opera non trovata.' : a.error.message);
  return { art: a.data as Artwork, pubs: (p.data ?? []) as Publication[] };
}

export function ArtworkPage({ id }: { id: string }) {
  const { data, setData, error, reload } = useLoad(() => loadArtwork(id), [id]);
  const [editing, setEditing] = useState(() => location.hash.includes('?modifica'));
  const [draft, setDraft] = useState<Artwork | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (data && editing && !draft) setDraft(structuredClone(data.art)); }, [data, editing, draft]);

  if (error) return <div className="page"><div className="notice err">{error}</div><a href="#/opere">← Archivio</a></div>;
  if (!data) return <div className="page muted">Caricamento…</div>;
  const art = editing && draft ? draft : data.art;
  const set = (patch: Partial<Artwork>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setMsg(null);
    try { await fn(); } catch (e: any) { setMsg({ text: e.message ?? String(e) }); }
    setBusy(null);
  };
  const saveFields = (patch: Partial<Artwork>) => updateArtwork(id, patch).then((a) => {
    setData((d) => (d ? { ...d, art: a } : d));
    if (draft) setDraft((dr) => (dr ? { ...dr, ...patch } : dr));
  });

  async function save() {
    if (!draft) return;
    const { id: _i, created_at: _c, updated_at: _u, images: _im, package_path: _p, thumb_path: _t, ...fields } = draft;
    await run('Salvo…', async () => {
      const a = await updateArtwork(id, { ...fields, title: fields.title.trim() || 'Senza titolo' });
      setData((d) => (d ? { ...d, art: a } : d)); setEditing(false); setDraft(null);
      history.replaceState(null, '', `#/opere/${id}`); setMsg({ ok: true, text: 'Scheda salvata.' });
    });
  }

  async function onZip(file?: File) {
    if (!file) return;
    await run('Leggo il pacchetto…', async () => {
      const pkg = await parseStudioZip(file);
      const folder = await uploadPackage(id, pkg, setBusy);
      const old = data!.art.package_path;
      await saveFields({ package_path: folder, thumb_path: `${folder}/thumb.jpg`, width: pkg.width, height: pkg.height, colors: pkg.colors, zones: pkg.zones,
        ...(data!.art.title === 'Senza titolo' ? { title: pkg.name } : {}), ...(data!.art.status === 'bozza' ? { status: 'pronta' as const } : {}) });
      if (old && old !== folder) await removeFolder(old).catch(() => {});
      setMsg({ ok: true, text: `Pacchetto caricato: ${pkg.colors} colori, ${pkg.zones} zone, ${pkg.width}×${pkg.height}px.` });
    });
  }

  async function onImages(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    await run('Carico le foto…', async () => {
      const added: ArtImage[] = [];
      for (const f of files) {
        const safe = f.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-60);
        const path = `opere/${id}/foto/${Date.now().toString(36)}-${safe}`;
        setBusy(`Carico ${f.name}…`);
        await upload(path, f, f.type || 'image/jpeg');
        added.push({ path, caption: '' });
      }
      await saveFields({ images: [...data!.art.images, ...added] });
    });
  }
  const setImages = (images: ArtImage[]) => run('Aggiorno le foto…', () => saveFields({ images }));
  async function removeImage(i: number) {
    const img = data!.art.images[i];
    if (!confirm('Eliminare questa foto? Non si può annullare.')) return;
    await run('Elimino la foto…', async () => {
      await saveFields({ images: data!.art.images.filter((_, k) => k !== i) });
      await supabase.storage.from('artworks').remove([img.path]);
    });
  }

  async function deleteArtwork() {
    const n = data!.pubs.length;
    if (!confirm(`Eliminare definitivamente "${data!.art.title}"${n ? ` e le sue ${n} pubblicazioni in calendario` : ''}? Foto e pacchetto verranno cancellati. Non si può annullare.`)) return;
    await run('Elimino…', async () => {
      await removeFolder(`opere/${id}`);
      const { error } = await supabase.from('artworks').delete().eq('id', id);
      if (error) throw error;
      go('opere');
    });
  }

  const cover = publicUrl(art.images[0]?.path ?? art.thumb_path);
  const now = Date.now();

  return (
    <div className="page wiki">
      <div className="crumbs"><a href="#/opere">Archivio opere</a> › {data.art.title}</div>
      <div className="wiki-head">
        {editing ? <input className="title-input" value={art.title} onChange={(e) => set({ title: e.target.value })} placeholder="Titolo dell'opera" />
          : <h1>{art.title}</h1>}
        <div className="actions">
          {editing ? (<>
            <button className="ghost" onClick={() => { setEditing(false); setDraft(null); history.replaceState(null, '', `#/opere/${id}`); }}>Annulla</button>
            <button onClick={save} disabled={!!busy}>Salva scheda</button>
          </>) : (<>
            <button className="ghost" onClick={() => { setDraft(structuredClone(data.art)); setEditing(true); }}>✎ Modifica</button>
            <button onClick={() => document.getElementById('programma')?.scrollIntoView({ behavior: 'smooth' })}>📅 Programma</button>
          </>)}
        </div>
      </div>
      <div className="subtitle muted">{[art.artist, art.year].filter(Boolean).join(' · ') || 'Pittore e anno non ancora inseriti'}</div>

      {busy && <div className="notice">{busy}</div>}
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

      <div className="wiki-grid">
        <article className="wiki-main">
          <section>
            <h2>Descrizione</h2>
            {editing ? (
              <div className="md-edit">
                <textarea rows={16} value={art.description} onChange={(e) => set({ description: e.target.value })}
                  placeholder={'Storia dell\'opera, soggetto, curiosità…\n\n## Storia\nTesto…\n\n- elenco\n**grassetto**, *corsivo*, [link](https://…)'} />
                <div className="md-preview prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(art.description) || '<p class="muted">Anteprima</p>' }} />
              </div>
            ) : art.description ? <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(art.description) }} />
              : <p className="muted">Nessuna descrizione. Premi <b>✎ Modifica</b> per scriverla.</p>}
          </section>

          <section>
            <div className="sec-head">
              <h2>Immagini dell'opera</h2>
              <button className="ghost small" onClick={() => imgRef.current?.click()} disabled={!!busy}>＋ Carica foto vere</button>
              <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onImages(e.target.files); e.target.value = ''; }} />
            </div>
            {!data.art.images.length && <p className="muted">Carica le foto reali del dipinto (alta risoluzione, dettagli, cornice…). La prima è l'immagine principale della scheda.</p>}
            <div className="gallery">
              {data.art.images.map((img, i) => (
                <figure key={img.path}>
                  <a href={publicUrl(img.path)!} target="_blank" rel="noopener"><img src={publicUrl(img.path)!} alt={img.caption ?? ''} loading="lazy" /></a>
                  <input className="caption" placeholder="Didascalia" defaultValue={img.caption ?? ''}
                    onBlur={(e) => { if (e.target.value !== (img.caption ?? '')) setImages(data.art.images.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x))); }} />
                  <div className="fig-actions">
                    {i === 0 ? <span className="badge">Principale</span>
                      : <button className="link" onClick={() => setImages([img, ...data.art.images.filter((_, k) => k !== i)])}>Rendi principale</button>}
                    <button className="link danger" onClick={() => removeImage(i)}>Elimina</button>
                  </div>
                </figure>
              ))}
            </div>
          </section>

          <section id="programma">
            <h2>Pubblicazioni nell'app</h2>
            <Schedule artwork={data.art} pubs={data.pubs} onChange={reload} now={now} busy={!!busy} run={run} saveFields={saveFields} setMsg={setMsg} />
          </section>

          {!editing && <section className="danger-zone"><button className="link danger" onClick={deleteArtwork}>Elimina opera</button></section>}
        </article>

        <aside className="infobox">
          <div className="ib-title">{art.title}</div>
          {cover ? <img src={cover} alt="" /> : <div className="ib-noimg">Nessuna immagine</div>}
          {art.images[0]?.caption && <div className="ib-caption">{art.images[0].caption}</div>}
          <table><tbody>
            {FIELDS.map(([k, label, ph]) => (
              <tr key={k}><th>{label}</th><td>{editing
                ? <input value={(art[k] as string) ?? ''} placeholder={ph} onChange={(e) => set({ [k]: e.target.value || null } as Partial<Artwork>)} />
                : (art[k] as string) || <span className="muted">—</span>}</td></tr>
            ))}
            <tr><th>Wikipedia</th><td>{editing
              ? <input value={art.wiki_url ?? ''} placeholder="https://it.wikipedia.org/…" onChange={(e) => set({ wiki_url: e.target.value || null })} />
              : art.wiki_url ? <a href={art.wiki_url} target="_blank" rel="noopener noreferrer">Apri la voce ↗</a> : <span className="muted">—</span>}</td></tr>
            <tr><th>Tag</th><td>{editing
              ? <input value={art.tags.join(', ')} placeholder="ritratto, rinascimento" onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
              : art.tags.length ? art.tags.join(', ') : <span className="muted">—</span>}</td></tr>
          </tbody></table>

          <div className="ib-section">Nell'app</div>
          <table><tbody>
            <tr><th>Categoria</th><td>{editing ? <input value={art.category} onChange={(e) => set({ category: e.target.value })} /> : art.category}</td></tr>
            <tr><th>Difficoltà</th><td>{editing
              ? <select value={art.difficulty} onChange={(e) => set({ difficulty: e.target.value as Artwork['difficulty'] })}>{Object.entries(DIFF_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              : DIFF_LABEL[art.difficulty]}</td></tr>
            <tr><th>Stato</th><td>{editing
              ? <select value={art.status} onChange={(e) => set({ status: e.target.value as Artwork['status'] })}>{Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              : <span className={`badge st-${art.status}`}>{STATUS_LABEL[art.status]}</span>}</td></tr>
          </tbody></table>

          <div className="ib-section">Pacchetto da colorare</div>
          {data.art.package_path ? (
            <div className="pkg">
              {data.art.thumb_path && <img src={publicUrl(data.art.thumb_path)!} alt="Anteprima colorata" />}
              <div className="small">{data.art.colors} colori · {data.art.zones} zone · {data.art.width}×{data.art.height}px</div>
            </div>
          ) : <p className="small muted">Ancora nessun pacchetto: senza pacchetto l'opera non può uscire nell'app.</p>}
          <button className="ghost small wide" disabled={!!busy} onClick={() => zipRef.current?.click()}>{data.art.package_path ? '↻ Sostituisci pacchetto (.zip)' : '⬆ Carica pacchetto dallo Studio (.zip)'}</button>
          <input ref={zipRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => { onZip(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="small muted ib-foot">Aggiornata {fmtRelative(data.art.updated_at)}</div>
        </aside>
      </div>
    </div>
  );

}

interface ScheduleProps {
  artwork: Artwork; pubs: Publication[]; now: number; busy: boolean;
  onChange(): void; run(label: string, fn: () => Promise<void>): Promise<void>;
  saveFields(patch: Partial<Artwork>): Promise<void>; setMsg(m: { ok?: boolean; text: string }): void;
}

function Schedule({ artwork, pubs, onChange, now, busy, run, saveFields, setMsg }: ScheduleProps) {
  const [day, setDay] = useState(dayKey(new Date(now + 86400000)));
  const [time, setTime] = useState('09:00');
  const [featured, setFeatured] = useState(true);
  const add = () => run('Programmo…', async () => {
    const at = toIso(day, time);
    const { error } = await supabase.from('publications').insert({ artwork_id: artwork.id, publish_at: at, featured });
    if (error) throw error;
    if (artwork.status === 'bozza') await saveFields({ status: 'pronta' });
    setMsg({ ok: true, text: `Programmata per ${fmtDateTime(at)}.` }); onChange();
  });
  const del = (p: Publication) => confirm(`Togliere la pubblicazione del ${fmtDateTime(p.publish_at)}?`) && run('Tolgo…', async () => {
    const { error } = await supabase.from('publications').delete().eq('id', p.id);
    if (error) throw error; onChange();
  });
  return (
    <div className="schedule">
      {pubs.length ? (
        <ul className="pub-list">
          {pubs.map((p) => {
            const past = new Date(p.publish_at).getTime() <= now;
            return (
              <li key={p.id} className={past ? 'past' : ''}>
                <span>{past ? '✓ Uscita' : '⏳ Esce'} <b>{fmtDateTime(p.publish_at)}</b> <span className="muted">({fmtRelative(p.publish_at)})</span></span>
                {p.featured && <span className="badge cal">Disegno del giorno</span>}
                <button className="link danger" onClick={() => del(p)}>Togli</button>
              </li>
            );
          })}
        </ul>
      ) : <p className="muted">Non ancora programmata.</p>}
      {artwork.package_path ? (
        <div className="pub-form">
          <label>Giorno<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
          <label>Ora<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Disegno del giorno</label>
          <button onClick={add} disabled={busy || !day || !time}>Aggiungi al calendario</button>
        </div>
      ) : <p className="small muted">Carica prima il pacchetto dallo Studio per poterla programmare.</p>}
    </div>
  );
}
