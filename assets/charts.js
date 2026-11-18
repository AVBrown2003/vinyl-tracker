// Small hand-written SVG charts: a line chart over the days and horizontal bars.
const PALETTE = ["#d8412a", "#1d7a85", "#17161a", "#c58b00", "#6a4fb3", "#2e8b57", "#d1558a", "#3a6ea5", "#8c5a2b", "#7a8c1f"];

function niceStep(range, ticks) {
  const raw = range / ticks, pow = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}
const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;

// series: [{label, color, values: [number|null per day]}]
function lineChart(days, series, fmt) {
  const W = 900, H = 330, L = 64, R = 18, T = 14, B = 40;
  const vals = series.flatMap(s => s.values).filter(v => v !== null);
  if (!vals.length) return '<p class="note">Nothing to draw for this choice.</p>';
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const step = niceStep(hi - lo, 5);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x = i => L + (days.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (days.length - 1));
  const y = v => T + (hi - v) * (H - T - B) / (hi - lo);
  let g = "";
  for (let t = lo; t <= hi + step / 1000; t += step) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="#e4dccb"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(Math.round(t * 1e6) / 1e6)}</text>`;
  }
  const every = Math.max(1, Math.ceil(days.length / 8));
  days.forEach((d, i) => { if (i % every === 0 || i === days.length - 1) g += `<text x="${x(i)}" y="${H - 14}" text-anchor="middle">${d.slice(5)}</text>`; });
  series.forEach(s => {
    let d = "", pen = false;
    s.values.forEach((v, i) => { if (v === null) { pen = false; return; } d += (pen ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); pen = true; });
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>`;
    s.values.forEach((v, i) => { if (v !== null) g += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.2" fill="${s.color}"><title>${esc(s.label)} ${days[i]}: ${fmt(v)}</title></circle>`; });
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart over the days">${g}</svg>`;
}

// items: [{label, value, color?}]; fmt shows a value; bars start at zero (and go left for negatives)
function hbars(items, fmt, color = "#d8412a") {
  if (!items.length) return '<p class="note">Nothing to draw yet.</p>';
  const W = 900, LAB = 270, R = 90, row = 26, T = 6, H = items.length * row + T + 8;
  const lo = Math.min(0, ...items.map(i => i.value)), hi = Math.max(0, ...items.map(i => i.value));
  const span = hi - lo || 1;
  const x = v => LAB + (v - lo) * (W - LAB - R) / span;
  let g = `<line x1="${x(0)}" x2="${x(0)}" y1="${T}" y2="${H - 6}" stroke="#bdb49f"/>`;
  items.forEach((it, i) => {
    const yy = T + i * row, x0 = x(0), x1 = x(it.value), left = it.value < 0;
    g += `<text x="${LAB - 10}" y="${yy + 17}" text-anchor="end">${esc(cut(it.label, 40))}</text>` +
      `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${yy + 4}" width="${Math.max(1, Math.abs(x1 - x0)).toFixed(1)}" height="${row - 9}" rx="2" fill="${it.color || (left ? "#c0392b" : color)}"/>` +
      `<text x="${(left ? Math.min(x0, x1) - 6 : Math.max(x0, x1) + 6).toFixed(1)}" y="${yy + 17}" text-anchor="${left ? "end" : "start"}">${esc(fmt(it.value))}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${g}</svg>`;
}
