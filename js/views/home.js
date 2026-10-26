// Home: "Where do the hits come from?" — choropleth of artist nationality (T1).
import { colorScale, drawMap } from "../charts/map.js";
import { countryCounts, scaledThresholds, topArtists, uniqueSongs } from "../data.js";
import { displayCountry, esc, fmt, periodLabel } from "../ui.js";

let root = null, map = null, known = null, fullSongs = null;

const pct = x => (x ? `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%` : "0%");
const tile = (b, span, attrs = "") => attrs
  ? `<button class="tile" ${attrs}><b>${b}</b><span>${span}</span></button>`
  : `<div class="tile"><b>${b}</b><span>${span}</span></div>`;

export function render(el, { db, route, go }) {
  known ??= new Set(db.artists.map(a => a.c).filter(c => c !== "Unknown"));
  fullSongs ??= uniqueSongs(db, { from: 0, to: db.meta.months.length - 1 });
  const counts = countryCounts(db, route);
  counts.delete("Unknown");
  const total = uniqueSongs(db, route);
  const thresholds = scaledThresholds(total / fullSongs);
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const c = route.country, v = counts.get(c) || 0;
  const select = name => go({ country: name }); // a history entry, so Back returns to the previous country

  if (root?.parentNode !== el) { // first visit, or main.js cleared the view
    el.innerHTML = `<div class="hero home" style="--hue:#1a6a3d">
      <div class="hero-row"><div class="grow"><div class="kicker"></div><h1 class="title"></h1><div class="sub"></div></div><div class="tiles"></div></div>
      <div class="mapwrap"></div>
      <div class="ctry"></div>
    </div>`;
    root = el.firstElementChild;
    map = drawMap(root.querySelector(".mapwrap"), { counts, selected: c, thresholds, total, known, onSelect: select });
  } else {
    map.update({ counts, selected: c, thresholds, total });
  }
  const $ = s => root.querySelector(s);

  $(".kicker").textContent = `Artist nationality · ${periodLabel(db.meta, route)}`;
  $(".title").textContent = c ? displayCountry(c) : "World";
  const topA = topArtists(db, route, c, 1)[0];
  const artistTile = topA
    ? tile(esc(db.artists[topA.artist].n), "top artist", `data-artist="${esc(db.artists[topA.artist].n)}"`)
    : tile("—", "top artist");
  if (c) {
    const rank = ranked.findIndex(([k]) => k === c) + 1;
    $(".sub").innerHTML = `<b>${fmt(v)}</b> charting song${v === 1 ? "" : "s"} by artists from here`;
    $(".tiles").innerHTML = tile(pct(v / (total || 1)), "of the period's songs") + tile(rank ? `#${rank}` : "—", "country rank") + artistTile;
  } else {
    $(".sub").innerHTML = `<b>${fmt(total)}</b> songs charted, by artists from <b>${ranked.length}</b> countries`;
    const [k0] = ranked[0] ?? [];
    $(".tiles").innerHTML = tile(fmt(ranked.length), "countries")
      + (k0 ? tile(esc(displayCountry(k0)), "most songs", `data-c="${esc(k0)}"`) : "") + artistTile;
  }

  const color = colorScale(thresholds);
  const chips = ranked.slice(0, 9);
  if (c && v && !chips.some(([k]) => k === c)) chips.push([c, v]);
  $(".ctry").innerHTML = chips.map(([k, n]) => `<button class="chip${k === c ? " on" : ""}" data-c="${esc(k)}"><i style="background:${color(n)}"></i>${esc(displayCountry(k))} <em>${fmt(n)}</em></button>`).join("");

  root.onclick = e => {
    const b = e.target.closest("[data-c],[data-artist]");
    if (b?.dataset.artist) go({ page: "artist", id: b.dataset.artist });
    else if (b?.dataset.c) select(b.dataset.c === c ? null : b.dataset.c);
  };
}
