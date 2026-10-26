import { COUNTRIES, countryCode, flag } from "./countries.js";

const app = document.getElementById("app");
const themeMeta = document.querySelector('meta[name="theme-color"]');
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
const ID_KEY = "hue:id";

async function api(path, body) {
  const res = await fetch(
    path,
    body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

let CONFIG = null;
let ME = null; // { me, tribe } from the server
const draft = { name: "", home: "", answers: [] };
let pollTimer = null;
let wakeLock = null;

function setTheme(key) {
  const t = key && CONFIG.tribes[key];
  document.documentElement.style.setProperty("--c", t ? t.color : "#9b3bff");
  document.documentElement.style.setProperty("--ink", t ? t.ink : "#ffffff");
  document.body.style.background = t ? t.color : "";
  themeMeta.content = t ? t.color : "#0b0b10";
}

function mount(html, onclick = null) {
  clearInterval(pollTimer);
  app.innerHTML = html;
  app.onclick = onclick;
  app.onsubmit = null;
  window.scrollTo(0, 0);
}

function failure(message, retry) {
  mount(
    `<section class="view center"><h2>Hmm.</h2><p class="muted">${esc(message)}</p><button class="btn sm" data-retry>Try again</button></section>`,
    (e) => e.target.closest("[data-retry]") && retry(),
  );
}

// ---------- intro ----------

function intro() {
  setTheme(null);
  const orbs = Object.values(CONFIG.tribes).map((t, i) => `<span style="--o:${t.color};--i:${i}"></span>`).join("");
  mount(
    `<section class="view intro">
      <div class="orbs" aria-hidden="true">${orbs}</div>
      <div class="intro-body">
        <p class="kicker">${esc(CONFIG.event)}</p>
        <h1 class="title">Hue are<br>you?</h1>
        <p class="lede">Five questions. One color. Then raise your phone and find the people who share it.</p>
      </div>
      <div class="actions">
        <button class="btn" data-go>Find my color</button>
        <p class="fine">About a minute. First name only.</p>
      </div>
    </section>`,
    (e) => e.target.closest("[data-go]") && profile(),
  );
}

// ---------- about you ----------

function profile() {
  setTheme(null);
  mount(
    `<section class="view">
      <header class="top"><button class="icon" data-back aria-label="Back">←</button><span class="step">About you</span></header>
      <form class="stack" id="pf" autocomplete="off">
        <h2 class="q">First, the basics.</h2>
        <label class="field"><span>First name</span>
          <input name="name" maxlength="24" placeholder="So your people can find you" value="${esc(draft.name)}" autocapitalize="words" enterkeyhint="next"></label>
        <label class="field"><span>Where's home originally?</span>
          <input name="home" maxlength="40" list="countries" placeholder="Country" value="${esc(draft.home)}" autocapitalize="words" enterkeyhint="done"></label>
        <datalist id="countries">${COUNTRIES.map(([, n]) => `<option value="${esc(n)}">`).join("")}</datalist>
        <div class="spacer"></div>
        <button class="btn" type="submit">Next</button>
      </form>
    </section>`,
    (e) => e.target.closest("[data-back]") && intro(),
  );
  app.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    draft.name = String(f.get("name") || "").trim();
    draft.home = String(f.get("home") || "").trim();
    question(0);
  };
}

// ---------- questions ----------

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// The two tribes your answers lean toward so far, as glow colors.
function leaning(answers) {
  const s = {};
  answers.forEach((a, i) => {
    for (const [k, w] of Object.entries(CONFIG.questions[i].options[a].w)) s[k] = (s[k] || 0) + w;
  });
  const top = Object.entries(s).sort((x, y) => y[1] - x[1]).map(([k]) => CONFIG.tribes[k].color);
  return [top[0] || "#34343f", top[1] || top[0] || "#23232c"];
}

function question(i) {
  setTheme(null);
  const q = CONFIG.questions[i];
  const n = CONFIG.questions.length;
  const [a, b] = leaning(draft.answers.slice(0, i));
  const dots = CONFIG.questions.map((_, j) => `<i class="${j < i ? "done" : j === i ? "now" : ""}"></i>`).join("");
  let locked = false;
  mount(
    `<section class="view quiz">
      <div class="glow a" style="background-color:${a}"></div>
      <div class="glow b" style="background-color:${b}"></div>
      <header class="top"><button class="icon" data-back aria-label="Back">←</button><span class="dots">${dots}</span><span class="step">${i + 1}/${n}</span></header>
      <h2 class="q">${esc(q.q)}</h2>
      <div class="opts">${q.options
        .map((o, j) => `<button class="opt${draft.answers[i] === j ? " picked" : ""}" data-j="${j}"><span class="e">${o.e}</span><span>${esc(o.t)}</span></button>`)
        .join("")}</div>
    </section>`,
    (e) => {
      if (e.target.closest("[data-back]")) return i ? question(i - 1) : profile();
      const opt = e.target.closest("[data-j]");
      if (!opt || locked) return;
      locked = true;
      draft.answers[i] = Number(opt.dataset.j);
      draft.answers.length = i + 1;
      app.querySelectorAll(".opt").forEach((el) => el.classList.toggle("picked", el === opt));
      const [na, nb] = leaning(draft.answers);
      app.querySelector(".glow.a").style.backgroundColor = na;
      app.querySelector(".glow.b").style.backgroundColor = nb;
      setTimeout(() => (i + 1 < n ? question(i + 1) : submit()), 320);
    },
  );
}

async function submit() {
  mount(`<section class="view center"><div class="spinner"></div><p class="muted">Mixing your color…</p></section>`);
  try {
    ME = await api("/api/join", { name: draft.name, home: draft.home, cc: countryCode(draft.home), answers: draft.answers });
    store.set(ID_KEY, ME.me.id);
    reveal();
  } catch (e) {
    failure(e.message, submit);
  }
}

// ---------- reveal ----------

function reveal() {
  const t = CONFIG.tribes[ME.me.tribe];
  setTheme(ME.me.tribe);
  mount(
    `<section class="view reveal">
      <div class="flood"></div>
      <div class="reveal-body">
        <p class="kicker r1">${ME.me.name ? `${esc(ME.me.name)}, you're` : "You're"}</p>
        <h1 class="huge r2">${esc(t.label)}</h1>
        <h2 class="tname r3">${esc(t.name)}</h2>
        <p class="tagline r3">${esc(t.tagline)}</p>
        <p class="line r4" id="line">${ME.me.line ? esc(ME.me.line) : '<span class="shimmer">Grok is reading your answers…</span>'}</p>
        <span class="circle-tag r4">Circle ${ME.me.circle}</span>
      </div>
      <div class="actions r5">
        <button class="btn ink" data-raise>Raise my phone ↑</button>
        <button class="btn ghost-ink" data-home>Meet my tribe</button>
      </div>
    </section>`,
    (e) => {
      if (e.target.closest("[data-raise]")) beacon();
      else if (e.target.closest("[data-home]")) home();
    },
  );
  document.body.style.background = "";
  app.querySelector(".flood").addEventListener("animationend", () => (document.body.style.background = t.color));
  if (!ME.me.line) {
    let tries = 0;
    pollTimer = setInterval(async () => {
      tries++;
      try {
        ME = await api(`/api/me?id=${encodeURIComponent(ME.me.id)}`);
      } catch {}
      const el = document.getElementById("line");
      if (el && (ME.me.line || tries > 12)) {
        el.textContent = ME.me.line || "";
        clearInterval(pollTimer);
      }
    }, 1500);
  }
}

// ---------- beacon: the full-screen color you hold up ----------

async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch {}
}

function beacon() {
  const t = CONFIG.tribes[ME.me.tribe];
  setTheme(ME.me.tribe);
  const el = document.createElement("div");
  el.className = "beacon";
  el.innerHTML = `
    <div class="b-label">${esc(t.label)}</div>
    <div class="b-circle"><span>Circle</span><b>${ME.me.circle}</b></div>
    <div class="b-hint">Brightness up · Hold it high · Tap to close</div>`;
  document.body.append(el);
  keepAwake();
  document.documentElement.requestFullscreen?.().catch(() => {});
  el.onclick = () => {
    el.remove();
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    home();
  };
}

// ---------- home: your tribe ----------

let promptIdx = 0;
let editing = false;
let sealSig = "";

function home() {
  const t = CONFIG.tribes[ME.me.tribe];
  setTheme(ME.me.tribe);
  document.body.style.background = "";
  editing = false;
  sealSig = "";
  let restartArmed = false;
  mount(
    `<section class="view home">
      <header class="band">
        <div class="band-top"><span class="chip">${esc(t.label)}</span><button class="raise-mini" data-raise>Raise phone ↑</button></div>
        <h1 class="band-name" id="tname"></h1>
        <p class="band-stats" id="tstats"></p>
        <p class="band-line" id="mline"></p>
      </header>
      <article class="card" id="circle"></article>
      <article class="card" id="prompts"></article>
      <article class="card" id="seal"></article>
      <article class="card" id="story"></article>
      <button class="link" data-restart>Not you? Start over</button>
    </section>`,
    async (e) => {
      const el = e.target.closest("button, a");
      if (!el) return;
      if (el.matches("[data-raise]")) return beacon();
      if (el.matches("[data-found]")) {
        el.disabled = true;
        try { ME = await api("/api/found", { id: ME.me.id, found: !ME.me.found }); } catch {}
        return update();
      }
      if (el.matches("[data-prev], [data-next]")) {
        promptIdx += el.matches("[data-next]") ? 1 : -1;
        return renderPrompts();
      }
      if (el.matches("[data-edit]")) { editing = true; sealSig = ""; return renderSeal(); }
      if (el.matches("[data-cancel]")) { editing = false; sealSig = ""; return renderSeal(); }
      if (el.matches("[data-restart]")) {
        if (!restartArmed) {
          restartArmed = true;
          el.textContent = "Tap again to start over";
          return;
        }
        api("/api/leave", { id: ME.me.id }).catch(() => {});
        store.del(ID_KEY);
        ME = null;
        draft.answers = [];
        return intro();
      }
    },
  );
  app.onsubmit = sealSubmit;
  app.onfocusin = (e) => { if (e.target.closest("#seal form")) editing = true; };
  renderPrompts();
  update();
  pollTimer = setInterval(refresh, 5000);
}

async function refresh() {
  if (document.hidden) return;
  try {
    ME = await api(`/api/me?id=${encodeURIComponent(ME.me.id)}`);
    update();
  } catch (e) {
    if (e.status === 404) {
      store.del(ID_KEY);
      intro();
    }
  }
}

function update() {
  const t = CONFIG.tribes[ME.me.tribe];
  const { me, tribe } = ME;
  document.getElementById("tname").textContent = tribe.seal?.name || t.name;
  document.getElementById("tstats").textContent =
    `${tribe.count} here · ${tribe.countries} ${tribe.countries === 1 ? "country" : "countries"} · ${tribe.found} found each other`;
  document.getElementById("mline").textContent = me.line || "";

  document.getElementById("circle").innerHTML = `
    <div class="card-head"><h3>Your circle</h3><span class="badge">${me.circle}</span></div>
    <p class="muted">Look for ${esc(t.label.toLowerCase())} phones showing <b>${me.circle}</b>.</p>
    <ul class="people">${tribe.circle
      .map((m) => `<li class="${m.found ? "found" : ""}${m.me ? " me" : ""}">${flag(m.cc) || "•"} ${esc(m.name)}${m.me ? " (you)" : ""}${m.found ? " ✓" : ""}</li>`)
      .join("")}</ul>
    <button class="btn ${me.found ? "ghost" : "tribe"}" data-found>${me.found ? "Found them ✓" : "I found my people"}</button>`;

  renderSeal();

  document.getElementById("story").innerHTML = `
    <div class="card-head"><h3>Your origin story</h3><span class="badge">by Grok</span></div>
    ${tribe.story
      ? `<p class="story-text">${esc(tribe.story)}</p>`
      : `<p class="muted">Seal your first ritual and Grok writes your tribe's origin story from everyone's answers. It goes on the big screen at the end.</p>`}`;
}

function renderPrompts() {
  const t = CONFIG.tribes[ME.me.tribe];
  const prompts = [CONFIG.opener, ...t.prompts];
  promptIdx = (promptIdx + prompts.length) % prompts.length;
  document.getElementById("prompts").innerHTML = `
    <div class="card-head"><h3>Talk about this</h3><span class="muted">${promptIdx + 1}/${prompts.length}</span></div>
    <p class="prompt">${esc(prompts[promptIdx])}</p>
    <div class="row"><button class="btn ghost sm" data-prev aria-label="Previous prompt">←</button><button class="btn ghost sm" data-next>Next prompt →</button></div>`;
}

function renderSeal() {
  const seal = ME.tribe.seal;
  const sig = JSON.stringify([seal, editing]);
  // Don't wipe the form while someone is typing in it.
  if (sig === sealSig || (editing && sealSig && document.querySelector("#seal form"))) return;
  sealSig = sig;
  const t = CONFIG.tribes[ME.me.tribe];
  const el = document.getElementById("seal");
  if (seal && !editing) {
    el.innerHTML = `
      <div class="card-head"><h3>${esc(seal.name)}</h3><span class="badge">Sealed</span></div>
      <p class="ritual">${esc(seal.ritual)}</p>
      <p class="muted">Same color, same people. See you there.</p>
      <p class="fine">Sealed by ${esc(seal.by)} · <button class="link inline" data-edit>Edit</button></p>`;
    return;
  }
  el.innerHTML = `
    <div class="card-head"><h3>Make it real</h3><span class="badge">10 min</span></div>
    <p class="muted">A color lasts one night. A ritual keeps you coming back. One of you fills this in and every ${esc(t.label.toLowerCase())} phone updates.</p>
    <form class="stack" autocomplete="off">
      <label class="field"><span>Tribe name</span>
        <input name="name" maxlength="40" placeholder="${esc(t.name)}" value="${esc(seal?.name || "")}"></label>
      <label class="field"><span>First ritual: what, when, where</span>
        <textarea name="ritual" maxlength="140" rows="2">${esc(seal?.ritual || t.ritual)}</textarea></label>
      <p class="error" id="seal-error" hidden></p>
      <button class="btn tribe" type="submit">${seal ? "Save" : "Seal it"}</button>
      ${seal ? `<button class="link" type="button" data-cancel>Cancel</button>` : ""}
    </form>`;
}

async function sealSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const f = new FormData(form);
  const btn = form.querySelector("[type=submit]");
  btn.disabled = true;
  try {
    ME = await api("/api/seal", { id: ME.me.id, name: f.get("name"), ritual: f.get("ritual") });
    editing = false;
    sealSig = "";
    update();
  } catch (err) {
    const msg = form.querySelector("#seal-error");
    msg.textContent = err.message;
    msg.hidden = false;
    btn.disabled = false;
  }
}

// ---------- boot ----------

async function boot() {
  try {
    CONFIG = await api("/api/config");
  } catch {
    return failure("Couldn't reach the server. Check your connection.", boot);
  }
  const id = store.get(ID_KEY);
  if (id) {
    try {
      ME = await api(`/api/me?id=${encodeURIComponent(id)}`);
      return home();
    } catch (e) {
      if (e.status !== 404) return failure("Couldn't load your color. Check your connection.", boot);
      store.del(ID_KEY);
    }
  }
  intro();
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && document.querySelector(".beacon")) keepAwake();
});

boot();
