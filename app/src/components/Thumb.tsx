import { useEffect, useState } from 'react';
import type { CatalogItem } from '../engine/types';
import { loadPuzzle } from '../data/catalog';
import { renderThumbnail } from '../engine/renderer';
import { getProgress } from '../state/store';
import { studioThumbnail } from '../data/studioView';

// Thumbnails are generated one at a time so the UI stays responsive.
const memo = new Map<string, string>();
let queue: Promise<unknown> = Promise.resolve();

function thumbFor(item: CatalogItem, filledCount: number, complete: boolean): Promise<string> {
  const key = `${item.id}:${filledCount}:${complete}`;
  const hit = memo.get(key);
  if (hit) return Promise.resolve(hit);
  const job = queue.then(async () => {
    if (item.source === 'remote' && item.baseUrl) { // come nel blocco 4: sketch + zone fatte con l'originale
      const pr = getProgress(item.id);
      const url = await studioThumbnail(item.baseUrl, pr?.order ?? null, 360, !!pr?.completed);
      memo.set(key, url);
      return url;
    }
    const p = await loadPuzzle(item);
    await new Promise((r) => setTimeout(r, 0));
    const url = renderThumbnail(p, getProgress(item.id)?.order ?? null, 360, complete);
    memo.set(key, url);
    return url;
  });
  queue = job.catch(() => {});
  return job;
}

export function Thumb({ item, filledCount, complete }: { item: CatalogItem; filledCount: number; complete: boolean }) {
  const [url, setUrl] = useState<string | null>(() => memo.get(`${item.id}:${filledCount}:${complete}`) ?? null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    thumbFor(item, filledCount, complete).then((u) => alive && setUrl(u)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [item, filledCount, complete]);
  if (error) return <div className="thumb thumb-error">!</div>;
  return url ? <img className="thumb" src={url} alt="" draggable={false} /> : <div className="thumb thumb-skeleton" />;
}
