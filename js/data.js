// Pure data layer: no DOM, no d3 (unit-tested in Node).
// Months are indices (0 = 2017-01). A range r = {from, to} is inclusive. Days count from meta.start.
const DAY = 864e5;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function makeDb(meta, songs, artists) {
  for (const a of artists) a.total = 0;
  for (const s of songs) {
    s.total = s.m.reduce((t, e) => t + e[1], 0);
    s.countries = [...new Set(s.a.map(i => artists[i].c))];
    for (const i of s.a) artists[i].total += s.total;
  }
  return {
    meta, songs, artists, ranks: null,
    artistByName: new Map(artists.map((a, i) => [a.n, i])),
    songById: new Map(songs.map((s, i) => [s.id, i])),
  };
}

const getJson = url => fetch(url).then(r => {
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
});

export async function loadDb(base = "data") {
  const [meta, songs, artists] = await Promise.all(["meta", "songs", "artists"].map(f => getJson(`${base}/${f}.json`)));
  return Object.assign(makeDb(meta, songs, artists), { base });
}

/** Loads the daily rank file once (it is the biggest file, so it is fetched after first paint). */
export function loadRanks(db) {
  return (db._ranks ??= getJson(`${db.base ?? "data"}/ranks.json`).then(r => (db.ranks = r)));
}

const inRange = (m, r) => m >= r.from && m <= r.to;
const isActive = (song, r) => song.m.some(e => inRange(e[0], r));

export function songStats(song, r) {
  let points = 0, peak = Infinity, days = 0;
  for (const [m, p, best, d] of song.m) if (inRange(m, r)) { points += p; peak = Math.min(peak, best); days += d; }
  return days ? { points, peak, days } : null;
}

export function countryCounts(db, r) {
  const counts = new Map();
  for (const s of db.songs) if (isActive(s, r)) for (const c of s.countries) counts.set(c, (counts.get(c) || 0) + 1);
  return counts;
}

/** Songs to highlight for a cmp value: an artist name or a song id. */
export function highlightOf(db, key) {
  if (db.artistByName.has(key)) { const a = db.artists[db.artistByName.get(key)]; return { label: a.n, songs: a.s }; }
  if (db.songById.has(key)) { const i = db.songById.get(key); return { label: db.songs[i].t, songs: [i] }; }
  return null;
}

/** Median of feature k over the songs charting in the period. */
export function featureMedian(db, k, r) {
  const v = db.songs.filter(s => isActive(s, r)).map(s => s.f[k]).sort((a, b) => a - b), h = v.length >> 1;
  return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
}

export const uniqueSongs = (db, r) => db.songs.filter(s => isActive(s, r)).length;

export function countryMonthly(db, country) {
  const n = db.meta.months.map(() => 0);
  for (const s of db.songs) if (s.countries.includes(country)) for (const e of s.m) n[e[0]]++;
  return n.map((v, m) => (db.meta.monthSongs[m] ? v / db.meta.monthSongs[m] : 0));
}

export function topArtists(db, r, country = null, limit = 50) {
  const acc = new Map();
  for (const s of db.songs) {
    const st = songStats(s, r);
    if (!st) continue;
    for (const i of s.a) {
      if (country && db.artists[i].c !== country) continue;
      const o = acc.get(i) ?? { artist: i, count: 0, points: 0 };
      o.count++;
      o.points += st.points;
      acc.set(i, o);
    }
  }
  const name = i => db.artists[i].n;
  return [...acc.values()]
    .sort((a, b) => b.count - a.count || b.points - a.points || name(a.artist).localeCompare(name(b.artist)))
    .slice(0, limit);
}

export function topSongs(db, r, country = null, limit = 50) {
  const out = [];
  db.songs.forEach((s, i) => {
    if (country && !s.countries.includes(country)) return;
    const st = songStats(s, r);
    if (st) out.push({ song: i, points: st.points });
  });
  return out.sort((a, b) => b.points - a.points || db.songs[a.song].t.localeCompare(db.songs[b.song].t)).slice(0, limit);
}

export function artistSongs(db, artistIdx, r) {
  return db.artists[artistIdx].s
    .map(i => ({ song: i, ...songStats(db.songs[i], r) }))
    .filter(x => x.days)
    .sort((a, b) => b.points - a.points);
}

/** Mean radar percentile (0–1) per axis; 95% CI only from 3 songs up. */
export function signature(db, songIdxs) {
  const n = songIdxs.length;
  if (!n) return { mean: null, ci: null, n };
  const val = (i, j) => db.songs[i].p[j] / 100;
  const mean = db.songs[songIdxs[0]].p.map((_, j) => songIdxs.reduce((t, i) => t + val(i, j), 0) / n);
  if (n < 3) return { mean, ci: null, n };
  const ci = mean.map((mu, j) => 1.96 * Math.sqrt(songIdxs.reduce((t, i) => t + (val(i, j) - mu) ** 2, 0) / (n - 1) / n));
  return { mean, ci, n };
}

