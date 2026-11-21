import { useState } from 'react';
import type { CatalogItem } from '../engine/types';
import { Card } from '../components/Card';
import { getProgress, useProgressVersion } from '../state/store';
import { IconBrush } from '../components/Icons';

export function MyWorks({ items, onOpen, onBrowse }: { items: CatalogItem[]; onOpen(item: CatalogItem): void; onBrowse(): void }) {
  useProgressVersion();
  const withP = items
    .map((it) => ({ it, p: getProgress(it.id) }))
    .filter((x) => x.p && x.p.order.length > 0)
    .sort((a, b) => b.p!.updatedAt - a.p!.updatedAt);
  const doing = withP.filter((x) => !x.p!.completed).map((x) => x.it);
  const done = withP.filter((x) => x.p!.completed).map((x) => x.it);
  const [tab, setTab] = useState<'doing' | 'done'>(() => (doing.length === 0 && done.length > 0 ? 'done' : 'doing'));
  const list = tab === 'doing' ? doing : done;

  return (
    <div className="screen-scroll">
      <header className="page-head">
        <h1>I miei lavori</h1>
      </header>
      <div className="segmented">
        <button className={tab === 'doing' ? 'on' : ''} onClick={() => setTab('doing')}>In corso <span>{doing.length}</span></button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>Completati <span>{done.length}</span></button>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><IconBrush size={40} /></div>
          <p>{tab === 'doing' ? 'Nessun disegno in corso.' : 'Non hai ancora completato disegni.'}</p>
          <button className="btn btn-primary" onClick={onBrowse}>Scegli un disegno</button>
        </div>
      ) : (
        <div className="grid">{list.map((it) => <Card key={it.id} item={it} onOpen={onOpen} />)}</div>
      )}
    </div>
  );
}
