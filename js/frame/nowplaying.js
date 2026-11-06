// Right "now playing" panel: the current song (or the top song of the selection) with Spotify's own player.
import { drawRadar, radarLegend } from "../charts/radar.js";
import { artistSongs, signature, topSongs } from "../data.js";
import { SERIES, coverHtml, displayCountry, esc, periodLabel } from "../ui.js";

let lastId = null;

/** Which song to play: the song page's song, else the top song of the artist / country / world in the period. */
function pick(db, route) {
  const period = periodLabel(db.meta, route);
  if (route.page === "song") return { song: db.songById.get(route.id), why: "Selected song" };
  if (route.page === "artist") {
    const ai = db.artistByName.get(route.id);
    const top = artistSongs(db, ai, route)[0];
    if (top) return { song: top.song, why: `Top song of ${db.artists[ai].n} · ${period}` };
    return { song: db.artists[ai].s[0], why: `Not on the chart in ${period} · their biggest hit` };
  }
  const top = topSongs(db, route, route.country, 1)[0];
  const where = route.country ? displayCountry(route.country) : "World";
  return top ? { song: top.song, why: `#1 song · ${where} · ${period}` } : null;
}

/** Home with a country selected: compact signature of that country's songs in the period (spec §5.8). */
function renderExtra(el, db, route, go) {
  const songs = route.page === "home" && route.country ? topSongs(db, route, route.country, Infinity).map(x => x.song) : [];
  if (!songs.length) { el.innerHTML = ""; return; }
  const s = { ...signature(db, songs), color: SERIES[0], label: displayCountry(route.country) };
  el.innerHTML = '<div class="np-label">Sound signature <small>percentiles · click an axis</small></div><div class="card"><svg class="radar"></svg><div class="radar-legend"></div></div>';
  drawRadar(el.querySelector(".radar"), { axes: db.meta.radar, series: [s], onAxis: f => go({ page: "feature", id: f }) });
  el.querySelector(".radar-legend").innerHTML = radarLegend([s]);
}

export function renderNowPlaying(el, { db, route, go }) {
  if (!el.querySelector(".np-body")) {
    el.innerHTML = '<div class="np-label">Now playing</div><div class="np-body"></div><div class="np-embed"></div><div class="np-extra"></div>';
    lastId = null;
  }
  const body = el.querySelector(".np-body"), embed = el.querySelector(".np-embed");
  renderExtra(el.querySelector(".np-extra"), db, route, go);
  const p = route.page === "artist" && !db.artistByName.has(route.id) ? null : pick(db, route);
  if (!p || p.song == null) {
    body.innerHTML = `<div class="empty">No songs from ${esc(displayCountry(route.country ?? "World"))} in this period.</div>`;
    embed.innerHTML = "";
    lastId = null;
    return;
  }
  const s = db.songs[p.song];
  body.innerHTML = `
    <div class="np-hd">
      ${coverHtml(s, { size: 64 })}
      <div style="min-width:0">
        <button class="np-title" data-song="${esc(s.id)}">${esc(s.t)}</button>
        <div class="np-artists">${s.a.map(i => `<button data-artist="${esc(db.artists[i].n)}">${esc(db.artists[i].n)}</button>`).join(", ")}</div>
      </div>
    </div>
    <div class="np-why">${esc(p.why)}</div>`;
  body.onclick = e => {
    const b = e.target.closest("[data-song],[data-artist]");
    if (b?.dataset.song) go({ page: "song", id: b.dataset.song });
    else if (b?.dataset.artist) go({ page: "artist", id: b.dataset.artist });
  };
  if (s.id !== lastId) { // a new iframe only when the track changes, so playback is not cut off
    lastId = s.id;
    embed.innerHTML = `<iframe class="embed" src="https://open.spotify.com/embed/track/${encodeURIComponent(s.id)}?theme=0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify preview: ${esc(s.t)}"></iframe>`;
  }
}
