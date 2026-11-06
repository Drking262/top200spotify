// Own data: daily chart CSVs from charts.spotify.com -> the same {meta, songs, artists, ranks} as build_data.py.
// Spotify's CSV has no nationality or audio features. Both are borrowed from the built-in data where it knows
// the song / artist; features of other songs come from ReccoBeats (fetchFeatures), else f = p = null.
// Unknown artists get country "Unknown". The top part is pure (unit-tested in Node).
import { norm } from "./data.js";

const DAY = 864e5;
const COLS = ["rank", "uri", "artist_names", "track_name"];
const utc = iso => Date.parse(iso + "T00:00:00Z");
const r3 = x => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

/** RFC 4180 CSV -> objects keyed by the header row (quoted fields may hold commas, quotes, newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      rows.push([...row, field]);
      row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) rows.push([...row, field]);
  const [head = [], ...body] = rows.filter(r => r.some(Boolean));
  return body.map(r => Object.fromEntries(head.map((h, k) => [h.trim(), r[k] ?? ""])));
}

/** Date of a chart file from its name, e.g. regional-global-daily-2024-01-31.csv -> "2024-01-31". */
export function chartDate(name) {
  if (/weekly/i.test(name)) throw new Error(`${name}: this is a weekly chart; please download daily charts`);
  const d = name.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!d || Number.isNaN(utc(d))) throw new Error(`${name}: no date (YYYY-MM-DD) in the file name`);
  return d;
}

/** "Tyler, The Creator, Kali Uchis" -> two artists: neighbours are joined back when that name is known. */
export function splitArtists(s, known) {
  const parts = s.split(", "), out = [];
  for (let i = 0; i < parts.length; i++) {
    let j = parts.length; // longest known join first
    while (j > i + 1 && !known.has(parts.slice(i, j).join(", "))) j--;
    out.push(parts.slice(i, j).join(", "));
    i = j - 1;
  }
  return out;
}

/** Percentile 0–100 like pandas rank(pct=True): ties get their average rank. */
function pctRanks(v) {
  const idx = v.map((_, i) => i).sort((a, b) => v[a] - v[b]), out = [];
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++;
    for (let k = i; k <= j; k++) out[idx[k]] = Math.round(((i + j) / 2 + 1) / v.length * 100);
    i = j + 1;
  }
  return out;
}

/** Linear-interpolated quantile of sorted values (numpy's default). */
const quantile = (s, q) => { const h = (s.length - 1) * q, lo = Math.floor(h); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo); };

