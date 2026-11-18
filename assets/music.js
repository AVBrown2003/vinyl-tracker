// "Listen while you scroll": pick an album and its most popular song plays from YouTube while you browse.
// assets/music.json (made by make_music.py) says which song and which YouTube video go with each record.
(function () {
  const KEY = "vinyl-vault-music";
  const HOW = {
    top: "the album's most popular song",
    popular: "one of the album's most popular songs",
    listed: "a song from the album",
    album: "the whole album",
    chosen: "a hand-picked song from the album",
  };
  let songs = {}, order = [], current = null, player = null, apiPromise = null, volume = 70, shuffle = false, skipOnError = 0;

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ id: current, volume, shuffle })); } catch (e) { /* storage blocked */ } };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };

  function loadYouTube() {
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) return resolve();
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => { apiPromise = null; reject(new Error("YouTube could not be reached")); };
      document.head.appendChild(tag);
    });
    return apiPromise;
  }

  function status(text) { $("music-status").textContent = text; }

  function showNow() {
    const s = songs[current];
    if (!s) return;
    const url = typeof ITEM_URL !== "undefined" ? ITEM_URL.get(s.item) : null;
    $("music-now").innerHTML = `<strong>${esc(s.song)}</strong><span>${esc(s.artist)}, from <em>${esc(s.album)}</em></span>` +
      `<small>${esc(HOW[s.how] || "")}</small>` +
      `<span class="music-links"><a href="https://www.youtube.com/watch?v=${esc(s.video)}" target="_blank" rel="noopener">YouTube</a>` +
      (url ? ` · <a href="${esc(url)}" target="_blank" rel="noopener">Album on Discogs</a>` : "") + "</span>";
    $("music-input").value = s.item;
    document.querySelectorAll("[data-play]").forEach(b => b.classList.toggle("on", b.dataset.play === current));
  }

  // skipDir: 0 when you picked the album yourself (a video that fails just says so); 1 or -1 when the player
  // moved on by itself or you pressed next or previous (a video that fails is skipped in that direction)
  function play(id, skipDir = 0) {
    if (!songs[id]) return;
    current = id;
    skipOnError = skipDir;
    save();
    openPanel(true);
    showNow();
    status("Loading...");
    loadYouTube().then(() => {
      const s = songs[current];
      if (player) { player.loadVideoById(s.video); return; }
      player = new YT.Player("music-player", {
        width: "100%", height: "200", videoId: s.video, host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: e => { e.target.setVolume(volume); e.target.playVideo(); },
          onStateChange: e => {
            if (e.data === 1) status("Playing"); else if (e.data === 2) status("Paused"); else if (e.data === 3) status("Buffering...");
            $("music-play").textContent = e.data === 1 ? "⏸" : "▶";
            $("music-play").setAttribute("aria-label", e.data === 1 ? "Pause" : "Play");
            if (e.data === 0) step(1);                        // the song ended: on to the next album
          },
          onError: () => {
            if (skipOnError) { status("That video could not be played, skipping..."); setTimeout(() => step(skipOnError), 1200); }
            else status("YouTube will not play this one here. Use the YouTube link above to open it.");
          },
        },
      });
    }).catch(err => status(err.message));
  }

  function step(dir) {
    if (!order.length) return;
    let i;
    if (shuffle) i = Math.floor(Math.random() * order.length);
    else i = (Math.max(0, order.indexOf(current)) + dir + order.length) % order.length;
    play(order[i], dir || 1);
  }

  function openPanel(open) {
    $("music").classList.toggle("open", open);
    $("music-toggle").setAttribute("aria-expanded", open);
  }

  function build() {
    const box = document.createElement("aside");
    box.id = "music";
    box.className = "music";
    box.setAttribute("aria-label", "Listen while you scroll");
    box.innerHTML = `
      <button type="button" class="music-toggle" id="music-toggle" aria-expanded="false"><span class="music-disc" aria-hidden="true"></span>Listen while you scroll</button>
      <div class="music-panel" id="music-panel">
        <div class="music-head"><strong>Listen while you scroll</strong>
          <button type="button" class="music-min" id="music-min" aria-label="Minimize the player" title="Minimize">&#8211;</button></div>
        <label class="music-pick">Choose an album
          <input type="text" id="music-input" list="music-list" autocomplete="off" spellcheck="false" placeholder="Type or pick an album"></label>
        <datalist id="music-list">${order.map(id => `<option value="${esc(songs[id].item)}"></option>`).join("")}</datalist>
        <div class="music-video"><div id="music-player"></div></div>
        <div class="music-now" id="music-now" aria-live="polite">Pick an album and its most popular song plays here.</div>
        <div class="music-controls">
          <button type="button" id="music-prev" aria-label="Previous album">&#9198;</button>
          <button type="button" id="music-play" aria-label="Play">&#9654;</button>
          <button type="button" id="music-next" aria-label="Next album">&#9197;</button>
          <button type="button" id="music-shuffle" aria-pressed="false" title="Shuffle">&#128256;</button>
          <input type="range" id="music-volume" min="0" max="100" value="${volume}" aria-label="Volume">
        </div>
        <div class="music-status" id="music-status" role="status"></div>
        <p class="music-note">Songs play from YouTube, using the videos listed on each album's Discogs page. When a song ends, the next album starts.</p>
      </div>`;
    document.body.appendChild(box);

    $("music-toggle").addEventListener("click", () => openPanel(!$("music").classList.contains("open")));
    $("music-min").addEventListener("click", () => openPanel(false));
    $("music-prev").addEventListener("click", () => step(-1));
    $("music-next").addEventListener("click", () => step(1));
    $("music-shuffle").addEventListener("click", e => {
      shuffle = !shuffle; e.currentTarget.setAttribute("aria-pressed", shuffle); save();
    });
    $("music-play").addEventListener("click", () => {
      if (!player || !player.getPlayerState) { if (current) play(current); return; }
      player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo();
    });
    $("music-volume").addEventListener("input", e => { volume = +e.target.value; if (player && player.setVolume) player.setVolume(volume); save(); });
    const pick = () => {
      const typed = $("music-input").value.trim().toLowerCase();
      const hit = order.find(id => songs[id].item.toLowerCase() === typed);
      if (hit && hit !== current) play(hit);
    };
    $("music-input").addEventListener("change", pick);
    $("music-input").addEventListener("input", pick);                 // choosing from the list fires this with the full name
    document.addEventListener("click", e => {                         // the small play buttons beside records
      const b = e.target.closest("[data-play]");
      if (b) { e.preventDefault(); play(b.dataset.play); }
    });
  }

  // hide the small play buttons for records that have no song
  function tidyButtons() {
    document.querySelectorAll("[data-play]").forEach(b => {
      if (!songs[b.dataset.play]) b.remove(); else b.classList.toggle("on", b.dataset.play === current);
    });
  }

  async function start() {
    try {
      const res = await fetch("assets/music.json", { cache: "no-cache" });
      if (!res.ok) return;
      songs = await res.json();
    } catch (e) { return; }                                           // offline or missing: no player
    order = Object.keys(songs).sort((a, b) => songs[a].item.localeCompare(songs[b].item));
    if (!order.length) return;
    const saved = load();
    if (typeof saved.volume === "number") volume = saved.volume;
    shuffle = !!saved.shuffle;
    build();
    $("music-shuffle").setAttribute("aria-pressed", shuffle);
    if (saved.id && songs[saved.id]) { current = saved.id; showNow(); status("Press play to resume."); }
    tidyButtons();
    new MutationObserver(tidyButtons).observe(document.body, { childList: true, subtree: true });
    window.vaultMusic = { play };
  }

  document.addEventListener("DOMContentLoaded", start);
})();
