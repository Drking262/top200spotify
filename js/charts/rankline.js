// Daily chart rank of one song over its whole chart life: gaps when off the chart, shaded period,
// peak label, crosshair tooltip, drag to zoom (brush), double-click to reset.
import { dayToDate } from "../data.js";
import { dur, tooltip } from "../ui.js";

const H = 320, M = { l: 44, r: 16, t: 26, b: 28 };
const fmtDay = d3.utcFormat("%-d %b %Y");

export function drawRankLine(el, { history, meta, shade }) {
  const W = Math.max(420, el.clientWidth || 700);
  el.innerHTML = "";
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "rankline").attr("role", "img")
    .attr("aria-label", "Daily chart rank over time");
  const date = d => dayToDate(meta, d);
  const full = [date(history[0].day - 1), date(history.at(-1).day + 2)]; // a day of padding so edge points are not clipped
  const x = d3.scaleUtc().domain(full).range([M.l, W - M.r]);
  const y = d3.scaleLinear().domain([1, 200]).range([M.t, H - M.b]);

  svg.append("defs").append("clipPath").attr("id", "rl-clip").append("rect")
    .attr("x", M.l).attr("y", 0).attr("width", W - M.l - M.r).attr("height", H);
  [1, 50, 100, 150, 200].forEach(v => {
    svg.append("line").attr("x1", M.l).attr("x2", W - M.r).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", "#2a2a2a");
    svg.append("text").attr("x", M.l - 8).attr("y", y(v) + 3.5).attr("text-anchor", "end").attr("fill", "#7a7a7a").attr("font-size", 10.5).text(`#${v}`);
  });
  const xAxis = svg.append("g").attr("transform", `translate(0,${H - M.b + 6})`).attr("class", "axis");
  const plot = svg.append("g").attr("clip-path", "url(#rl-clip)");
  const band = plot.append("rect").attr("y", M.t - 8).attr("height", H - M.b - M.t + 8).attr("fill", "#1ed760").attr("fill-opacity", 0.07);
  const bandLabel = plot.append("text").attr("y", H - M.b - 6).attr("fill", "#7a7a7a").attr("font-size", 10.5).text("selected period");
  const path = plot.append("path").datum(history).attr("fill", "none").attr("stroke", "#1ed760").attr("stroke-width", 2).attr("stroke-linejoin", "round").attr("stroke-linecap", "round"); // round cap: a lone chart day shows as a dot
  const peak = history.reduce((p, d) => (d.rank != null && (!p || d.rank < p.rank) ? d : p), null);
  const peakG = plot.append("g");
  peakG.append("circle").attr("r", 4.5).attr("fill", "#1ed760").attr("stroke", "#1a1a1a").attr("stroke-width", 2);
  peakG.append("text").attr("x", 8).attr("y", -8).attr("fill", "#fff").attr("font-size", 12).attr("font-weight", 700)
    .text(`Peak #${peak.rank} · ${fmtDay(date(peak.day))}`);
  const cross = svg.append("g").style("display", "none").style("pointer-events", "none");
  cross.append("line").attr("y1", M.t).attr("y2", H - M.b).attr("stroke", "#535353");
  const dot = cross.append("circle").attr("r", 4).attr("fill", "#fff");

  function paint(animate) {
    const t = animate ? svg.transition().duration(dur(350)) : svg;
    xAxis.call(d3.axisBottom(x).ticks(Math.min(Math.round(W / 110), Math.round((x.domain()[1] - x.domain()[0]) / 864e5))).tickSizeOuter(0)) // no sub-day ticks.call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").attr("stroke", "#3a3a3a")).call(g => g.selectAll("text").attr("fill", "#7a7a7a").attr("font-size", 10.5));
    const line = d3.line().defined(d => d.rank != null).x(d => x(date(d.day))).y(d => y(d.rank));
    (animate ? path.transition(t) : path).attr("d", line);
    const [a, b] = [x(date(shade[0])), x(date(shade[1] + 1))].map(v => Math.max(M.l, Math.min(W - M.r, v)));
    band.attr("x", a).attr("width", Math.max(0, b - a)).style("display", b - a > 1 ? null : "none");
    bandLabel.attr("x", a + 4).style("display", b - a > 90 ? null : "none");
    const px = x(date(peak.day));
    peakG.attr("transform", `translate(${px},${y(peak.rank)})`).select("text")
      .attr("text-anchor", px > W - 200 ? "end" : "start").attr("x", px > W - 200 ? -8 : 8);
  }

  const brush = d3.brushX().extent([[M.l, M.t], [W - M.r, H - M.b]]).on("end", e => {
    if (!e.selection) return;
    const [a, b] = e.selection.map(x.invert);
    brushG.call(brush.move, null);
    if (b - a < 2 * 864e5) return; // too small to be a zoom
    x.domain([a, b]);
    paint(true);
  });
  const brushG = svg.append("g").attr("class", "brush").call(brush);
  brushG.on("dblclick", () => { x.domain(full); paint(true); })
    .on("pointermove.cross", e => {
      const [mx] = d3.pointer(e, svg.node());
      const day = Math.round((x.invert(mx) - date(0)) / 864e5);
      const d = history[day - history[0].day];
      if (!d) return;
      cross.style("display", null).attr("transform", `translate(${x(date(d.day))},0)`);
      dot.style("display", d.rank ? null : "none").attr("cy", d.rank ? y(d.rank) : 0);
      tooltip.show(e, `${fmtDay(date(d.day))}<small>${d.rank ? `#${d.rank} on the daily chart` : "not on the chart"}</small>`);
    })
    .on("pointerleave.cross", () => { cross.style("display", "none"); tooltip.hide(); });
  paint(false);
}
