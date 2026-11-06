// Bump chart: best chart rank per week/month for a few songs, with cover + title end labels.
import { dayToDate } from "../data.js";
import { coverUrl, esc, spreadLabels, tooltip } from "../ui.js";

const H = 300, M = { l: 40, r: 190, t: 14, b: 28 };
const clip = s => (s.length > 24 ? s.slice(0, 23) + "…" : s);

export function drawBump(svgEl, { unit, steps, series, meta, onSong }) {
  const W = Math.max(420, svgEl.clientWidth || 700);
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);
  svg.selectAll("*").remove();
  const x = d3.scalePoint().domain(d3.range(steps.length)).range([M.l + 6, W - M.r]).padding(steps.length === 1 ? 0.5 : 0);
  const y = d3.scaleLinear().domain([1, 200]).range([M.t, H - M.b]);
  const date = i => dayToDate(meta, steps[i]);

  const grid = svg.append("g");
  [1, 50, 100, 150, 200].forEach(v => {
    grid.append("line").attr("x1", M.l).attr("x2", W - M.r + 4).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", "#2a2a2a");
    grid.append("text").attr("x", M.l - 6).attr("y", y(v) + 3.5).attr("text-anchor", "end").attr("fill", "#7a7a7a").attr("font-size", 10.5).text(`#${v}`);
  });
  const every = Math.ceil(steps.length / 8);
  const fmtX = d3.utcFormat(unit === "week" ? "%-d %b" : steps.length <= 13 ? "%b" : "%b %Y");
  steps.forEach((_, i) => {
    if (i % every === 0) grid.append("text").attr("x", x(i)).attr("y", H - 8).attr("text-anchor", "middle").attr("fill", "#7a7a7a").attr("font-size", 10.5).text(fmtX(date(i)));
  });
  const when = i => (unit === "week" ? `week of ${d3.utcFormat("%-d %b %Y")(date(i))}` : d3.utcFormat("%B %Y")(date(i)));

  svg.append("defs").append("clipPath").attr("id", "bump-cover").append("rect").attr("x", 12).attr("width", 22).attr("height", 22).attr("rx", 3); // same spot as the cover image
  const line = d3.line().defined(v => v != null).x((v, i) => x(i)).y(v => y(v)).curve(d3.curveBumpX);
  const lastIdx = s => s.values.findLastIndex(v => v != null);
  const ly = spreadLabels(series.map(s => y(s.values[lastIdx(s)] ?? 200)), 27, M.t + 11, H - M.b - 11);
  const r = steps.length > 30 ? 2.5 : 3.5;

  const groups = svg.selectAll("g.ln").data(series).join("g").attr("class", "ln").style("cursor", "pointer")
    .on("mouseenter", (e, s) => groups.style("opacity", g => (g === s ? 1 : 0.15)))
    .on("mouseleave", () => groups.style("opacity", 1))
    .on("click", (e, s) => onSong(s.song));
  groups.each(function (s, k) {
    const g = d3.select(this);
    g.append("path").attr("d", line(s.values)).attr("fill", "none").attr("stroke", "transparent").attr("stroke-width", 12); // hover target
    g.append("path").attr("d", line(s.values)).attr("fill", "none").attr("stroke", s.color).attr("stroke-width", 2).attr("stroke-linecap", "round");
    s.values.forEach((v, i) => {
      if (v == null) return;
      g.append("circle").attr("cx", x(i)).attr("cy", y(v)).attr("r", r).attr("fill", s.color).attr("stroke", "#1a1a1a").attr("stroke-width", 1.5)
        .on("mousemove", e => tooltip.show(e, `${esc(s.label)}<small>best #${v} · ${when(i)}</small>`))
        .on("mouseleave", tooltip.hide);
    });
    const lab = g.append("g").attr("transform", `translate(${W - M.r + 12},${ly[k] - 11})`);
    lab.append("rect").attr("y", 10).attr("width", 8).attr("height", 2).attr("rx", 1).attr("fill", s.color);
    if (s.cover) lab.append("image").attr("x", 12).attr("href", coverUrl(s.cover)).attr("width", 22).attr("height", 22).attr("clip-path", "url(#bump-cover)");
    else lab.append("rect").attr("x", 12).attr("width", 22).attr("height", 22).attr("rx", 3).attr("fill", s.color);
    lab.append("text").attr("x", 40).attr("y", 15).attr("fill", "#e6e6e6").attr("font-size", 12).attr("font-weight", 600).text(clip(s.label))
      .append("title").text(s.label);
  });
}
