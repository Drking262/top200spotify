// Artist page: header, bump chart of the picked songs (top 5 by default), sound radar with compare.
// The song list lives in the right panel (frame/nowplaying.js), where songs are ticked for the chart.
import { drawBump } from "../charts/bump.js";
import { drawRadar, radarLegend } from "../charts/radar.js";
import { artistSongs, bumpSeries, chartDays, loadRanks, search, signature } from "../data.js";
import { current } from "../state.js";
import { SERIES, coverHtml, displayCountry, esc, fmt, fmtCompact, hueFor, periodLabel } from "../ui.js";

export const MAX_PICKS = SERIES.length;
const picks = new Map(); // artist name → Set of song indices ticked for the chart; unset = top 5

/** Songs shown in the chart, in the artist's points order (`songs` = artistSongs rows). */
export function chartSongs(db, ai, songs) {
  const p = picks.get(db.artists[ai].n);
  return p ? songs.map(x => x.song).filter(i => p.has(i)) : songs.slice(0, 5).map(x => x.song);
}

export function togglePick(db, ai, songs, song) {
  const p = new Set(chartSongs(db, ai, songs));
  if (p.has(song)) p.delete(song);
  else if (p.size < MAX_PICKS) p.add(song);
  picks.set(db.artists[ai].n, p);
}

const tile = (b, span) => `<div class="tile"><b>${b}</b><span>${span}</span></div>`;

/** Signature of an artist's songs in the period, or of all their songs when none charted in it. */
function artistSignature(db, ai, route, color) {
  const inPeriod = artistSongs(db, ai, route).map(x => x.song);
  const idxs = inPeriod.length ? inPeriod : db.artists[ai].s;
  return { ...signature(db, idxs), color, label: db.artists[ai].n + (inPeriod.length ? "" : " (all time)") };
}

