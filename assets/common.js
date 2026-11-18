// Shared by all three pages: navigation bar, data loading, small helpers.
const PAGES = [["index.html", "Today"], ["browse.html", "Browse"], ["trends.html", "Trends"]];

function renderNav() {
  const here = location.pathname.split("/").pop() || "index.html";
  const nav = document.createElement("nav");
  nav.className = "nav";
  nav.innerHTML = '<div class="nav-inner"><a class="brand" href="index.html"><span class="disc" aria-hidden="true"></span>The Vinyl Vault</a>' +
    PAGES.map(([href, label]) =>
      `<a class="link${href === here ? " current" : ""}" href="${href}">${label}</a>`).join("") +
    "</div>";
  document.body.prepend(nav);
  // a poster-style filter that gives album covers a little cartoon look
  document.body.insertAdjacentHTML("afterbegin", '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="toon" color-interpolation-filters="sRGB">' +
    '<feColorMatrix type="saturate" values="1.6"/><feComponentTransfer><feFuncR type="discrete" tableValues="0 .18 .36 .55 .75 .9 1"/>' +
    '<feFuncG type="discrete" tableValues="0 .18 .36 .55 .75 .9 1"/><feFuncB type="discrete" tableValues="0 .18 .36 .55 .75 .9 1"/></feComponentTransfer></filter></svg>');
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift() || [];
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

// the numeric columns of data/history.csv, with a label and how to show them
const money = v => "$" + (Math.round(v * 100 + 1e-9) / 100).toFixed(2);   // half-up, so $20.275 shows as $20.28
const VALUES = {
  lowest_price: { label: "Lowest price", unit: "US dollars", fmt: money },
  num_for_sale: { label: "Copies for sale", unit: "copies", fmt: v => v.toLocaleString("en-US") },
  have: { label: "Collectors who have it", unit: "collectors", fmt: v => v.toLocaleString("en-US") },
  want: { label: "Collectors who want it", unit: "collectors", fmt: v => v.toLocaleString("en-US") },
  rating: { label: "Average rating", unit: "stars out of 5", fmt: v => v.toFixed(2) },
  rating_votes: { label: "Rating votes", unit: "votes", fmt: v => v.toLocaleString("en-US") },
};
const NUMBER_COLUMNS = [...Object.keys(VALUES), "year", "release_id"];

const ITEM_URL = new Map();                  // record name -> its Discogs page
let servedFromCache = false;
async function getText(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(path + ": " + res.status);
  if (res.headers.get("x-from-cache")) servedFromCache = true;
  return res.text();
}

// Loads both data files. Numbers become numbers; a value the source did not report is null.
async function loadData() {
  const [statusText, csvText] = await Promise.all([getText("data/status.json"), getText("data/history.csv")]);
  const rows = parseCsv(csvText).map(r => {
    const out = { ...r };
    NUMBER_COLUMNS.forEach(k => { out[k] = r[k] === "" || r[k] === undefined ? null : Number(r[k]); });
    return out;
  });
  rows.forEach(r => { if (r.url) ITEM_URL.set(r.item, r.url); });
  const status = JSON.parse(statusText);
  if (servedFromCache) {
    const b = document.createElement("div");
    b.className = "banner";
    b.textContent = "You are offline. Showing the last data this device loaded.";
    document.querySelector("main").prepend(b);
  }
  return { status, rows };
}

// ---- the rules the pipeline uses, repeated here so the pages can compute everything in the browser ----
const dayNum = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const dates = rows => [...new Set(rows.map(r => r.date))].sort();
function pctChange(a, b) { return a === null || b === null || a === 0 ? null : (b - a) / a * 100; }

// Same move rule as tracker/moves.py: percent change of the lowest price between two days.
function compareDays(rows, date, top = 5) {
  const days = dates(rows).filter(d => d < date);
  const prev = days.length ? days[days.length - 1] : null;
  const today = new Map(rows.filter(r => r.date === date).map(r => [r.item_id, r]));
  if (prev === null || !today.size) return { previous: prev, moves: [], appeared: [], disappeared: [], before: new Map() };
  const before = new Map(rows.filter(r => r.date === prev).map(r => [r.item_id, r]));
  const moves = [];
  today.forEach((now, id) => {
    const old = before.get(id);
    if (!old) return;
    const pct = pctChange(old.lowest_price, now.lowest_price);
    if (pct) moves.push({ id, item: now.item, old: old.lowest_price, now: now.lowest_price, pct, oldSale: old.num_for_sale, newSale: now.num_for_sale });
  });
  moves.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.id.localeCompare(b.id));
  return {
    previous: prev, moves: moves.slice(0, top), before,
    appeared: [...today.values()].filter(r => !before.has(r.item_id)).map(r => r.item).sort(),
    disappeared: [...before.values()].filter(r => !today.has(r.item_id)).map(r => r.item).sort(),
  };
}

// The time window for every number and chart. Daily = the latest run and the one before it;
// the others are measured back from the latest date in the history.
const WINDOWS = {
  daily:  { label: "Daily",    phrase: "since the previous run",  text: "the latest run compared with the previous run" },
  week:   { label: "Weekly",   phrase: "over the last 7 days",    text: "the last 7 days", days: 7 },
  month:  { label: "Monthly",  phrase: "over the last 30 days",   text: "the last 30 days", days: 30 },
  year:   { label: "Yearly",   phrase: "over the last 365 days",  text: "the last 365 days", days: 365 },
  decade: { label: "Decade",   phrase: "over the last 10 years",  text: "the last 10 years", days: 3650 },
  all:    { label: "All time", phrase: "since the first run",     text: "all of the history" },
};

