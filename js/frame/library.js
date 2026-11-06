// Left "library": top artists (T3, unique songs) or top songs (T4, points) for the period and country.
import { topArtists, topSongs } from "../data.js";
import { coverHtml, displayCountry, esc, fmt, fmtCompact, periodLabel } from "../ui.js";

let tab = "artists";
const ICON = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 22a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v18a1 1 0 0 1-1 1zM15.5 2.134A1 1 0 0 0 14 3v18a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6.464a1 1 0 0 0-.5-.866l-6-3.464zM9 2a1 1 0 0 0-1 1v18a1 1 0 1 0 2 0V3a1 1 0 0 0-1-1z" fill="currentColor"/></svg>';

const bar = pct => `<span class="bar"><i style="width:${Math.max(2, pct).toFixed(1)}%"></i></span>`;

function artistRows(db, route) {
  const rows = topArtists(db, route, route.country);
  const max = rows[0]?.count || 1;
  return rows.map(({ artist, count, points }) => {
    const a = db.artists[artist];
    const sel = route.page === "artist" && route.id === a.n ? " sel" : "";
    return `<button class="row${sel}" data-artist="${esc(a.n)}" title="${esc(a.n)} · ${fmt(points)} points">
      ${coverHtml(db.songs[a.s[0]], { size: 48, round: true, label: a.n })}
      <div style="min-width:0"><div class="nm">${esc(a.n)}</div>
      <div class="meta"><span class="n">${count} song${count === 1 ? "" : "s"}</span>${bar((count / max) * 100)}</div></div>
    </button>`;
  });
}

function songRows(db, route) {
  const rows = topSongs(db, route, route.country);
  const max = rows[0]?.points || 1;
  return rows.map(({ song, points }) => {
    const s = db.songs[song];
    const sel = route.page === "song" && route.id === s.id ? " sel" : "";
    const who = s.a.map(i => db.artists[i].n).join(", ");
    return `<button class="row${sel}" data-song="${esc(s.id)}" title="${esc(s.t)} · ${fmt(points)} points">
      ${coverHtml(s, { size: 48 })}
      <div style="min-width:0"><div class="nm">${esc(s.t)}</div>
      <div class="meta"><span class="who">${esc(who)}</span><span class="n">${fmtCompact(points)}</span>${bar((points / max) * 100)}</div></div>
    </button>`;
  });
}

export function renderLibrary(el, { db, route, go }) {
  const where = route.country ? displayCountry(route.country) : "World";
  const rows = tab === "artists" ? artistRows(db, route) : songRows(db, route);
  el.innerHTML = `
    <div class="lib-head">${ICON}<span>Top ${tab} · ${esc(where)}</span></div>
    <div class="lib-sub">${esc(periodLabel(db.meta, route))} · ${tab === "artists" ? "by unique songs" : "by chart points"}</div>
    <div class="chips" role="tablist">
      <button class="chip${tab === "artists" ? " on" : ""}" data-tab="artists" role="tab" aria-selected="${tab === "artists"}">Artists</button>
      <button class="chip${tab === "songs" ? " on" : ""}" data-tab="songs" role="tab" aria-selected="${tab === "songs"}">Songs</button>
    </div>
    ${rows.length ? rows.join("") : `<div class="empty">No songs from ${esc(where)} in this period.<br>Try a longer period or another country.</div>`}`;
  el.onclick = e => {
    const b = e.target.closest("[data-tab],[data-artist],[data-song]");
    if (!b) return;
    if (b.dataset.tab) {
      tab = b.dataset.tab;
      renderLibrary(el, { db, route, go });
    } else if (b.dataset.artist) go({ page: "artist", id: b.dataset.artist });
    else go({ page: "song", id: b.dataset.song });
  };
}
