// The Trends page: every number is computed here from data/history.csv.
const usd = money;
const sum = a => a.reduce((x, y) => x + y, 0);
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// grouping for the chart: each point is one day, month, year or decade
const GROUPS = {
  day: d => d, month: d => d.slice(0, 7), year: d => d.slice(0, 4), decade: d => d.slice(0, 3) + "0s",
};

function computeTrends(rows) {
  const days = dates(rows);
  const last = days[days.length - 1];
  const latest = rows.filter(r => r.date === last);
  const byItem = new Map();                           // item_id -> rows in date order
  rows.forEach(r => { if (!byItem.has(r.item_id)) byItem.set(r.item_id, []); byItem.get(r.item_id).push(r); });

  // 1. change of the lowest price from the first day an item had a price to the latest day it had one
  const sinceFirst = [];
  byItem.forEach(list => {
    const priced = list.filter(r => r.lowest_price !== null);
    if (priced.length < 2) return;
    const a = priced[0], b = priced[priced.length - 1];
    const pct = pctChange(a.lowest_price, b.lowest_price);
    if (pct !== null) sinceFirst.push({ item: b.item, from: a.lowest_price, to: b.lowest_price, fromDate: a.date, toDate: b.date, pct });
  });
  sinceFirst.sort((x, y) => y.pct - x.pct || x.item.localeCompare(y.item));

  // 2. one-day moves: the percent change between two consecutive days that an item has a price
  const daily = [];
  byItem.forEach(list => {
    for (let i = 1; i < list.length; i++) {
      const pct = pctChange(list[i - 1].lowest_price, list[i].lowest_price);
      if (pct !== null) daily.push({ item: list[i].item, date: list[i].date, from: list[i - 1].lowest_price, to: list[i].lowest_price, pct });
    }
  });
  daily.sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct) || x.item.localeCompare(y.item) || x.date.localeCompare(y.date));

  // 3-6: snapshots of the latest day
  const priced = latest.filter(r => r.lowest_price !== null).sort((x, y) => y.lowest_price - x.lowest_price || x.item.localeCompare(y.item));
  const demand = latest.filter(r => r.have && r.want !== null).map(r => ({ item: r.item, ratio: r.want / r.have * 100, want: r.want, have: r.have }))
    .sort((x, y) => y.ratio - x.ratio || x.item.localeCompare(y.item));
  const stock = latest.filter(r => r.num_for_sale !== null).sort((x, y) => x.num_for_sale - y.num_for_sale || x.item.localeCompare(y.item));
  const rated = latest.filter(r => r.rating !== null).sort((x, y) => y.rating - x.rating || y.rating_votes - x.rating_votes || x.item.localeCompare(y.item));
  const gains = collectorGains(rows);
  return { days, last, latest, sinceFirst, daily, priced, demand, stock, rated, gains };
}

function section(heading, paragraph, how, chartHtml) {
  return `<section class="finding"><h2>${heading}</h2><p>${paragraph}</p><p class="how">How it is computed: ${how}</p><div class="chart">${chartHtml}</div></section>`;
}

