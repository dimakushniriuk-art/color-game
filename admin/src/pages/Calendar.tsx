import { useMemo, useState } from 'react';
import { coverOf } from './Archive';
import { fetchArtworks, fetchPublications, useLoad } from '../lib/data';
import { dayKey, fmtDateTime, fmtRelative, monthGrid, MONTHS, timeOf, toIso, WEEKDAYS } from '../lib/dates';
import { supabase } from '../lib/supabase';
import type { Artwork, Publication } from '../lib/types';

type Editing = { day: string; pub?: Publication };

export function Calendar() {
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const grid = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const from = grid[0].toISOString(), to = new Date(grid[41].getFullYear(), grid[41].getMonth(), grid[41].getDate() + 1).toISOString();
  const arts = useLoad(fetchArtworks);
  const pubs = useLoad(() => fetchPublications(from, to), [from, to]);
  const upcoming = useLoad(() => fetchPublications(new Date().toISOString()).then((p) => p.slice(0, 12)));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const byId = useMemo(() => new Map((arts.data ?? []).map((a) => [a.id, a])), [arts.data]);
  const byDay = useMemo(() => {
    const m = new Map<string, Publication[]>();
    for (const p of pubs.data ?? []) { const k = dayKey(new Date(p.publish_at)); m.set(k, [...(m.get(k) ?? []), p]); }
    return m;
  }, [pubs.data]);
  const reloadAll = () => { pubs.reload(); upcoming.reload(); };
  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });
  const todayKey = dayKey(today);

  async function moveTo(pubId: string, day: string) {
    const p = pubs.data?.find((x) => x.id === pubId);
    if (!p || dayKey(new Date(p.publish_at)) === day) return;
    const { error } = await supabase.from('publications').update({ publish_at: toIso(day, timeOf(p.publish_at)) }).eq('id', pubId);
    if (error) setErr(error.message); else reloadAll();
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Calendario delle pubblicazioni</h1>
          <p className="muted">Clicca un giorno per programmare un'opera all'ora esatta. Trascina un'opera su un altro giorno per spostarla. Orari nel fuso di questo computer.</p>
        </div>
      </div>
      {(err || pubs.error || arts.error) && <div className="notice err">{err || pubs.error || arts.error}</div>}

      <div className="cal-layout">
        <div className="cal">
          <div className="cal-nav">
            <button className="ghost" onClick={() => shift(-1)}>‹</button>
            <h2>{MONTHS[ym.m]} {ym.y}</h2>
            <button className="ghost" onClick={() => shift(1)}>›</button>
            <button className="link" onClick={() => setYm({ y: today.getFullYear(), m: today.getMonth() })}>Oggi</button>
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
            {grid.map((d) => {
              const k = dayKey(d), list = byDay.get(k) ?? [], out = d.getMonth() !== ym.m, past = k < todayKey;
              return (
                <div key={k} className={`cal-day ${out ? 'out' : ''} ${k === todayKey ? 'today' : ''} ${past ? 'past' : ''} ${!past && !list.length ? 'gap' : ''}`}
                  onClick={() => setEditing({ day: k })}
                  onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (dragId) moveTo(dragId, k); setDragId(null); }}>
                  <div className="cal-num">{d.getDate()}</div>
                  {list.map((p) => {
                    const a = byId.get(p.artwork_id), cover = a && coverOf(a);
                    return (
                      <div key={p.id} className={`cal-item ${p.featured ? 'feat' : ''}`} draggable
                        onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragId(null)}
                        onClick={(e) => { e.stopPropagation(); setEditing({ day: k, pub: p }); }} title={a?.title}>
                        {cover && <img src={cover} alt="" />}
                        <span className="t">{timeOf(p.publish_at)}</span>
                        <span className="n">{a?.title ?? '…'}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="upcoming panel">
          <h3>Prossime uscite</h3>
          {!upcoming.data?.length && <p className="muted small">Nessuna uscita programmata.</p>}
          {upcoming.data?.map((p) => {
            const a = byId.get(p.artwork_id);
            return (
              <a key={p.id} className="up-item" href={`#/opere/${p.artwork_id}`}>
                {a && coverOf(a) ? <img src={coverOf(a)!} alt="" /> : <span className="ph" />}
                <span><b>{a?.title ?? '…'}</b><br /><span className="small muted">{fmtDateTime(p.publish_at)} · {fmtRelative(p.publish_at)}</span></span>
              </a>
            );
          })}
        </aside>
      </div>

      {editing && <DayDialog key={editing.pub?.id ?? "nuova-" + editing.day} editing={editing} artworks={arts.data ?? []} dayPubs={byDay.get(editing.day) ?? []} byId={byId}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reloadAll(); }} onPick={(p) => setEditing({ day: editing.day, pub: p })} />}
    </div>
  );
}

function DayDialog({ editing, artworks, dayPubs, byId, onClose, onSaved, onPick }: {
  editing: Editing; artworks: Artwork[]; dayPubs: Publication[]; byId: Map<string, Artwork>;
  onClose(): void; onSaved(): void; onPick(p?: Publication): void;
}) {
  const pub = editing.pub;
  const [day, setDay] = useState(editing.day);
  const [time, setTime] = useState(pub ? timeOf(pub.publish_at) : '09:00');
  const [artworkId, setArtworkId] = useState(pub?.artwork_id ?? '');
  const [featured, setFeatured] = useState(pub?.featured ?? true);
  const [note, setNote] = useState(pub?.note ?? '');
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = artworks.filter((a) => a.package_path && a.status !== 'archiviata');
  const shown = ready.filter((a) => !q.trim() || [a.title, a.artist].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase())));
  const label = new Date(`${editing.day}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const inPast = new Date(toIso(day, time)).getTime() <= Date.now();

  async function save() {
    if (!artworkId) return setErr('Scegli un\'opera.');
    setBusy(true); setErr(null);
    const row = { artwork_id: artworkId, publish_at: toIso(day, time), featured, note: note.trim() || null };
    const { error } = pub ? await supabase.from('publications').update(row).eq('id', pub.id) : await supabase.from('publications').insert(row);
    setBusy(false);
    if (error) setErr(error.message); else onSaved();
  }
  async function remove() {
    if (!pub || !confirm('Togliere questa opera dal calendario?')) return;
    const { error } = await supabase.from('publications').delete().eq('id', pub.id);
    if (error) setErr(error.message); else onSaved();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head"><h3>{label}</h3><button className="link" onClick={onClose}>✕</button></div>

        {dayPubs.length > 0 && (
          <div className="day-list">
            {dayPubs.map((p) => (
              <button key={p.id} className={`day-pub ${pub?.id === p.id ? 'on' : ''}`} onClick={() => onPick(p)}>
                {timeOf(p.publish_at)} · {byId.get(p.artwork_id)?.title ?? '…'} {p.featured && '★'}
              </button>
            ))}
            <button className={`day-pub ${!pub ? 'on' : ''}`} onClick={() => onPick(undefined)}>＋ Nuova</button>
          </div>
        )}

        <div className="form-row">
          <label>Giorno<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
          <label>Ora esatta<input type="time" step={60} value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Disegno del giorno (premio ×2)</label>
        </div>
        {inPast && <p className="small warn-text">Questo orario è già passato: l'opera comparirà subito nell'app.</p>}

        <label className="full">Opera</label>
        <input className="search" placeholder="Cerca tra le opere pronte…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="picker">
          {!ready.length && <p className="muted small">Nessuna opera con pacchetto. Importa prima un pacchetto dallo Studio nell'archivio.</p>}
          {shown.map((a) => (
            <button key={a.id} className={`pick ${artworkId === a.id ? 'on' : ''}`} onClick={() => setArtworkId(a.id)}>
              {coverOf(a) ? <img src={coverOf(a)!} alt="" /> : <span className="ph" />}
              <span className="pick-t">{a.title}</span>
              <span className="pick-s">{[a.artist, a.year].filter(Boolean).join(', ')}</span>
            </button>
          ))}
        </div>

        <label className="full">Nota interna<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="facoltativa" /></label>
        {err && <p className="err">{err}</p>}
        <div className="dialog-foot">
          {pub && <button className="link danger" onClick={remove}>Togli dal calendario</button>}
          <span style={{ flex: 1 }} />
          {artworkId && <a className="link" href={`#/opere/${artworkId}`}>Apri scheda</a>}
          <button className="ghost" onClick={onClose}>Annulla</button>
          <button onClick={save} disabled={busy}>{pub ? 'Salva modifiche' : 'Programma'}</button>
        </div>
      </div>
    </div>
  );
}