export function decodeRanks([start, b64]) {
  return { start, ranks: Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)) };
}

export function rankHistory(db, songIdx) {
  const { start, ranks } = decodeRanks(db.ranks[songIdx]);
  return Array.from(ranks, (v, i) => ({ day: start + i, rank: v || null }));
}

/** First day index of month m (m may run past the data, e.g. to get an exclusive end). */
export function monthStart(meta, m) {
  const [y, mo] = meta.start.split("-").map(Number);
  return Math.round((Date.UTC(y, mo - 1 + m, 1) - Date.UTC(y, mo - 1, 1)) / DAY);
}

/** Best rank per step for a bump chart: weekly for periods up to 6 months, else monthly. */
export function bumpSeries(db, songIdxs, r) {
  const { meta } = db;
  if (r.to - r.from < 6) {
    const d0 = monthStart(meta, r.from), d1 = Math.min(monthStart(meta, r.to + 1), meta.days);
    const steps = [];
    for (let d = d0; d < d1; d += 7) steps.push(d);
    const series = songIdxs.map(i => {
      const { start, ranks } = decodeRanks(db.ranks[i]);
      const values = steps.map(s => {
        let best = 0;
        for (let d = s; d < Math.min(s + 7, d1); d++) {
          const v = ranks[d - start];
          if (v && (!best || v < best)) best = v;
        }
        return best || null;
      });
      return { song: i, values };
    });
    return { unit: "week", steps, series };
  }
  const months = Array.from({ length: r.to - r.from + 1 }, (_, k) => r.from + k);
  const series = songIdxs.map(i => {
    const best = new Map(db.songs[i].m.map(e => [e[0], e[2]]));
    return { song: i, values: months.map(m => best.get(m) ?? null) };
  });
  return { unit: "month", steps: months.map(m => monthStart(meta, m)), series };
}

export const norm = s => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Songs and artists matching q: prefix, then word start, then anywhere; ties by popularity. */
export function search(db, q, limit = 8) {
  q = norm(q.trim());
  if (!q) return [];
  db._names ??= { song: db.songs.map(s => norm(s.t)), artist: db.artists.map(a => norm(a.n)) };
  const hits = [];
  for (const type of ["song", "artist"]) {
    db._names[type].forEach((n, idx) => {
      const at = n.indexOf(q);
      if (at < 0) return;
      const total = (type === "song" ? db.songs : db.artists)[idx].total;
      hits.push({ type, idx, score: at === 0 ? 0 : n.includes(" " + q) ? 1 : 2, total });
    });
  }
  return hits.sort((a, b) => a.score - b.score || b.total - a.total).slice(0, limit).map(({ type, idx }) => ({ type, idx }));
}

export function monthLabel(meta, m) {
  const [y, mo] = meta.months[m].split("-");
  return `${MON[mo - 1]} ${y}`;
}

export function dayToDate(meta, d) {
  const [y, mo, dd] = meta.start.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, dd) + d * DAY);
}

// map (Natural Earth) names → friendlier display names
const NICE = {
  "United States of America": "United States", "Dominican Rep.": "Dominican Republic", "Solomon Is.": "Solomon Islands",
  "Bosnia and Herz.": "Bosnia and Herzegovina", "Central African Rep.": "Central African Republic", "Dem. Rep. Congo": "DR Congo",
};
export const displayCountry = name => NICE[name] ?? name;

/** Choropleth class breaks [5, 20, 50, 200] scaled by k = songs in the period / songs overall.
 *  Breaks ≤ 1 are dropped (every colored country has ≥ 1 song) and repeats removed. */
export const scaledThresholds = k => [...new Set([5, 20, 50, 200].map(t => Math.round(t * k)).filter(t => t > 1))];

/** Distinct days in the period on which at least one of the songs was on the chart (needs db.ranks). */
export function chartDays(db, songIdxs, r) {
  const d0 = monthStart(db.meta, r.from), d1 = Math.min(monthStart(db.meta, r.to + 1), db.meta.days);
  const on = new Uint8Array(Math.max(0, d1 - d0));
  for (const i of songIdxs) {
    const { start, ranks } = decodeRanks(db.ranks[i]);
    for (let d = Math.max(d0, start); d < Math.min(d1, start + ranks.length); d++) if (ranks[d - start]) on[d - d0] = 1;
  }
  return on.reduce((a, b) => a + b, 0);
}
