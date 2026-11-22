// Accesso unico del team per lo Studio: stessa sessione Supabase dell'admin (stesso sito = stesso login).
// - Mostra nell'intestazione "entra" (email + password) oppure "👤 email · Esci".
// - Aggiunge da sola il token a ogni chiamata /api/* (Gemini, condividi): niente più password da scrivere.
// - Espone window.team per "Invia all'admin".
// Richiede prima: <script src="vendor/supabase-2.119.2.js"></script>
(function () {
  const URL_SB = "https://vcvboeioopplfqhqpqvf.supabase.co";
  const KEY_SB = "sb_publishable_dcPyb3gwCap83RYt-mcWig__ypgYX5S";
  const sito = location.pathname.startsWith("/studio"); // dentro il sito unico (App /, Admin /admin/)
  const lib = window.supabase;
  if (!lib || !lib.createClient) { console.warn("team.js: libreria Supabase non caricata"); return; }
  const client = lib.createClient(URL_SB, KEY_SB);
  let sessione = null;

  async function token() {
    const { data } = await client.auth.getSession();
    sessione = data.session;
    return sessione ? sessione.access_token : null;
  }

  // token automatico sulle chiamate /api/*
  const fetchOrig = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(url, location.href);
    if (u.origin === location.origin && u.pathname.startsWith("/api/")) {
      const t = await token();
      if (t) {
        const h = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
        if (!h.has("authorization")) h.set("authorization", "Bearer " + t);
        init = Object.assign({}, init, { headers: h });
      }
    }
    return fetchOrig(input, init);
  };

  // ---------- interfaccia nell'intestazione ----------
  const css = document.createElement("style");
  css.textContent = `
  .team{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-family:system-ui,sans-serif;font-size:13px}
  .team input{border:1px solid var(--linea,#d9cfbd);background:#fff;border-radius:6px;padding:5px 7px;font-size:13px;width:150px}
  .team .chi{color:var(--tenue,#6d665b)} .team .chi b{color:var(--inchiostro,#1d1b18);font-weight:600}
  .team button.link{background:none;border:0;color:var(--accento2,#2f5d62);text-decoration:underline;padding:0;cursor:pointer}
  .team .errore{color:var(--err,#a12a1c)}
  .vai{display:flex;gap:4px;font-family:system-ui,sans-serif;font-size:13px}
  .vai a{padding:4px 9px;border:1px solid var(--linea,#d9cfbd);border-radius:6px;text-decoration:none;color:var(--inchiostro,#1d1b18);background:#fffdf8}
  .vai a:hover{border-color:var(--inchiostro,#1d1b18)}
  .pw-vecchia{display:contents}`;
  document.head.appendChild(css);

  function monta() {
    const header = document.querySelector("header");
    if (!header) return;
    const box = document.createElement("div");
    box.className = "team";
    const blocco = header.querySelector(".pw");
    // i vecchi campi password restano (servono al codice), nascosti quando sei dentro col team
    const vecchi = ["label[for=pw]", "#pw", "#btnCheck", "#statoPw"].map((s) => header.querySelector(s)).filter(Boolean);
    if (blocco) blocco.insertBefore(box, blocco.firstChild); else header.appendChild(box);
    if (sito) {
      const vai = document.createElement("div");
      vai.className = "vai";
      vai.innerHTML = '<a href="/admin/">⚙ Admin</a><a href="/" target="_blank" rel="noopener">📱 App</a>';
      (blocco || header).appendChild(vai);
    }
    async function disegna() {
      await token();
      vecchi.forEach((el) => (el.style.display = sessione ? "none" : ""));
      if (sessione) {
        box.innerHTML = `<span class="chi">👤 <b></b></span><button class="link" type="button">Esci</button>`;
        box.querySelector("b").textContent = sessione.user.email;
        box.querySelector("button").onclick = async () => { await client.auth.signOut(); disegna(); };
      } else {
        box.innerHTML = `<form style="display:contents"><input type="email" placeholder="email del team" autocomplete="username" required>` +
          `<input type="password" placeholder="password" autocomplete="current-password" required><button class="sec">Entra</button>` +
          `<span class="errore"></span></form>${vecchi.length ? '<span class="chi">oppure password Studio:</span>' : ""}`;
        const f = box.querySelector("form"), [em, pw] = f.querySelectorAll("input");
        f.onsubmit = async (e) => {
          e.preventDefault();
          const { error } = await client.auth.signInWithPassword({ email: em.value.trim(), password: pw.value });
          if (error) { box.querySelector(".errore").textContent = error.message === "Invalid login credentials" ? "email o password errate" : error.message; return; }
          disegna();
        };
      }
    }
    client.auth.onAuthStateChange(() => disegna());
    disegna();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", monta); else monta();

  window.team = {
    client,
    token,
    get utente() { return sessione ? sessione.user : null; },
    sito,
  };
})();
