/* Blueprint HQ backend (based on the Let's Roll / Lunchbox HQ kit).
   Supabase stands in for the capabilities the app used inside Claude:
   window.claude.use("db" | "user" | "sample" | "assets" | "downloads") with the same shape the app expects.
   A sign-in screen shows until a team member is logged in. After that, Blueprint's own
   "Who's working?" name + PIN screen picks the person. */
(function () {
  if (window.BP_OFFLINE) return;               // offline copies run on their own built-in data
  const cfg = window.LR_CONFIG || {};
  const ready = cfg.supabaseUrl && cfg.supabaseAnonKey && !/YOUR_/.test(cfg.supabaseUrl + cfg.supabaseAnonKey);
  const sb = ready && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const BUCKET = "assets";

  let session = null, member = null, loaded = false;
  const cache = new Map();
  const listeners = new Set();
  const collOf = p => p.slice(0, p.lastIndexOf("/"));
  const rid = (n = 20) => (crypto.randomUUID ? crypto.randomUUID() + crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, n);
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const meta = () => ({ fromCache: !loaded, hasPendingWrites: false });

  function snapDoc(path) { const v = cache.get(path); return { id: path.split("/").pop(), exists: v !== undefined, data: () => clone(v), metadata: meta() }; }
  const OPS = { "==": (a, b) => a === b, "!=": (a, b) => a !== b, "<": (a, b) => a < b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, ">=": (a, b) => a >= b,
    "in": (a, b) => (b || []).includes(a), "not-in": (a, b) => !(b || []).includes(a), "array-contains": (a, b) => Array.isArray(a) && a.includes(b) };
  function snapColl(coll, q) {
    q = q || {};
    let paths = [...cache.keys()].filter(p => collOf(p) === coll);
    (q.where || []).forEach(([f, op, v]) => { const fn = OPS[op]; if (fn) paths = paths.filter(p => fn((cache.get(p) || {})[f], v)); });
    if (q.order) { const [f, dir] = q.order, k = dir === "desc" ? -1 : 1;
      paths.sort((a, b) => { const x = (cache.get(a) || {})[f], y = (cache.get(b) || {})[f];
        if (x === undefined && y === undefined) return a < b ? -1 : 1; if (x === undefined) return 1; if (y === undefined) return -1;
        return x < y ? -k : x > y ? k : (a < b ? -1 : 1); }); }
    else paths.sort();
    if (q.limit) paths = paths.slice(0, q.limit);
    const docs = paths.map(snapDoc);
    return { docs, size: docs.length, empty: !docs.length, metadata: meta(), docChanges: () => [] };
  }
  function emit() { listeners.forEach(l => { try { l(); } catch (e) { console.error(e); } }); }

  async function loadAll() {
    const rows = [];
    for (let from = 0; ; from += 1000) {                 // page through: Supabase returns 1000 rows max
      const { data, error } = await sb.from("docs").select("path,data").range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    cache.clear();
    rows.forEach(r => cache.set(r.path, r.data));
    loaded = true;
    emit();
  }
  function goLive() {
    sb.channel("docs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, p => {
        if (p.eventType === "DELETE") cache.delete(p.old.path); else cache.set(p.new.path, p.new.data);
        emit();
      })
      .subscribe(st => { if (st === "SUBSCRIBED") loadAll().catch(console.error); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadAll().catch(() => {}); });
    setInterval(() => { if (document.visibilityState === "visible") loadAll().catch(() => {}); }, 30000);
  }

  const fail = e => { throw { code: "invalid_argument", message: (e && e.message) || "Not allowed" }; };
  async function write(path, data) {
    cache.set(path, clone(data)); emit();
    const { error } = await sb.from("docs").upsert({ path, coll: collOf(path), data, updated_at: new Date().toISOString() });
    if (error) { await loadAll().catch(() => {}); fail(error); }
  }
  async function remove(path) {
    cache.delete(path); emit();
    const { error } = await sb.from("docs").delete().eq("path", path);
    if (error) { await loadAll().catch(() => {}); fail(error); }
  }
  function listen(make, next) { const l = () => next(make()); listeners.add(l); if (loaded) setTimeout(l, 0); return () => listeners.delete(l); }
  function docRef(path) {
    return {
      id: path.split("/").pop(), path,
      get: async () => snapDoc(path),
      set: d => write(path, d),
      update: async d => { const cur = cache.get(path); if (cur === undefined) fail({ message: "Missing document" }); return write(path, Object.assign({}, cur, d)); },
      delete: () => remove(path),
      onSnapshot: next => listen(() => snapDoc(path), next),
      collection: c => collRef(path + "/" + c)
    };
  }
  function query(coll, st) {
    return {
      get: async () => snapColl(coll, st),
      onSnapshot: next => listen(() => snapColl(coll, st), next),
      where: (f, op, v) => query(coll, { ...st, where: [...(st.where || []), [f, op, v]] }),
      orderBy: (f, dir) => query(coll, { ...st, order: [f, dir || "asc"] }),
      limit: n => query(coll, { ...st, limit: n })
    };
  }
  function collRef(coll) {
    return Object.assign(query(coll, {}), { path: coll, doc: id => docRef(coll + "/" + (id || rid())), add: async d => { const r = docRef(coll + "/" + rid()); await r.set(d); return r; } });
  }
  const db = { doc: docRef, collection: collRef };

  const user = {
    isOwner: async () => member?.role === "owner",
    canEdit: async () => !!member,
    can: async () => !!member,
    id: async () => session?.user?.id || null,
    me: async () => ({ id: session?.user?.id, name: member?.name || "" }),
    profiles: async ids => Object.fromEntries((ids || []).map(i => [i, { name: "" }]))
  };

  /* ---------- files: photos and documents in Supabase Storage (served at /_blob/<id>, see vercel.json) ---------- */
  const assets = {
    upload: async (file) => {
      const id = rid(32), contentType = file.type || "application/octet-stream";
      const { error } = await sb.storage.from(BUCKET).upload(id, file, { contentType, upsert: false, cacheControl: "31536000" });
      if (error) fail(error);
      return { id, url: "/_blob/" + id, contentType, size: file.size };
    }
  };
  window.lrBlobUrl = id => cfg.supabaseUrl + "/storage/v1/object/public/" + BUCKET + "/" + encodeURIComponent(id);
  // Bring the starting files over (owner, ☰ → Import files): each file is named <id>.<ext>
  window.lrImportFile = async (file) => {
    const id = file.name.replace(/\.[^.]+$/, "");
    const { error } = await sb.storage.from(BUCKET).upload(id, file, { contentType: file.type || "application/octet-stream", upsert: true, cacheControl: "31536000" });
    if (error) throw error;
    return id;
  };

  /* ---------- Claude (photo reading, descriptions) through the "ask" Edge Function ---------- */
  async function toImg(blob) {
    const type = blob.type || "image/jpeg";
    try {
      const bmp = await createImageBitmap(blob);
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", 0.85);
      return { media_type: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
    } catch (e) {
      const buf = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
      return { media_type: /png|gif|webp/.test(type) ? type : "image/jpeg", data: btoa(s) };
    }
  }
  async function ask(prompt, opts) {
    const images = await Promise.all(((opts && opts.images) || []).slice(0, 8).map(toImg));
    const { data, error } = await sb.functions.invoke("ask", { body: { prompt: String(prompt), images, json: !!(opts && opts.json) } });
    if (error) throw { code: "unavailable", message: error.message };
    if (data && data.error) throw { code: "unavailable", message: data.error };
    return { text: data?.text || "", truncated: false };
  }
  const textOf = input => typeof input === "string" ? input : (input || []).map(m => typeof m.content === "string" ? m.content : "").join("\n");
  const sample = Object.assign((input, opts) => ask(textOf(input), opts), {
    json: async (input, opts) => {
      const { text } = await ask(textOf(input) + "\n\nReply with the JSON only.", { ...(opts || {}), json: true });
      const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      return JSON.parse(m ? m[0] : text);
    },
    limits: async () => ({ images: true })
  });

  /* ---------- downloads ---------- */
  const downloads = {
    save: async ({ filename, data, mimeType }) => {
      const b = data instanceof Blob ? data : new Blob([data], { type: mimeType || (/\.html?$/i.test(filename) ? "text/html" : /\.json$/i.test(filename) ? "application/json" : "application/octet-stream") });
      const u = URL.createObjectURL(b), a = document.createElement("a");
      a.href = u; a.download = filename || "download"; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 5000);
      return { ok: true };
    }
  };

  /* ---------- sign-in screen ---------- */
  let resolveReady;
  const readyP = new Promise(r => (resolveReady = r));
  const TH = () => { try { return localStorage.getItem("bp-lang") === "th"; } catch (e) { return false; } };
  function gate(html) {
    let el = document.getElementById("lrGate");
    if (!el) {
      el = document.createElement("div"); el.id = "lrGate";
      el.style.cssText = "position:fixed;inset:0;z-index:80;background:#0A0A0A;color:#F2EDE4;display:grid;place-items:center;padding:24px;font:16px/1.5 Inter,system-ui,sans-serif";
      document.body.appendChild(el);
    }
    el.innerHTML = `<div style="width:min(100%,380px);display:grid;gap:14px;text-align:center">
      <img src="icons/icon-192.png" alt="" width="88" height="88" style="justify-self:center;border-radius:22px">
      <div style="font:400 16px Michroma,'Space Grotesk',sans-serif;letter-spacing:.06em">CP MEDICAL <span style="color:#C8A96E">×</span> BLUEPRINT</div>
      <div style="color:#C8A96E;font-size:14px;margin-top:-10px">House of Strains HQ</div>${html}</div>`;
    return el;
  }
  const inp = "width:100%;font-size:17px;padding:13px 14px;border-radius:14px;border:2px solid #2a2a2a;background:#141414;color:#fff;box-sizing:border-box";
  const btn = "min-height:52px;border:0;border-radius:14px;background:#C8A96E;color:#111;font:700 18px Inter,sans-serif;cursor:pointer";
  function showEmail(msg) {
    const t = TH();
    const el = gate(`<p style="margin:0;color:#bdb6aa">${t ? "เข้าสู่ระบบ" : "Sign in"} · Sign in</p>
      ${cfg.googleSignIn ? `<button id="lrGoogle" style="${btn};background:#fff">Continue with Google</button><p style="margin:0;color:#8a8a92">${t ? "หรือใช้อีเมล" : "or use your email"}</p>` : ""}
      <input id="lrEmail" type="email" autocomplete="email" placeholder="you@gmail.com" style="${inp}">
      <button id="lrSend" style="${btn}">${t ? "ส่งรหัสให้ฉัน" : "Send me a code"}</button><p id="lrMsg" style="margin:0;color:#ff8592;min-height:1.5em">${msg || ""}</p>`);
    el.querySelector("#lrGoogle")?.addEventListener("click", () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } }));
    el.querySelector("#lrSend").onclick = async () => {
      const email = el.querySelector("#lrEmail").value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { el.querySelector("#lrMsg").textContent = t ? "ใส่อีเมลของคุณ" : "Enter your email address."; return; }
      el.querySelector("#lrSend").disabled = true;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) { el.querySelector("#lrMsg").textContent = error.message; el.querySelector("#lrSend").disabled = false; return; }
      showCode(email);
    };
  }
  function showCode(email) {
    const t = TH();
    const el = gate(`<p style="margin:0;color:#bdb6aa">${t ? "เราส่งรหัสไปที่" : "We emailed"} <b>${email.replace(/[<>&"]/g, "")}</b>.<br>${t ? "พิมพ์รหัส หรือกดลิงก์ในอีเมล" : "Type the code, or tap the link in the email."}</p>
      <input id="lrCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456" style="${inp};text-align:center;letter-spacing:.3em;font-size:24px">
      <button id="lrGo" style="${btn}">${t ? "เปิด Blueprint" : "Open Blueprint"}</button><button id="lrBack" style="background:none;border:0;color:#bdb6aa;cursor:pointer">${t ? "ใช้อีเมลอื่น" : "Use a different email"}</button>
      <p id="lrMsg" style="margin:0;color:#ff8592;min-height:1.5em"></p>`);
    el.querySelector("#lrBack").onclick = () => showEmail();
    el.querySelector("#lrGo").onclick = async () => {
      const token = el.querySelector("#lrCode").value.trim();
      const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
      if (error) el.querySelector("#lrMsg").textContent = t ? "รหัสไม่ถูกต้อง ลองอีกครั้ง" : "That code didn't work. Check it and try again.";
    };
  }

  /* ---------- "you did it" celebration after confirming the email / signing in ---------- */
  let justSignedIn = false;
  function celebrate() {
    const t = TH(), el = document.createElement("div");
    el.id = "lrYay";
    el.style.cssText = "position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:rgba(10,10,10,.82);pointer-events:none;font:16px/1.4 Inter,system-ui,sans-serif;color:#F2EDE4;animation:lrFade 3.2s ease forwards";
    const bits = Array.from({ length: 70 }, (_, i) => {
      const c = ["#C8A96E", "#00AEC7", "#3ecf8e", "#F2EDE4", "#ff8592"][i % 5], x = Math.random() * 100, d = 0.6 + Math.random() * 1.4, r = Math.random() * 720 - 360, w = 6 + Math.random() * 8;
      return `<i style="position:absolute;top:-20px;left:${x}vw;width:${w}px;height:${w * 0.5}px;background:${c};border-radius:2px;animation:lrDrop ${d + 1.2}s ${Math.random() * 0.5}s cubic-bezier(.2,.7,.4,1) forwards;--r:${r}deg"></i>`;
    }).join("");
    el.innerHTML = `<style>@keyframes lrDrop{to{transform:translateY(110vh) rotate(var(--r));opacity:.9}}@keyframes lrPop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}@keyframes lrFade{0%,80%{opacity:1}100%{opacity:0}}</style>${bits}
      <div style="text-align:center;animation:lrPop .6s ease-out both"><div style="font-size:84px;line-height:1">👍</div>
      <div style="font:700 30px 'Space Grotesk',Inter,sans-serif;margin-top:10px">${t ? "เรียบร้อย! คุณเข้าสู่ระบบแล้ว" : "You're in!"}</div>
      <div style="color:#C8A96E;margin-top:6px">${(member && member.email || "").replace(/[<>&"]/g, "")} ${t ? "ยืนยันแล้ว" : "confirmed"} ✓</div>
      <div style="color:#bdb6aa;margin-top:4px;font-size:14px">${t ? "ต่อไป: กดชื่อของคุณและใส่ PIN" : "Next: tap your name and enter your PIN"}</div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3300);
  }

  let admitting = false;
  async function admit(s) { if (member || admitting) return; admitting = true; try { await admitInner(s); } finally { admitting = false; } }
  async function admitInner(s) {
    session = s;
    if (!s) { showEmail(); return; }
    const { data } = await sb.from("members").select("email,role,name").ilike("email", s.user.email).maybeSingle();
    if (!data) {
      const el = gate(`<p style="margin:0;color:#bdb6aa">${s.user.email} isn't on the team yet.<br>Ask Jack or Isaac to add you.</p><button id="lrOut" style="${btn}">Sign out</button>`);
      el.querySelector("#lrOut").onclick = () => sb.auth.signOut();
      return;
    }
    member = data; window.lrMember = data;
    document.getElementById("lrGate")?.remove();
    if (justSignedIn) { justSignedIn = false; celebrate(); }
    if (!loaded) { goLive(); await loadAll().catch(console.error); }
    resolveReady();
  }

  const caps = { db, user, sample, assets, downloads };
  window.claude = { use: async name => { if (!sb) return null; await readyP; return caps[name] || null; } };
  window.lrSb = sb;
  window.lrSignOut = () => sb && sb.auth.signOut().then(() => location.reload());

  document.addEventListener("DOMContentLoaded", () => {
    if (!sb) { gate(`<p style="margin:0;color:#ff8592">Setup needed: add the Supabase address and key to <b>config.js</b>.</p>`); return; }
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
    const urlErr = q.get("error_description") || h.get("error_description");
    const tidy = () => { if (q.get("code") || h.get("access_token") || urlErr) history.replaceState(null, "", location.pathname); };
    if (q.get("code") || h.get("access_token") || h.get("type")) justSignedIn = true;
    (async () => {
      if (q.get("code")) { const { error } = await sb.auth.exchangeCodeForSession(q.get("code")); if (error) console.error("code exchange", error); }
      const { data, error } = await sb.auth.getSession();
      tidy();
      if (urlErr || error) { showEmail("Google sign-in: " + (urlErr || error.message).replace(/\+/g, " ")); return; }
      admit(data.session);
    })();
    sb.auth.onAuthStateChange((ev, s) => { if (ev === "SIGNED_IN" && !member) { justSignedIn = true; admit(s); } if (ev === "SIGNED_OUT") location.reload(); });
  });
})();
