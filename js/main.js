// Entry: load data, draw the frame once, then re-render on every route change.
import { loadDb, loadRanks } from "./data.js";
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
    db = await loadDb();
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

  const c0 = ctx();
  initTopbar($("top"), c0);
  initPlayer($("player"), c0);
  onChange(paint);
  paint();
  requestAnimationFrame(() => loadRanks(db).catch(err => console.error("ranks.json", err)));
}

start();
