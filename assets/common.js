// Shared by all three pages: navigation bar, data loading, small helpers.
const PAGES = [["index.html", "Today"], ["browse.html", "Browse"], ["trends.html", "Trends"]];

function renderNav() {
  const here = location.pathname.split("/").pop() || "index.html";
  const nav = document.createElement("nav");
  nav.className = "nav";
  nav.innerHTML = '<div class="nav-inner"><a class="brand" href="index.html"><span class="disc" aria-hidden="true"></span>Vinyl Tracker</a>' +
    PAGES.map(([href, label]) =>
      `<a class="link${href === here ? " current" : ""}" href="${href}">${label}</a>`).join("") +
    "</div>";
  document.body.prepend(nav);
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

// Top seller. Discogs does not publish sales, so the signal is how many collectors newly say they have a
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

// A small record sleeve: a colour taken from the item key, with the artist's initials.
function sleeve(row) {
  let h = 0;
  for (const c of row.item_id) h = (h * 31 + c.charCodeAt(0)) % 360;
  const initials = (row.artist || row.item).split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  return `<span class="sleeve" style="--h:${h}" aria-hidden="true"><i></i><b>${esc(initials)}</b></span>`;
}

function showError(err) {
  const main = document.querySelector("main");
  main.insertAdjacentHTML("beforeend",
    `<div class="banner">Could not load the data (${esc(err.message)}). Try again when you are online.</div>`);
}

document.addEventListener("DOMContentLoaded", () => {
  renderNav();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
});
