// Feature page charts: monthly median + middle-50% band (T5), feature vs chart points scatter (T6),
// and the Spearman correlation of every feature with points (diverging bars).
import { monthLabel } from "../data.js";
import { esc, fmtCompact, tooltip } from "../ui.js";

export const fmtR = r => d3.format("+.2f")(Math.abs(r) < 0.005 ? 0 : r); // no "-0.00"
export const fmtValue = (f, v) => (f === "Loudness" ? `${v.toFixed(1)} dB` : v.toFixed(2));
const POS = "#20b155", NEG = "#d95926", MUTED = "#7a7a7a";
const widthOf = el => Math.max(420, Math.round(el.getBoundingClientRect().width) || 720);
const grid = (svg, y, x0, x1, fmt) => y.ticks(5).forEach(v => {
  svg.append("line").attr("x1", x0).attr("x2", x1).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", "#2a2a2a");
  svg.append("text").attr("x", x0 - 8).attr("y", y(v) + 3.5).attr("text-anchor", "end").attr("fill", MUTED).attr("font-size", 10.5).text(fmt(v));
});
const styleAxis = g => g.call(a => a.select(".domain").remove()).call(a => a.selectAll("line").attr("stroke", "#3a3a3a"))
  .call(a => a.selectAll("text").attr("fill", MUTED).attr("font-size", 10.5));

