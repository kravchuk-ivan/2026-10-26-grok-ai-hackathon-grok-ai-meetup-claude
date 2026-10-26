import { flag } from "./countries.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const $ = (id) => document.getElementById(id);
const ADMIN_KEY = new URLSearchParams(location.search).get("admin") || "";
const SLIDE_MS = 24000;

let CONFIG = null;
let STATE = null;
let prevCounts = {};
let prevSealed = null;
let storyIdx = 0;
let storyTimer = null;

async function api(path, body) {
  const res = await fetch(
    path,
    body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function renderQR() {
  const url = `${location.origin}/`;
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
  $("qr").innerHTML = `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${esc(url)}"><path d="${d}" fill="#000"/></svg>`;
  $("url").textContent = location.host;
}

// ---------- live board ----------

function render() {
  const s = STATE;
  $("s-total").textContent = s.total;
  $("s-countries").textContent = s.countries;
  $("s-sealed").textContent = s.tribes.filter((t) => t.sealed).length;

  $("tribes").innerHTML = s.tribes
    .map((t) => {
      const c = CONFIG.tribes[t.key];
      const before = prevCounts[t.key] ?? t.count;
      const fs = t.count <= 20 ? "2.2vw" : t.count <= 45 ? "1.7vw" : t.count <= 80 ? "1.3vw" : "1vw";
      const flags = t.flags
        .map((cc, i) => {
          const f = flag(cc);
          return `<span class="${i >= before ? "pop" : ""}${f ? "" : " dot"}">${f || "●"}</span>`;
        })
        .join("");
      const foot = t.sealed
        ? esc(t.ritual)
        : t.count
          ? `${t.found} found each other`
          : "Waiting for the first one";
      return `<div class="tile${t.count ? "" : " empty"}${t.sealed ? " sealed" : ""}" style="--c:${c.color};--ink:${c.ink};--fs:${fs}">
        <div class="t-top"><span class="t-label">${esc(c.label)}</span><span class="t-count">${t.count}</span></div>
        <div class="t-name">${esc(t.name)}</div>
        <div class="t-flags">${flags}</div>
        <div class="t-foot">${foot}</div>
      </div>`;
    })
    .join("");

  $("feed").innerHTML = s.feed
    .map((f) => `<span class="f" style="--c:${CONFIG.tribes[f.tribe].color}"><i></i>${flag(f.cc)} ${esc(f.name)}</span>`)
    .join("");

  prevCounts = Object.fromEntries(s.tribes.map((t) => [t.key, t.count]));
}

function announceSeals() {
  const sealed = new Set(STATE.tribes.filter((t) => t.sealed).map((t) => t.key));
  if (prevSealed) {
    STATE.tribes.filter((t) => t.sealed && !prevSealed.has(t.key)).forEach((t, i) => setTimeout(() => toast(t), i * 1200));
  }
  prevSealed = sealed;
}

function toast(t) {
  const c = CONFIG.tribes[t.key];
  const el = document.createElement("div");
  el.className = "toast";
  el.style.cssText = `--c:${c.color};--ink:${c.ink}`;
  el.innerHTML = `<small>${esc(c.label)} just sealed it</small><b>${esc(t.name)}</b><span>${esc(t.ritual)}</span>`;
  $("toasts").append(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 500);
  }, 7000);
}

async function poll() {
  try {
    STATE = await api("/api/state");
    render();
    announceSeals();
  } catch (e) {
    console.warn(e);
  }
}

// ---------- story mode ----------

function slides() {
  const list = STATE.tribes.filter((t) => t.story && t.count).map((t) => ({ tribe: t }));
  if (STATE.room) list.push({ room: true });
  return list;
}

