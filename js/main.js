// Entry: load data, draw the frame once, then re-render on every route change.
import { loadDb, loadRanks, makeDb } from "./data.js";
import { chosenSet, loadOwn } from "./own.js";
import { current, defaultRoute, go, initRouter, onChange, routeExists } from "./state.js";
import { initTopbar, updateTopbar } from "./frame/topbar.js";
import { renderLibrary } from "./frame/library.js";
import { renderNowPlaying } from "./frame/nowplaying.js";
import { initPlayer, updatePlayer } from "./frame/player.js";
import { esc } from "./ui.js";
import * as home from "./views/home.js";
import * as artist from "./views/artist.js";
import * as song from "./views/song.js";
import * as feature from "./views/feature.js";

const views = { home, artist, song, feature }; // page → { render(el, ctx) }
const $ = id => document.getElementById(id);



async function start() {
  let db;
  try {
    const own = chosenSet() === "own" ? await loadOwn() : null;
    if (chosenSet() === "own" && !own) localStorage.removeItem("ownLabel"); // browser storage was cleared
    db = own ? Object.assign(makeDb(own.meta, own.songs, own.artists), { ranks: own.ranks, _ranks: Promise.resolve(own.ranks) }) : await loadDb();
  } catch (err) {
    $("view").innerHTML = `<div class="empty">Could not load the chart data (${esc(err.message)}).<br>Please reload the page.</div>`;
    return;
  }
  initRouter(db.meta);
  const ctx = () => ({ db, route: current(), go });
  let lastPage = null;

  function paint() {
    const c = ctx();
    if (!routeExists(db, c.route)) return go(defaultRoute(db.meta), { replace: true }); // stale or bad deep link → Home
    updateTopbar(c);
    updatePlayer(c);
    renderLibrary($("lib"), c);
    renderNowPlaying($("np"), c);
    const page = `${c.route.page}/${c.route.id}`;
    if (page !== lastPage) {
      $("center").scrollTop = 0;
      $("view").innerHTML = "";
      $("view").onclick = null; // views attach their own click handler
      lastPage = page;
    }
    views[c.route.page].render($("view"), c);
  }

  if (db.meta.own) document.querySelector(".foot").textContent = "Your own data: daily global charts from charts.spotify.com · countries and audio features from the built-in 2017–2023 data where known, newer songs\u2019 audio features from ReccoBeats";
  const c0 = ctx();
  initTopbar($("top"), c0);
  initPlayer($("player"), c0);
  onChange(paint);
  paint();
  requestAnimationFrame(() => loadRanks(db).catch(err => console.error("ranks.json", err)));
}

start();
