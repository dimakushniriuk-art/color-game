// Sito unico: API dello Studio su /api/* (riusa studio/src/worker.js, lo stesso di Cloudflare).
// vercel.json manda ogni /api/<percorso> qui come /api/proxy?__path=<percorso>.
// Variabili su Vercel: GEMINI_API_KEY (obbligatoria), APP_PASSWORD (facoltativa, riserva al login del team).
import worker from '../studio/src/worker.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.searchParams.get('__path') || '';
  url.searchParams.delete('__path');
  url.pathname = '/api/' + path;
  const inner = new Request(url, req);
  const env = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    APP_PASSWORD: process.env.APP_PASSWORD,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    OPEN_ACCESS: process.env.OPEN_ACCESS,
    ASSETS: { fetch: () => new Response('Not found', { status: 404 }) },
  };
  return worker.fetch(inner, env);
}
