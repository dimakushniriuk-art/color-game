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

function autorizzato(req, env) {
  if (!env.APP_PASSWORD) return true; // nessuna password impostata
  return req.headers.get("x-app-password") === env.APP_PASSWORD;
}


// ---------- condivisione PC -> telefono (solo test, in memoria finché il server è acceso) ----------
const CONDIVISI = new Map(); // id -> { nome, ts, tipo, corpo }
const MAX_CONDIVISI = 20, MAX_BYTES = 80 * 1024 * 1024;
function idCasuale() { const a = new Uint8Array(9); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); }

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/api/check") {
      if (!autorizzato(req, env)) return json({ ok: false, error: "Password errata" }, 401);
      return json({ ok: true, chiave: Boolean(env.GEMINI_API_KEY) });
    }

    if (url.pathname === "/api/gemini") {
      if (req.method !== "POST") return json({ error: "Usa POST" }, 405);
      if (!autorizzato(req, env)) return json({ error: "Password errata" }, 401);
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
      if (!autorizzato(req, env)) return json({ error: "Password errata" }, 401);
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
