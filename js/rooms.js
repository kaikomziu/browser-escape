/* ===== ブラウザ脱出 — 部屋の定義 =====
   各部屋: { title, flavor, hints:[...], init(host, api) -> cleanup? }
   api = { solve(), say(msg,type), penalty(sec), isMobile }
*/
(function () {
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];
  const digits = (n) => Array.from({ length: n }, () => rand(10)).join("");

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---------- ROOM 1 : visibilitychange ---------- */
  const room1 = {
    title: "看守のいる部屋",
    flavor:
      "鉄格子の前で、看守（👁）がこちらをじっと見ている。\n" +
      "「お前がこの部屋を見ている限り、俺は決して目を閉じない」",
    hints: [
      "看守が反応しているのは“この部屋”＝いま開いているタブそのもの。",
      "別のタブやアプリに切り替えると、看守からは君が見えなくなる。",
      "合計で数秒間、このタブから目を離す（バックグラウンドにする）と看守は眠り込む。戻ってくれば鍵が奪える。",
    ],
    init(host, api) {
      const NEED = 3000;
      let acc = 0,
        since = null;
      host.appendChild(el("p", "readout", '看守の眠り: <b id="r1n">0.0</b> / 3.0 秒'));
      const g = el("div", "gauge", "<i></i>");
      host.appendChild(g);
      host.appendChild(
        el(
          "p",
          "tiny center",
          "ヒント: このタブを離れて、少ししてから戻ってくる。"
        )
      );
      const bar = g.querySelector("i");
      const num = host.querySelector("#r1n");
      const upd = () => {
        const v = Math.min(acc, NEED);
        bar.style.width = (v / NEED) * 100 + "%";
        num.textContent = (v / 1000).toFixed(1);
      };
      const onVis = () => {
        if (document.hidden) {
          since = Date.now();
          api.say("……看守が船を漕ぎ始めた。", "wait");
        } else {
          if (since) {
            acc += Date.now() - since;
            since = null;
          }
          upd();
          if (acc >= NEED) {
            api.say("看守は完全に眠っている。鍵をかすめ取った。", "ok");
            setTimeout(api.solve, 800);
          } else {
            api.say("まだ浅い眠りだ。もっと長く目を離せ。", "wait");
          }
        }
      };
      document.addEventListener("visibilitychange", onVis);
      return () => document.removeEventListener("visibilitychange", onVis);
    },
  };

  /* ---------- ROOM 2 : window width / resize ---------- */
  const room2 = {
    title: "狭くなる通路",
    flavor:
      "壁の亀裂。すき間はちょうど、この部屋の“横幅”と同じだけ空いている。\n" +
      "部屋が十分に細くなれば、体をすべり込ませられそうだ。",
    hints: [
      "“部屋の横幅”＝ブラウザウィンドウの幅。",
      "ウィンドウの端をドラッグして、横幅を 480px より狭くする。（最大化していると縮められないので解除）",
      "どうしても縮められない環境なら、下の「身をよじる」を長押しして無理やり通れる（時間ペナルティ）。",
    ],
    init(host, api) {
      const TARGET = 480;
      const start = window.innerWidth;
      host.appendChild(
        el("p", "readout", 'ウィンドウ幅: <b id="r2w">0</b> px　（目標: 480px 以下）')
      );
      const g = el("div", "gauge", "<i></i>");
      host.appendChild(g);
      const bar = g.querySelector("i");
      const num = host.querySelector("#r2w");
      let solved = false;
      const upd = () => {
        const w = window.innerWidth;
        num.textContent = w;
        // gauge: full at start width, empty at target
        const p = Math.max(
          0,
          Math.min(1, (w - TARGET) / Math.max(1, start - TARGET))
        );
        bar.style.width = 100 - p * 100 + "%";
        if (!solved && w <= TARGET) {
          solved = true;
          api.say("すき間に体がすべり込んだ。", "ok");
          setTimeout(api.solve, 700);
        }
      };
      const onResize = () => upd();
      window.addEventListener("resize", onResize);
      const pollIv = setInterval(upd, 500);

      // fallback: hold to squeeze
      const hold = el(
        "button",
        "hold-btn mt",
        '<i></i><span>身をよじって無理やり通る（長押し / +0:40）</span>'
      );
      host.appendChild(hold);
      let t = null,
        p = 0;
      const fill = hold.querySelector("i");
      const startHold = (e) => {
        e.preventDefault();
        if (solved) return;
        t = setInterval(() => {
          p += 0.025;
          fill.style.width = Math.min(100, p * 100) + "%";
          if (p >= 1) {
            clearInterval(t);
            solved = true;
            api.penalty(40);
            api.say("服は破れたが、通れた。（+0:40）", "ok");
            setTimeout(api.solve, 700);
          }
        }, 50);
      };
      const endHold = () => {
        if (t) clearInterval(t);
        if (p < 1) {
          p = 0;
          fill.style.width = "0%";
        }
      };
      hold.addEventListener("mousedown", startHold);
      hold.addEventListener("touchstart", startHold, { passive: false });
      hold.addEventListener("mouseup", endHold);
      hold.addEventListener("mouseleave", endHold);
      hold.addEventListener("touchend", endHold);

      upd();
      if (start <= TARGET) {
        // already narrow (typical on phones)
        solved = false;
        api.say("", "");
        setTimeout(() => {
          if (solved) return;
          solved = true;
          api.say("……あなたの部屋は、もとから狭かった。", "ok");
          setTimeout(api.solve, 900);
        }, 1100);
      }
      return () => {
        window.removeEventListener("resize", onResize);
        clearInterval(pollIv);
      };
    },
  };

  /* ---------- ROOM 3 : prefers-color-scheme / dark mode ---------- */
  const room3 = {
    title: "暗闇に浮かぶ碑文",
    flavor:
      "石板に、何かが彫られている。\n" +
      "明るい部屋ではただの石。だが、灯りを消すと文字が燐光を放つらしい。",
    hints: [
      "石板の文字は“暗い表示”のときだけ見える。",
      "下の照明スイッチをOFFにする（＝ダークモード）。OSの外観設定をダークにしても現れる。",
      "浮かび上がった3桁の数字を、キーパッドに入力する。",
    ],
    init(host, api) {
      const code = digits(3);
      const root = document.documentElement;
      const tablet = el(
        "div",
        "tablet",
        '<div class="engraved">' + code.split("").join(" ") + "</div>"
      );
      host.appendChild(tablet);
      const engraved = tablet.querySelector(".engraved");

      const sw = el("div", "switch-row");
      sw.appendChild(el("span", "tiny", "照明"));
      const lamp = el("div", "lampswitch");
      sw.appendChild(lamp);
      sw.appendChild(el("span", "tiny", "ON / OFF"));
      host.appendChild(sw);

      const prefersDark =
        !window.matchMedia ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = () => {
        const t = root.getAttribute("data-theme");
        if (t === "light") return false;
        if (t === "dark") return true;
        return prefersDark;
      };
      const refresh = () => {
        const d = isDark();
        engraved.classList.toggle("lit", d);
        lamp.classList.toggle("on", !d);
      };
      lamp.addEventListener("click", () => {
        root.setAttribute("data-theme", isDark() ? "light" : "dark");
        refresh();
      });
      const mq = window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
      const onMq = () => refresh();
      if (mq && mq.addEventListener) mq.addEventListener("change", onMq);

      const field = el("input", "code-field");
      field.readOnly = true;
      field.placeholder = "___";
      host.appendChild(field);
      const pad = el("div", "keypad");
      let buf = "";
      "1 2 3 4 5 6 7 8 9 ← 0 OK".split(" ").forEach((k) => {
        const b = el("button", null, k);
        b.addEventListener("click", () => {
          if (k === "←") buf = buf.slice(0, -1);
          else if (k === "OK") {
            if (buf === code) {
              api.say("石の扉が、ごとりと開いた。", "ok");
              setTimeout(api.solve, 700);
            } else {
              api.say("錠は動かない。", "no");
              buf = "";
            }
          } else if (buf.length < 3) buf += k;
          field.value = buf;
        });
        pad.appendChild(b);
      });
      host.appendChild(pad);

      refresh();
      return () => {
        if (mq && mq.removeEventListener) mq.removeEventListener("change", onMq);
      };
    },
  };

  /* ---------- ROOM 4 : @media print ---------- */
  const room4 = {
    title: "印刷室",
    flavor:
      "壁に額縁。中は空っぽに見える。\n" +
      "「この部屋の脱出経路図は、“印刷”したときにしか現れない」",
    hints: [
      "画面では見えない。印刷プレビュー（Ctrl+P）を開くと経路図が現れる。",
      "下のボタンでプレビューを開ける。矢印の並び順を覚える。",
      "プレビューを閉じて、同じ順に矢印ボタンを押す。うまく開けないときは「虫めがね」で画面に表示できる（時間ペナルティ）。",
    ],
    init(host, api) {
      const dirs = ["↑", "→", "↓", "←"];
      const seq = Array.from({ length: 4 }, () => pick(dirs));
      const pm = document.getElementById("pm-seq");
      if (pm) pm.textContent = seq.join("   ");

      const btn = el("button", "btn btn-ghost", "🖨 印刷プレビューを開く");
      btn.style.width = "100%";
      host.appendChild(btn);
      const inputWrap = el("div", "mt");
      host.appendChild(inputWrap);
      let revealed = false,
        prints = 0;

      const buildInput = () => {
        if (revealed) return;
        revealed = true;
        inputWrap.innerHTML = "";
        const view = el("div", "seq-view", "");
        inputWrap.appendChild(view);
        const row = el("div", "arrow-row");
        let buf = [];
        const redraw = () => (view.textContent = buf.join(" "));
        dirs.forEach((d) => {
          const b = el("button", null, d);
          b.addEventListener("click", () => {
            if (buf.length >= 4) buf = [];
            buf.push(d);
            redraw();
            if (buf.length === 4) {
              if (buf.join("") === seq.join("")) {
                api.say("隠し扉のラッチが外れた。", "ok");
                setTimeout(api.solve, 700);
              } else {
                api.say("経路が違う。壁に手が触れただけだ。", "no");
                setTimeout(() => {
                  buf = [];
                  redraw();
                }, 500);
              }
            }
          });
          row.appendChild(b);
        });
        inputWrap.appendChild(row);
        const clr = el("button", "btn btn-ghost mt", "入力しなおす");
        clr.style.width = "100%";
        clr.addEventListener("click", () => {
          buf = [];
          redraw();
        });
        inputWrap.appendChild(clr);
      };

      btn.addEventListener("click", () => {
        prints++;
        api.say("プレビューを表示中…（矢印の並びを覚えて）", "wait");
        try {
          window.print();
        } catch (e) {}
        // afterprint may not fire on some mobile browsers
        setTimeout(buildInput, 2500);
      });
      const onAfter = () => buildInput();
      window.addEventListener("afterprint", onAfter);

      // fallback
      let fb = null;
      const fbTimer = setTimeout(() => {
        fb = el(
          "button",
          "btn btn-ghost mt",
          "🔍 虫めがねを使って画面に映す（+0:45）"
        );
        fb.style.width = "100%";
        fb.addEventListener("click", () => {
          api.penalty(45);
          host.querySelector(".magnify")?.remove();
          const r = el(
            "p",
            "readout magnify mt",
            "経路図: <b>" + seq.join(" ") + "</b>（+0:45）"
          );
          host.appendChild(r);
          buildInput();
        });
        host.appendChild(fb);
      }, 45000);

      return () => {
        window.removeEventListener("afterprint", onAfter);
        clearTimeout(fbTimer);
      };
    },
  };

  /* ---------- ROOM 5 : location.hash ---------- */
  const room5 = {
    title: "住所のない扉",
    flavor:
      "扉に鍵穴がない。代わりに、かすれた文字。\n" +
      "「この部屋の“住所”のうしろに、呪文  escape  を書き加えよ」",
    hints: [
      "“住所”＝アドレスバーのURL。",
      "URLの末尾に  #escape  と打ち足して Enter。（例: …/browser-escape/#escape）",
      "下の欄に写経してもよい。書き込むとURLが変わり、扉が反応する。",
    ],
    init(host, api) {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (e) {
        location.hash = "";
      }
      host.appendChild(
        el(
          "p",
          "readout",
          '現在の住所の末尾: <b id="r5h">（なし）</b>'
        )
      );
      const out = host.querySelector("#r5h");
      const field = el("input", "spell-field mt");
      field.placeholder = "#escape";
      host.appendChild(field);
      const b = el("button", "btn btn-ghost mt", "写経して書き込む");
      b.style.width = "100%";
      host.appendChild(b);

      let solved = false;
      const check = () => {
        const h = (location.hash || "").toLowerCase();
        out.textContent = location.hash || "（なし）";
        if (!solved && /escape/.test(h)) {
          solved = true;
          api.say("呪文が住所に刻まれ、扉が消えた。", "ok");
          setTimeout(api.solve, 700);
        }
      };
      const onHash = () => check();
      window.addEventListener("hashchange", onHash);
      const write = () => {
        let v = field.value.trim();
        if (!v) v = "#escape";
        if (v[0] !== "#") v = "#" + v;
        location.hash = v;
        check();
      };
      b.addEventListener("click", write);
      field.addEventListener("keydown", (e) => {
        if (e.key === "Enter") write();
      });
      check();
      return () => window.removeEventListener("hashchange", onHash);
    },
  };

  /* ---------- ROOM 6 : zoom ---------- */
  const room6 = {
    title: "遠すぎる鍵盤",
    flavor:
      "対岸の壁に、小さすぎるキーパッド。数字も読めない。\n" +
      "近づく道はない。ならば、世界のほうを拡大しろ。",
    hints: [
      "ブラウザのズーム機能を使う。Ctrl と ＋（スマホはピンチアウト）。",
      "拡大率が 150% を超えると、キーパッドの数字が読めるようになり、押せるようになる。",
      "読み取った3桁を入力。ズームできない環境なら「目を凝らす」で代用（時間ペナルティ）。",
    ],
    init(host, api) {
      const code = digits(3);
      const baseDpr = window.devicePixelRatio || 1;
      host.appendChild(el("p", "readout", '拡大率: <b id="r6z">100</b>%'));
      const zt = el(
        "div",
        "zoom-target mt",
        '<div class="zt-label">遠くのパネル</div><div class="zt-code" id="r6c">? ? ?</div>'
      );
      zt.style.maxWidth = "120px";
      zt.style.transform = "scale(.55)";
      host.appendChild(zt);
      const zn = host.querySelector("#r6z");
      const zc = host.querySelector("#r6c");

      const padWrap = el("div", "mt");
      host.appendChild(padWrap);
      let padBuilt = false,
        unlocked = false,
        solved = false;

      const buildPad = () => {
        if (padBuilt) return;
        padBuilt = true;
        const field = el("input", "code-field");
        field.readOnly = true;
        field.placeholder = "___";
        padWrap.appendChild(field);
        const pad = el("div", "keypad");
        let buf = "";
        "1 2 3 4 5 6 7 8 9 ← 0 OK".split(" ").forEach((k) => {
          const bt = el("button", null, k);
          bt.addEventListener("click", () => {
            if (k === "←") buf = buf.slice(0, -1);
            else if (k === "OK") {
              if (buf === code) {
                api.say("遠くの錠が外れる音がした。", "ok");
                solved = true;
                setTimeout(api.solve, 700);
              } else {
                api.say("違う。", "no");
                buf = "";
              }
            } else if (buf.length < 3) buf += k;
            field.value = buf;
          });
          pad.appendChild(bt);
        });
        padWrap.appendChild(pad);
      };

      const factor = () => {
        const dpr = window.devicePixelRatio || 1;
        const vv = window.visualViewport ? window.visualViewport.scale : 1;
        return Math.max(dpr / baseDpr, vv || 1);
      };
      const upd = () => {
        if (solved) return;
        const f = factor();
        zn.textContent = Math.round(f * 100);
        if (!unlocked && f >= 1.5) {
          unlocked = true;
          zc.textContent = code.split("").join(" ");
          zc.style.color = "var(--accent)";
          api.say("数字が読める。キーパッドに手が届いた。", "ok");
          buildPad();
        }
      };
      const iv = setInterval(upd, 400);
      window.addEventListener("resize", upd);
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", upd);
        window.visualViewport.addEventListener("scroll", upd);
      }

      const fbTimer = setTimeout(() => {
        const fb = el(
          "button",
          "btn btn-ghost mt",
          "🔍 目を凝らして読み取る（+0:45）"
        );
        fb.style.width = "100%";
        fb.addEventListener("click", () => {
          api.penalty(45);
          unlocked = true;
          zc.textContent = code.split("").join(" ");
          zc.style.color = "var(--accent)";
          buildPad();
          fb.remove();
        });
        host.appendChild(fb);
      }, 45000);

      upd();
      return () => {
        clearInterval(iv);
        clearTimeout(fbTimer);
        window.removeEventListener("resize", upd);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener("resize", upd);
          window.visualViewport.removeEventListener("scroll", upd);
        }
      };
    },
  };

  /* ---------- ROOM 7 : navigator.onLine ---------- */
  const room7 = {
    title: "回線の部屋",
    flavor:
      "最後のひとつ手前の扉。表面が脈打つように光っている。\n" +
      "「この扉は、お前が世界と繋がっている限り、開かない」",
    hints: [
      "インターネット接続を切ると開く。",
      "PC: 開発者ツール → Network → “Offline”。または Wi-Fi / LANを一時的に切る。スマホ: 機内モード。",
      "切れない環境なら「ブレーカーを落とす」で代用（時間ペナルティ）。オフラインにしたら、あとで戻してOK。",
    ],
    init(host, api) {
      const pill = el(
        "div",
        "status-pill center",
        '<span class="led"></span><span id="r7s">オンライン</span>'
      );
      const wrap = el("div", "center");
      wrap.appendChild(pill);
      host.appendChild(wrap);
      host.appendChild(
        el(
          "p",
          "tiny center mt",
          "接続を切ると扉が開く。切ったあとは元に戻して大丈夫。"
        )
      );
      const label = host.querySelector("#r7s");
      let solved = false;
      const refresh = () => {
        const on = navigator.onLine;
        label.textContent = on ? "オンライン" : "オフライン";
        pill.classList.toggle("good", !on);
        if (!solved && !on) {
          solved = true;
          api.say("扉の光が消え、静かに開いた。", "ok");
          setTimeout(api.solve, 800);
        }
      };
      const onOff = () => refresh();
      window.addEventListener("offline", onOff);
      window.addEventListener("online", onOff);

      const fbTimer = setTimeout(() => {
        const fb = el(
          "button",
          "btn btn-ghost mt",
          "🔌 ブレーカーを落とす（+1:00）"
        );
        fb.style.width = "100%";
        fb.addEventListener("click", () => {
          api.penalty(60);
          solved = true;
          api.say("部屋が暗転し、扉が開いた。（+1:00）", "ok");
          setTimeout(api.solve, 700);
        });
        host.appendChild(fb);
      }, 30000);

      refresh();
      return () => {
        window.removeEventListener("offline", onOff);
        window.removeEventListener("online", onOff);
        clearTimeout(fbTimer);
      };
    },
  };

  /* ---------- ROOM 8 : history / back button ---------- */
  const room8 = {
    title: "振り出しの扉",
    flavor:
      "最後の部屋。目の前の壁に、扉はない。\n" +
      "「出口は“進む”先にはない。お前が“戻ってきた道”の中にある」",
    hints: [
      "前に進むのをやめて、うしろに戻る。",
      "ブラウザの「←（戻る）」ボタンを押す。",
      "キーボードなら Alt+← / Backspace。うまくいかなければ下のボタンで戻れる。",
    ],
    init(host, api) {
      try {
        history.pushState({ be: 1 }, "", location.pathname + location.search);
        history.pushState({ be: 2 }, "", location.pathname + location.search);
      } catch (e) {}
      host.appendChild(
        el(
          "p",
          "readout center",
          "ブラウザの <b>← 戻る</b> を押せ。"
        )
      );
      let done = false;
      const onPop = () => {
        if (done) return;
        done = true;
        try {
          history.pushState({ be: 3 }, "", location.pathname + location.search);
        } catch (e) {}
        api.say("……来た道を戻ると、そこに出口があった。", "ok");
        setTimeout(api.solve, 800);
      };
      window.addEventListener("popstate", onPop);

      const fb = el("button", "btn btn-ghost mt", "⬅ 戻る");
      fb.style.width = "100%";
      fb.addEventListener("click", () => history.back());
      host.appendChild(fb);

      return () => window.removeEventListener("popstate", onPop);
    },
  };

  window.ROOMS = [room1, room2, room3, room4, room5, room6, room7, room8];
})();
