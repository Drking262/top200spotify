// Top bar: back/forward, home, search with live suggestions, breadcrumb, credit, data set (built-in / own CSVs).
import { loadDb, search } from "../data.js";
import { buildOwn, fetchCovers, fetchFeatures, saveOwn, useSet } from "../own.js";
import { canGoBack, crumbs } from "../state.js";
import { coverHtml, displayCountry, esc, highlight } from "../ui.js";

const svg = (d, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
const BACK = "M11.03.47a.75.75 0 0 1 0 1.06L4.56 8l6.47 6.47a.75.75 0 1 1-1.06 1.06L2.44 8 9.97.47a.75.75 0 0 1 1.06 0z";
const FWD = "M4.97.47a.75.75 0 0 0 0 1.06L11.44 8l-6.47 6.47a.75.75 0 1 0 1.06 1.06L13.56 8 6.03.47a.75.75 0 0 0-1.06 0z";
const HOME = "M8 1.2 1 7v8h5v-4.5h4V15h5V7L8 1.2zm0 1.9 5.5 4.6V13.5h-2V9H4.5v4.5h-2V7.7L8 3.1z";
const LENS = "M7 1.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5zM.25 7a6.75 6.75 0 1 1 12.096 4.12l3.184 3.185a.75.75 0 1 1-1.06 1.06L11.304 12.2A6.75 6.75 0 0 1 .25 7z";

let crumbEl, backEl;

export function initTopbar(el, ctx) {
  el.innerHTML = `
    <div class="logo" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="7" width="3.2" height="8" rx="1.6"/><rect x="7.4" y="3" width="3.2" height="12" rx="1.6"/><rect x="12.8" y="5.5" width="3.2" height="9.5" rx="1.6"/></svg></div>
    <button class="nav-btn" id="t-back" aria-label="Go back">${svg(BACK)}</button>
    <button class="nav-btn" id="t-fwd" aria-label="Go forward">${svg(FWD)}</button>
    <button class="home-btn" id="t-home" aria-label="Home: world map">${svg(HOME, 22)}</button>
    <div class="search" id="t-search">${svg(LENS, 20)}<input id="q" type="search" placeholder="Search a song or an artist" autocomplete="off" spellcheck="false" aria-label="Search songs and artists"><kbd>/</kbd></div>
    <nav class="crumbs" id="t-crumbs" aria-label="Breadcrumb"></nav>
    <div class="credit">Top 200 Spotify · Havlíková, Drkoš, Pešková</div>
    ${dataHtml(ctx.db)}`;
  backEl = el.querySelector("#t-back");
  backEl.onclick = () => history.back();
  el.querySelector("#t-fwd").onclick = () => history.forward();
  el.querySelector("#t-home").onclick = () => ctx.go({ page: "home", country: null });
  crumbEl = el.querySelector("#t-crumbs");
  initSearch(el, ctx);
  initData(el, ctx);
  updateTopbar(ctx);
}

export function updateTopbar({ db, route, go }) {
  backEl.disabled = !canGoBack(); // the landing page: Back would leave the site
  const list = crumbs(route, db);
  crumbEl.innerHTML = list.map((c, i) => (i ? '<span class="sep">›</span>' : "")
    + `<button data-i="${i}"${i === list.length - 1 ? ' class="cur" aria-current="page"' : ""} title="${esc(c.label)}">${esc(c.label)}</button>`).join("");
  crumbEl.onclick = e => {
    const i = e.target.closest("[data-i]")?.dataset.i;
    if (i != null && +i !== list.length - 1) go(list[+i].route);
  };
}

const HOWTO = "Load daily chart CSVs from charts.spotify.com (Charts › Global › Daily › download each day). Select several files at once.";

function dataHtml(db) {
  const own = localStorage.getItem("ownLabel"); // set when own data is saved
  const set = own ? `<select id="t-set" aria-label="Data set">
      <option value="builtin"${db.meta.own ? "" : " selected"}>Global 2017–2023</option>
      <option value="own"${db.meta.own ? " selected" : ""}>My data · ${esc(own)}</option></select>` : "";
  return `<div class="data">${set}<span class="data-msg" role="status"></span>
    <button class="chip" id="t-up" title="${HOWTO}">Load own data</button>
    <input type="file" id="t-file" accept=".csv,text/csv" multiple hidden aria-label="Daily chart CSV files"></div>`;
}

function initData(el, { db }) {
  const btn = el.querySelector("#t-up"), file = el.querySelector("#t-file"), msg = el.querySelector(".data-msg");
  el.querySelector("#t-set")?.addEventListener("change", e => useSet(e.target.value));
  btn.onclick = () => file.click();
  file.onchange = async () => {
    if (!file.files.length) return;
    btn.disabled = true;
    msg.textContent = `Reading ${file.files.length} file${file.files.length === 1 ? "" : "s"}…`;
    try {
      const files = await Promise.all([...file.files].map(async f => ({ name: f.name, text: await f.text() })));
      const base = db.meta.own ? await loadDb() : db; // countries and features come from the built-in data
      await new Promise(requestAnimationFrame); // let the message paint before the synchronous build
      let out = buildOwn(files, base);
      const missing = out.songs.filter(s => !s.f).map(s => s.id);
      const extra = await fetchFeatures(missing, base.meta.features, (i, n) => (msg.textContent = `Audio features ${i}/${n}…`));
      if (extra.size) out = buildOwn(files, base, extra); // again, so percentiles and trends include them
      await fetchCovers(out.songs, (i, n) => (msg.textContent = `Album covers ${i}/${n}…`));
      await saveOwn(out);
      const { first, last } = out.meta.own;
      localStorage.setItem("ownLabel", `${first} – ${last}`);
      useSet("own");
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add("err");
      btn.disabled = false;
    }
    file.value = ""; // picking the same files again fires change again
  };
}

function initSearch(el, { db, go }) {
  const box = el.querySelector("#t-search"), input = el.querySelector("#q");
  const dd = Object.assign(document.createElement("div"), { className: "dd", id: "q-list", hidden: true });
  dd.setAttribute("role", "listbox");
  box.append(dd);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-controls", "q-list");
  let hits = [], sel = 0;

  const close = () => { dd.hidden = true; input.setAttribute("aria-expanded", "false"); };
  const choose = h => {
    go(h.type === "song" ? { page: "song", id: db.songs[h.idx].id } : { page: "artist", id: db.artists[h.idx].n });
    input.value = "";
    close();
    input.blur();
  };
  function draw() {
    const q = input.value;
    if (!q.trim()) return close();
    hits = search(db, q);
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    dd.hidden = false;
    input.setAttribute("aria-expanded", "true");
    dd.innerHTML = hits.length ? hits.map((h, k) => {
      const on = k === sel ? " on" : "";
      if (h.type === "song") {
        const s = db.songs[h.idx], peak = Math.min(...s.m.map(e => e[2]));
        return `<button class="it${on}" data-k="${k}" role="option" aria-selected="${!!on}">${coverHtml(s, { size: 40 })}<div style="min-width:0"><div class="t1">${highlight(s.t, q)}</div><div class="t2">Song · ${esc(s.a.map(i => db.artists[i].n).join(", "))}</div></div><div class="x">#${peak} peak</div></button>`;
      }
      const a = db.artists[h.idx];
      return `<button class="it${on}" data-k="${k}" role="option" aria-selected="${!!on}">${coverHtml(db.songs[a.s[0]], { size: 40, round: true, label: a.n })}<div style="min-width:0"><div class="t1">${highlight(a.n, q)}</div><div class="t2">Artist · ${esc(displayCountry(a.c))}</div></div><div class="x">${a.s.length} song${a.s.length === 1 ? "" : "s"}</div></button>`;
    }).join("") : `<div class="none">No songs or artists match “${esc(q.trim())}”</div>`;
  }

  input.oninput = () => { sel = 0; draw(); };
  input.onfocus = draw;
  input.onkeydown = e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sel = Math.max(0, Math.min(hits.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1)));
      draw();
    } else if (e.key === "Enter" && !dd.hidden && hits[sel]) choose(hits[sel]);
    else if (e.key === "Escape") { input.value = ""; close(); input.blur(); }
  };
  dd.onmousedown = e => e.preventDefault(); // keep focus in the input while clicking a suggestion
  dd.onclick = e => { const b = e.target.closest("[data-k]"); if (b) choose(hits[+b.dataset.k]); };
  document.addEventListener("click", e => { if (!box.contains(e.target)) close(); });
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) { e.preventDefault(); input.focus(); }
  });
}
