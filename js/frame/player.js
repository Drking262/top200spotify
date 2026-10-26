// Bottom "player": the global time filter (waveform scrubber, ◀◀ ▶ ▶▶, granularity chips).
import { drawWaveform } from "../charts/waveform.js";
import { countryMonthly, monthLabel, uniqueSongs } from "../data.js";
import { pickMonth, stepPeriod } from "../state.js";
import { displayCountry, esc, fmt, periodLabel } from "../ui.js";

const PLAY = '<path d="M3 1.5v11l9-5.5z" fill="currentColor"/>';
const PAUSE = '<rect x="2.5" y="1.5" width="3" height="11" rx="1" fill="currentColor"/><rect x="8.5" y="1.5" width="3" height="11" rx="1" fill="currentColor"/>';
const GRANS = [["all", "All"], ["year", "Year"], ["month", "Month"], ["custom", "Custom"]];
const STEP_MS = 1200;

let ctx, el, wave, timer = null, waveKey = null, values = null;
const $ = id => el.querySelector(id);

function waveValues() {
  const { db, route } = ctx;
  return (values = route.country ? countryMonthly(db, route.country) : db.meta.monthSongs);
}

function waveTip(i) {
  const { db, route } = ctx;
  const m = monthLabel(db.meta, i);
  if (route.country) return `${m}<small>${esc(displayCountry(route.country))}: ${Math.round(values[i] * 100)}% of charting songs</small>`;
  return `${m}<small>${fmt(db.meta.monthSongs[i])} songs charted · ${db.meta.chartDays[i]} daily charts</small>`;
}

function setPlaying(on) {
  clearInterval(timer);
  timer = on ? setInterval(() => ctx.go(stepPeriod(ctx.route, 1, ctx.db.meta), { replace: true }), STEP_MS) : null;
  $("#p-icon").innerHTML = on ? PAUSE : PLAY;
  $("#p-play").setAttribute("aria-label", on ? "Pause" : "Play through time");
}

export function initPlayer(root, c) {
  el = root;
  ctx = c;
  root.innerHTML = `
    <div class="now"><div class="yr" id="p-yr"></div><div style="min-width:0"><b id="p-rng"></b><small id="p-sum"></small></div></div>
    <div class="ctl">
      <div class="btns">
        <button class="ic" id="p-prev" aria-label="Previous period"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 2v12M13 2 5 8l8 6z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>
        <button class="play" id="p-play" aria-label="Play through time"><svg width="14" height="14" viewBox="0 0 14 14" id="p-icon">${PLAY}</svg></button>
        <button class="ic" id="p-next" aria-label="Next period"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M13 2v12M3 2l8 6-8 6z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>
      </div>
      <div class="wave"><span>2017</span><svg id="p-wave"></svg><span>2023</span></div>
    </div>
    <div class="gran">${GRANS.map(([g, l]) => `<button class="chip" data-g="${g}"${g === "custom" ? ' title="Drag across the bars to pick any range"' : ""}>${l}</button>`).join("")}</div>`;

  const meta = c.db.meta, last = meta.months.length - 1;
  wave = drawWaveform($("#p-wave"), {
    values: waveValues(), from: c.route.from, to: c.route.to, tip: waveTip,
    onPick: (a, b) => ctx.go(a === b ? pickMonth(ctx.route, a, meta) : { gran: "custom", from: a, to: b }),
  });
  waveKey = c.route.country;
  $("#p-play").onclick = () => {
    if (timer) return setPlaying(false);
    if (ctx.route.gran === "all") ctx.go(stepPeriod(ctx.route, 1, meta)); // start from 2017 at once
    setPlaying(true);
  };
  $("#p-prev").onclick = () => ctx.go(stepPeriod(ctx.route, -1, meta));
  $("#p-next").onclick = () => ctx.go(stepPeriod(ctx.route, 1, meta));
  root.querySelector(".gran").onclick = e => {
    const g = e.target.closest("[data-g]")?.dataset.g;
    if (!g) return;
    if (g === "all") ctx.go({ gran: "all", from: 0, to: last });
    else if (g === "custom") ctx.go({ gran: "custom" });
    else ctx.go(pickMonth({ gran: g }, ctx.route.from, meta));
  };
  updatePlayer(c);
}

export function updatePlayer(c) {
  ctx = c;
  const { db, route } = c, meta = db.meta;
  const p = periodLabel(meta, route);
  const big = route.gran === "all" ? "2017–23" : p.length <= 8 ? p : "Custom";
  $("#p-yr").textContent = big;
  $("#p-yr").classList.toggle("long", big.length > 5);
  $("#p-rng").textContent = route.from === route.to ? monthLabel(meta, route.from) : `${monthLabel(meta, route.from)} – ${monthLabel(meta, route.to)}`;
  const days = meta.chartDays.slice(route.from, route.to + 1).reduce((a, b) => a + b, 0);
  $("#p-sum").textContent = `${fmt(days)} daily charts · ${fmt(uniqueSongs(db, route))} songs`;
  el.querySelectorAll("[data-g]").forEach(b => b.classList.toggle("on", b.dataset.g === route.gran));
  $("#p-prev").disabled = $("#p-next").disabled = route.gran === "all";
  const next = { from: route.from, to: route.to };
  if (waveKey !== route.country) { waveKey = route.country; next.values = waveValues(); }
  wave.update(next);
}
