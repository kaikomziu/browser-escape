/* ===== ブラウザ脱出 — エンジン ===== */
(function () {
  const KEY = "browser-escape:v1";
  const ROOMS = window.ROOMS || [];
  const $ = (s) => document.querySelector(s);

  const screens = {
    title: $("#screen-title"),
    game: $("#screen-game"),
    clear: $("#screen-clear"),
  };

  const state = {
    room: 0,
    elapsedBase: 0, // ms of penalties + previously banked time
    runStart: 0, // Date.now() when current session timer started
    running: false,
    cleanup: null,
    hintShown: 0,
  };

  /* ---- save ---- */
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function persist() {
    try {
      const s = load();
      localStorage.setItem(
        KEY,
        JSON.stringify({
          room: state.room,
          elapsed: totalMs(),
          best: s.best || null,
        })
      );
    } catch (e) {}
  }
  function clearSave() {
    try {
      const s = load();
      localStorage.setItem(KEY, JSON.stringify({ best: s.best || null }));
    } catch (e) {}
  }
  function saveBest(ms) {
    try {
      const s = load();
      if (!s.best || ms < s.best) s.best = ms;
      localStorage.setItem(KEY, JSON.stringify(s));
      return s.best;
    } catch (e) {
      return ms;
    }
  }

  /* ---- time ---- */
  function totalMs() {
    return (
      state.elapsedBase + (state.running ? Date.now() - state.runStart : 0)
    );
  }
  function fmt(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(t / 60)).padStart(2, "0");
    const s = String(t % 60).padStart(2, "0");
    return m + ":" + s;
  }
  let timerIv = null;
  function startTimer() {
    state.runStart = Date.now();
    state.running = true;
    if (timerIv) clearInterval(timerIv);
    timerIv = setInterval(() => {
      $("#hud-timer").textContent = fmt(totalMs());
    }, 500);
    $("#hud-timer").textContent = fmt(totalMs());
  }
  function stopTimer() {
    if (state.running) {
      state.elapsedBase += Date.now() - state.runStart;
      state.running = false;
    }
    if (timerIv) clearInterval(timerIv);
  }

  /* ---- screens ---- */
  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo(0, 0);
  }

  /* ---- favicon: reflect progress ---- */
  function setFavicon(done) {
    const total = ROOMS.length;
    const pct = done / total;
    const bars = Array.from({ length: total }, (_, i) => {
      const on = i < done;
      const x = 1 + i * 1.85;
      return `<rect x='${x.toFixed(2)}' y='10' width='1.5' height='4' fill='${
        on ? "%235ef2b8" : "%232b3446"
      }'/>`;
    }).join("");
    const svg =
      `%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E` +
      `%3Crect width='16' height='16' fill='%230a0e14'/%3E` +
      `%3Crect x='1' y='1' width='14' height='4' fill='%232b3446'/%3E` +
      `%3Ccircle cx='3' cy='3' r='1.1' fill='${
        pct >= 1 ? "%235ef2b8" : "%23ff5f56"
      }'/%3E` +
      bars +
      `%3C/svg%3E`;
    let link = document.getElementById("favicon");
    if (link) link.href = "data:image/svg+xml," + svg;
    document.title =
      (pct >= 1 ? "脱出成功" : `[${done}/${total}]`) +
      " ブラウザ脱出 - ESCAPE THE BROWSER";
  }

  /* ---- HUD dots ---- */
  function renderDots() {
    const wrap = $("#hud-rooms");
    wrap.innerHTML = "";
    ROOMS.forEach((_, i) => {
      const d = document.createElement("span");
      d.className =
        "dot" +
        (i < state.room ? " done" : "") +
        (i === state.room ? " current" : "");
      wrap.appendChild(d);
    });
  }

  /* ---- feedback ---- */
  function say(msg, type) {
    const f = $("#room-feedback");
    f.textContent = msg || "";
    f.className = "room-feedback" + (type ? " " + type : "");
  }

  /* ---- room lifecycle ---- */
  function teardownRoom() {
    if (typeof state.cleanup === "function") {
      try {
        state.cleanup();
      } catch (e) {}
    }
    state.cleanup = null;
  }

  function enterRoom(i) {
    teardownRoom();
    state.room = i;
    state.hintShown = 0;
    persist();
    renderDots();
    setFavicon(i);

    if (i >= ROOMS.length) return finish();

    const room = ROOMS[i];
    $("#room-tag").textContent = "ROOM " + (i + 1) + " / " + ROOMS.length;
    $("#room-title").textContent = room.title;
    $("#room-flavor").textContent = room.flavor;
    const stage = $("#room-stage");
    stage.innerHTML = "";
    say("", "");
    $("#hint-box").hidden = true;
    $("#hint-box").textContent = "";
    $("#btn-hint").disabled = !(room.hints && room.hints.length);

    const api = {
      solve: () => {
        say("CLEAR", "ok");
        teardownRoom();
        setTimeout(() => enterRoom(i + 1), 550);
      },
      say: say,
      penalty: (sec) => {
        state.elapsedBase += sec * 1000;
        $("#hud-timer").textContent = fmt(totalMs());
        persist();
      },
      isMobile:
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (window.matchMedia && window.matchMedia("(pointer: coarse)").matches),
    };

    try {
      state.cleanup = room.init(stage, api) || null;
    } catch (e) {
      console.error("room init failed", e);
      say("この部屋の仕掛けが壊れている…（メニューからスキップ可）", "no");
    }
  }

  function finish() {
    stopTimer();
    teardownRoom();
    setFavicon(ROOMS.length);
    const ms = totalMs();
    const best = saveBest(ms);
    clearSave();
    state.room = 0;
    state.elapsedBase = 0;

    $("#clear-time").textContent = fmt(ms);
    $("#clear-rank").textContent = rank(ms);
    $("#clear-best").textContent =
      "ベスト: " + fmt(best) + (best === ms ? "（自己ベスト更新！）" : "");
    show("clear");
  }

  function rank(ms) {
    const m = ms / 60000;
    if (m < 3) return "S ── ブラウザの支配者";
    if (m < 5) return "A ── 熟練ユーザー";
    if (m < 8) return "B ── 一般ユーザー";
    if (m < 15) return "C ── まだ操作に慣れていない";
    return "D ── それでも、脱出はした";
  }

  /* ---- start / continue ---- */
  function newGame() {
    state.room = 0;
    state.elapsedBase = 0;
    clearSave();
    show("game");
    startTimer();
    enterRoom(0);
  }
  function continueGame() {
    const s = load();
    state.room = Math.min(s.room || 0, ROOMS.length - 1);
    state.elapsedBase = s.elapsed || 0;
    show("game");
    startTimer();
    enterRoom(state.room);
  }

  /* ---- menu modal ---- */
  const modal = $("#modal");
  function openModal() {
    renderChangelog();
    modal.hidden = false;
  }
  function closeModal() {
    modal.hidden = true;
  }
  function renderChangelog() {
    const box = $("#modal-changelog");
    const cl = window.CHANGELOG || [];
    box.innerHTML =
      '<h4>更新履歴　v' +
      (window.GAME_VERSION || "?") +
      "</h4><ul>" +
      cl
        .map(
          (e) =>
            '<li><span class="v">v' +
            e.v +
            "</span> <span class='tiny'>" +
            e.date +
            "</span><br>" +
            e.notes.map((n) => "・" + n).join("<br>") +
            "</li>"
        )
        .join("") +
      "</ul>";
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) return closeModal();
    const act = e.target.getAttribute("data-act");
    if (!act) return;
    if (act === "resume") closeModal();
    if (act === "skip") {
      closeModal();
      state.elapsedBase += 120000;
      say("この部屋をあきらめた。（+2:00）", "no");
      persist();
      enterRoom(state.room + 1);
    }
    if (act === "restart") {
      closeModal();
      stopTimer();
      newGame();
    }
    if (act === "title") {
      closeModal();
      stopTimer();
      teardownRoom();
      show("title");
      refreshTitle();
    }
  });

  /* ---- hints ---- */
  $("#btn-hint").addEventListener("click", () => {
    const room = ROOMS[state.room];
    if (!room || !room.hints) return;
    if (state.hintShown < room.hints.length) state.hintShown++;
    const box = $("#hint-box");
    box.hidden = false;
    box.textContent = room.hints
      .slice(0, state.hintShown)
      .map((h, i) => "ヒント" + (i + 1) + "： " + h)
      .join("\n\n");
    if (state.hintShown >= room.hints.length)
      $("#btn-hint").textContent = "ヒント（全部見た）";
    else $("#btn-hint").textContent = "ヒントをもう1つ";
  });

  /* ---- title ---- */
  function refreshTitle() {
    const s = load();
    const has = s.room && s.room > 0 && s.room < ROOMS.length;
    $("#btn-continue").hidden = !has;
    const tb = $("#title-best");
    if (s.best) {
      tb.hidden = false;
      tb.textContent = "ベスト脱出タイム: " + fmt(s.best);
    } else tb.hidden = true;
    setFavicon(has ? s.room : 0);
    document.documentElement.removeAttribute("data-theme");
    document.title = "ブラウザ脱出 - ESCAPE THE BROWSER";
  }

  /* ---- wire buttons ---- */
  $("#btn-start").addEventListener("click", newGame);
  $("#btn-continue").addEventListener("click", continueGame);
  $("#btn-menu").addEventListener("click", openModal);
  $("#btn-replay").addEventListener("click", () => {
    show("title");
    refreshTitle();
  });
  $("#btn-share").addEventListener("click", () => {
    const t = $("#clear-time").textContent;
    const txt =
      "「ブラウザ脱出 - ESCAPE THE BROWSER」を " +
      t +
      " で脱出した！ ランク: " +
      $("#clear-rank").textContent +
      "\nhttps://kaikomziu.github.io/browser-escape/";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(
        () => ($("#btn-share").textContent = "コピーした！"),
        () => prompt("コピーしてください", txt)
      );
    } else prompt("コピーしてください", txt);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  refreshTitle();
})();
