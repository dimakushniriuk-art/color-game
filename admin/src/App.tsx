import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { APP_URL, STUDIO_URL, supabase } from './lib/supabase';
import { Login } from './pages/Login';
import { Archive } from './pages/Archive';
import { ArtworkPage } from './pages/ArtworkPage';
import { Calendar } from './pages/Calendar';

type Route = { name: 'archive' } | { name: 'artwork'; id: string } | { name: 'calendar' };

function parse(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('?')[0].split('/');
  if (p[0] === 'opere' && p[1]) return { name: 'artwork', id: p[1] };
  if (p[0] === 'calendario') return { name: 'calendar' };
  return { name: 'archive' };
}
export const go = (path: string) => { location.hash = '#/' + path; };

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [member, setMember] = useState<boolean | null>(null);
  const [route, setRoute] = useState<Route>(() => parse(location.hash));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    const onHash = () => { setRoute(parse(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => { data.subscription.unsubscribe(); window.removeEventListener('hashchange', onHash); };
  }, []);

  useEffect(() => {
    if (!session) { setMember(null); return; }
    supabase.rpc('am_i_team_member').then(({ data, error }) => setMember(!error && data === true));
  }, [session?.user.id]);

  if (session === undefined) return <div className="center muted">Caricamento…</div>;
  if (!session) return <Login />;
  if (member === null) return <div className="center muted">Controllo l'accesso…</div>;
  if (!member) return (
    <div className="center">
      <div className="panel narrow">
        <h2>Accesso non abilitato</h2>
        <p>L'account <b>{session.user.email}</b> non è nella lista del team (tabella <code>team_members</code>).</p>
        <button onClick={() => supabase.auth.signOut()}>Esci</button>
      </div>
    </div>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#/opere">Color Game <span>Admin</span></a>
        <nav className="tabs">
          <a className={route.name !== 'calendar' ? 'on' : ''} href="#/opere">Archivio opere</a>
          <a className={route.name === 'calendar' ? 'on' : ''} href="#/calendario">Calendario</a>
        </nav>
        <div className="jump">
          <a className="btn ghost" href={STUDIO_URL} target="_blank" rel="noopener">🎨 Apri lo Studio ↗</a>
          <a className="btn ghost" href={APP_URL} target="_blank" rel="noopener">📱 Apri l'App ↗</a>
          <button className="link" title={session.user.email ?? ''} onClick={() => supabase.auth.signOut()}>Esci</button>
        </div>
      </header>
      <main>
        {route.name === 'archive' && <Archive />}
        {route.name === 'artwork' && <ArtworkPage key={route.id} id={route.id} />}
        {route.name === 'calendar' && <Calendar />}
      </main>
    </div>
  );
}