function windowRows(rows, key) {
  const all = dates(rows);
  if (key === "all" || !all.length) return rows;
  if (key === "daily") { const keep = new Set(all.slice(-2)); return rows.filter(r => keep.has(r.date)); }
  const cutoff = dayNum(all[all.length - 1]) - WINDOWS[key].days;
  return rows.filter(r => dayNum(r.date) >= cutoff);
}

// Popularity gain: how many collectors newly say they have a
// record: gain = collectors at the end of the window - collectors at the start (`have`, first and last day with a count).
function collectorGains(rows) {
  const byItem = new Map();
  rows.forEach(r => { if (r.have !== null) { if (!byItem.has(r.item_id)) byItem.set(r.item_id, []); byItem.get(r.item_id).push(r); } });
  const out = [];
  byItem.forEach(list => {
    if (list.length < 2) return;
    const a = list[0], b = list[list.length - 1];
    out.push({ item: b.item, id: b.item_id, from: a.have, to: b.have, gain: b.have - a.have, fromDate: a.date, toDate: b.date });
  });
  return out.sort((x, y) => y.gain - x.gain || x.item.localeCompare(y.item));
}

const fmtPct = p => p === null || p === undefined ? "-" : Math.abs(p) < 0.05 ? "0.0%" : (p > 0 ? "+" : "") + p.toFixed(1) + "%";
const fmtVal = (col, v) => v === null || v === undefined ? "-" : VALUES[col].fmt(v);
const runDate = status => status.run_time.slice(0, 10);
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// The record's name as a link to its Discogs page (plain text if the page is not known).
function L(name) {
  const url = ITEM_URL.get(name);
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(name)}</a>` : esc(name);
}

// The album cover in a small box, cartoonized by the toon filter and linking to the Discogs page.
// If the picture cannot load, the box keeps a colour taken from the item key and the artist's initials.
function sleeve(row) {
  if (!row) return "";
  let h = 0;
  for (const c of row.item_id) h = (h * 31 + c.charCodeAt(0)) % 360;
  const initials = (row.artist || row.item).split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  const img = row.cover ? `<img src="${esc(row.cover)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  const inner = `<b>${esc(initials)}</b>${img}`;
  return row.url
    ? `<a class="sleeve" style="--h:${h}" href="${esc(row.url)}" target="_blank" rel="noopener" title="${esc(row.item)} on Discogs" aria-label="${esc(row.item)} on Discogs">${inner}</a>`
    : `<span class="sleeve" style="--h:${h}" aria-hidden="true">${inner}</span>`;
}

function showError(err) {
  const main = document.querySelector("main");
  main.insertAdjacentHTML("beforeend",
    `<div class="banner">Could not load the data (${esc(err.message)}). Try again when you are online.</div>`);
}

document.addEventListener("DOMContentLoaded", () => {
  renderNav();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  runPage();
});

// ---- moving between pages without reloading, so the music in the player keeps playing ----
// Clicking a link to another page fetches it and swaps only the heading and the content; the navigation bar,
// the player and the page's scripts stay. If anything goes wrong it falls back to a normal page load.
const PAGE_NAMES = ["index.html", "browse.html", "trends.html"];
const pageName = u => new URL(u, location.href).pathname.split("/").pop() || "index.html";

function runPage() {
  const init = (window.PAGES || {})[pageName(location.href)];
  if (init) init();
}

async function loadScripts(doc) {                       // load the scripts a page needs that are not loaded yet, in order
  for (const s of doc.querySelectorAll("script[src]")) {
    const src = s.getAttribute("src").split("?")[0];
    if ([...document.scripts].some(x => (x.getAttribute("src") || "").split("?")[0] === src)) continue;
    await new Promise((ok, fail) => {
      const t = document.createElement("script");
      t.src = s.getAttribute("src");
      t.onload = ok; t.onerror = fail;
      document.head.appendChild(t);
    });
  }
}

async function goTo(url, push = true) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error("page " + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    if (!doc.querySelector("main") || !doc.querySelector(".hero .wrap")) throw new Error("not a page");
    await loadScripts(doc);
    document.title = doc.title;
    document.querySelector(".hero .wrap").innerHTML = doc.querySelector(".hero .wrap").innerHTML;   // the hero itself stays, so the record keeps spinning
    const main = document.querySelector("main");
    main.innerHTML = doc.querySelector("main").innerHTML;
    const foot = document.querySelector("footer");
    if (foot && doc.querySelector("footer")) foot.innerHTML = doc.querySelector("footer").innerHTML;
    if (push) history.pushState({}, "", url);
    window.scrollTo(0, 0);
    document.querySelectorAll(".nav a.link").forEach(a => a.classList.toggle("current", pageName(a.href) === pageName(url)));
    main.classList.remove("swap"); void main.offsetWidth; main.classList.add("swap");
    servedFromCache = false;
    runPage();
  } catch (err) { location.href = url; }
}

document.addEventListener("click", e => {
  const a = e.target.closest("a[href]");
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (a.target && a.target !== "_self") return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || !PAGE_NAMES.includes(pageName(u.href)) || !u.pathname.match(/(\.html|\/)$/)) return;
  e.preventDefault();
  if (pageName(u.href) !== pageName(location.href)) goTo(u.href);
  else window.scrollTo({ top: 0, behavior: "smooth" });
});
window.addEventListener("popstate", () => goTo(location.href, false));
