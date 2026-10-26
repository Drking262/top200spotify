// "Sound signature" radar on percentile axes: mean polygon + 95% CI band, dashed typical-hit (50th) reference.
import { esc, tooltip } from "../ui.js";

const W = 340, H = 256, CX = 170, CY = 130, R = 88;
const ord = n => n + ((n % 100 >= 11 && n % 100 <= 13) ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");

export function drawRadar(svgEl, { axes, series, onAxis }) {
  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`);
  svg.selectAll("*").remove();
  const ang = i => -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
  const pt = (v, i) => [CX + Math.cos(ang(i)) * R * v, CY + Math.sin(ang(i)) * R * v];
  const poly = vs => "M" + vs.map((v, i) => pt(Math.max(0, Math.min(1, v)), i).join(",")).join("L") + "Z";

  [0.25, 0.5, 0.75, 1].forEach(k => svg.append("path").attr("d", poly(axes.map(() => k))).attr("fill", "none").attr("stroke", "#2e2e2e"));
  axes.forEach((a, i) => {
    const [x2, y2] = pt(1, i), [x, y] = pt(1.13, i);
    svg.append("line").attr("x1", CX).attr("y1", CY).attr("x2", x2).attr("y2", y2).attr("stroke", "#2e2e2e");
    svg.append("text").attr("class", onAxis ? "ax lk" : "ax").attr("x", x).attr("y", y + 4)
      .attr("text-anchor", Math.abs(x - CX) < 5 ? "middle" : x > CX ? "start" : "end")
      .attr("fill", "#b3b3b3").attr("font-size", 11.5).attr("font-weight", 600).text(a)
      .on("click", () => onAxis?.(a))
      .on("mousemove", e => onAxis && tooltip.show(e, `${a}<small>Open the ${a} page</small>`))
      .on("mouseleave", tooltip.hide);
  });
  svg.append("path").attr("d", poly(axes.map(() => 0.5))).attr("fill", "none").attr("stroke", "#8a8a8a").attr("stroke-width", 1.5).attr("stroke-dasharray", "4 3");

  [...series].reverse().forEach(s => { // first series drawn last, on top
    if (s.ci) {
      svg.append("path").attr("d", poly(s.mean.map((v, i) => v + s.ci[i])) + poly(s.mean.map((v, i) => v - s.ci[i])))
        .attr("fill", s.color).attr("fill-opacity", 0.28).attr("fill-rule", "evenodd");
    }
    svg.append("path").attr("d", poly(s.mean)).attr("fill", s.color).attr("fill-opacity", 0.1).attr("stroke", s.color).attr("stroke-width", 2);
    s.mean.forEach((v, i) => {
      const [x, y] = pt(v, i);
      svg.append("circle").attr("cx", x).attr("cy", y).attr("r", 4).attr("fill", s.color).attr("stroke", "#1a1a1a").attr("stroke-width", 2)
        .on("mousemove", e => tooltip.show(e, `${axes[i]}<small>${esc(s.label)}: ${ord(Math.round(v * 100))} percentile${s.ci ? ` ± ${Math.round(s.ci[i] * 100)}` : ""}</small><small>typical hit = 50th</small>`))
        .on("mouseleave", tooltip.hide);
    });
  });
}

/** Legend under the radar; says when the CI is hidden. */
export function radarLegend(series) {
  const items = series.map(s => `<span><i style="border-color:${s.color}"></i>${esc(s.label)}${s.ci ? " ± 95% CI" : ""}${s.n != null ? ` <em>n = ${s.n}</em>` : ""}</span>`);
  const noCi = series.filter(s => !s.ci && s.n != null); // a single song has no CI to hide
  const note = noCi.length ? `<div class="note">CI band needs ≥ 3 songs, so it is hidden for ${noCi.map(s => esc(s.label)).join(" and ")}.</div>` : "";
  return `<div class="legend">${items.join("")}<span><i style="border-color:#8a8a8a;border-top-style:dashed"></i>Typical hit (50th percentile)</span></div>${note}`;
}
