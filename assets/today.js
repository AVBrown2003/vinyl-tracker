document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { status, rows } = await loadData();
    const el = id => document.getElementById(id);
    el("run-time").textContent = status.run_time.replace("T", " ").replace("Z", " UTC");
    el("n-days").textContent = status.days_with_success;
    el("n-items").textContent = status.items;
    el("about-n").textContent = status.items;
    el("n-new").textContent = status.new_today;
    el("n-gone").textContent = status.gone_today;

    el("sources").innerHTML = status.sources.map(s =>
      `<tr><td><strong>${esc(s.name)}</strong> <span class="sub">(Discogs API, JSON)</span></td><td class="num">${s.count}</td>` +
      `<td><span class="${s.ok ? "ok" : "fail"}" role="img" aria-label="${s.ok ? "Loaded" : "Failed"}" title="${s.ok ? "Loaded" : "Failed"}">${s.ok ? "✓" : "✗"}</span></td></tr>`).join("");

    const all = dates(rows);
    if (!all.length) { el("moves").innerHTML = '<li class="empty">No data yet.</li>'; return; }
    const latest = all[all.length - 1];
    const diff = compareDays(rows, latest);

    el("move-note").textContent = diff.previous
      ? `Compared with ${diff.previous}. A move is the percent change in the lowest asking price; the five biggest are listed, up or down.`
      : "This is the first run with data, so there is nothing to compare yet.";
    el("moves").innerHTML = diff.moves.length ? diff.moves.map(m =>
      `<li><div class="grow"><strong>${esc(m.item)}</strong><div class="sub">${fmtVal("lowest_price", m.old)} to ${fmtVal("lowest_price", m.now)} · ` +
      `copies for sale ${m.oldSale ?? "-"} to ${m.newSale ?? "-"}</div></div>` +
      `<span class="${m.pct > 0 ? "up" : "down"}">${fmtPct(m.pct)}</span></li>`).join("")
      : `<li class="empty">${diff.previous ? "No record's lowest price moved." : "Nothing to show yet."}</li>`;

    el("sellers").innerHTML = ["daily", "week", "month", "year", "decade"].map(k => {
      const g = collectorGains(windowRows(rows, k));
      const label = `<td><strong>${WINDOWS[k].label}</strong><div class="sub">${WINDOWS[k].text}</div></td>`;
      if (!g.length) return `<tr>${label}<td class="sub" colspan="3">Not enough history yet (needs two runs in the period).</td></tr>`;
      const top = g[0];
      return `<tr>${label}<td class="name"><div class="itemcell">${top.gain > 0 ? "" : ""}<strong>${esc(top.item)}</strong></div></td>` +
        `<td class="num up">${top.gain > 0 ? "+" : ""}${top.gain.toLocaleString("en-US")}</td><td class="sub">${top.fromDate} to ${top.toDate}</td></tr>`;
    }).join("");

    el("latest-note").textContent = `Values from the run on ${latest}.`;
    const today = rows.filter(r => r.date === latest).sort((a, b) => (b.lowest_price ?? -1) - (a.lowest_price ?? -1));
    el("latest").innerHTML = today.map(r => {
      const old = diff.before.get(r.item_id);
      const pct = old ? pctChange(old.lowest_price, r.lowest_price) : null;
      const cls = pct === null || Math.abs(pct) < 0.05 ? "flat" : pct > 0 ? "up" : "down";
      return `<tr><td class="name"><div class="itemcell">${sleeve(r)}<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.item)}</a></div></td>` +
        `<td class="num">${fmtVal("lowest_price", r.lowest_price)}</td><td class="num ${cls}">${fmtPct(pct)}</td>` +
        `<td class="num">${fmtVal("num_for_sale", r.num_for_sale)}</td><td class="num">${fmtVal("have", r.have)}</td>` +
        `<td class="num">${fmtVal("want", r.want)}</td><td class="num">${fmtVal("rating", r.rating)}</td></tr>`;
    }).join("");
  } catch (err) { showError(err); }
});
