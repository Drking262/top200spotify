// Monthly "waveform" bars used as the global time scrubber. Click = one bar, drag = a range.
import { tooltip, dur } from "../ui.js";

const W = 800, H = 40;

export function drawWaveform(svg, { values, from, to, onPick, tip }) {
  const n = values.length, bw = W / n;
  const s = d3.select(svg).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "none")
    .attr("role", "img").attr("aria-label", "Charting songs per month; click or drag to pick a period");
  let state = { values, from, to }, drag = null;

  const bars = s.selectAll("rect").data(d3.range(n)).join("rect")
    .attr("x", i => i * bw + 1).attr("width", bw - 2).attr("rx", 1.5)
    .attr("y", H / 2).attr("height", 0);

  const at = e => {
    const r = svg.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)));
  };

  function paint(animate = true) {
    const h = d3.scaleLinear().domain([0, d3.max(state.values) || 1]).range([2, H - 2]); // bars start at zero
    const [a, b] = drag ? [Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)] : [state.from, state.to];
    (animate ? bars.transition().duration(dur(250)) : bars)
      .attr("y", i => H / 2 - h(state.values[i]) / 2).attr("height", i => h(state.values[i]))
      .attr("fill", i => (i >= a && i <= b ? "#1ed760" : "#4d4d4d"));
  }

  s.on("pointerdown", e => {
    svg.setPointerCapture(e.pointerId);
    drag = { a: at(e), b: at(e) };
    paint(false);
  })
    .on("pointermove", e => {
      const i = at(e);
      if (tip) tooltip.show(e, tip(i));
      if (drag && drag.b !== i) { drag.b = i; paint(false); }
    })
    .on("pointerup", () => {
      if (!drag) return;
      const { a, b } = drag;
      drag = null;
      onPick(Math.min(a, b), Math.max(a, b));
      paint(false);
    })
    .on("pointerleave", () => tooltip.hide())
    .on("pointercancel", () => { drag = null; paint(false); });

  paint();
  return {
    update(next) {
      state = { ...state, ...next };
      paint();
    },
  };
}
