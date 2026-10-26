// Small shared UI helpers. Importable in Node (no DOM access at module load).
export { displayCountry } from "./data.js";
import { monthLabel, norm } from "./data.js";

const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ENT[c]);

const nf = new Intl.NumberFormat("en-US");
const nfc = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export const fmt = n => nf.format(n);
export const fmtCompact = n => nfc.format(n);

// Header gradient base colors, picked per name so an artist always gets the same one.
const HUES = ["#1e6b45", "#8a4b12", "#5b1f6e", "#1f4e8a", "#8a1f3d", "#2f6b6b", "#6b5a1f", "#4a2f8a"];
export function hueFor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

// Categorical series colors (bump lines, compare).
// validate_palette.js --mode dark: all checks pass (bright #1ed760 is too light for the band; it stays a UI accent).
export const SERIES = ["#20b155", "#3987e5", "#d95926", "#9085e9", "#c98500"];

export const coverUrl = id => (id ? `https://i.scdn.co/image/${id}` : null);

const initials = t => String(t).replace(/\(.*?\)|-.*$/g, "").trim().split(/\s+/).slice(0, 2).map(w => [...w][0] ?? "").join("").toUpperCase();

/** Album cover <img>, or a colored tile with initials when Spotify had no cover. */
export function coverHtml(song, { size = 48, round = false, label = song.t } = {}) {
  const cls = `cover${round ? " round" : ""}`;
  const st = `width:${size}px;height:${size}px`;
  if (song.c) return `<img class="${cls}" src="${coverUrl(song.c)}" alt="" loading="lazy" style="${st}">`;
  return `<div class="${cls} ph" style="${st};background:${hueFor(label)};font-size:${Math.round(size / 2.8)}px">${esc(initials(label))}</div>`;
}

export const tooltip = {
  show(e, html) {
    const tip = document.getElementById("tip");
    tip.innerHTML = html;
    tip.classList.add("on");
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const x = e.clientX + 14 + w > innerWidth ? e.clientX - 14 - w : e.clientX + 14;
    const y = e.clientY + 14 + h > innerHeight ? e.clientY - 14 - h : e.clientY + 14;
    tip.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
  },
  hide() { document.getElementById("tip")?.classList.remove("on"); },
};

export const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
/** Transition duration that respects reduced motion. */
export const dur = ms => (reducedMotion() ? 0 : ms);

/** "2017 – 2023", "2019", "Mar 2019" or "Mar 2019 – Jun 2020". */
export function periodLabel(meta, r) {
  const last = meta.months.length - 1;
  const year = m => meta.months[m].slice(0, 4);
  if (r.from === 0 && r.to === last) return `${year(0)} – ${year(last)}`;
  const fullYear = r.from % 12 === 0 && (r.to - r.from === 11 || (r.to === last && year(r.from) === year(last)));
  if (fullYear) return year(r.from);
  if (r.from === r.to) return monthLabel(meta, r.from);
  return `${monthLabel(meta, r.from)} – ${monthLabel(meta, r.to)}`;
}

/** End-label positions: same order as ys, at least `gap` apart, inside [min, max]. */
export function spreadLabels(ys, gap, min, max) {
  const order = ys.map((y, i) => i).sort((a, b) => ys[a] - ys[b]);
  const out = ys.slice();
  order.forEach((i, k) => { if (k) out[i] = Math.max(out[i], out[order[k - 1]] + gap); });
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    out[i] = Math.min(out[i], k === order.length - 1 ? max : out[order[k + 1]] - gap);
  }
  order.forEach(i => { out[i] = Math.max(out[i], min); });
  return out;
}

/** HTML of text with the first accent/case-insensitive match of q wrapped in <mark>. */
export function highlight(text, q) {
  const chars = [...text], starts = [];
  let flat = "";
  for (const ch of chars) { starts.push(flat.length); flat += norm(ch); }
  const at = flat.indexOf(norm(q.trim()));
  if (at < 0 || !q.trim()) return esc(text);
  const end = at + norm(q.trim()).length;
  const a = starts.findLastIndex(x => x <= at), b = starts.findIndex(x => x >= end);
  const cut = b < 0 ? chars.length : b;
  return esc(chars.slice(0, a).join("")) + `<mark>${esc(chars.slice(a, cut).join(""))}</mark>` + esc(chars.slice(cut).join(""));
}
