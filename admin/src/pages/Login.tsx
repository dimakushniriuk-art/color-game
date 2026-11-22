import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMsg({ text: error.message === 'Invalid login credentials' ? 'Email o password errate.' : error.message });
    setBusy(false);
  }
  async function magicLink() {
    if (!email.trim()) return setMsg({ text: 'Scrivi prima la tua email.' });
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
    setMsg(error ? { text: error.message } : { ok: true, text: 'Ti ho mandato un link di accesso: aprilo da questo computer.' });
    setBusy(false);
  }

  return (
    <div className="center">
      <form className="panel narrow login" onSubmit={signIn}>
        <div className="brand big">Color Game <span>Admin</span></div>
        <p className="muted">Archivio delle opere e calendario delle pubblicazioni.</p>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button disabled={busy || !password}>Entra</button>
        <button type="button" className="link" disabled={busy} onClick={magicLink}>Non ho la password: mandami un link per email</button>
        {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.text}</p>}
      </form>
    </div>
  );
}
