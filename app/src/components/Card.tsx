import type { CatalogItem } from '../engine/types';
import { getProgress } from '../state/store';
import { IconCheck } from './Icons';
import { Thumb } from './Thumb';

export const DIFF_LABEL: Record<CatalogItem['difficulty'], string> = { facile: 'Facile', medio: 'Medio', difficile: 'Difficile' };

export function Card({ item, onOpen, large }: { item: CatalogItem; onOpen(item: CatalogItem): void; large?: boolean }) {
  const pr = getProgress(item.id);
  const filled = pr?.order.length ?? 0;
  const pct = pr && pr.total ? Math.floor((filled / pr.total) * 100) : 0;
  const done = !!pr?.completed;
  return (
    <button className={`card ${large ? 'card-large' : ''}`} onClick={() => onOpen(item)}>
      <div className="card-img">
        <Thumb item={item} filledCount={filled} complete={done || filled === 0} />
        {item.isNew && !pr && <span className="badge badge-new">Nuovo</span>}
        {done && <span className="badge badge-done"><IconCheck size={14} /></span>}
        {!done && filled > 0 && (
          <div className="card-progress"><div style={{ width: `${pct}%` }} /></div>
        )}
      </div>
      <div className="card-meta">
        <span className="card-title">{item.title}</span>
        <span className={`diff diff-${item.difficulty}`}>{DIFF_LABEL[item.difficulty]}</span>
      </div>
    </button>
  );
}