function showStory(step = 0) {
  const list = slides();
  const el = $("story");
  if (!list.length) {
    status("No stories yet. Seal a tribe or press “Write stories”.");
    return closeStory();
  }
  storyIdx = (storyIdx + step + list.length) % list.length;
  const cur = list[storyIdx];
  const dots = `<div class="s-dots">${list.map((_, i) => `<i class="${i === storyIdx ? "on" : ""}"></i>`).join("")}</div>`;
  if (cur.room) {
    const stripes = Object.values(CONFIG.tribes).map((c) => `<i style="--o:${c.color}"></i>`).join("");
    el.className = "story room";
    el.style.cssText = "";
    el.innerHTML = `
      <div class="s-stripes">${stripes}</div>
      <p class="s-kicker">${esc(STATE.event)} · ${STATE.total} people · ${STATE.countries} countries</p>
      <h1 class="s-name">The story of this room</h1>
      <p class="s-text">${esc(STATE.room)}</p>
      ${dots}`;
  } else {
    const t = cur.tribe;
    const c = CONFIG.tribes[t.key];
    el.className = "story";
    el.style.cssText = `--c:${c.color};--ink:${c.ink}`;
    el.innerHTML = `
      <p class="s-kicker">${esc(c.label)} · ${t.count} ${t.count === 1 ? "person" : "people"}${t.countries.length ? ` · ${esc(t.countries.join(" · "))}` : ""}</p>
      <h1 class="s-name">${esc(t.name)}</h1>
      <p class="s-text">${esc(t.story)}</p>
      <div class="s-flags">${t.flags.map((cc) => flag(cc)).join("")}</div>
      ${dots}`;
  }
  el.hidden = false;
  clearTimeout(storyTimer);
  storyTimer = setTimeout(() => showStory(1), SLIDE_MS);
}

function closeStory() {
  clearTimeout(storyTimer);
  $("story").hidden = true;
}

document.addEventListener("keydown", (e) => {
  const open = !$("story").hidden;
  if (e.key === "s" && !open) { storyIdx = 0; showStory(); }
  else if (open && (e.key === "ArrowRight" || e.key === " ")) { e.preventDefault(); showStory(1); }
  else if (open && e.key === "ArrowLeft") showStory(-1);
  else if (open && e.key === "Escape") closeStory();
});
$("story").addEventListener("click", () => showStory(1));

// ---------- admin ----------

function status(msg) {
  const el = document.querySelector(".a-status");
  if (el) el.textContent = msg;
}

function setupAdmin() {
  const el = $("admin");
  el.hidden = false;
  el.innerHTML = `
    <span class="a-status">${STATE?.ai ? "Grok connected" : "No XAI_API_KEY: template stories"}</span>
    <button data-a="stories">Write stories with Grok</button>
    <button data-a="show">Story mode (S)</button>
    <button data-a="seed">+30 fake people</button>
    <button data-a="fakes">Remove fakes</button>
    <button data-a="reset" class="danger">Reset everything</button>`;
  let resetArmed = false;
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    const a = b.dataset.a;
    try {
      if (a === "show") { storyIdx = 0; return showStory(); }
      if (a === "reset" && !resetArmed) {
        resetArmed = true;
        b.textContent = "Click again to wipe all data";
        setTimeout(() => { resetArmed = false; b.textContent = "Reset everything"; }, 4000);
        return;
      }
      b.disabled = true;
      status(a === "stories" ? "Grok is writing…" : "Working…");
      if (a === "stories") STATE = await api("/api/admin/stories", { key: ADMIN_KEY });
      if (a === "seed") STATE = await api("/api/admin/seed", { key: ADMIN_KEY, n: 30 });
      if (a === "fakes") STATE = await api("/api/admin/reset", { key: ADMIN_KEY, fakesOnly: true });
      if (a === "reset") { STATE = await api("/api/admin/reset", { key: ADMIN_KEY }); prevSealed = new Set(); }
      render();
      status("Done");
      if (a === "stories") { storyIdx = 0; showStory(); }
    } catch (err) {
      status(err.message);
    } finally {
      b.disabled = false;
    }
  });
}

async function boot() {
  CONFIG = await api("/api/config");
  renderQR();
  await poll();
  if (ADMIN_KEY) setupAdmin();
  setInterval(poll, 2000);
}

boot();
