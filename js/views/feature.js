// Feature page (T5, T6): how one audio feature changed over the years, and whether it goes with chart success.
import { drawCorrBars, drawScatter, drawTrend, fmtR, fmtValue } from "../charts/feature.js";
import { featureMedian, highlightOf } from "../data.js";
import { pickMonth } from "../state.js";
import { esc, hueFor, periodLabel } from "../ui.js";

const ABOUT = {
  Danceability: "How suitable a track is for dancing, judged from tempo, rhythm stability and beat strength (0–1).",
  Energy: "Perceived intensity and activity: fast, loud and noisy tracks score high, calm ones low (0–1).",
  Loudness: "Average loudness of the whole track in decibels; values closer to 0 dB are louder.",
  Speechiness: "How much of the track is spoken word; rap scores higher, above about 0.66 it is mostly speech (0–1).",
  Acousticness: "Confidence that the track is acoustic rather than electronic or amplified (0–1).",
  Instrumentalness: "Likelihood that the track has no vocals; almost every hit is close to 0 (0–1).",
  Valence: "Musical positiveness: high sounds happy and cheerful, low sounds sad, tense or angry (0–1).",
};
const tile = (b, span) => `<div class="tile"><b>${b}</b><span>${span}</span></div>`;
const strength = r => { const a = Math.abs(r); return a < 0.1 ? "negligible" : a < 0.3 ? "weak" : a < 0.5 ? "moderate" : "strong"; };

export function render(el, { db, route, go }) {
  const f = route.id, k = db.meta.features.indexOf(f), c = db.meta.corr[f];
  const hl = highlightOf(db, route.cmp), hlArtist = db.artistByName.has(route.cmp);
  const last = db.meta.months.length - 1;
  const verdict = !c ? "" : strength(c.spearman) === "negligible" || strength(c.spearman) === "weak"
    ? `Knowing a song's ${f.toLowerCase()} tells you almost nothing about how many points it collects (ρ = ${fmtR(c.spearman)}, ${strength(c.spearman)}).`
    : `Songs with higher ${f.toLowerCase()} tend to collect ${c.spearman > 0 ? "more" : "fewer"} points (ρ = ${fmtR(c.spearman)}, ${strength(c.spearman)}).`;

  el.innerHTML = `
    <div class="hero" style="--hue:${hueFor(f)}">
      <div class="kicker">Audio feature</div>
      <h1 class="title">${esc(f)}</h1>
      <div class="sub">${ABOUT[f]}</div>
      <div class="tiles">
        ${tile(fmtValue(f, featureMedian(db, k, route)), `median in ${esc(periodLabel(db.meta, route))}`)}
        ${tile(fmtValue(f, featureMedian(db, k, { from: 0, to: last })), "median 2017–2023")}
        ${c ? tile(fmtR(c.spearman), `Spearman ρ with points · ${strength(c.spearman)}`) + tile(fmtR(c.pearson), "Pearson r with log points") : ""}
      </div>
    </div>
    <div class="section">
      <h2>Over the years <small>monthly median of the songs on the chart · band = middle 50% · click a month to select it</small></h2>
      <div class="card"><svg class="trend"></svg></div>
      <h2>Does it make a hit? <small>one dot per song · height = total chart points (log) · click a dot to open the song</small></h2>
      <div class="card">
        ${hl ? `<div class="hl-bar"><i></i>Highlighted: <button class="lk" data-hl>${esc(hl.label)}</button><span>· ${hl.songs.length} song${hl.songs.length === 1 ? "" : "s"}${hlArtist ? ", all years" : ""}</span><button class="chip" data-clear>Clear</button></div>` : ""}
        <div class="scatter"></div>
        <p class="note">${verdict}</p>
      </div>
      <h2>All features <small>Spearman correlation with total chart points · click one to open it</small></h2>
      <div class="card"><svg class="corr"></svg></div>
    </div>`;

  drawTrend(el.querySelector(".trend"), { meta: db.meta, feature: f, from: route.from, to: route.to, onMonth: m => go(pickMonth(route, m, db.meta)) });
  drawScatter(el.querySelector(".scatter"), { db, feature: f, highlight: hl?.songs ?? [], onSong: i => go({ page: "song", id: db.songs[i].id }) });
  drawCorrBars(el.querySelector(".corr"), { meta: db.meta, active: f, onPick: g => go({ page: "feature", id: g, cmp: route.cmp }) });

  el.onclick = e => {
    if (e.target.closest("[data-clear]")) go({ cmp: null }, { replace: true });
    else if (e.target.closest("[data-hl]")) go(hlArtist ? { page: "artist", id: route.cmp } : { page: "song", id: route.cmp });
  };
}
