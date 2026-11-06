// Choropleth of charting songs per artist nationality, with zoom/pan and click-to-select.
import { displayCountry, dur, fmt, tooltip } from "../ui.js";

export const RAMP = ["#1a3a27", "#1b5e37", "#1a8c4b", "#1ec05c", "#7ff0a8"];
const NONE = "#242424";
let atlas = null; // loaded once per page

/** Threshold scale whose top class is always the brightest green. */
export const colorScale = t => d3.scaleThreshold(t, RAMP.slice(RAMP.length - t.length - 1));

export function drawMap(el, opts) {
  let state = { ...opts };
  el.innerHTML = `<svg class="map" role="img" aria-label="World map of charting songs by artist nationality"></svg>
    <div class="lg"></div>
    <div class="zoom"><button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button></div>`;
  const svg = d3.select(el).select("svg"), lg = el.querySelector(".lg");
  const { width: W, height: H } = el.getBoundingClientRect();
  svg.attr("viewBox", `0 0 ${W} ${H}`);
  const g = svg.append("g");
  let paths = null;

  const zoom = d3.zoom().scaleExtent([1, 8]).translateExtent([[0, 0], [W, H]]).on("zoom", e => g.attr("transform", e.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  const [zin, zout] = el.querySelectorAll(".zoom button");
  zin.onclick = () => svg.transition().duration(dur(300)).call(zoom.scaleBy, 1.6);
  zout.onclick = () => svg.transition().duration(dur(300)).call(zoom.scaleBy, 1 / 1.6);
  svg.on("click", e => { if (e.target === svg.node()) state.onSelect(null); }); // ocean → World

  const value = d => state.counts.get(d.properties.name) || 0;
  const fill = d => (value(d) ? colorScale(state.thresholds)(value(d)) : NONE);

  function paint(animate) {
    if (!paths) return;
    (animate ? paths.transition().duration(dur(350)) : paths).attr("fill", fill);
    paths.attr("stroke", d => (d.properties.name === state.selected ? "#fff" : "#121212"))
      .attr("stroke-width", d => (d.properties.name === state.selected ? 1.6 : 0.5))
      .style("cursor", d => (state.known.has(d.properties.name) ? "pointer" : "default"))
      .filter(d => d.properties.name === state.selected).raise();
    const t = state.thresholds, colors = colorScale(t).range();
    lg.innerHTML = `Songs by artists from the country
      <div class="sw">${colors.map(c => `<i style="background:${c}"></i>`).join("")}</div>
      <div class="tk">${[1, ...t].map((v, i) => `<span>${fmt(v)}${i === t.length ? "+" : ""}</span>`).join("")}</div>`;
  }

  (atlas ??= d3.json("data/countries-110m.json")).then(world => {
    const feats = topojson.feature(world, world.objects.countries).features.filter(f => f.properties.name !== "Antarctica");
    const proj = d3.geoEqualEarth().fitExtent([[4, 4], [W - 4, H - 4]], { type: "FeatureCollection", features: feats });
    paths = g.selectAll("path").data(feats).join("path").attr("d", d3.geoPath(proj)).attr("vector-effect", "non-scaling-stroke")
      .on("mouseenter", function (e, d) { if (value(d)) d3.select(this).attr("fill", d3.color(fill(d)).brighter(0.5)); })
      .on("mousemove", (e, d) => {
        const v = value(d), name = displayCountry(d.properties.name);
        tooltip.show(e, v
          ? `${name}<small>${fmt(v)} song${v === 1 ? "" : "s"} · ${((v / state.total) * 100).toFixed(1)}% of the period's songs</small><small>Collaborations count for each artist's country</small>`
          : `${name}<small>${state.known.has(d.properties.name) ? "No charting songs in this period" : "No artists from here in the Top 200"}</small>`);
      })
      .on("mouseleave", function (e, d) { tooltip.hide(); d3.select(this).attr("fill", fill(d)); })
      .on("click", (e, d) => {
        const n = d.properties.name;
        if (state.known.has(n)) state.onSelect(n === state.selected ? null : n);
      });
    paint(false);
  });

  paint(false);
  return {
    update(next) {
      state = { ...state, ...next };
      paint(true);
    },
  };
}
