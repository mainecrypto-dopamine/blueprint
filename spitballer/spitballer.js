/*!
 * Spitballer · a voice secretary you can drop into any app.
 * Tap the gun, talk, tap again to fire. It opens pages, answers questions from your app's data,
 * or turns a ramble into tidy notes.
 *
 *   <script src="spitballer.js"></script>
 *   <script>
 *     Spitballer.mount({
 *       app: "Let's Roll",                       // shown to Claude so it knows the context
 *       user: () => "Isaac",                      // who is talking
 *       pages: [                                  // what can be opened by voice
 *         { id: "map", label: "Map", words: ["map", "where", "route"], open: () => location.hash = "map" },
 *         { id: "orders", label: "Orders", words: ["orders", "buy"], href: "#orders" }
 *       ],
 *       snapshot: () => "Today: ...\nOrders: ...",   // plain text of your data, for answering questions
 *       onNote: async note => { },                // save it: {text, by, at, tidy:{title,summary,todos,ideas,...}}
 *       onTidy: async note => { },                // optional: called again when Claude's tidy version is ready
 *       mode: "button"                            // "button" = floating 🎯 that opens a sheet; "inline" = render into opts.el
 *     });
 *   </script>
 *
 * Works in Claude artifacts (dictation, tts, sample capabilities) and on any normal website
 * (browser SpeechRecognition / speechSynthesis; pass opts.claude = async (prompt) => json for answers).
 */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const NUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const GUN = `<svg viewBox="0 0 240 120" aria-hidden="true" class="sb-gun"><defs><linearGradient id="sbg" x1="0" x2="1"><stop offset="0" stop-color="#8a6d3b"/><stop offset="1" stop-color="#d9b56d"/></linearGradient></defs><rect x="18" y="50" width="160" height="20" rx="10" fill="url(#sbg)"/><rect x="160" y="46" width="22" height="28" rx="6" fill="#d9b56d"/><circle cx="30" cy="60" r="16" fill="#2a2a2a" stroke="#d9b56d" stroke-width="3"/><g class="sb-ball"><circle cx="200" cy="60" r="9" fill="#e8e2d6"/><circle cx="197" cy="57" r="3" fill="#fff" opacity=".8"/></g><g class="sb-trail" fill="#e8e2d6"><circle cx="214" cy="54" r="2.5"/><circle cx="222" cy="64" r="2"/><circle cx="230" cy="58" r="1.6"/></g></svg>`;
  const CSS = `.sb{--sb-gold:#d9b56d;--sb-ink:#f3efe7;--sb-mute:#9c968d;--sb-bg:#151515;--sb-card:#1d1d1d;--sb-line:#2c2c2c;--sb-bad:#e5484d;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:var(--sb-ink);max-width:560px;margin:0 auto}
.sb h2{font-size:28px;margin:2px 0;text-align:center}.sb .sb-sub{color:var(--sb-mute);text-align:center;margin:0 0 10px}.sb .sb-kick{color:var(--sb-mute);text-align:center;font-size:12px;letter-spacing:.08em;margin:0}
.sb-btn{display:flex;flex-direction:column;align-items:center;gap:4px;margin:6px auto;width:100%;max-width:360px;padding:14px 10px 12px;border-radius:22px;border:2px solid var(--sb-gold);background:var(--sb-card);color:var(--sb-ink);font:inherit;cursor:pointer}
.sb-btn span{font-size:14px;color:var(--sb-mute)}.sb-gun{width:240px;max-width:90%;height:auto}.sb-trail{opacity:0}.sb-btn.on{border-color:var(--sb-bad);background:rgba(229,72,77,.14)}.sb-btn.on span{color:var(--sb-ink);font-weight:700}
.sb-btn.on .sb-gun{animation:sbw .5s ease-in-out infinite alternate}@keyframes sbw{to{transform:translateY(-3px) rotate(-1.5deg)}}.sb-btn.shot .sb-ball{animation:sbf .8s ease-out forwards}.sb-btn.shot .sb-trail{animation:sbt .8s ease-out}
@keyframes sbf{to{transform:translateX(70px);opacity:0}}@keyframes sbt{30%{opacity:1}to{opacity:0;transform:translateX(30px)}}
.sb-part{color:var(--sb-mute);text-align:center;min-height:18px;margin:4px 0}.sb textarea{width:100%;box-sizing:border-box;min-height:84px;background:var(--sb-card);color:var(--sb-ink);border:1px solid var(--sb-line);border-radius:12px;padding:10px;font:inherit}
.sb-fire{display:block;width:100%;padding:15px;margin-top:10px;border:0;border-radius:12px;background:var(--sb-gold);color:#111;font:600 18px system-ui,sans-serif;cursor:pointer}.sb-msg{text-align:center;color:var(--sb-mute);min-height:18px}
.sb-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin:8px 0}.sb-tile{display:flex;flex-direction:column;gap:2px;padding:12px;border:1px solid var(--sb-gold);border-radius:14px;background:var(--sb-card);color:var(--sb-ink);text-decoration:none;cursor:pointer;font:inherit;text-align:left}.sb-tile b{font-size:16px}.sb-tile small{color:var(--sb-gold)}
.sb-ans{border:1px solid var(--sb-gold);border-radius:14px;background:var(--sb-card);padding:12px 14px;margin:8px 0;font-size:16px}.sb-ans ul{margin:6px 0 0;padding-left:18px}.sb-ans li{margin:2px 0}
.sb-fab{position:fixed;right:18px;bottom:84px;width:58px;height:58px;border-radius:50%;border:0;background:#d9b56d;color:#111;font-size:27px;box-shadow:0 6px 20px rgba(0,0,0,.45);z-index:9998;cursor:pointer}
.sb-sheet{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:none;align-items:flex-end;justify-content:center}.sb-sheet.on{display:flex}.sb-sheet>.sb{background:#111;border-radius:22px 22px 0 0;padding:18px 16px 26px;width:100%;max-width:600px;max-height:92vh;overflow:auto;box-sizing:border-box}
.sb-x{float:right;background:none;border:0;color:#9c968d;font-size:22px;cursor:pointer}`;

  async function capability(name) { try { return window.claude && window.claude.use ? await window.claude.use(name) : null; } catch (e) { return null; } }

  function browserDictation(langOf) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return null;
    let rec = null, want = false, P = () => {}, F = () => {}, St = () => {};
    return {
      start() { return new Promise((res, rej) => { try { want = true; rec = new SR(); rec.lang = langOf(); rec.interimResults = true; rec.continuous = true;
        rec.onresult = e => { let p = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) F({ text: x[0].transcript.trim() }); else p += x[0].transcript; } P({ text: p }); };
        rec.onend = () => { if (want) { try { rec.start(); return; } catch (e) {} } St({ state: "idle", reason: "stopped" }); };
        rec.onerror = e => { if (/not-allowed/.test(e.error)) { want = false; St({ state: "idle", reason: "not_granted" }); } };
        rec.start(); St({ state: "listening" }); res(); } catch (e) { want = false; rej(e); } }); },
      async stop() { want = false; try { rec && rec.stop(); } catch (e) {} }, onPartial(f) { P = f; }, onFinal(f) { F = f; }, onState(f) { St = f; }
    };
  }
  function browserVoice() { if (!window.speechSynthesis) return null; return { speak(t) { return new Promise(r => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t).slice(0, 2000)); u.lang = /[฀-๿]/.test(t) ? "th-TH" : /[က-႟]/.test(t) ? "my-MM" : "en-US"; u.onend = u.onerror = () => r(); speechSynthesis.speak(u); } catch (e) { r(); } }); } }; }

  function mount(o) {
    o = Object.assign({ app: "this app", user: () => "", pages: [], snapshot: () => "", mode: "button", lang: "en-US", title: "What do you need?", subtitle: "Talk. Ask for a page, ask a question, or ramble a note.", noteWords: 12 }, o || {});
    if (!document.getElementById("sb-css")) { const st = document.createElement("style"); st.id = "sb-css"; st.textContent = CSS; document.head.appendChild(st); }
    let DICT = null, TTS = null, SAMPLE = null, on = false, fire = false;
    const root = document.createElement("div"); root.className = "sb";
    root.innerHTML = `${o.mode === "button" ? '<button class="sb-x" data-sb="x" aria-label="Close">✕</button>' : ""}<p class="sb-kick">🎯 THE SPITBALLER</p><h2>${esc(o.title)}</h2><p class="sb-sub">${esc(o.subtitle)}</p>
      <button class="sb-btn" data-sb="mic" type="button">${GUN}<span>Tap to load, then talk</span></button><p class="sb-part"></p><div class="sb-res"></div>
      <textarea placeholder="Your words show up here. You can type too."></textarea><button class="sb-fire" data-sb="fire" type="button">🎯 Fire</button><p class="sb-msg"></p>`;
    const $ = s => root.querySelector(s), ta = $("textarea"), btn = $(".sb-btn"), msg = $(".sb-msg"), res = $(".sb-res");
    let sheet = null, fab = null;
    if (o.mode === "button") {
      sheet = document.createElement("div"); sheet.className = "sb-sheet"; sheet.appendChild(root); document.body.appendChild(sheet);
      fab = document.createElement("button"); fab.className = "sb-fab"; fab.textContent = "🎯"; fab.title = "Spitballer"; document.body.appendChild(fab);
      fab.onclick = () => sheet.classList.add("on"); sheet.addEventListener("click", e => { if (e.target === sheet) sheet.classList.remove("on"); });
    } else (typeof o.el === "string" ? document.querySelector(o.el) : o.el).appendChild(root);
    const close = () => sheet && sheet.classList.remove("on");

    (async () => {
      DICT = (await capability("dictation")) || browserDictation(() => o.lang);
      TTS = (await capability("tts")) || browserVoice();
      SAMPLE = await capability("sample");
      if (!DICT) { btn.querySelector("span").textContent = "Tap the 🎤 on your keyboard, talk, then fire."; btn.style.borderStyle = "dashed"; }
      else {
        DICT.onPartial(({ text }) => { $(".sb-part").textContent = text; });
        DICT.onFinal(({ text }) => { ta.value = (ta.value.trim() ? ta.value.trim() + " " : "") + text; $(".sb-part").textContent = ""; tiles(route(ta.value)); });
        DICT.onState(({ state }) => { on = state === "listening"; btn.classList.toggle("on", on); btn.querySelector("span").textContent = on ? "Listening… tap to FIRE" : "Tap to load, then talk"; if (!on && fire) { fire = false; setTimeout(done, 150); } });
      }
    })();

    const say = t => { try { TTS && TTS.speak(t).catch(() => {}); } catch (e) {} };
    const ask = async prompt => { if (o.claude) return o.claude(prompt); if (SAMPLE) return SAMPLE.json(prompt); return null; };
    function route(text) {
      const s = String(text || "").toLowerCase(), out = [];
      for (const p of o.pages) { const ws = [p.label, p.id, ...(p.words || [])].filter(Boolean);
        if (ws.some(w => w instanceof RegExp ? w.test(s) : new RegExp("\\b" + String(w).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "s?\\b").test(s))) out.push(p); }
      if (o.match) { const extra = o.match(s, NUM) || []; extra.forEach(p => { if (!out.includes(p)) out.unshift(p); }); }
      return out.slice(0, 6);
    }
    function open(p) { close(); if (p.open) p.open(); else if (p.href) location.href = p.href; }
    function tiles(P, answer) {
      res.innerHTML = (answer ? `<div class="sb-ans">${answer}</div>` : "") + (P.length ? `<div class="sb-tiles">${P.map((p, i) => `<button class="sb-tile" data-sb-i="${i}"><span>${esc(p.icon || "›")}</span><b>${esc(p.label)}</b><small>Open →</small></button>`).join("")}</div>` : "");
      res.querySelectorAll("[data-sb-i]").forEach(b => b.onclick = () => open(P[+b.dataset.sbI]));
    }
    const isQ = s => /\?\s*$|^\s*(what|what's|how|when|where|which|who|why|is|are|do|does|did|can|could|should|tell me|give me|any)\b|ไหม|อะไร|เท่าไร|กี่|เมื่อไร|ที่ไหน|ใคร/i.test(s);

    async function done() {
      const text = ta.value.trim(); if (!text) return; const P = route(text), words = text.split(/\s+/).length;
      if (isQ(text) && !(P.length === 1 && words <= 5) && (o.claude || SAMPLE)) return answer(text);
      if (P.length === 1 && words <= o.noteWords) { msg.textContent = "Opening " + P[0].label + "…"; say("Opening " + P[0].label); ta.value = ""; setTimeout(() => open(P[0]), 400); return; }
      if (P.length && words <= o.noteWords) { tiles(P); msg.textContent = "Here you go. Tap one."; say("Here you go"); return; }
      return note(text);
    }
    async function answer(text) {
      res.innerHTML = `<div class="sb-ans" style="color:#9c968d">Looking it up…</div>`; ta.value = "";
      try {
        const out = await ask(`You are the voice secretary for ${o.app}. ${o.user() || "Someone"} asked (speech-to-text, may be misheard, any language): "${text.slice(0, 600)}"
Answer from the app data below only. If it isn't there, say so plainly. 1-3 sentences, easy to read aloud, same language they asked in. Pick pages that show it.
Pages: ${o.pages.map(p => p.id + "=" + p.label).join(", ")}
Return JSON only: {"answer":"","pages":["page id"]}

APP DATA:
${String(o.snapshot() || "").slice(0, 14000)}`);
        const a = (out && out.answer) || "Sorry, I couldn't find that."; const P = ((out && out.pages) || []).map(id => o.pages.find(p => p.id === id)).filter(Boolean).slice(0, 4);
        tiles(P, esc(a)); say(a); o.onAsk && o.onAsk({ text, answer: a, by: o.user(), at: Date.now() });
      } catch (e) { res.innerHTML = `<div class="sb-ans">Couldn't look that up right now.</div>`; }
    }
    async function note(text) {
      const n = { id: "sb" + Date.now().toString(36), text, by: o.user(), at: Date.now(), tidy: null };
      try { o.onNote && await o.onNote(n); } catch (e) { msg.textContent = "Couldn't save: " + (e && e.message || e); return; }
      ta.value = ""; btn.classList.add("shot"); setTimeout(() => btn.classList.remove("shot"), 900); msg.textContent = "🎯 Fired."; say("Got it. Noted.");
      if (!(o.claude || SAMPLE)) return;
      try {
        const out = await ask(`Tidy this note for ${o.app}. It was spoken (speech-to-text, any language) by ${n.by || "a team member"} and may ramble. Today is ${new Date().toISOString().slice(0, 10)}.
Return JSON only: {"title":"max 8 words","summary":"1-3 plain sentences","todos":[{"what":"","who":"","due":"YYYY-MM-DD or \\"\\""}],"ideas":[""],"decisions":[""],"orders":[{"item":"","qty":""}],"questions":[""]}
Note:\n"""${text.slice(0, 6000)}"""`);
        n.tidy = out || {}; const t = n.tidy, L = (a, f) => (a || []).length ? a.map(f).join("") : "";
        tiles([], `<b>${esc(t.title || "Note")}</b><br>${esc(t.summary || "")}<ul>${L(t.todos, x => `<li>☐ ${esc(x.what)}${x.due ? " · " + esc(x.due) : ""}</li>`)}${L(t.ideas, x => `<li>💡 ${esc(x)}</li>`)}${L(t.decisions, x => `<li>✔ ${esc(x)}</li>`)}${L(t.orders, x => `<li>🛒 ${esc(x.item)} ${esc(x.qty || "")}</li>`)}${L(t.questions, x => `<li>❓ ${esc(x)}</li>`)}</ul>`);
        o.onTidy && await o.onTidy(n);
      } catch (e) {}
    }

    root.addEventListener("click", e => { const b = e.target.closest("[data-sb]"); if (!b) return; const k = b.dataset.sb;
      if (k === "x") return close();
      if (k === "mic") { if (!DICT) return; if (on) { fire = true; DICT.stop().catch(() => {}); } else { fire = false; DICT.start().catch(() => {}); } }
      if (k === "fire") { if (DICT && on) { fire = true; DICT.stop().catch(() => {}); } else done(); } });
    ta.addEventListener("input", () => tiles(route(ta.value)));
    return { open: () => sheet && sheet.classList.add("on"), close, route, destroy() { root.remove(); sheet && sheet.remove(); fab && fab.remove(); } };
  }
  window.Spitballer = { mount };
})();
