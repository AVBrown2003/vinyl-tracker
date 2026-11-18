// The Trends page: every number is computed here from data/history.csv.
const usd = money;
const sum = a => a.reduce((x, y) => x + y, 0);
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

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
  return { days, last, latest, sinceFirst, daily, priced, demand, stock, rated };
}

function section(heading, paragraph, how, chartHtml) {
  return `<section class="finding"><h2>${heading}</h2><p>${paragraph}</p><p class="how">How it is computed: ${how}</p><div class="chart">${chartHtml}</div></section>`;
}

function renderFindings(t) {
  const out = [];
  const needTwo = (what) => section(`${what} needs at least two days of history`,
    `The history has ${t.days.length} day so far (${t.days[0]}). This section fills in as soon as a second daily run arrives.`,
    "it compares days, so it needs two or more.", "");

  // 1
  if (t.sinceFirst.length) {
    const up = t.sinceFirst[0], down = t.sinceFirst[t.sinceFirst.length - 1];
    const avg = sum(t.sinceFirst.map(s => s.pct)) / t.sinceFirst.length;
    out.push(section(
      up.pct > 0 ? `${esc(up.item)} rose the most in price since the first run (${fmtPct(up.pct)})` : `No record has risen in price since the first run`,
      `From ${up.fromDate} to ${up.toDate} the lowest asking price of ${esc(up.item)} went from ${usd(up.from)} to ${usd(up.to)} (${fmtPct(up.pct)}). ` +
      `The record that fell the most was ${esc(down.item)}, from ${usd(down.from)} to ${usd(down.to)} (${fmtPct(down.pct)}). ` +
      `Across the ${t.sinceFirst.length} records with at least two priced days the average change is ${fmtPct(avg)}.`,
      "for each record, (latest price − first price) ÷ first price × 100, using the first and the latest day on which it had a lowest price in history.csv.",
      hbars(t.sinceFirst.map(s => ({ label: s.item, value: s.pct })), v => fmtPct(v))));
  } else out.push(needTwo("The price change since the first run"));

  // 2
  if (t.daily.length) {
    const top = t.daily[0];
    out.push(section(
      `The biggest one-day price move was ${esc(top.item)} on ${top.date} (${fmtPct(top.pct)})`,
      `Its lowest asking price went from ${usd(top.from)} to ${usd(top.to)} in one day. Across all ${t.daily.length} price changes between consecutive days, ` +
      `the average size of a move (ignoring up or down) is ${(sum(t.daily.map(d => Math.abs(d.pct))) / t.daily.length).toFixed(1)}%, and ` +
      `${t.daily.filter(d => d.pct === 0).length} ${t.daily.filter(d => d.pct === 0).length === 1 ? "was" : "were"} no change at all.`,
      "for every record and every pair of consecutive days with a price, (price today − price before) ÷ price before × 100; the chart shows the ten largest by size.",
      hbars(t.daily.slice(0, 10).map(d => ({ label: `${d.item} (${d.date.slice(5)})`, value: d.pct })), v => fmtPct(v))));
  } else out.push(needTwo("The biggest one-day move"));

  // 3
  if (t.priced.length) {
    const hi = t.priced[0], lo = t.priced[t.priced.length - 1];
    const prices = t.priced.map(r => r.lowest_price);
    out.push(section(
      `Prices run from ${usd(lo.lowest_price)} to ${usd(hi.lowest_price)}, so the dearest record costs ${(hi.lowest_price / lo.lowest_price).toFixed(1)} times the cheapest`,
      `On ${t.last} the cheapest copy for sale is ${esc(lo.item)} at ${usd(lo.lowest_price)} and the most expensive is ${esc(hi.item)} at ${usd(hi.lowest_price)}. ` +
      `The middle price (median) is ${usd(median(prices))} and the average is ${usd(sum(prices) / prices.length)} across ${prices.length} records.`,
      "the lowest_price of every record on the latest day in history.csv, then the minimum, maximum, median and mean of those prices; the ratio is maximum ÷ minimum.",
      hbars(t.priced.map(r => ({ label: r.item, value: r.lowest_price })), usd, "#1d7a85")));
  }

  // 4
  if (t.demand.length) {
    const a = t.demand[0], z = t.demand[t.demand.length - 1];
    out.push(section(
      `${esc(a.item)} has the most collectors waiting: ${a.ratio.toFixed(0)} want it for every 100 who have it`,
      `${a.want.toLocaleString("en-US")} collectors want ${esc(a.item)} and ${a.have.toLocaleString("en-US")} have it. The lowest demand is for ${esc(z.item)}, ` +
      `at ${z.ratio.toFixed(0)} wants per 100 owners. The typical record (median) has ${median(t.demand.map(d => d.ratio)).toFixed(0)} wants per 100 owners.`,
      "on the latest day, want ÷ have × 100 for every record (collectors who want it per 100 collectors who own it); the chart shows the ten highest.",
      hbars(t.demand.slice(0, 10).map(d => ({ label: d.item, value: d.ratio })), v => v.toFixed(0))));
  }

  // 5
  if (t.stock.length) {
    const few = t.stock[0], many = t.stock[t.stock.length - 1];
    out.push(section(
      `Only ${few.num_for_sale} ${few.num_for_sale === 1 ? "copy" : "copies"} of ${esc(few.item)} ${few.num_for_sale === 1 ? "is" : "are"} for sale, against ${many.num_for_sale} of ${esc(many.item)}`,
      `Across the ${t.stock.length} records there are ${sum(t.stock.map(r => r.num_for_sale)).toLocaleString("en-US")} copies for sale in total, an average of ` +
      `${(sum(t.stock.map(r => r.num_for_sale)) / t.stock.length).toFixed(0)} per record (median ${median(t.stock.map(r => r.num_for_sale)).toFixed(0)}).`,
      "num_for_sale of every record on the latest day in history.csv; the chart shows the ten scarcest.",
      hbars(t.stock.slice(0, 10).map(r => ({ label: r.item, value: r.num_for_sale })), v => String(v), "#17161a")));
  }

  // 6
  if (t.rated.length) {
    const best = t.rated[0], worst = t.rated[t.rated.length - 1];
    out.push(section(
      `${esc(best.item)} is the highest rated at ${best.rating.toFixed(2)} stars`,
      `It has ${best.rating_votes.toLocaleString("en-US")} rating votes. The lowest rated is ${esc(worst.item)} at ${worst.rating.toFixed(2)} stars, so the whole range is only ` +
      `${(best.rating - worst.rating).toFixed(2)} stars. The average rating across ${t.rated.length} records is ${(sum(t.rated.map(r => r.rating)) / t.rated.length).toFixed(2)}.`,
      "the rating (average of Discogs members' votes, 0 to 5) of every record on the latest day in history.csv; the chart shows the ten highest.",
      hbars(t.rated.slice(0, 10).map(r => ({ label: r.item, value: r.rating })), v => v.toFixed(2), "#c58b00")));
  }
  return out.join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  let data;
  try { data = await loadData(); } catch (err) { showError(err); return; }
  const el = id => document.getElementById(id);
  const rows = data.rows;
  const t = computeTrends(rows);
  window.trendsResult = t;                              // handy for checking the numbers in the console
  if (!t.days.length) { el("intro").textContent = "No data yet."; return; }
  el("intro").textContent = `${t.days.length} day${t.days.length === 1 ? "" : "s"} of history (${t.days[0]} to ${t.last}), ${new Set(rows.map(r => r.item_id)).size} records.`;
  el("findings").innerHTML = renderFindings(t);

  // the chart of each value over the days, with a control that picks the records
  const items = [...new Map(rows.map(r => [r.item_id, r.item])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const topFive = t.priced.slice(0, 5).map(r => r.item_id);
  const state = { col: "lowest_price", chosen: new Set(topFive.length ? topFive : items.slice(0, 5).map(i => i[0])) };
  el("t-value").innerHTML = Object.entries(VALUES).map(([k, v]) => `<option value="${k}">${v.label} (${v.unit})</option>`).join("");

  function draw() {
    const color = new Map(items.filter(([id]) => state.chosen.has(id)).map(([id], i) => [id, PALETTE[i % PALETTE.length]]));
    el("picker").innerHTML = items.map(([id, name]) =>
      `<label class="chip${state.chosen.has(id) ? "" : " off"}" style="--c:${color.get(id) || "#bbb"}"><input type="checkbox" data-id="${esc(id)}" ${state.chosen.has(id) ? "checked" : ""}><i></i>${esc(name)}</label>`).join("");
    const lookup = new Map(rows.map(r => [r.date + "|" + r.item_id, r]));
    const series = items.filter(([id]) => state.chosen.has(id)).map(([id, name]) => ({
      label: name, color: color.get(id),
      values: t.days.map(d => { const r = lookup.get(d + "|" + id); return r ? r[state.col] : null; }),
    }));
    el("line-chart").innerHTML = lineChart(t.days, series, VALUES[state.col].fmt);
    el("line-note").textContent = `${VALUES[state.col].label} (${VALUES[state.col].unit}) for ${series.length} record${series.length === 1 ? "" : "s"}; a gap means the source reported no value that day.`;
  }
  el("t-value").addEventListener("input", () => { state.col = el("t-value").value; draw(); });
  el("picker").addEventListener("change", e => {
    const id = e.target.dataset.id;
    e.target.checked ? state.chosen.add(id) : state.chosen.delete(id);
    draw();
  });
  document.querySelectorAll("[data-pick]").forEach(b => b.addEventListener("click", () => {
    state.chosen = new Set(b.dataset.pick === "all" ? items.map(i => i[0]) : b.dataset.pick === "none" ? [] : topFive);
    draw();
  }));
  draw();
});
