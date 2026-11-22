// Proxy minimale verso l'API Gemini: la chiave resta sul server, mai nel browser.
// Il corpo della richiesta viene inoltrato così com'è (nessun parsing = poco CPU,
// adatto anche al piano gratuito di Cloudflare Workers).

const BASE = "https://generativelanguage.googleapis.com/v1beta";

const MODELLI_AMMESSI = new Set([
  "gemini-nano-banana-2.1",
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
  "gemini-3.1-flash-lite-image",
  "gemini-2.5-flash-image",
]);

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Accesso: login del team (token Supabase, lo stesso dell'admin) oppure, come riserva, APP_PASSWORD.
// Senza nessuno dei due l'API resta chiusa, tranne se OPEN_ACCESS=1 (solo per prove in locale).
const SUPABASE_URL_DEF = "https://vcvboeioopplfqhqpqvf.supabase.co";
const SUPABASE_KEY_DEF = "sb_publishable_dcPyb3gwCap83RYt-mcWig__ypgYX5S";
const TOKEN_OK = new Map(); // token -> scadenza della verifica (ms)

async function membroDelTeam(token, env) {
  const t = TOKEN_OK.get(token);
  if (t && t > Date.now()) return true;
  try {
    const r = await fetch(`${env.SUPABASE_URL || SUPABASE_URL_DEF}/rest/v1/rpc/am_i_team_member`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_ANON_KEY || SUPABASE_KEY_DEF, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    const ok = r.ok && (await r.json()) === true;
    if (ok) {
      TOKEN_OK.set(token, Date.now() + 5 * 60 * 1000);
      if (TOKEN_OK.size > 200) TOKEN_OK.delete(TOKEN_OK.keys().next().value);
    }
    return ok;
  } catch (e) { return false; }
}

async function autorizzato(req, env) {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (bearer && (await membroDelTeam(bearer, env))) return true;
  const pw = req.headers.get("x-app-password");
  if (env.APP_PASSWORD && pw && pw === env.APP_PASSWORD) return true;
  return !env.APP_PASSWORD && env.OPEN_ACCESS === "1";
}


// ---------- condivisione PC -> telefono (solo test, in memoria finché il server è acceso) ----------
const CONDIVISI = new Map(); // id -> { nome, ts, tipo, corpo }
const MAX_CONDIVISI = 20, MAX_BYTES = 80 * 1024 * 1024;
function idCasuale() { const a = new Uint8Array(9); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); }

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/api/check") {
      if (!(await autorizzato(req, env))) return json({ ok: false, error: "Accesso non autorizzato: entra con l'account del team" }, 401);
      return json({ ok: true, chiave: Boolean(env.GEMINI_API_KEY) });
    }

    if (url.pathname === "/api/gemini") {
      if (req.method !== "POST") return json({ error: "Usa POST" }, 405);
      if (!(await autorizzato(req, env))) return json({ error: "Accesso non autorizzato: entra con l'account del team" }, 401);
      if (!env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY non configurata sul server" }, 500);

      const model = url.searchParams.get("model") || "";
      const api = url.searchParams.get("api") || "interactions";
      if (!MODELLI_AMMESSI.has(model) && !/^gemini-[a-z0-9.\-]{1,60}$/.test(model)) return json({ error: "Modello non ammesso: " + model }, 400);

      const target =
        api === "generateContent"
          ? `${BASE}/models/${model}:generateContent`
          : `${BASE}/interactions`;

      const r = await fetch(target, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: req.body,
      });
      return new Response(r.body, {
        status: r.status,
        headers: { "content-type": r.headers.get("content-type") || "application/json" },
      });
    }


    if (url.pathname === "/api/condividi") {
      if (req.method !== "POST") return json({ error: "Usa POST" }, 405);
      if (!(await autorizzato(req, env))) return json({ error: "Accesso non autorizzato: entra con l'account del team" }, 401);
      const corpo = await req.arrayBuffer();
      if (corpo.byteLength > MAX_BYTES) return json({ error: "Disegno troppo grande" }, 413);
      const id = idCasuale(), nome = decodeURIComponent(req.headers.get("x-nome") || "Disegno").slice(0, 120);
      CONDIVISI.set(id, { nome, ts: Date.now(), tipo: req.headers.get("content-type") || "application/octet-stream", corpo });
      while (CONDIVISI.size > MAX_CONDIVISI) CONDIVISI.delete(CONDIVISI.keys().next().value);
      return json({ ok: true, id });
    }
    if (url.pathname === "/api/condivisi") {
      const lista = [...CONDIVISI.entries()].map(([id, c]) => ({ id, nome: c.nome, ts: c.ts, mb: +(c.corpo.byteLength / 1048576).toFixed(1) })).reverse();
      return new Response(JSON.stringify(lista), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }
    if (url.pathname.startsWith("/api/condivisi/")) {
      const c = CONDIVISI.get(url.pathname.slice("/api/condivisi/".length));
      if (!c) return json({ error: "Non trovato (il server è stato riavviato?)" }, 404);
      return new Response(c.corpo, { headers: { "content-type": c.tipo, "cache-control": "no-store" } });
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "Endpoint inesistente" }, 404);
    return env.ASSETS.fetch(req);
  },
};
