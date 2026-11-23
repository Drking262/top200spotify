// Right panel: Spotify's player for the current song, then the songs of that song's artist
// (on the artist page: tick songs to show them in the chart). Home + country adds that country's sound.
import { drawRadar, radarLegend } from "../charts/radar.js";
import { artistSongs, signature, topSongs } from "../data.js";
import { refresh } from "../state.js";
import { SERIES, coverHtml, displayCountry, esc, fmtCompact, periodLabel } from "../ui.js";
import { MAX_PICKS, chartSongs, togglePick } from "../views/artist.js";

let lastId = null;

/** The current song: the song page's song, else the top song of the artist / country / world in the period. */
export function pick(db, route) {
  if (route.page === "song") return db.songById.get(route.id) ?? null;
  if (route.page === "artist") {
    const ai = db.artistByName.get(route.id);
    if (ai == null) return null;
    return artistSongs(db, ai, route)[0]?.song ?? db.artists[ai].s[0];
  }
  return topSongs(db, route, route.country, 1)[0]?.song ?? null;
}

/** Home with a country selected: compact signature of that country's songs in the period (spec §5.8). */
function renderExtra(el, db, route, go) {
  const songs = route.page === "home" && route.country ? topSongs(db, route, route.country, Infinity).map(x => x.song) : [];
  if (!songs.length) { el.innerHTML = ""; return; }
  const s = { ...signature(db, songs), color: SERIES[0], label: displayCountry(route.country) };
  el.innerHTML = '<div class="np-label">Sound vs. a typical hit <small>percentiles · click an axis</small></div><div class="card"><svg class="radar"></svg><div class="radar-legend"></div></div>';
  drawRadar(el.querySelector(".radar"), { axes: db.meta.radar, series: [s], onAxis: f => go({ page: "feature", id: f }) });
  el.querySelector(".radar-legend").innerHTML = radarLegend([s]);
}

/** Songs of the current song's artist; on the artist page each row also toggles the song in the chart. */
function renderSongs(el, db, route, go, cur) {
  const onArtist = route.page === "artist";
  const ai = onArtist ? db.artistByName.get(route.id) : db.songs[cur].a[0];
  const a = db.artists[ai], songs = artistSongs(db, ai, route);
  const shown = onArtist ? chartSongs(db, ai, songs) : [];
  const head = onArtist
    ? `<div class="np-label">Songs <small>${esc(periodLabel(db.meta, route))}</small></div><div class="np-hint">Tick songs to show them in the chart (up to ${MAX_PICKS})</div>`
    : `<div class="np-label"><span>More by <button class="lk" data-artist="${esc(a.n)}">${esc(a.n)}</button></span><small>${esc(periodLabel(db.meta, route))}</small></div>`;
  const rows = songs.map(x => {
    const s = db.songs[x.song], k = shown.indexOf(x.song);
    const box = onArtist ? `<button class="pick${k >= 0 ? " on" : ""}" data-pick="${x.song}" role="checkbox" aria-checked="${k >= 0}" aria-label="Show ${esc(s.t)} in the chart"${k >= 0 ? ` style="--c:${SERIES[k]}"` : ""}></button>` : "";
    return `<div class="np-song${x.song === cur ? " sel" : ""}">${box}<button class="np-open" data-song="${esc(s.id)}">${coverHtml(s, { size: 40 })}<span class="np-t"><b>${esc(s.t)}</b><small>#${x.peak} peak · ${x.days} days · ${fmtCompact(x.points)} pts</small></span></button></div>`;
  }).join("");
  el.innerHTML = head + (rows || `<div class="empty">${esc(a.n)} had no songs on the chart in this period.</div>`);
  el.onclick = e => {
    const b = e.target.closest("[data-pick],[data-song],[data-artist]");
    if (!b) return;
    if (b.dataset.pick) { togglePick(db, ai, songs, +b.dataset.pick); refresh(); }
    else if (b.dataset.song) go({ page: "song", id: b.dataset.song });
    else go({ page: "artist", id: b.dataset.artist });
  };
}

export function renderNowPlaying(el, { db, route, go }) {
  if (!el.querySelector(".np-embed")) {
    el.innerHTML = '<div class="np-embed"></div><div class="np-songs"></div><div class="np-extra"></div>';
    lastId = null;
  }
  const embed = el.querySelector(".np-embed"), list = el.querySelector(".np-songs");
  renderExtra(el.querySelector(".np-extra"), db, route, go);
  const cur = pick(db, route);
  if (cur == null) {
    embed.innerHTML = `<div class="empty">No songs from ${esc(displayCountry(route.country ?? "World"))} in this period.</div>`;
    list.innerHTML = "";
    lastId = null;
    return;
  }
  const s = db.songs[cur];
  if (s.id !== lastId) { // a new iframe only when the track changes, so playback is not cut off
    lastId = s.id;
    embed.innerHTML = `<iframe class="embed" src="https://open.spotify.com/embed/track/${encodeURIComponent(s.id)}?theme=0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify preview: ${esc(s.t)}"></iframe>`;
  }
  renderSongs(list, db, route, go, cur);
}
