/* Blueprint HQ app extras: ☰ menu with Install, Share (LINE / WhatsApp), Team and Import (owners). Loaded only in the hosted app. */
(function () {
  if (window.BP_OFFLINE) return;
  let deferredPrompt = null;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; });
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent), isLine = /Line\//i.test(navigator.userAgent);
  const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const th = () => { try { return localStorage.getItem("bp-lang") === "th"; } catch (e) { return false; } };
  const L = (en, t) => th() ? t : en;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const APP = location.origin + "/";

  const css = document.createElement("style");
  css.textContent = `
  .lrmenu{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));right:16px;z-index:40;height:44px;width:44px;border-radius:50%;border:1px solid #2a2a2a;background:#141414;color:#F2EDE4;font-size:18px;cursor:pointer;box-shadow:0 4px 16px #0008}
  .lrveil{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.6);display:grid;align-items:end;justify-items:center}
  .lrsheet{width:min(100%,560px);max-height:92vh;overflow:auto;background:#121212;color:#F2EDE4;border-radius:24px 24px 0 0;padding:22px 20px calc(24px + env(safe-area-inset-bottom));display:grid;gap:12px;font:16px/1.5 Inter,system-ui,sans-serif}
  .lrsheet h2{margin:0;font:700 24px 'Space Grotesk',Inter,sans-serif}
  .lrsheet .big{width:100%;min-height:56px;border:0;border-radius:14px;font:700 17px Inter,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
  .lrsheet .pk{background:#C8A96E;color:#111}.lrsheet .gr{background:#06c755;color:#fff}.lrsheet .wa{background:#25d366;color:#fff}.lrsheet .gh{background:#1c1c1c;color:#F2EDE4;border:1px solid #2a2a2a}
  .lrsheet ol{margin:0;padding-left:22px;line-height:1.7}
  .lrsheet input,.lrsheet select,.lrsheet textarea{width:100%;font-size:16px;padding:11px 14px;border:1px solid #2a2a2a;border-radius:12px;background:#0d0d0d;color:#F2EDE4;box-sizing:border-box}
  .lrrow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:1px solid #2a2a2a;border-radius:12px}
  .lrrow small{color:#8a8a92;display:block}
  .lrrow button{border:0;background:none;color:#ff8592;font-size:20px;cursor:pointer}
  .lrx{justify-self:end;margin-bottom:-44px;position:relative;z-index:2;min-height:40px;padding:0 14px;border-radius:12px;border:1px solid #2a2a2a;background:#1c1c1c;color:#F2EDE4;font-weight:600;cursor:pointer}`;
  document.head.appendChild(css);

  let veil;
  function open(html) {
    close();
    veil = document.createElement("div"); veil.className = "lrveil";
    veil.innerHTML = `<div class="lrsheet" role="dialog" aria-modal="true"><button class="lrx" data-x>${L("Close", "ปิด")}</button>${html}</div>`;
    veil.addEventListener("click", e => { if (e.target === veil || e.target.closest("[data-x]")) close(); });
    document.body.appendChild(veil);
    return veil;
  }
  function close() { veil?.remove(); veil = null; }

  const shareText = () => th()
    ? `🌿 CP MEDICAL × BLUEPRINT · House of Strains HQ\nห้องปลูก ตารางงาน กระดานหลัก สต็อก และฟีดประจำวัน อยู่ที่นี่ทั้งหมด\n\n👉 ${APP}\n\nติดตั้งเป็นแอป:\n📱 iPhone: เปิดใน Safari → แชร์ ⬆️ → "เพิ่มไปยังหน้าจอโฮม"\n🤖 Android: เปิดใน Chrome → ⋮ → "ติดตั้งแอป"\n\nเข้าสู่ระบบด้วยอีเมล แล้วกดชื่อของคุณและใส่ PIN`
    : `🌿 CP MEDICAL × BLUEPRINT · House of Strains HQ\nRooms, schedule, main board, stock and the daily feed, all in one place.\n\n👉 ${APP}\n\nInstall it as an app:\n📱 iPhone: open in Safari → Share ⬆️ → "Add to Home Screen"\n🤖 Android: open in Chrome → ⋮ → "Install app"\n\nSign in with your email, then tap your name and enter your PIN.`;

  function menu() {
    const owner = window.lrMember?.role === "owner";
    const v = open(`<h2>Blueprint HQ</h2>
      ${installed() ? "" : `<button class="big pk" data-a="install">📲 ${L("Install app", "ติดตั้งแอป")}</button>`}
      <button class="big gh" data-a="share">🔗 ${L("Share the link", "แชร์ลิงก์")}</button>
      ${owner ? `<button class="big gh" data-a="team">👥 ${L("Who can sign in", "ใครเข้าสู่ระบบได้")}</button>
        <button class="big gh" data-a="import">📥 ${L("Import data", "นำเข้าข้อมูล")}</button>
        <button class="big gh" data-a="files">🖼 ${L("Import photos & files", "นำเข้ารูปและไฟล์")}</button>` : ""}
      <button class="big gh" data-a="out" style="min-height:44px;font-size:15px;opacity:.8">🚪 ${L("Sign out of this device", "ออกจากระบบเครื่องนี้")}</button>
      <p style="margin:0;color:#8a8a92;font-size:13px;text-align:center">${esc(window.lrMember?.email || "")}</p>`);
    v.addEventListener("click", e => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "install") install(); if (a === "share") share(); if (a === "team") team(); if (a === "import") importData(); if (a === "files") importFiles(); if (a === "out") window.lrSignOut?.();
    });
  }

  async function install() {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice.catch(() => {}); deferredPrompt = null; close(); return; }
    open(`<h2>📲 ${L("Install Blueprint", "ติดตั้ง Blueprint")}</h2>
      ${isLine ? `<p style="margin:0">${L("You're inside LINE. Tap ⋯ (top right) → <b>Open in browser</b> first, then follow the steps.", "ตอนนี้อยู่ใน LINE ให้กด ⋯ (มุมขวาบน) → <b>เปิดในเบราว์เซอร์</b> ก่อน แล้วทำตามขั้นตอน")}</p>` : ""}
      ${isIOS
        ? `<ol><li>${L("Open this page in <b>Safari</b>", "เปิดหน้านี้ใน <b>Safari</b>")}</li><li>${L("Tap <b>Share</b> ⬆️ at the bottom", "กด <b>แชร์</b> ⬆️ ด้านล่าง")}</li><li>${L("Choose <b>Add to Home Screen</b>", "เลือก <b>เพิ่มไปยังหน้าจอโฮม</b>")}</li><li>${L("Tap <b>Add</b>", "กด <b>เพิ่ม</b>")}</li></ol>`
        : /Android/i.test(navigator.userAgent)
        ? `<ol><li>${L("Open this page in <b>Chrome</b>", "เปิดหน้านี้ใน <b>Chrome</b>")}</li><li>${L("Tap <b>⋮</b> top right", "กด <b>⋮</b> มุมขวาบน")}</li><li>${L("Choose <b>Install app</b>", "เลือก <b>ติดตั้งแอป</b>")}</li></ol>`
        : `<ol><li>${L("Open this page in <b>Chrome</b> or <b>Edge</b>", "เปิดหน้านี้ใน <b>Chrome</b> หรือ <b>Edge</b>")}</li><li>${L("Click the <b>Install</b> icon at the right of the address bar", "คลิกไอคอน <b>ติดตั้ง</b> ด้านขวาของช่องที่อยู่")}</li></ol>`}`);
  }

  function share() {
    const v = open(`<h2>🔗 ${L("Share the link", "แชร์ลิงก์")}</h2>
      <textarea id="lrShareTxt" style="min-height:200px">${esc(shareText())}</textarea>
      <a class="big gr" id="lrLn" href="https://line.me/R/msg/text/?${encodeURIComponent(shareText())}" target="_blank" rel="noopener">LINE</a>
      <a class="big wa" id="lrWa" href="https://wa.me/?text=${encodeURIComponent(shareText())}" target="_blank" rel="noopener">WhatsApp</a>
      ${navigator.share ? `<button class="big gh" data-s="native">📤 ${L("Share…", "แชร์…")}</button>` : ""}
      <button class="big gh" data-s="copy">${L("Copy", "คัดลอก")}</button>
      <p style="margin:0;color:#8a8a92;font-size:13px">${L("They also need to be added in 👥 Who can sign in.", "ต้องเพิ่มอีเมลของเขาใน 👥 ใครเข้าสู่ระบบได้ ก่อน")}</p>`);
    const area = v.querySelector("#lrShareTxt");
    area.addEventListener("input", () => { v.querySelector("#lrLn").href = "https://line.me/R/msg/text/?" + encodeURIComponent(area.value); v.querySelector("#lrWa").href = "https://wa.me/?text=" + encodeURIComponent(area.value); });
    v.addEventListener("click", async e => {
      const s = e.target.closest("[data-s]")?.dataset.s;
      if (s === "native") navigator.share({ title: "Blueprint HQ", text: area.value }).catch(() => {});
      if (s === "copy") { try { await navigator.clipboard.writeText(area.value); e.target.textContent = "✓"; } catch (err) { area.select(); } }
    });
  }

  async function team() {
    const sb = window.lrSb;
    const v = open(`<h2>👥 ${L("Who can sign in", "ใครเข้าสู่ระบบได้")}</h2>
      <p style="margin:0;color:#8a8a92;font-size:14px">${L("Each email here can open Blueprint. After signing in, people tap their own name and PIN. Crew without email can share one floor email (e.g. a shared Gmail), then pick their name.", "อีเมลที่อยู่ในรายการนี้เปิด Blueprint ได้ หลังเข้าสู่ระบบ แต่ละคนกดชื่อตัวเองและใส่ PIN ทีมงานที่ไม่มีอีเมลใช้อีเมลกลางร่วมกันได้ แล้วเลือกชื่อตัวเอง")}</p>
      <div id="lrTeam" style="display:grid;gap:8px">…</div>
      <b>${L("Add someone", "เพิ่มคน")}</b>
      <input id="lrTEmail" type="email" placeholder="name@gmail.com">
      <input id="lrTName" placeholder="${L("Name (e.g. Matt, Floor team)", "ชื่อ (เช่น Matt, ทีมหน้างาน)")}">
      <select id="lrTRole"><option value="team">${L("Team", "ทีม")}</option><option value="owner">${L("Owner (can add people)", "เจ้าของ (เพิ่มคนได้)")}</option></select>
      <button class="big pk" data-t="add">${L("Add", "เพิ่ม")}</button><p id="lrTMsg" style="margin:0;color:#ff8592;min-height:1.4em"></p>`);
    async function load() {
      const { data, error } = await sb.from("members").select("email,role,name").order("role");
      v.querySelector("#lrTeam").innerHTML = error ? `<p>${esc(error.message)}</p>` : data.map(m => `<div class="lrrow"><div><b>${esc(m.name || m.email)}</b><small>${esc(m.email)} · ${esc(m.role)}</small></div>${m.email === window.lrMember?.email ? "" : `<button data-rm="${esc(m.email)}" aria-label="Remove">×</button>`}</div>`).join("");
    }
    v.addEventListener("click", async e => {
      if (e.target.closest("[data-t=add]")) {
        const email = v.querySelector("#lrTEmail").value.trim().toLowerCase(), name = v.querySelector("#lrTName").value.trim(), role = v.querySelector("#lrTRole").value;
        if (!/^\S+@\S+\.\S+$/.test(email)) { v.querySelector("#lrTMsg").textContent = L("Enter a valid email.", "ใส่อีเมลให้ถูกต้อง"); return; }
        const { error } = await sb.from("members").upsert({ email, name, role });
        v.querySelector("#lrTMsg").textContent = error ? error.message : "";
        if (!error) { v.querySelector("#lrTEmail").value = ""; v.querySelector("#lrTName").value = ""; load(); }
      }
      const rm = e.target.closest("[data-rm]");
      if (rm) { if (!rm.dataset.sure) { rm.dataset.sure = "1"; rm.textContent = L("Remove?", "ลบ?"); rm.style.fontSize = "14px"; return; } await sb.from("members").delete().eq("email", rm.dataset.rm); load(); }
    });
    load();
  }

  // Data from the Claude version: a .json file (rows of {path,data}) or a Blueprint snapshot ({S,CFG,TEAM,CL})
  function rowsOf(x) {
    if (Array.isArray(x) && x.every(r => r && typeof r.path === "string" && r.data && typeof r.data === "object")) return x;
    if (x && x.S && typeof x.S === "object") {
      const rows = [];
      for (const [c, arr] of Object.entries(x.S)) if (Array.isArray(arr)) arr.forEach(d => { if (d && d.id) { const data = { ...d }; delete data.id; rows.push({ path: c + "/" + d.id, data }); } });
      if (x.CFG) rows.push({ path: "meta/settings", data: x.CFG });
      if (Array.isArray(x.TEAM)) rows.push({ path: "meta/team", data: { people: x.TEAM } });
      if (x.CL) rows.push({ path: "meta/checklist", data: x.CL });
      if (x.TODAY && x.TODAY.date) rows.push({ path: "ops/" + x.TODAY.date, data: x.TODAY });
      return rows;
    }
    throw new Error(L("That isn't a Blueprint data file.", "ไม่ใช่ไฟล์ข้อมูล Blueprint"));
  }
  async function pushRows(rows, msg) {
    const sb = window.lrSb;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100).map(r => ({ path: r.path, coll: r.path.slice(0, r.path.lastIndexOf("/")), data: r.data, updated_at: new Date().toISOString() }));
      const { error } = await sb.from("docs").upsert(batch);
      if (error) throw error;
      msg.textContent = L("Importing… ", "กำลังนำเข้า… ") + Math.min(rows.length, i + 100) + " / " + rows.length;
    }
  }
  function importData() {
    const v = open(`<h2>📥 ${L("Import data", "นำเข้าข้อมูล")}</h2>
      <p style="margin:0">${L("Pick the Blueprint data file (.json), or paste the data copied from the Claude version (Settings → Copy all data). Items with the same id are updated.", "เลือกไฟล์ข้อมูล Blueprint (.json) หรือวางข้อมูลที่คัดลอกจากเวอร์ชัน Claude (ตั้งค่า → คัดลอกข้อมูลทั้งหมด)")}</p>
      <input id="lrImp" type="file" accept=".json,application/json,.html">
      <textarea id="lrImpTxt" placeholder="${L("…or paste here", "…หรือวางที่นี่")}" style="min-height:90px"></textarea>
      <button class="big pk" data-i="go">${L("Import", "นำเข้า")}</button>
      <p id="lrImpMsg" style="margin:0;color:#8a8a92;min-height:1.4em"></p>`);
    const msg = v.querySelector("#lrImpMsg");
    v.querySelector("[data-i=go]").onclick = async () => {
      try {
        const f = v.querySelector("#lrImp").files[0];
        let txt = f ? await f.text() : v.querySelector("#lrImpTxt").value;
        const m = txt.match(/window\.BP_SEED=(\{[\s\S]*?\});<\/script>/);   // an offline-copy .html also works
        const rows = rowsOf(JSON.parse(m ? m[1] : txt));
        await pushRows(rows, msg);
        msg.style.color = "#3ecf8e"; msg.textContent = L("Done: ", "เสร็จ: ") + rows.length + L(" items. Reloading…", " รายการ กำลังโหลดใหม่…");
        setTimeout(() => location.reload(), 1200);
      } catch (err) { msg.style.color = "#ff8592"; msg.textContent = (err && err.message) || String(err); }
    };
  }
  function importFiles() {
    const v = open(`<h2>🖼 ${L("Import photos & files", "นำเข้ารูปและไฟล์")}</h2>
      <p style="margin:0">${L("Unzip the <b>Blueprint starting files</b> Claude sent you, then select all the files inside (they're named with long codes). They go into place automatically.", "แตกไฟล์ <b>Blueprint starting files</b> ที่ Claude ส่งให้ แล้วเลือกทุกไฟล์ข้างใน ระบบจะจัดเข้าที่เอง")}</p>
      <input id="lrFiles" type="file" multiple>
      <p id="lrFMsg" style="margin:0;color:#8a8a92;min-height:1.4em"></p>`);
    v.querySelector("#lrFiles").addEventListener("change", async e => {
      const files = [...e.target.files], msg = v.querySelector("#lrFMsg"); let ok = 0, bad = [];
      for (const f of files) { try { await window.lrImportFile(f); ok++; } catch (err) { bad.push(f.name); } msg.textContent = ok + " / " + files.length; }
      msg.style.color = bad.length ? "#ff8592" : "#3ecf8e";
      msg.textContent = L(`Done: ${ok} of ${files.length} uploaded.`, `เสร็จ: อัปโหลด ${ok} จาก ${files.length}`) + (bad.length ? " " + L("Failed: ", "ไม่สำเร็จ: ") + bad.join(", ") : "");
    });
  }

  function addButton() {
    if (document.getElementById("lrMenuBtn")) return;
    const b = document.createElement("button"); b.id = "lrMenuBtn"; b.className = "lrmenu"; b.type = "button"; b.setAttribute("aria-label", "Menu"); b.textContent = "☰";
    b.onclick = menu; document.body.appendChild(b);
  }
  document.addEventListener("DOMContentLoaded", addButton);
})();