function pearson(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/**
 * files: [{name, text}] daily chart CSVs; base: the built-in Db (makeDb) to borrow countries, features, covers;
 * extra: Map song id -> features (FEATURES order) for songs the built-in data does not know.
 * Points per chart day = 201 − rank, as in the Kaggle dataset.
 */
export function buildOwn(files, base, extra = new Map()) {
  if (!files.length) throw new Error("No files selected");
  const known = new Set(base.artists.map(a => a.n));
  const rows = [];
  for (const { name, text } of files) {
    const date = chartDate(name), recs = parseCsv(text);
    const missing = COLS.filter(c => !(c in (recs[0] ?? {})));
    if (missing.length) throw new Error(`${name}: not a Spotify Charts CSV (missing ${missing.join(", ")})`);
    for (const r of recs) {
      const rank = +r.rank;
      if (rank >= 1 && rank <= 200) rows.push({ date, rank, id: r.uri.split(":").pop(), t: r.track_name, a: splitArtists(r.artist_names, known) });
    }
  }
  if (!rows.length) throw new Error("The files contain no chart rows");

  // re-issues: ids sharing title and artists become one song, under the id with the most points
  const key = r => `${r.t}|${r.a.join(", ")}`, pts = new Map(), canon = new Map();
  for (const r of rows) pts.set(r.id, (pts.get(r.id) ?? 0) + 201 - r.rank);
  for (const r of rows) if (!canon.has(key(r)) || pts.get(r.id) > pts.get(canon.get(key(r)))) canon.set(key(r), r.id);

  // the timeline starts on the 1st of the first chart month (monthStart() in data.js counts from a 1st)
  const dates = [...new Set(rows.map(r => r.date))].sort();
  const y0 = +dates[0].slice(0, 4), m0 = +dates[0].slice(5, 7) - 1, t0 = Date.UTC(y0, m0, 1);
  const dayOf = iso => Math.round((utc(iso) - t0) / DAY);
  const days = dayOf(dates.at(-1)) + 1;
  const month = Array.from({ length: days }, (_, d) => { const dt = new Date(t0 + d * DAY); return (dt.getUTCFullYear() - y0) * 12 + dt.getUTCMonth() - m0; });
  const nMonths = month[days - 1] + 1;

  // one rank per song-day: best rank wins over duplicates
  const byId = new Map();
  for (const r of rows) {
    const id = canon.get(key(r));
    if (!byId.has(id)) byId.set(id, { id, t: r.t, names: r.a, R: new Uint8Array(days) });
    const R = byId.get(id).R, d = dayOf(r.date);
    if (!R[d] || r.rank < R[d]) R[d] = r.rank;
  }
  const list = [...byId.values()];

  // days without a chart file: carry a song over only if it charts on both sides of the gap
  const pub = dates.map(dayOf);
  for (let k = 1; k < pub.length; k++) {
    const p = pub[k - 1], n = pub[k];
    if (n - p > 1) for (const { R } of list) if (R[p] && R[n]) R.fill(R[p], p + 1, n);
  }

  // per song-month: [month, points, best rank, days]
  for (const s of list) {
    const acc = new Map();
    s.R.forEach((v, d) => {
      if (!v) return;
      const e = acc.get(month[d]) ?? [month[d], 0, 255, 0];
      e[1] += 201 - v; e[2] = Math.min(e[2], v); e[3]++;
      acc.set(month[d], e);
    });
    s.m = [...acc.values()];
    s.total = s.m.reduce((t, e) => t + e[1], 0);
  }
  list.sort((a, b) => b.total - a.total);

  // borrowed from the built-in data: by id, else by title + first artist (the built-in data merged re-issues too)
  const byName = new Map(base.songs.map(s => [`${norm(s.t)}|${base.artists[s.a[0]].n}`, s]));
  for (const s of list) {
    const ref = base.songs[base.songById.get(s.id)] ?? byName.get(`${norm(s.t)}|${s.names[0]}`);
    s.f = ref?.f ?? extra.get(s.id) ?? null;
    s.c = ref?.c ?? null;
  }
  const { features, radar } = base.meta;
  const withF = list.filter(s => s.f);
  radar.forEach((name, j) => {
    const k = features.indexOf(name), p = pctRanks(withF.map(s => s.f[k]));
    withF.forEach((s, i) => (s.p ??= [])[j] = p[i]);
  });

  // artists, sorted by the points of the songs they are credited on
  const aSongs = new Map(), aTotal = new Map();
  list.forEach((s, i) => s.names.forEach(n => {
    if (!aSongs.has(n)) aSongs.set(n, []);
    aSongs.get(n).push(i);
    aTotal.set(n, (aTotal.get(n) ?? 0) + s.total);
  }));
  const aOrder = [...aSongs.keys()].sort((a, b) => aTotal.get(b) - aTotal.get(a) || (a < b ? -1 : a > b ? 1 : 0));
  const aIdx = new Map(aOrder.map((n, i) => [n, i]));
  const country = n => base.artists[base.artistByName.get(n)]?.c ?? "Unknown";
  const artists = aOrder.map(n => ({ n, c: country(n), s: aSongs.get(n) }));

  const songs = list.map(s => ({ id: s.id, t: s.t, a: s.names.map(n => aIdx.get(n)), f: s.f, p: s.p ?? null, c: s.c, m: s.m }));
  const ranks = list.map(({ R }) => {
    let a = 0, b = days - 1;
    while (!R[a]) a++;
    while (!R[b]) b--;
    return [a, btoa(String.fromCharCode(...R.subarray(a, b + 1)))];
  });

  // month-level stats for the feature page and the player
  const active = m => list.filter(s => s.m.some(e => e[0] === m));
  const chartDays = Array(nMonths).fill(0);
  for (const d of pub) chartDays[month[d]]++;
  const monthSongs = [], featureMonthly = Object.fromEntries(features.map(f => [f, []]));
  for (let m = 0; m < nMonths; m++) {
    const act = active(m);
    monthSongs.push(act.length);
    features.forEach((f, k) => {
      const v = act.filter(s => s.f).map(s => s.f[k]).sort((a, b) => a - b);
      featureMonthly[f].push(v.length ? [.25, .5, .75].map(q => r3(quantile(v, q))) : [null, null, null]);
    });
  }
  const corr = {};
  const tot = withF.map(s => s.total), rankTot = pctRanks(tot);
  features.forEach((f, k) => {
    const v = withF.map(s => s.f[k]);
    const pearsonR = pearson(v, tot.map(t => Math.log10(Math.max(t, 1)))), spearman = pearson(pctRanks(v), rankTot);
    if (withF.length >= 3 && Number.isFinite(pearsonR)) corr[f] = { pearson: r3(pearsonR), spearman: r3(spearman) };
  });

  const ym = m => `${y0 + Math.floor((m0 + m) / 12)}-${String(((m0 + m) % 12) + 1).padStart(2, "0")}`;
  const meta = {
    start: dates[0].slice(0, 8) + "01", days, months: Array.from({ length: nMonths }, (_, m) => ym(m)),
    chartDays, monthSongs, features, radar, featureMonthly, corr,
    own: { first: dates[0], last: dates.at(-1), files: dates.length },
  };
  return { meta, songs, artists, ranks };
}

// ---- browser side ----

/** Album covers for songs the built-in data does not know (Spotify's public oEmbed allows CORS). */
export async function fetchCovers(songs, onProgress, workers = 6) {
  const todo = songs.filter(s => !s.c);
  let done = 0, next = 0, limited = false;
  const one = async () => {
    while (next < todo.length && !limited) {
      const s = todo[next++];
      try {
        const r = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${s.id}`);
        if (r.status === 429) limited = true; // rate limited: the rest keep their initials placeholder
        else if (r.ok) s.c = (await r.json()).thumbnail_url.split("/image/").pop();
      } catch { /* offline or blocked: no cover */ }
      onProgress?.(++done, todo.length);
    }
  };
  await Promise.all(Array.from({ length: workers }, one));
}

/** Audio features from ReccoBeats (free, no key, takes Spotify ids) -> Map id -> FEATURES-order array. */
export async function fetchFeatures(ids, features, onProgress, batch = 40) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += batch) {
    try {
      const r = await fetch(`https://api.reccobeats.com/v1/audio-features?ids=${ids.slice(i, i + batch).join(",")}`);
      if (r.status === 429) break; // rate limited: the rest stay without features
      if (r.ok) for (const t of (await r.json()).content ?? []) {
        const v = features.map(f => t[f.toLowerCase()]);
        if (v.every(Number.isFinite)) out.set(t.href.split("/").pop(), v.map(r3));
      }
    } catch { /* offline or blocked: no features */ }
    onProgress?.(Math.min(i + batch, ids.length), ids.length);
  }
  return out;
}

const store = (mode, fn) => new Promise((ok, fail) => {
  const open = indexedDB.open("top200", 1);
  open.onupgradeneeded = () => open.result.createObjectStore("kv");
  open.onerror = () => fail(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction("kv", mode), req = fn(tx.objectStore("kv"));
    tx.oncomplete = () => ok(req.result);
    tx.onerror = () => fail(tx.error);
  };
});
export const loadOwn = () => store("readonly", s => s.get("own")).catch(() => null);
export const saveOwn = data => store("readwrite", s => s.put(data, "own"));
export const deleteOwn = () => store("readwrite", s => s.delete("own"));

/** Which data set to show: "own" or "builtin" (remembered in localStorage). */
export const chosenSet = () => localStorage.getItem("dataset") ?? "builtin";

/** Switch data sets: the whole app reloads on Home, so no view keeps state from the other set. */
export function useSet(name) {
  localStorage.setItem("dataset", name);
  history.replaceState(null, "", location.pathname + "#/");
  location.reload();
}