export function render(el, { db, route, go }) {
  const ai = db.artistByName.get(route.id), a = db.artists[ai];
  const songs = artistSongs(db, ai, route);
  const period = periodLabel(db.meta, route);
  const points = songs.reduce((t, x) => t + x.points, 0);
  const peak = songs.length ? Math.min(...songs.map(x => x.peak)) : null;
  const top = chartSongs(db, ai, songs);
  const cmpIdx = route.cmp && route.cmp !== a.n ? db.artistByName.get(route.cmp) : undefined;
  const nation = a.c === "Unknown" ? "Unknown nationality" : `<button class="lk" data-c="${esc(a.c)}">${esc(displayCountry(a.c))}</button>`;

  el.innerHTML = `
    <div class="hero" style="--hue:${hueFor(a.n)}">
      <div class="hero-row">
        <div class="hero-art round">${coverHtml(db.songs[a.s[0]], { size: 168, round: true, label: a.n })}</div>
        <div class="grow">
          <div class="kicker">Artist · ${esc(period)}</div>
          <h1 class="title${a.n.length > 16 ? " long" : ""}">${esc(a.n)}</h1>
          <div class="sub">${nation} · <b>${a.s.length}</b> song${a.s.length === 1 ? "" : "s"} on the chart ${esc(periodLabel(db.meta, { from: 0, to: db.meta.months.length - 1 }))} · ${fmtCompact(a.total)} points</div>
        </div>
      </div>
      <div class="tiles">
        ${tile(fmt(songs.length), `song${songs.length === 1 ? "" : "s"} in ${esc(period)}`)}
        ${tile(fmtCompact(points), "chart points")}
        ${tile(peak ? `#${peak}` : "—", "best rank")}
        ${tile(db.ranks ? fmt(chartDays(db, a.s, route)) : "…", "days on the chart")}
      </div>
    </div>
    <div class="section">
      <h2>Top songs: rank over time <small>${songs.length ? `best rank per ${route.to - route.from < 6 ? "week" : "month"} · ${top.length} song${top.length === 1 ? "" : "s"} · pick songs on the right` : ""}</small></h2>
      <div class="card">${!top.length ? `<div class="empty">${songs.length ? "No songs ticked. Tick songs in the right panel to show them here." : `${esc(a.n)} had no songs on the chart in ${esc(period)}.<br>Pick a longer period below.`}</div>`
        : db.ranks ? '<svg class="bump" width="100%"></svg>' : '<div class="skel" style="height:340px"></div>'}</div>
      <h2>Sound vs. a typical hit <small>percentiles vs all ${fmt(db.songs.length)} chart songs</small></h2>
      <div class="card sig">
        <svg class="radar"></svg>
        <div>
          <div class="cmp">${cmpIdx != null
            ? `<span class="cmp-on"><i style="background:${SERIES[1]}"></i>vs <button class="lk" data-artist="${esc(route.cmp)}">${esc(route.cmp)}</button><button class="x" data-clear aria-label="Remove comparison">×</button></span>`
            : `<div class="cmp-pick"><input type="search" placeholder="+ Compare with an artist" aria-label="Compare with an artist" autocomplete="off"><div class="dd" hidden></div></div>`}</div>
          <div class="radar-legend"></div>
          <p class="note">Each axis is the average percentile of the artist's songs among all chart songs: 50 = a typical hit (dashed line), 90 = higher than 90% of hits. The band is the 95% confidence interval of that average. Click an axis to explore the feature.</p>
        </div>
      </div>
    </div>`;

  const series = [artistSignature(db, ai, route, SERIES[0])];
  if (cmpIdx != null) series.push(artistSignature(db, cmpIdx, route, SERIES[1]));
  drawRadar(el.querySelector(".radar"), { axes: db.meta.radar, series, onAxis: f => go({ page: "feature", id: f, cmp: a.n }) });
  el.querySelector(".radar-legend").innerHTML = radarLegend(series);

  if (top.length && db.ranks) {
    const b = bumpSeries(db, top, route);
    drawBump(el.querySelector(".bump"), {
      unit: b.unit, steps: b.steps, meta: db.meta, onSong: i => go({ page: "song", id: db.songs[i].id }),
      series: b.series.map((s, k) => ({ ...s, label: db.songs[s.song].t, cover: db.songs[s.song].c, color: SERIES[k] })),
    });
  }
  if (!db.ranks) loadRanks(db).then(() => { const r = current(); if (r.page === "artist" && r.id === a.n) render(el, { db, route: r, go }); });

  const input = el.querySelector(".cmp-pick input");
  if (input) {
    const dd = el.querySelector(".cmp-pick .dd");
    const hits = () => search(db, input.value, 30).filter(h => h.type === "artist" && h.idx !== ai).slice(0, 6);
    input.oninput = () => {
      const list = hits();
      dd.hidden = !input.value.trim();
      dd.innerHTML = list.length ? list.map(h => {
        const o = db.artists[h.idx];
        return `<button class="it" data-cmp="${esc(o.n)}">${coverHtml(db.songs[o.s[0]], { size: 40, round: true, label: o.n })}<div style="min-width:0"><div class="t1">${esc(o.n)}</div><div class="t2">${esc(displayCountry(o.c))} · ${o.s.length} song${o.s.length === 1 ? "" : "s"}</div></div></button>`;
      }).join("") : '<div class="none">No artist found</div>';
    };
    input.onkeydown = e => {
      if (e.key === "Enter" && hits()[0]) go({ cmp: db.artists[hits()[0].idx].n }, { replace: true });
      if (e.key === "Escape") { input.value = ""; dd.hidden = true; }
    };
  }

  el.onclick = e => {
    const b = e.target.closest("[data-song],[data-artist],[data-c],[data-clear],[data-cmp]");
    if (!b) return;
    if (b.dataset.song) go({ page: "song", id: b.dataset.song });
    else if (b.dataset.cmp) go({ cmp: b.dataset.cmp }, { replace: true });
    else if (b.dataset.artist) go({ page: "artist", id: b.dataset.artist, cmp: null });
    else if (b.dataset.c) go({ page: "home", country: b.dataset.c });
    else go({ cmp: null }, { replace: true });
  };
}
