const STAR_KEY = "vinyl-tracker-shortlist";
function loadStars() {
  try { return new Set(JSON.parse(localStorage.getItem(STAR_KEY) || "[]")); } catch (e) { return new Set(); }
}
function saveStars(set) {
  try { localStorage.setItem(STAR_KEY, JSON.stringify([...set])); } catch (e) { /* storage blocked */ }
}

// every numeric column can be sorted up or down
const SORTABLE = ["year", "lowest_price", "num_for_sale", "have", "want", "rating", "rating_votes"];
const SHORT = { year: "Year", lowest_price: "Price", num_for_sale: "For sale", have: "Have", want: "Want", rating: "Rating", rating_votes: "Votes" };
const LABELS = { year: "Year", ...Object.fromEntries(Object.entries(VALUES).map(([k, v]) => [k, v.label])) };

document.addEventListener("DOMContentLoaded", async () => {
  let data;
  try { data = await loadData(); } catch (err) { showError(err); return; }
  const rows = data.rows;
  const el = id => document.getElementById(id);
  const all = dates(rows);
  if (!all.length) { el("count").textContent = "No data yet."; return; }
  const latest = rows.filter(r => r.date === all[all.length - 1]);
  el("browse-n").textContent = latest.length;
  el("q").placeholder = `Search the ${latest.length} records`;
  const stars = loadStars();
  const state = { scope: "all", col: "lowest_price", dir: "desc" };
  const decade = r => r.year === null ? "" : Math.floor(r.year / 10) * 10 + "s";

  const fill = (id, label, values) => {
    el(id).innerHTML = `<option value="">${label}</option>` +
      [...new Set(values.filter(Boolean))].sort().map(v => `<option>${esc(v)}</option>`).join("");
  };
  fill("f-artist", "All artists", latest.map(r => r.artist));
  fill("f-genre", "All genres", latest.map(r => r.genre));
  fill("f-decade", "Any decade", latest.map(decade));
  el("sort-col").innerHTML = SORTABLE.map(c => `<option value="${c}">${LABELS[c]}</option>`).join("");
  el("sort-col").value = state.col;

  el("head").innerHTML = '<th></th><th>Record</th>' + SORTABLE.map(c =>
    `<th class="num sortable" data-col="${c}" title="Sort by ${LABELS[c]}">${SHORT[c]}<span class="arrow"></span></th>`).join("");

  function render() {
    const artist = el("f-artist").value, genre = el("f-genre").value, dec = el("f-decade").value;
    const q = el("q").value.trim().toLowerCase();
    const maxPrice = el("f-price").value === "" ? null : Number(el("f-price").value);
    const list = latest.filter(r => {
      if (state.scope === "star" && !stars.has(r.item_id)) return false;
      if (artist && r.artist !== artist) return false;
      if (genre && r.genre !== genre) return false;
      if (dec && decade(r) !== dec) return false;
      if (maxPrice !== null && (r.lowest_price === null || r.lowest_price > maxPrice)) return false;
      if (q && !r.item.toLowerCase().includes(q)) return false;
      return true;
    });
    const sign = state.dir === "desc" ? -1 : 1;
    list.sort((a, b) => {
      const x = a[state.col], y = b[state.col];
      if (x === null && y === null) return a.item.localeCompare(b.item);
      if (x === null) return 1;                      // records with no value go last either way
      if (y === null) return -1;
      return sign * (x - y) || a.item.localeCompare(b.item);
    });
    el("count").textContent = `${list.length} record${list.length === 1 ? "" : "s"} (values from ${all[all.length - 1]})`;
    el("head").querySelectorAll("th.sortable").forEach(th => {
      th.querySelector(".arrow").textContent = th.dataset.col === state.col ? (state.dir === "desc" ? "▼" : "▲") : "";
    });
    el("sort-col").value = state.col;
    el("sort-dir").value = state.dir;
    el("results").innerHTML = list.length ? list.map(r => {
      const starred = stars.has(r.item_id);
      return `<tr><td><button class="star" type="button" data-id="${esc(r.item_id)}" aria-pressed="${starred}" ` +
        `aria-label="${starred ? "Remove from" : "Add to"} shortlist" title="Shortlist">${starred ? "★" : "☆"}</button></td>` +
        `<td class="name"><div class="itemcell">${sleeve(r)}<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.item)}</a></div>` +
        `<div class="sub">${esc(r.genre || "")}${r.country ? " · " + esc(r.country) + " pressing" : ""}</div></td>` +
        `<td class="num">${r.year ?? "-"}</td>` + ["lowest_price", "num_for_sale", "have", "want", "rating", "rating_votes"]
          .map(c => `<td class="num">${fmtVal(c, r[c])}</td>`).join("") + "</tr>";
    }).join("") : `<tr><td colspan="9" class="sub" style="padding:18px">${state.scope === "star" ? "Nothing starred yet. Star a record to save it here." : "No records match these filters."}</td></tr>`;
  }

  el("results").addEventListener("click", e => {
    const btn = e.target.closest(".star");
    if (!btn) return;
    const id = btn.dataset.id;
    stars.has(id) ? stars.delete(id) : stars.add(id);
    saveStars(stars);
    render();
  });
  el("head").addEventListener("click", e => {
    const th = e.target.closest("th.sortable");
    if (!th) return;
    if (state.col === th.dataset.col) state.dir = state.dir === "desc" ? "asc" : "desc";
    else { state.col = th.dataset.col; state.dir = "desc"; }
    render();
  });
  el("scope").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    state.scope = b.dataset.v;
    el("scope").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
    render();
  });
  el("sort-col").addEventListener("input", () => { state.col = el("sort-col").value; render(); });
  el("sort-dir").addEventListener("input", () => { state.dir = el("sort-dir").value; render(); });
  ["q", "f-artist", "f-genre", "f-decade", "f-price"].forEach(id => el(id).addEventListener("input", render));
  render();
});
