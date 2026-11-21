import { useMemo, useState } from 'react';
import type { CatalogItem } from '../engine/types';
import { Card } from '../components/Card';
import { useProgressVersion } from '../state/store';
import { pickDaily } from '../data/catalog';
import { Wallet } from '../components/Wallet';

export function Gallery({ items, onOpen, onWallet }: { items: CatalogItem[]; onOpen(item: CatalogItem): void; onWallet(): void }) {
  useProgressVersion();
  const [cat, setCat] = useState('Tutti');
  const cats = useMemo(() => ['Tutti', ...new Set(items.map((i) => i.category))], [items]);
  const daily = useMemo(() => pickDaily(items), [items]);
  const shown = cat === 'Tutti' ? items : items.filter((i) => i.category === cat);

  return (
    <div className="screen-scroll">
      <div className="top-wallet"><Wallet onClick={onWallet} /></div>
      <header className="page-head">
        <h1>Color Game</h1>
        <p>Scegli un disegno e colora con i numeri</p>
      </header>

      {daily && cat === 'Tutti' && (
        <section className="daily">
          <div className="section-row"><div className="section-title">Disegno del giorno</div><span className="bonus">Premio ×2</span></div>
          <Card item={daily} onOpen={onOpen} large />
        </section>
      )}

      <div className="chips" role="tablist">
        {cats.map((c) => (
          <button key={c} role="tab" aria-selected={c === cat} className={`chip ${c === cat ? 'chip-on' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid">
        {shown.map((it, i) => <div key={it.id} className="stagger" style={{ animationDelay: `${i * 45}ms` }}><Card item={it} onOpen={onOpen} /></div>)}
      </div>
    </div>
  );
}
