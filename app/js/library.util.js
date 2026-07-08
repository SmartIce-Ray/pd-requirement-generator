// 选品库共享层：状态 + 工具 + 视图路由 + 选品卡片。各功能模块挂到本对象 window.RD.lib 上。
window.RD = window.RD || {};
window.RD.lib = (function () {
  const api = window.RD.api;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const state = {
    config: { brands: [], categories: [] },
    me: null,                 // { uid, name, role }
    items: [],                // 产品灵感（首页日志 + 产品灵感库；只装 kind=product）
    creativeItems: [],        // 创意灵感（创意灵感库；只装 kind=creative）
    view: "home",
    selectMode: false,
    selected: new Map(),      // id -> item
    filterBrand: "",
    filterCategory: "",
    filterCuisine: "",
    filterUploader: "",
    upCards: [],
    uploadKind: "product",    // 当前上传弹窗用途：product | creative
    detailItem: null,
  };

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtDate(ms) { const d = new Date(ms), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  function fieldLabel(text) { return el("label", "field-label", text); }
  function opt(value, text) { const o = document.createElement("option"); o.value = value; o.textContent = text; return o; }

  let toastTimer;
  function toast(msg, isErr) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.hidden = false; t.classList.toggle("err", !!isErr);
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 250); }, 3000);
  }

  function dataURLtoBlob(dataURL) {
    const [head, b64] = dataURL.split(",");
    const mime = (head.match(/:(.*?);/) || [, "image/jpeg"])[1];
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function brandOpt(name, sel) {
    const b = el("button", "brand-opt" + (sel ? " sel" : "")); b.type = "button";
    b.dataset.name = name; b.setAttribute("aria-pressed", String(sel));
    b.append(el("span", "check", "✓"), document.createTextNode(name));
    b.addEventListener("click", () => { const on = b.classList.toggle("sel"); b.setAttribute("aria-pressed", String(on)); if (b._onToggle) b._onToggle(on); });
    return b;
  }
  function pickedBrands(container) { return $$(".brand-opt.sel", container).map((b) => b.dataset.name).filter(Boolean); }

  function openModal(sel) { $(sel).hidden = false; }
  function closeModal(sel) { $(sel).hidden = true; }
  function bindModalClose(sel) { $$(`${sel} [data-close]`).forEach((e) => e.addEventListener("click", () => closeModal(sel))); }

  function isAdmin() { return !!(state.me && state.me.role === "admin"); }

  const L = {}; // 前向引用：各模块挂 L.home / L.gallery / L.detail / L.upload / L.account

  // 选品卡片（首页日志 + 产品灵感库网格共用）。选品模式下点击=勾选，否则=看详情。
  function galleryCard(it, opts) {
    opts = opts || {};
    const c = el("div", "insp-card" + (state.selected.has(it.id) ? " sel" : "")); c.dataset.id = it.id;
    const check = el("div", "sel-check", "✓");
    const img = el("img", "thumb"); img.loading = "lazy"; img.alt = "选品图"; img.src = api.imgUrl(it.id);
    const meta = el("div", "meta");
    const tags = el("div", "tags");
    (it.brands || []).forEach((b) => tags.appendChild(el("span", "tag", b)));
    if (it.category) tags.appendChild(el("span", "tag cat", it.category));
    if (it.cuisine) tags.appendChild(el("span", "tag cuisine", it.cuisine));
    meta.appendChild(tags);
    if (opts.showUploader) meta.appendChild(el("div", "card-uploader", it.uploader_name || "（已删除）"));
    if (it.notes) meta.appendChild(el("div", "note", it.notes));
    c.append(check, img, meta);
    c.addEventListener("click", () => {
      if (state.selectMode && L.gallery) L.gallery.toggleSelect(it, c);
      else if (L.detail) L.detail.open(it);
    });
    return c;
  }

  function setView(view) {
    // 离开产品灵感库时退出选品态，避免残留 selectMode 让其它视图卡片点击误触勾选。
    if (view !== "library" && state.selectMode && L.gallery) L.gallery.setSelectMode(false);
    state.view = view;
    document.body.dataset.view = view;
    $("#view-home").hidden = view !== "home";
    $("#view-library").hidden = view !== "library";
    $("#view-creative").hidden = view !== "creative";
    $("#view-account").hidden = view !== "account";
    $("#view-reqform").hidden = view !== "reqform";
    const rm = $("#view-reqmulti"); if (rm) rm.hidden = view !== "reqmulti";
    $("#reqformTools").hidden = view !== "reqform";
    // 顶部切换高亮按板块分组：home/library/account→选品库，creative→创意灵感库，reqform/reqmulti→研发需求。
    const group = view === "creative" ? "creative"
      : (view === "reqform" || view === "reqmulti") ? "reqform"
      : "home";
    $$("#viewSwitch button").forEach((b) => b.classList.toggle("active", b.dataset.view === group));
    $("#selbar").hidden = !(view === "library" && state.selectMode && state.selected.size > 0);
    if (view === "home" && L.home) L.home.render();
    if (view === "library" && L.gallery) L.gallery.render();
    if (view === "creative" && L.creative) L.creative.render();
    if (view === "account" && L.account) L.account.render();
  }

  // 拉产品灵感（kind=product）→ 重渲当前视图（首页/产品灵感库）。创意灵感由 L.creative.reload() 各拉各的。
  async function loadData() {
    try {
      const data = await api.list({ kind: "product" });
      state.items = data.items || [];
    } catch (e) {
      if (e.status === 401) return;
      toast(e.message || "加载失败", true);
      return;
    }
    if (state.view === "home" && L.home) L.home.render();
    else if (state.view === "library" && L.gallery) L.gallery.render();
  }

  Object.assign(L, {
    api, $, $$, state, el, fmtDate, fieldLabel, opt, toast, dataURLtoBlob,
    brandOpt, pickedBrands, openModal, closeModal, bindModalClose,
    isAdmin, galleryCard, setView, loadData,
  });
  return L;
})();