/** Monthly median of `feature` with its interquartile band; months from..to shaded; click a month → onMonth(m). */
export function drawTrend(svgEl, { meta, feature, from, to, onMonth }) {
  const W = widthOf(svgEl), H = 250, M = { l: 52, r: 16, t: 14, b: 26 };
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`);
  svg.selectAll("*").remove();
  const q = meta.featureMonthly[feature], n = q.length, Y0 = +meta.start.slice(0, 4);
  const t = (m, d = 1) => new Date(Date.UTC(Y0, m, d));
  const x = d3.scaleUtc().domain([t(0), t(n)]).range([M.l, W - M.r]);
  const y = d3.scaleLinear().domain(d3.extent(q.flat().filter(v => v != null))).nice().range([H - M.b, M.t]);

  grid(svg, y, M.l, W - M.r, v => (feature === "Loudness" ? `${v} dB` : d3.format(".2~f")(v)));
  svg.append("g").attr("transform", `translate(0,${H - M.b + 6})`).call(d3.axisBottom(x).ticks(d3.utcYear).tickFormat(d3.utcFormat("%Y")).tickSizeOuter(0)).call(styleAxis);
  const [a, b] = [x(t(from)), x(t(to + 1))];
  svg.append("rect").attr("x", a).attr("width", b - a).attr("y", M.t).attr("height", H - M.b - M.t).attr("fill", "#fff").attr("fill-opacity", 0.06);
  if (b - a > 90) svg.append("text").attr("x", a + 4).attr("y", M.t + 12).attr("fill", MUTED).attr("font-size", 10.5).text("selected period");

  const ok = d => d[1] != null, mx = (d, m) => x(t(m, 15));
  svg.append("path").datum(q).attr("fill", POS).attr("fill-opacity", 0.18)
    .attr("d", d3.area().defined(ok).x(mx).y0(d => y(d[0])).y1(d => y(d[2])).curve(d3.curveMonotoneX));
  svg.append("path").datum(q).attr("fill", "none").attr("stroke", "#1ed760").attr("stroke-width", 2)
    .attr("d", d3.line().defined(ok).x(mx).y(d => y(d[1])).curve(d3.curveMonotoneX));

  const cross = svg.append("g").style("display", "none").style("pointer-events", "none");
  cross.append("line").attr("y1", M.t).attr("y2", H - M.b).attr("stroke", "#535353");
  const dot = cross.append("circle").attr("r", 4).attr("fill", "#fff");
  const monthAt = e => {
    const d = x.invert(d3.pointer(e, svgEl)[0]);
    return Math.max(0, Math.min(n - 1, (d.getUTCFullYear() - Y0) * 12 + d.getUTCMonth()));
  };
  svg.append("rect").attr("x", M.l).attr("y", M.t).attr("width", W - M.l - M.r).attr("height", H - M.b - M.t)
    .attr("fill", "transparent").style("cursor", "pointer")
    .on("pointermove", e => {
      const m = monthAt(e), [lo, med, hi] = q[m];
      if (med == null) return;
      cross.style("display", null).attr("transform", `translate(${mx(null, m)},0)`);
      dot.attr("cy", y(med));
      tooltip.show(e, `${monthLabel(meta, m)}<small>median ${fmtValue(feature, med)} · middle 50%: ${fmtValue(feature, lo)} – ${fmtValue(feature, hi)}</small><small>${meta.monthSongs[m]} songs on the chart · click to select</small>`);
    })
    .on("pointerleave", () => { cross.style("display", "none"); tooltip.hide(); })
    .on("click", e => onMonth?.(monthAt(e)));
}

/** Every song as a dot: x = feature value, y = total points (log). Canvas dots, SVG axes, nearest-dot hover. */
export function drawScatter(el, { db, feature, highlight = [], onSong }) {
  const k = db.meta.features.indexOf(feature);
  const W = widthOf(el), H = 360, M = { l: 52, r: 16, t: 12, b: 38 };
  el.innerHTML = "";
  const pts = db.songs.map((s, i) => ({ i, v: s.f[k], p: Math.max(1, s.total) }));
  const x = d3.scaleLinear().domain(d3.extent(pts, d => d.v)).nice().range([M.l, W - M.r]);
  const y = d3.scaleLog().domain(d3.extent(pts, d => d.p)).nice().range([H - M.b, M.t]);
  const hl = new Set(highlight);

  const dpr = window.devicePixelRatio || 1;
  const canvas = d3.select(el).append("canvas").attr("width", W * dpr).attr("height", H * dpr).node();
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.fillStyle = hl.size ? "rgba(179,179,179,.22)" : "rgba(30,215,96,.3)";
  for (const d of pts) if (!hl.has(d.i)) { ctx.beginPath(); ctx.arc(x(d.v), y(d.p), 2.2, 0, 7); ctx.fill(); }
  ctx.fillStyle = "#1ed760"; ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 1.5;
  for (const d of pts) if (hl.has(d.i)) { ctx.beginPath(); ctx.arc(x(d.v), y(d.p), 4.5, 0, 7); ctx.fill(); ctx.stroke(); }

  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img")
    .attr("aria-label", `${feature} against total chart points, one dot per song`);
  y.ticks(5, "~s").forEach(v => {
    svg.append("line").attr("x1", M.l).attr("x2", W - M.r).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", "#2a2a2a");
    svg.append("text").attr("x", M.l - 8).attr("y", y(v) + 3.5).attr("text-anchor", "end").attr("fill", MUTED).attr("font-size", 10.5).text(fmtCompact(v));
  });
  svg.append("g").attr("transform", `translate(0,${H - M.b + 6})`)
    .call(d3.axisBottom(x).ticks(Math.round(W / 90)).tickFormat(v => (feature === "Loudness" ? `${v} dB` : d3.format(".1~f")(v))).tickSizeOuter(0)).call(styleAxis);
  svg.append("text").attr("x", W - M.r).attr("y", H - 4).attr("text-anchor", "end").attr("fill", MUTED).attr("font-size", 10.5).text(`${feature} →`);
  svg.append("text").attr("x", M.l + 4).attr("y", M.t + 10).attr("fill", MUTED).attr("font-size", 10.5).text("↑ total chart points");
  if (hl.size === 1) {
    const d = pts[highlight[0]];
    svg.append("text").attr("x", x(d.v) + (x(d.v) > W - 200 ? -9 : 9)).attr("y", y(d.p) + 4).attr("text-anchor", x(d.v) > W - 200 ? "end" : "start")
      .attr("fill", "#fff").attr("font-size", 12).attr("font-weight", 700).text(db.songs[d.i].t);
  }

  const ring = svg.append("circle").attr("r", 6).attr("fill", "none").attr("stroke", "#fff").attr("stroke-width", 2).style("display", "none").style("pointer-events", "none");
  const delaunay = d3.Delaunay.from(pts, d => x(d.v), d => y(d.p));
  const near = e => {
    const [mx, my] = d3.pointer(e, svg.node()), d = pts[delaunay.find(mx, my)];
    return Math.hypot(x(d.v) - mx, y(d.p) - my) < 14 ? d : null;
  };
  svg.append("rect").attr("width", W).attr("height", H).attr("fill", "transparent")
    .on("pointermove", e => {
      const d = near(e);
      e.currentTarget.style.cursor = d ? "pointer" : "default";
      if (!d) { ring.style("display", "none"); tooltip.hide(); return; }
      const s = db.songs[d.i];
      ring.style("display", null).attr("cx", x(d.v)).attr("cy", y(d.p));
      tooltip.show(e, `${esc(s.t)}<small>${esc(s.a.map(a => db.artists[a].n).join(", "))}</small><small>${feature} ${fmtValue(feature, d.v)} · ${fmtCompact(s.total)} points</small>`);
    })
    .on("pointerleave", () => { ring.style("display", "none"); tooltip.hide(); })
    .on("click", e => { const d = near(e); if (d) { tooltip.hide(); onSong(d.i); } });
}

/** Spearman ρ of each feature with total points, sorted, diverging around 0; click a row → onPick(feature). */
export function drawCorrBars(svgEl, { meta, active, onPick }) {
  const rows = meta.features.filter(f => meta.corr[f]).map(f => ({ f, ...meta.corr[f] })).sort((a, b) => b.spearman - a.spearman);
  const W = widthOf(svgEl), RH = 30, H = rows.length * RH + 26, L = 140, R = 56;
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`);
  svg.selectAll("*").remove();
  const lim = Math.max(0.1, d3.max(rows, d => Math.abs(d.spearman))) * 1.1;
  const x = d3.scaleLinear().domain([-lim, lim]).range([L, W - R]);
  svg.append("g").attr("transform", `translate(0,${rows.length * RH + 4})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("+.2~f")).tickSizeOuter(0)).call(styleAxis);
  svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", rows.length * RH + 4).attr("stroke", "#535353");

  const row = svg.selectAll("g.row").data(rows).join("g").attr("class", "row").attr("transform", (d, i) => `translate(0,${i * RH})`)
    .style("cursor", "pointer").on("click", (e, d) => onPick(d.f))
    .on("mousemove", (e, d) => tooltip.show(e, `${d.f}<small>Spearman ρ = ${d.spearman.toFixed(3)}</small><small>Pearson r (log points) = ${d.pearson.toFixed(3)}</small>`))
    .on("mouseleave", tooltip.hide);
  row.append("rect").attr("width", W).attr("height", RH).attr("fill", d => (d.f === active ? "rgba(255,255,255,.06)" : "transparent")).attr("rx", 4);
  row.append("text").attr("x", 10).attr("y", RH / 2 + 4).attr("font-size", 13)
    .attr("fill", d => (d.f === active ? "#fff" : "#b3b3b3")).attr("font-weight", d => (d.f === active ? 700 : 500)).text(d => d.f);
  row.append("rect").attr("y", RH / 2 - 6).attr("height", 12).attr("rx", 2)
    .attr("x", d => Math.min(x(0), x(d.spearman))).attr("width", d => Math.max(1, Math.abs(x(d.spearman) - x(0))))
    .attr("fill", d => (d.spearman >= 0 ? POS : NEG)).attr("fill-opacity", d => (d.f === active ? 1 : 0.6));
  row.append("text").attr("y", RH / 2 + 4).attr("font-size", 11.5).attr("fill", "#b3b3b3")
    .attr("x", d => x(d.spearman) + (d.spearman >= 0 ? 6 : -6)).attr("text-anchor", d => (d.spearman >= 0 ? "start" : "end"))
    .text(d => fmtR(d.spearman));
}
