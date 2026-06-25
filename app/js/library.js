// 选品库控制器：视图路由 + 登录 + 画廊(筛选) + 上传 + 详情 + 选品模式。
window.RD = window.RD || {};
(function () {
  const api = window.RD.api;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let config = { brands: [], categories: [] };
  const filter = { brand: "", category: "", untagged: false };
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
  function showLibrary() { $("#loginScreen").hidden = true; $("#libMain").hidden = false; renderFilters(); loadGallery(); }
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

  // ---------- 筛选 ----------
  function chip(text, sel, onClick) {
    const b = document.createElement("button"); b.type = "button"; b.className = "filter-chip" + (sel ? " sel" : ""); b.textContent = text;
    b.addEventListener("click", onClick); return b;
  }
  function flabel(text) { const s = document.createElement("span"); s.className = "filter-label"; s.textContent = text; return s; }
  function renderFilters() {
    const fb = $("#filterBrands"); fb.innerHTML = ""; fb.appendChild(flabel("品牌"));
    fb.appendChild(chip("全部", !filter.brand, () => { filter.brand = ""; refresh(); }));
    config.brands.forEach((b) => fb.appendChild(chip(b.name, filter.brand === b.name, () => { filter.brand = b.name; refresh(); })));

    const fc = $("#filterCats"); fc.innerHTML = ""; fc.appendChild(flabel("分类"));
    fc.appendChild(chip("全部", !filter.category && !filter.untagged, () => { filter.category = ""; filter.untagged = false; refresh(); }));
    fc.appendChild(chip("未整理", filter.untagged, () => { filter.untagged = true; filter.category = ""; refresh(); }));
    config.categories.forEach((c) => fc.appendChild(chip(c.name, !filter.untagged && filter.category === c.name, () => { filter.category = c.name; filter.untagged = false; refresh(); })));
  }
  function refresh() { renderFilters(); loadGallery(); }

  // ---------- 画廊 ----------
  async function loadGallery() {
    const g = $("#gallery"), empty = $("#galleryEmpty");
    try {
      const data = await api.list(filter);
      items = data.items || [];
      g.innerHTML = "";
      if (!items.length) {
        empty.hidden = false; empty.innerHTML = "";
        const big = document.createElement("div"); big.className = "big";
        const sub = document.createElement("div");
        const filtered = filter.brand || filter.category || filter.untagged;
        big.textContent = filtered ? "没有符合条件的选品" : "还没有选品";
        sub.textContent = filtered ? "换个筛选，或上传新灵感。" : "点「+ 上传灵感」把刷到的产品图存进来。";
        empty.appendChild(big); empty.appendChild(sub);
        return;
      }
      empty.hidden = true;
      items.forEach((it) => g.appendChild(galleryCard(it)));
    } catch (e) {
      if (e.status === 401) { showLogin(); return; }
      toast(e.message || "加载失败", true);
    }
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
    const d = document.createElement("div"); d.className = "date"; d.textContent = fmtDate(it.created_at); meta.appendChild(d);
    c.append(check, img, meta);
    c.addEventListener("click", () => { if (selectMode) toggleSelect(it, c); else openDetail(it); });
    return c;
  }

  // ---------- 选品模式 ----------
  function setSelectMode(on) {
    selectMode = on; selected.clear();
    $("#gallery").classList.toggle("selectable", on);
    const btn = $("#btnSelectMode"); btn.textContent = on ? "退出选品" : "选品模式"; btn.classList.toggle("sel", on);
    if (!on) $$(".insp-card.sel").forEach((c) => c.classList.remove("sel"));
    updateSelbar();
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
    upCards = []; $("#upList").innerHTML = ""; $("#batchApply").hidden = true; $("#upStatus").textContent = "";
    $("#upSaveBtn").disabled = true;
    renderBatchApply();
    openModal("#uploadModal");
  }
  function renderBatchApply() {
    const bb = $("#batchBrands"); bb.innerHTML = "";
    config.brands.forEach((b) => bb.appendChild(brandOpt(b.name, false)));
    const bc = $("#batchCat"); bc.innerHTML = ""; bc.appendChild(opt("", "（不改分类）"));
    config.categories.forEach((c) => bc.appendChild(opt(c.name, c.name)));
  }
  async function addUploadFiles(fileList) {
    const files = Array.from(fileList).filter(Boolean);
    if (!files.length) return;
    const fails = [];
    for (const file of files) {
      const cardObj = makeUploadCard();
      try {
        const r = await window.RD.images.process(file);
        cardObj.dataURL = r.dataURL; cardObj.w = r.w; cardObj.h = r.h;
        cardObj.thumb.classList.remove("loading"); cardObj.thumb.src = r.dataURL;
      } catch (e) {
        cardObj.el.remove(); upCards = upCards.filter((c) => c !== cardObj);
        fails.push(e && e.message);
      }
    }
    $("#batchApply").hidden = upCards.length === 0;
    $("#upSaveBtn").disabled = upCards.length === 0;
    if (fails.length) toast(fails.length === 1 ? (fails[0] || "图片处理失败") : `${fails.length} 张未能添加（其余已加）`, true);
  }
  function makeUploadCard() {
    const el = document.createElement("div"); el.className = "up-card";
    const thumb = document.createElement("img"); thumb.className = "up-thumb loading"; thumb.alt = "预览";
    const right = document.createElement("div");
    const bp = document.createElement("div"); bp.className = "brand-picker";
    config.brands.forEach((b) => bp.appendChild(brandOpt(b.name, false)));
    const catSel = document.createElement("select"); catSel.appendChild(opt("", "未整理"));
    config.categories.forEach((c) => catSel.appendChild(opt(c.name, c.name)));
    const notes = document.createElement("textarea"); notes.rows = 2; notes.placeholder = "想法 / 灵感（可空，之后整理）";
    const lblB = fieldLabel("品牌（可多选）"); const lblC = fieldLabel("分类");
    right.append(lblB, bp, lblC, catSel, notes);
    el.append(thumb, right);
    $("#upList").appendChild(el);
    const obj = { dataURL: "", w: 0, h: 0, el, thumb, brandsEl: bp, catEl: catSel, notesEl: notes };
    upCards.push(obj);
    return obj;
  }
  function applyBatch() {
    const brands = pickedBrands($("#batchBrands"));
    const cat = $("#batchCat").value;
    upCards.forEach((c) => {
      if (brands.length) $$(".brand-opt", c.brandsEl).forEach((b) => {
        const on = brands.includes(b.dataset.name);
        b.classList.toggle("sel", on); b.setAttribute("aria-pressed", String(on));
      });
      if (cat) c.catEl.value = cat;
    });
    toast("已套用到全部");
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
    $("#batchApplyBtn").addEventListener("click", applyBatch);
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
