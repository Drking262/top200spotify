// App state lives in the URL hash: #/<page>/<id>?c=&from=YYYY-MM&to=YYYY-MM&g=&cmp=
// parse/format/crumbs are pure (unit-tested); go/current/onChange touch the browser.
import { displayCountry } from "./data.js";

const PAGES = ["artist", "song", "feature"];
const GRANS = ["all", "year", "month", "custom"];

export const defaultRoute = meta => ({
  page: "home", id: null, country: null, from: 0, to: meta.months.length - 1, gran: "all", cmp: null,
});

export function parseHash(hash, meta) {
  const r = defaultRoute(meta);
  try {
    const [path, query = ""] = hash.replace(/^#/, "").split("?");
    const [page, id] = path.split("/").filter(Boolean).map(decodeURIComponent);
    if (PAGES.includes(page) && id) Object.assign(r, { page, id });
    const q = new URLSearchParams(query);
    const month = k => meta.months.indexOf(q.get(k));
    if (q.get("c")) r.country = q.get("c");
    if (month("from") >= 0) r.from = month("from");
    if (month("to") >= 0) r.to = month("to");
    if (r.from > r.to) [r.from, r.to] = [r.to, r.from];
    if (GRANS.includes(q.get("g"))) r.gran = q.get("g");
    if (q.get("cmp")) r.cmp = q.get("cmp");
  } catch {
    return defaultRoute(meta); // broken encoding etc.
  }
  return r;
}

export function formatHash(route, meta) {
  const last = meta.months.length - 1;
  const q = [];
  const add = (k, v) => q.push(`${k}=${encodeURIComponent(v)}`);
  if (route.country) add("c", route.country);
  if (route.from !== 0) add("from", meta.months[route.from]);
  if (route.to !== last) add("to", meta.months[route.to]);
  if (route.gran !== "all") add("g", route.gran);
  if (route.cmp) add("cmp", route.cmp);
  const path = route.page === "home" ? "#/" : `#/${route.page}/${encodeURIComponent(route.id)}`;
  return path + (q.length ? "?" + q.join("&") : "");
}

/** A link is valid only if its page id and country exist in the data (anything else goes Home). */
export const routeExists = (db, r) => (!r.country || db.artists.some(a => a.c === r.country)) && (r.page === "home"
  || (r.page === "artist" && db.artistByName.has(r.id))
  || (r.page === "song" && db.songById.has(r.id))
  || (r.page === "feature" && db.meta.features.includes(r.id)));

/** Breadcrumb: World › country › artist › song (labels + route patches for go()). */
export function crumbs(route, db) {
  const out = [{ label: "World", route: { page: "home", id: null, country: null } }];
  const country = c => out.push({ label: displayCountry(c), route: { page: "home", id: null, country: c } });
  const artist = i => out.push({ label: db.artists[i].n, route: { page: "artist", id: db.artists[i].n } });
  if (route.page === "home" && route.country) country(route.country);
  if (route.page === "artist" && db.artistByName.has(route.id)) {
    const i = db.artistByName.get(route.id);
    country(db.artists[i].c);
    artist(i);
  }
  if (route.page === "song" && db.songById.has(route.id)) {
    const s = db.songs[db.songById.get(route.id)];
    country(db.artists[s.a[0]].c);
    artist(s.a[0]);
    out.push({ label: s.t, route: { page: "song", id: s.id } });
  }
  if (route.page === "feature") out.push({ label: `Feature: ${route.id}`, route: { page: "feature", id: route.id } });
  return out;
}

const yearOf = (m, last) => ({ gran: "year", from: m - (m % 12), to: Math.min(m - (m % 12) + 11, last) });

/** Next/previous period for the player (▶, ◀◀, ▶▶): same granularity, loops at both ends. */
export function stepPeriod(route, dir, meta) {
  const n = meta.months.length, last = n - 1;
  if (route.gran === "all") return yearOf(0, last);
  if (route.gran === "year") {
    let m = route.from + 12 * dir;
    if (m > last) m = 0;
    if (m < 0) m = last;
    return yearOf(m, last);
  }
  const len = route.to - route.from + 1;
  let from = route.from + dir * len;
  if (from + len - 1 > last) from = 0; // a window cut off at the end loops instead
  if (from < 0) from = n - len;
  return { gran: route.gran, from, to: from + len - 1 };
}

/** Clicking waveform bar m: its year in Year mode, otherwise that month. */
export const pickMonth = (route, m, meta) =>
  route.gran === "year" ? yearOf(m, meta.months.length - 1) : { gran: "month", from: m, to: m };

// ---- browser side ----
let META = null;
const listeners = [];

export function initRouter(meta) {
  META = meta;
  window.addEventListener("hashchange", () => listeners.forEach(fn => fn(current())));
}

export const current = () => parseHash(location.hash, META);

/** Route after a navigation patch; cmp (compare/highlight) belongs to one page and is dropped on leaving it. */
export function nextRoute(route, patch) {
  const next = { ...route, ...patch };
  if (next.page === "home") next.id = null;
  if ((next.page !== route.page || next.id !== route.id) && !("cmp" in patch)) next.cmp = null;
  return next;
}

export function go(patch, { replace = false } = {}) {
  const next = nextRoute(current(), patch);
  const hash = formatHash(next, META);
  if (hash === formatHash(current(), META)) return;
  if (replace) {
    history.replaceState(null, "", hash);
    listeners.forEach(fn => fn(current())); // replaceState fires no hashchange
  } else {
    location.hash = hash;
  }
}

export const onChange = fn => listeners.push(fn);
