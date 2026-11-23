// First-visit tour: one pop-up per part of the screen (timeline, list, map, right panel). The "?" button reopens it.
const STEPS = [
  ["#player", "Timeline", "Each bar is one month of the Top 200. Click a bar, or drag across bars, to pick a period. All / Year / Month / Custom set the length, and Play through time steps through the years so you can watch the chart change."],
  ["#lib", "Top artists and songs", "The list ranks artists (by number of songs) or songs (by chart points) for the period and country you picked. Switch with Artists / Songs and click a row to open it."],
  [".mapwrap", "World map", "Colour shows how many charting songs come from artists of each country. Click a country to zoom in and filter the whole page to it; click it again to zoom back out."],
  ["#np", "Player and songs", "Play the current song and see the other songs by the same artist. On an artist page, tick songs here to show them in the rank chart."],
];
const KEY = "tourSeen";

let box = null;

const seen = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(KEY, "1"); } catch { /* storage blocked: the tour shows again next visit */ } };

export function maybeStartTour() { if (!seen() && innerWidth > 1100) startTour(); } // narrow screens stack the panels; "?" still opens it

export function startTour() {
  const steps = STEPS.filter(([sel]) => document.querySelector(sel)); // the map exists only on Home
  if (!steps.length) return;
  box?.remove();
  box = document.createElement("div");
  box.className = "tour";
  box.innerHTML = '<div class="tour-ring"></div><div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-h"></div>';
  document.body.append(box);
  const ring = box.firstElementChild, card = box.lastElementChild;
  let i = 0;

  const close = () => { markSeen(); box.remove(); box = null; removeEventListener("keydown", onKey); removeEventListener("resize", show); };
  const onKey = e => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft" && i > 0) { i--; show(); }
  };
  const next = () => (i < steps.length - 1 ? (i++, show()) : close());

  function show() {
    const [sel, h, t] = steps[i];
    const target = document.querySelector(sel);
    target.scrollIntoView({ block: "nearest" });
    const r = target.getBoundingClientRect(), pad = 6;
    Object.assign(ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px` });
    card.innerHTML = `<div class="tour-n">${i + 1} / ${steps.length}</div><h3 id="tour-h">${h}</h3><p>${t}</p>
      <div class="tour-btns"><button class="chip" data-t="skip">Skip</button>${i ? '<button class="chip" data-t="back">Back</button>' : ""}<button class="chip on" data-t="next">${i < steps.length - 1 ? "Next" : "Got it"}</button></div>`;
    // beside tall panels, above/below wide ones; kept inside the window
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 18, W = innerWidth, H = innerHeight;
    let x, y;
    if (r.height > H * 0.5 && r.width < W * 0.5) {
      x = r.right + gap + cw < W ? r.right + gap : r.left - gap - cw;
      y = r.top + 40;
    } else {
      x = r.left + r.width / 2 - cw / 2;
      y = r.top - gap - ch > 0 ? r.top - gap - ch : r.bottom + gap;
      if (y + ch > H) y = r.top + 40; // the map: no room around it, so overlap its top
    }
    card.style.left = `${Math.max(12, Math.min(W - cw - 12, x))}px`;
    card.style.top = `${Math.max(12, Math.min(H - ch - 12, y))}px`;
    card.querySelector('[data-t="next"]').focus();
  }

  card.onclick = e => {
    const t = e.target.closest("[data-t]")?.dataset.t;
    if (t === "skip") close();
    else if (t === "back") { i--; show(); }
    else if (t === "next") next();
  };
  box.addEventListener("click", e => { if (e.target === box) close(); });
  addEventListener("keydown", onKey);
  addEventListener("resize", show);
  show();
}
