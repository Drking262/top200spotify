// Song page (T2): header, daily rank over the song's whole chart life, and the song's sound radar.
import { drawRadar, radarLegend } from "../charts/radar.js";
import { drawRankLine } from "../charts/rankline.js";
import { loadRanks, monthLabel, monthStart, rankHistory } from "../data.js";
import { current } from "../state.js";
import { SERIES, coverHtml, displayCountry, esc, fmt, fmtCompact, hueFor, periodLabel } from "../ui.js";

const tile = (b, span) => `<div class="tile"><b>${b}</b><span>${span}</span></div>`;
const short = (meta, m) => monthLabel(meta, m).replace(/ 20(\d\d)$/, " ’$1"); // Oct ’18
const raw = (name, v) => (name === "Loudness" ? `${v.toFixed(1)} dB` : v.toFixed(2));

export function render(el, { db, route, go }) {
  const i = db.songById.get(route.id), s = db.songs[i];
  const peak = Math.min(...s.m.map(e => e[2]));
  const days = s.m.reduce((t, e) => t + e[3], 0);
  const first = s.m[0][0], last = s.m.at(-1)[0];
  const countries = [...new Set(s.a.map(a => db.artists[a].c))].filter(c => c !== "Unknown");

  el.innerHTML = `
    <div class="hero" style="--hue:${hueFor(s.t)}">
      <div class="hero-row">
        <div class="hero-art">${coverHtml(s, { size: 168 })}</div>
        <div class="grow">
          <div class="kicker">Song</div>
          <h1 class="title${s.t.length > 22 ? " long" : ""}">${esc(s.t)}</h1>
          <div class="chips tight">${s.a.map(a => `<button class="chip" data-artist="${esc(db.artists[a].n)}">${esc(db.artists[a].n)}</button>`).join("")}
            ${countries.map(c => `<button class="chip ghost" data-c="${esc(c)}">${esc(displayCountry(c))}</button>`).join("")}</div>
        </div>
      </div>
      <div class="tiles">
        ${tile(`#${peak}`, "peak rank")}
        ${tile(fmt(days), "days on the chart")}
        ${tile(fmtCompact(s.total), "chart points")}
        ${tile(first === last ? short(db.meta, first) : `${short(db.meta, first)} – ${short(db.meta, last)}`, "first – last month on the chart")}
      </div>
    </div>
    <div class="section">
      <h2>Rank over time <small>daily · drag to zoom · double-click to reset · shaded: ${esc(periodLabel(db.meta, route))}</small></h2>
      <div class="card"><div class="rl">${db.ranks ? "" : '<div class="skel" style="height:320px"></div>'}</div></div>
      <h2>Sound <small>percentiles vs all ${fmt(db.songs.length)} chart songs</small></h2>
      <div class="card sig">
        <svg class="radar"></svg>
        <div>
          <div class="radar-legend"></div>
          <table class="feats">${db.meta.features.map((f, k) => `<tr><td><button class="lk" data-f="${f}">${f}</button></td><td class="num">${raw(f, s.f[k])}</td></tr>`).join("")}</table>
          <p class="note">Percentile = share of chart songs with a lower value. Click a feature to see how it changed over the years.</p>
        </div>
      </div>
    </div>`;

  const series = [{ label: s.t, mean: s.p.map(v => v / 100), ci: null, color: SERIES[0] }];
  drawRadar(el.querySelector(".radar"), { axes: db.meta.radar, series, onAxis: f => go({ page: "feature", id: f, cmp: s.id }) });
  el.querySelector(".radar-legend").innerHTML = radarLegend(series);

  if (db.ranks) {
    drawRankLine(el.querySelector(".rl"), {
      history: rankHistory(db, i), meta: db.meta,
      shade: [monthStart(db.meta, route.from), Math.min(monthStart(db.meta, route.to + 1), db.meta.days) - 1],
    });
  } else {
    loadRanks(db).then(() => { const r = current(); if (r.page === "song" && r.id === s.id) render(el, { db, route: r, go }); });
  }

  el.onclick = e => {
    const b = e.target.closest("[data-artist],[data-c],[data-f]");
    if (b?.dataset.artist) go({ page: "artist", id: b.dataset.artist });
    else if (b?.dataset.c) go({ page: "home", country: b.dataset.c });
    else if (b?.dataset.f) go({ page: "feature", id: b.dataset.f, cmp: s.id });
  };
}
