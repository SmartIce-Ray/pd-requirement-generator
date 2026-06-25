// 选品库控制器：视图路由 + 登录 + 画廊(筛选) + 上传 + 详情 + 选品模式。
window.RD = window.RD || {};
(function () {
  const api = window.RD.api;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let config = { brands: [], categories: [] };
  let selectMode = false;
  const selected = new Map(); // id -> item
  let items = [];

  // ---------- 通用 ----------
  let toastTimer;
  function toast(msg, isErr) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.hidden = false; t.classList.toggle("err", !!isErr);
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 250); }, 3000);
  }
  function fmtDate(ms) { const d = new Date(ms), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  function fieldLabel(text) { const l = document.createElement("label"); l.className = "field-label"; l.textContent = text; return l; }
  function opt(value, text) { const o = document.createElement("option"); o.value = value; o.textContent = text; return o; }
  function dataURLtoBlob(dataURL) {
    const [head, b64] = dataURL.split(",");
    const mime = (head.match(/:(.*?);/) || [, "image/jpeg"])[1];
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function brandOpt(name, sel) {
    const b = document.createElement("button"); b.type = "button"; b.className = "brand-opt" + (sel ? " sel" : "");
    b.dataset.name = name; b.setAttribute("aria-pressed", String(sel));
    const chk = document.createElement("span"); chk.className = "check"; chk.textContent = "✓";
    b.appendChild(chk); b.appendChild(document.createTextNode(name));
    b.addEventListener("click", () => { const on = b.classList.toggle("sel"); b.setAttribute("aria-pressed", String(on)); if (b._onToggle) b._onToggle(on); });
    return b;
  }
  function pickedBrands(container) { return $$(".brand-opt.sel", container).map((b) => b.dataset.name).filter(Boolean); }

  // ---------- 视图路由 ----------
  function setView(view) {
    document.body.dataset.view = view;
    $("#view-library").hidden = view !== "library";
    $("#view-reqform").hidden = view !== "reqform";
    const rm = $("#view-reqmulti"); if (rm) rm.hidden = view !== "reqmulti";
    $("#reqformTools").style.display = view === "reqform" ? "" : "none";
    $$("#viewSwitch button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $("#selbar").hidden = !(view === "library" && selectMode && selected.size > 0);
  }

  // ---------- 鉴权 ----------
  async function boot() {
    setView("library");
    try { config = await api.config(); showLibrary(); }
    catch (e) { showLogin(); if (e.status !== 401) toast(e.message || "加载失败", true); }
  }
  function showLogin() { $("#loginScreen").hidden = false; $("#libMain").hidden = true; }
  function showLibrary() { $("#loginScreen").hidden = true; $("#libMain").hidden = false; loadGallery(); }
  async function doLogin() {
    const pw = $("#loginPw").value;
    $("#loginErr").textContent = "";
    if (!pw) { $("#loginErr").textContent = "请输入密码"; return; }
    const btn = $("#loginBtn"); btn.disabled = true;
    try {
      await api.login(pw);
      config = await api.config();
      $("#loginPw").value = "";
      showLibrary();
    } catch (e) { $("#loginErr").textContent = e.status === 401 ? "密码错误" : (e.message || "登录失败"); }
    finally { btn.disabled = false; }
  }

  // ---------- 画廊 ----------
  async function loadGallery() {
    const g = $("#gallery"), empty = $("#galleryEmpty");
    try {
      const data = await api.list();
      items = data.items || [];
      g.innerHTML = "";
      if (!items.length) {
        empty.hidden = false; empty.innerHTML = "";
        const big = document.createElement("div"); big.className = "big";
        const sub = document.createElement("div");
        big.textContent = "还没有上传记录";
        sub.textContent = "点「+ 上传灵感」把刷到的产品图存进来。";
        empty.appendChild(big); empty.appendChild(sub);
        return;
      }
      empty.hidden = true;
      renderLog(g, items);
    } catch (e) {
      if (e.status === 401) { showLogin(); return; }
      toast(e.message || "加载失败", true);
    }
  }
  // 上传记录：按天分组，默认只显示「日期 · N 张」，点开展开那天的缩略图
  function renderLog(g, list) {
    const sorted = [...list].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    const groups = new Map();
    sorted.forEach((it) => { const day = fmtDate(it.created_at); if (!groups.has(day)) groups.set(day, []); groups.get(day).push(it); });
    groups.forEach((dayItems, day) => g.appendChild(logDayGroup(day, dayItems)));
  }
  function logDayGroup(day, dayItems) {
    const wrap = document.createElement("div"); wrap.className = "log-group";
    const head = document.createElement("button"); head.type = "button"; head.className = "log-day";
    const dd = document.createElement("span"); dd.textContent = day;
    const cc = document.createElement("span"); cc.className = "count"; cc.textContent = `· ${dayItems.length} 张`;
    const chev = document.createElement("span"); chev.className = "chev"; chev.textContent = "›";
    head.append(dd, cc, chev);
    const body = document.createElement("div"); body.className = "log-day-body";
    dayItems.forEach((it) => body.appendChild(galleryCard(it)));
    head.addEventListener("click", () => { const open = head.classList.toggle("open"); body.classList.toggle("open", open); });
    wrap.append(head, body);
    return wrap;
  }
  function galleryCard(it) {
    const c = document.createElement("div"); c.className = "insp-card" + (selected.has(it.id) ? " sel" : ""); c.dataset.id = it.id;
    const check = document.createElement("div"); check.className = "sel-check"; check.textContent = "✓";
    const img = document.createElement("img"); img.className = "thumb"; img.loading = "lazy"; img.alt = "选品图"; img.src = api.imgUrl(it.id);
    const meta = document.createElement("div"); meta.className = "meta";
    const tags = document.createElement("div"); tags.className = "tags";
    (it.brands || []).forEach((b) => { const t = document.createElement("span"); t.className = "tag"; t.textContent = b; tags.appendChild(t); });
    if (it.category) { const t = document.createElement("span"); t.className = "tag cat"; t.textContent = it.category; tags.appendChild(t); }
    else { const t = document.createElement("span"); t.className = "tag untagged"; t.textContent = "未整理"; tags.appendChild(t); }
    meta.appendChild(tags);
    if (it.notes) { const n = document.createElement("div"); n.className = "note"; n.textContent = it.notes; meta.appendChild(n); }
    c.append(check, img, meta);
    c.addEventListener("click", () => { if (selectMode) toggleSelect(it, c); else openDetail(it); });
    return c;
  }

  // ---------- 选品模式 ----------
  let selBrand = ""; // 筛选："" 全部 / "__untagged__" 未打标 / 品牌名
  function setSelectMode(on) {
    selectMode = on; selected.clear(); selBrand = "";
    $("#gallery").classList.toggle("selectable", on);
    $("#selFilter").hidden = !on;
    const btn = $("#btnSelectMode"); btn.textContent = on ? "退出选品" : "选品模式"; btn.classList.toggle("sel", on);
    // 进选品模式：所有天自动展开；退出：收回折叠
    $$(".log-day", $("#gallery")).forEach((h) => h.classList.toggle("open", on));
    $$(".log-day-body", $("#gallery")).forEach((b) => b.classList.toggle("open", on));
    if (on) { renderSelFilter(); applySelFilter(); }
    else {
      $$(".insp-card.sel").forEach((c) => c.classList.remove("sel"));
      $$(".log-group, .insp-card", $("#gallery")).forEach((el) => (el.style.display = ""));
    }
    updateSelbar();
  }
  function renderSelFilter() {
    const bar = $("#selFilter"); bar.innerHTML = "";
    const mk = (label, val) => {
      const b = document.createElement("button"); b.type = "button";
      b.className = "filter-chip" + (selBrand === val ? " sel" : "");
      b.dataset.val = val; b.textContent = label;
      b.addEventListener("click", () => setSelBrand(val));
      return b;
    };
    bar.appendChild(mk("全部", ""));
    config.brands.forEach((br) => bar.appendChild(mk(br.name, br.name)));
    bar.appendChild(mk("未打标", "__untagged__"));
  }
  function setSelBrand(val) {
    selBrand = val;
    selected.clear(); $$(".insp-card.sel").forEach((c) => c.classList.remove("sel")); // 切筛选清空已选（Ray 定）
    $$("#selFilter .filter-chip").forEach((c) => c.classList.toggle("sel", c.dataset.val === val));
    applySelFilter();
    updateSelbar();
  }
  function matchBrand(it) {
    if (!selBrand) return true;
    if (selBrand === "__untagged__") return !((it.brands || []).length);
    return (it.brands || []).includes(selBrand);
  }
  function applySelFilter() {
    const byId = new Map(items.map((it) => [String(it.id), it]));
    $$(".log-group", $("#gallery")).forEach((group) => {
      let visible = 0;
      $$(".insp-card", group).forEach((card) => {
        const it = byId.get(card.dataset.id);
        const show = it ? matchBrand(it) : true;
        card.style.display = show ? "" : "none";
        if (show) visible++;
      });
      group.style.display = visible ? "" : "none";
    });
  }
  function toggleSelect(it, cardEl) {
    if (selected.has(it.id)) { selected.delete(it.id); cardEl.classList.remove("sel"); }
    else { selected.set(it.id, it); cardEl.classList.add("sel"); }
    updateSelbar();
  }
  function updateSelbar() {
    $("#selCount").textContent = `已选 ${selected.size}`;
    $("#selbar").hidden = !(selectMode && selected.size > 0);
  }

  // ---------- 弹窗 ----------
  function openModal(sel) { $(sel).hidden = false; }
  function closeModal(sel) { $(sel).hidden = true; }
  function bindModalClose(sel) {
    $$(`${sel} [data-close]`).forEach((el) => el.addEventListener("click", () => closeModal(sel)));
  }

  // ---------- 详情 ----------
  let detailItem = null;
  function openDetail(it) {
    detailItem = it;
    const body = $("#detailBody"); body.innerHTML = "";
    const img = document.createElement("img"); img.className = "detail-img"; img.alt = "选品图"; img.src = api.imgUrl(it.id);
    body.appendChild(img);
    body.appendChild(fieldLabel("品牌（可多选）"));
    const bp = document.createElement("div"); bp.className = "brand-picker"; bp.id = "detailBrands";
    config.brands.forEach((b) => bp.appendChild(brandOpt(b.name, (it.brands || []).includes(b.name))));
    body.appendChild(bp);
    body.appendChild(fieldLabel("分类"));
    const sel = document.createElement("select"); sel.id = "detailCat"; sel.appendChild(opt("", "未整理"));
    config.categories.forEach((c) => sel.appendChild(opt(c.name, c.name)));
    sel.value = it.category || "";
    body.appendChild(sel);
    body.appendChild(fieldLabel("想法"));
    const ta = document.createElement("textarea"); ta.id = "detailNotes"; ta.rows = 3; ta.value = it.notes || "";
    body.appendChild(ta);
    openModal("#detailModal");
  }
  async function saveDetail() {
    if (!detailItem) return;
    const patch = {
      brands: pickedBrands($("#detailBrands")),
      category: $("#detailCat").value || null,
      notes: $("#detailNotes").value,
    };
    const btn = $("#detailSave"); btn.disabled = true;
    try { await api.update(detailItem.id, patch); closeModal("#detailModal"); toast("已保存"); loadGallery(); }
    catch (e) { toast(e.message || "保存失败", true); if (e.status === 404) { closeModal("#detailModal"); loadGallery(); } }
    finally { btn.disabled = false; }
  }
  async function deleteDetail() {
    if (!detailItem) return;
    if (!confirm("删除这条选品？图片也会一并删除。")) return;
    try { await api.remove(detailItem.id); closeModal("#detailModal"); toast("已删除"); loadGallery(); }
    catch (e) { toast(e.message || "删除失败", true); if (e.status === 404) { closeModal("#detailModal"); loadGallery(); } }
  }

  // ---------- 上传 ----------
  let upCards = []; // { dataURL, w, h, brandsEl, catEl, notesEl, el }
  function openUpload() {
    upCards = []; $("#upList").innerHTML = ""; $("#upStatus").textContent = "";
    updateUploadState();
    openModal("#uploadModal");
  }
  // 集中维护上传弹窗状态：保存键启用/数量文案 + 上传区收缩为细条
  function updateUploadState() {
    const n = upCards.filter((c) => c.dataURL).length;
    const btn = $("#upSaveBtn");
    btn.disabled = n === 0;
    btn.textContent = n ? `保存全部（${n} 张）` : "保存全部";
    $("#upDrop").classList.toggle("small", upCards.length > 0);
  }
  async function addUploadFiles(fileList) {
    const files = Array.from(fileList).filter(Boolean);
    if (!files.length) return;
    const fails = [];
    for (const file of files) {
      const cardObj = makeUploadCard();
      updateUploadState();
      try {
        const r = await window.RD.images.process(file);
        cardObj.dataURL = r.dataURL; cardObj.w = r.w; cardObj.h = r.h;
        cardObj.thumb.classList.remove("loading"); cardObj.thumb.src = r.dataURL;
      } catch (e) {
        cardObj.el.remove(); upCards = upCards.filter((c) => c !== cardObj);
        fails.push(e && e.message);
      }
      updateUploadState();
    }
    if (fails.length) toast(fails.length === 1 ? (fails[0] || "图片处理失败") : `${fails.length} 张未能添加（其余已加）`, true);
  }
  function makeUploadCard() {
    const el = document.createElement("div"); el.className = "up-card";
    const thumbWrap = document.createElement("div"); thumbWrap.className = "up-thumb-wrap";
    const thumb = document.createElement("img"); thumb.className = "up-thumb loading"; thumb.alt = "预览";
    const del = document.createElement("button"); del.type = "button"; del.className = "up-del"; del.setAttribute("aria-label", "移除这张图"); del.textContent = "×";
    thumbWrap.append(thumb, del);
    const right = document.createElement("div");
    const bp = document.createElement("div"); bp.className = "brand-picker";
    config.brands.forEach((b) => bp.appendChild(brandOpt(b.name, false)));
    const catSel = document.createElement("select"); catSel.appendChild(opt("", "未整理"));
    config.categories.forEach((c) => catSel.appendChild(opt(c.name, c.name)));
    const notes = document.createElement("textarea"); notes.rows = 2; notes.placeholder = "想法 / 灵感（可空，之后整理）";
    const lblB = fieldLabel("品牌（可多选）"); const lblC = fieldLabel("分类");
    right.append(lblB, bp, lblC, catSel, notes);
    el.append(thumbWrap, right);
    $("#upList").appendChild(el);
    const obj = { dataURL: "", w: 0, h: 0, el, thumb, brandsEl: bp, catEl: catSel, notesEl: notes };
    del.addEventListener("click", () => removeCard(obj));
    upCards.push(obj);
    return obj;
  }
  function removeCard(cardObj) {
    cardObj.el.remove();
    upCards = upCards.filter((c) => c !== cardObj);
    updateUploadState();
  }
  async function saveUpload() {
    const ready = upCards.filter((c) => c.dataURL);
    if (!ready.length) return;
    const btn = $("#upSaveBtn"); btn.disabled = true;
    let done = 0, fail = 0;
    const failMsgs = [];
    for (const c of ready) {
      $("#upStatus").textContent = `保存中 ${done + fail + 1} / ${ready.length}`;
      const fd = new FormData();
      fd.append("image", dataURLtoBlob(c.dataURL), "inspiration.jpg");
      fd.append("brands", JSON.stringify(pickedBrands(c.brandsEl)));
      fd.append("category", c.catEl.value || "");
      fd.append("notes", c.notesEl.value || "");
      try { await api.create(fd); done++; }
      catch (e) {
        fail++; failMsgs.push(e && e.message); console.error("upload_create_failed", e);
        if (e.status === 401) { showLogin(); break; }
      }
    }
    btn.disabled = false;
    closeModal("#uploadModal");
    toast(fail ? `已存 ${done} 条，${fail} 条失败（${failMsgs[0] || "未知原因"}）` : `已存 ${done} 条灵感`, !!fail);
    loadGallery();
  }

  // ---------- 选品 → 研发需求 ----------
  function genRequirement() {
    const picks = Array.from(selected.values());
    if (!picks.length) return;
    if (window.RD.reqformMulti && window.RD.reqformMulti.start) {
      window.RD.reqformMulti.start(picks);
    } else {
      toast("研发需求模块未就绪", true);
    }
  }

  // ---------- init ----------
  function init() {
    $$("#viewSwitch button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    $("#loginBtn").addEventListener("click", doLogin);
    $("#loginPw").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
    $("#btnSelectMode").addEventListener("click", () => setSelectMode(!selectMode));
    $("#btnSelCancel").addEventListener("click", () => setSelectMode(false));
    $("#btnGenReq").addEventListener("click", genRequirement);
    $("#btnUpload").addEventListener("click", openUpload);
    $("#detailSave").addEventListener("click", saveDetail);
    $("#detailDel").addEventListener("click", deleteDetail);
    $("#upSaveBtn").addEventListener("click", saveUpload);
    bindModalClose("#uploadModal");
    bindModalClose("#detailModal");
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal("#uploadModal"); closeModal("#detailModal"); } });

    // 上传弹窗的拖拽 / 选择 / 粘贴
    const drop = $("#upDrop"), file = $("#upFile");
    drop.addEventListener("click", () => file.click());
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
    file.addEventListener("change", () => { if (file.files.length) addUploadFiles(file.files); file.value = ""; });
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => {
      const fs = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(f.name));
      if (fs.length) addUploadFiles(fs);
    });
    document.addEventListener("paste", (e) => {
      if ($("#uploadModal").hidden) return; // 只在上传弹窗开着时接管粘贴
      const imgs = Array.from(e.clipboardData?.items || []).filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile()).filter(Boolean);
      if (imgs.length) addUploadFiles(imgs);
    });

    api.onUnauth(() => { setView("library"); showLogin(); });
    boot();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.RD.library = { reload: loadGallery, setView, getConfig: () => config };
})();