function renderFindings(t, win) {
  const out = [];
  const w = WINDOWS[win];
  const inWindow = win === "all" ? "" : ` Only the dates inside the window (${w.text}) are used.`;
  const needTwo = what => section(`${what} needs at least two days in this window`,
    `The window (${w.text}) has ${t.days.length} day${t.days.length === 1 ? "" : "s"} so far (${t.days[0] ?? "none"}). Pick a longer window, or wait for the next daily run.`,
    "it compares days, so it needs two or more.", "");
  const latestNote = " It always uses the latest day, whatever the window.";

  // 1
  if (t.sinceFirst.length) {
    const up = t.sinceFirst[0], down = t.sinceFirst[t.sinceFirst.length - 1];
    const avg = sum(t.sinceFirst.map(s => s.pct)) / t.sinceFirst.length;
    out.push(section(
      up.pct > 0 ? `${esc(up.item)} rose the most in price ${w.phrase} (${fmtPct(up.pct)})` : `No record has risen in price ${w.phrase}`,
      `From ${up.fromDate} to ${up.toDate} the lowest asking price of ${esc(up.item)} went from ${usd(up.from)} to ${usd(up.to)} (${fmtPct(up.pct)}). ` +
      `The record that fell the most was ${esc(down.item)}, from ${usd(down.from)} to ${usd(down.to)} (${fmtPct(down.pct)}). ` +
      `Across the ${t.sinceFirst.length} records with at least two priced days the average change is ${fmtPct(avg)}.`,
      "for each record, (latest price − first price) ÷ first price × 100, using the first and the latest day on which it had a lowest price in history.csv." + inWindow,
      hbars(t.sinceFirst.map(s => ({ label: s.item, value: s.pct })), v => fmtPct(v))));
  } else out.push(needTwo("The price change"));

  // 2
  if (t.daily.length) {
    const top = t.daily[0];
    const flat = t.daily.filter(d => d.pct === 0).length;
    out.push(section(
      `The biggest one-day price move was ${esc(top.item)} on ${top.date} (${fmtPct(top.pct)})`,
      `Its lowest asking price went from ${usd(top.from)} to ${usd(top.to)} in one day. Across all ${t.daily.length} price changes between consecutive days, ` +
      `the average size of a move (ignoring up or down) is ${(sum(t.daily.map(d => Math.abs(d.pct))) / t.daily.length).toFixed(1)}%, and ` +
      `${flat} ${flat === 1 ? "was" : "were"} no change at all.`,
      "for every record and every pair of consecutive days with a price, (price today − price before) ÷ price before × 100; the chart shows the ten largest by size." + inWindow,
      hbars(t.daily.slice(0, 10).map(d => ({ label: `${d.item} (${d.date.slice(5)})`, value: d.pct })), v => fmtPct(v))));
  } else out.push(needTwo("The biggest one-day move"));

  // popularity gain of the window
  if (t.gains.length) {
    const top = t.gains[0];
    const total = sum(t.gains.map(g => g.gain));
    out.push(section(
      top.gain > 0 ? `${esc(top.item)} gained the most popularity ${w.phrase}, with ${top.gain.toLocaleString("en-US")} new collectors` : `No record gained collectors ${w.phrase}`,
      `Popularity here is counted in collectors: the record that gained the most collectors who say they have it is the one rising fastest. From ${top.fromDate} to ${top.toDate}, ` +
      `${esc(top.item)} went from ${top.from.toLocaleString("en-US")} to ${top.to.toLocaleString("en-US")} collectors. All ${t.gains.length} records together gained ${total.toLocaleString("en-US")}, ` +
      `an average of ${(total / t.gains.length).toFixed(1)} per record.`,
      "for each record, have on the last day in the window minus have on the first day in the window with a count in history.csv; the chart shows the ten largest gains." + inWindow,
      hbars(t.gains.slice(0, 10).map(g => ({ label: g.item, value: g.gain })), v => (v > 0 ? "+" : "") + v.toLocaleString("en-US"), "#6a4fb3")));
  } else out.push(needTwo("The popularity gain"));

  // 3
  if (t.priced.length) {
    const hi = t.priced[0], lo = t.priced[t.priced.length - 1];
    const prices = t.priced.map(r => r.lowest_price);
    out.push(section(
      `Prices run from ${usd(lo.lowest_price)} to ${usd(hi.lowest_price)}, so the dearest record costs ${(hi.lowest_price / lo.lowest_price).toFixed(1)} times the cheapest`,
      `On ${t.last} the cheapest copy for sale is ${esc(lo.item)} at ${usd(lo.lowest_price)} and the most expensive is ${esc(hi.item)} at ${usd(hi.lowest_price)}. ` +
      `The middle price (median) is ${usd(median(prices))} and the average is ${usd(sum(prices) / prices.length)} across ${prices.length} records.`,
      "the lowest_price of every record on the latest day in history.csv, then the minimum, maximum, median and mean of those prices; the ratio is maximum ÷ minimum." + latestNote,
      hbars(t.priced.map(r => ({ label: r.item, value: r.lowest_price })), usd, "#1d7a85")));
  }

  // 4
  if (t.demand.length) {
    const a = t.demand[0], z = t.demand[t.demand.length - 1];
    out.push(section(
      `${esc(a.item)} has the most collectors waiting: ${a.ratio.toFixed(0)} want it for every 100 who have it`,
      `${a.want.toLocaleString("en-US")} collectors want ${esc(a.item)} and ${a.have.toLocaleString("en-US")} have it. The lowest demand is for ${esc(z.item)}, ` +
      `at ${z.ratio.toFixed(0)} wants per 100 owners. The typical record (median) has ${median(t.demand.map(d => d.ratio)).toFixed(0)} wants per 100 owners.`,
      "on the latest day, want ÷ have × 100 for every record (collectors who want it per 100 collectors who own it); the chart shows the ten highest." + latestNote,
      hbars(t.demand.slice(0, 10).map(d => ({ label: d.item, value: d.ratio })), v => v.toFixed(0))));
  }

  // 5
  if (t.stock.length) {
    const few = t.stock[0], many = t.stock[t.stock.length - 1];
    out.push(section(
      `Only ${few.num_for_sale} ${few.num_for_sale === 1 ? "copy" : "copies"} of ${esc(few.item)} ${few.num_for_sale === 1 ? "is" : "are"} for sale, against ${many.num_for_sale} of ${esc(many.item)}`,
      `Across the ${t.stock.length} records there are ${sum(t.stock.map(r => r.num_for_sale)).toLocaleString("en-US")} copies for sale in total, an average of ` +
      `${(sum(t.stock.map(r => r.num_for_sale)) / t.stock.length).toFixed(0)} per record (median ${median(t.stock.map(r => r.num_for_sale)).toFixed(0)}).`,
      "num_for_sale of every record on the latest day in history.csv; the chart shows the ten scarcest." + latestNote,
      hbars(t.stock.slice(0, 10).map(r => ({ label: r.item, value: r.num_for_sale })), v => String(v), "#17161a")));
  }

  // 6
  if (t.rated.length) {
    const best = t.rated[0], worst = t.rated[t.rated.length - 1];
    out.push(section(
      `${esc(best.item)} is the highest rated at ${best.rating.toFixed(2)} stars`,
      `It has ${best.rating_votes.toLocaleString("en-US")} rating votes. The lowest rated is ${esc(worst.item)} at ${worst.rating.toFixed(2)} stars, so the whole range is only ` +
      `${(best.rating - worst.rating).toFixed(2)} stars. The average rating across ${t.rated.length} records is ${(sum(t.rated.map(r => r.rating)) / t.rated.length).toFixed(2)}.`,
      "the rating (average of Discogs members' votes, 0 to 5) of every record on the latest day in history.csv; the chart shows the ten highest." + latestNote,
      hbars(t.rated.slice(0, 10).map(r => ({ label: r.item, value: r.rating })), v => v.toFixed(2), "#c58b00")));
  }
  return out.join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  let data;
  try { data = await loadData(); } catch (err) { showError(err); return; }
  const el = id => document.getElementById(id);
  const rows = data.rows;
  const full = computeTrends(rows);
  if (!full.days.length) { el("intro").textContent = "No data yet."; return; }
  el("intro").textContent = `${full.days.length} day${full.days.length === 1 ? "" : "s"} of history (${full.days[0]} to ${full.last}), ${new Set(rows.map(r => r.item_id)).size} records.`;

  const items = [...new Map(rows.map(r => [r.item_id, r.item])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const topFive = full.priced.slice(0, 5).map(r => r.item_id);
  const state = { win: "all", group: "day", col: "lowest_price", chosen: new Set(topFive.length ? topFive : items.slice(0, 5).map(i => i[0])) };
  el("t-value").innerHTML = Object.entries(VALUES).map(([k, v]) => `<option value="${k}">${v.label} (${v.unit})</option>`).join("");

  let wrows = rows;
  function drawChart() {
    const color = new Map(items.filter(([id]) => state.chosen.has(id)).map(([id], i) => [id, PALETTE[i % PALETTE.length]]));
    el("picker").innerHTML = items.map(([id, name]) =>
      `<label class="chip${state.chosen.has(id) ? "" : " off"}" style="--c:${color.get(id) || "#bbb"}"><input type="checkbox" data-id="${esc(id)}" ${state.chosen.has(id) ? "checked" : ""}><i></i>${esc(name)}</label>`).join("");
    const key = GROUPS[state.group];
    const periods = [...new Set(wrows.map(r => key(r.date)))].sort();
    const cell = new Map();                                   // "period|item" -> the values in that period
    wrows.forEach(r => {
      if (r[state.col] === null) return;
      const k = key(r.date) + "|" + r.item_id;
      if (!cell.has(k)) cell.set(k, []);
      cell.get(k).push(r[state.col]);
    });
    const series = items.filter(([id]) => state.chosen.has(id)).map(([id, name]) => ({
      label: name, color: color.get(id),
      values: periods.map(p => { const v = cell.get(p + "|" + id); return v ? sum(v) / v.length : null; }),
    }));
    el("line-chart").innerHTML = lineChart(periods, series, VALUES[state.col].fmt, state.group === "day" ? undefined : p => p);
    el("line-note").textContent = `${VALUES[state.col].label} (${VALUES[state.col].unit}) for ${series.length} record${series.length === 1 ? "" : "s"}` +
      (state.group === "day" ? "" : `; each point is the average of the days in that ${state.group}`) + "; a gap means the source reported no value then.";
  }

  function refresh() {
    wrows = windowRows(rows, state.win);
    const t = computeTrends(wrows);
    window.trendsResult = t;                                 // handy for checking the numbers in the console
    el("findings").innerHTML = renderFindings(t, state.win);
    el("window-note").textContent = `Showing ${WINDOWS[state.win].text}: ${t.days.length} day${t.days.length === 1 ? "" : "s"}` +
      (t.days.length ? ` (${t.days[0]} to ${t.last})` : "") + ". Daily needs two runs; the other windows are counted back from the latest date.";
    el("t-window").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.w === state.win));
    drawChart();
  }

  el("t-window").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    state.win = b.dataset.w;
    refresh();
  });
  el("t-group").addEventListener("input", () => { state.group = el("t-group").value; drawChart(); });
  el("t-value").addEventListener("input", () => { state.col = el("t-value").value; drawChart(); });
  el("picker").addEventListener("change", e => {
    const id = e.target.dataset.id;
    e.target.checked ? state.chosen.add(id) : state.chosen.delete(id);
    drawChart();
  });
  document.querySelectorAll("[data-pick]").forEach(b => b.addEventListener("click", () => {
    state.chosen = new Set(b.dataset.pick === "all" ? items.map(i => i[0]) : b.dataset.pick === "none" ? [] : topFive);
    drawChart();
  }));
  refresh();
});
