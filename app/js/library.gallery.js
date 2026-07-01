// 产品灵感库：全部图网格 + 筛选（品牌/分类/上传人，所有人可用）+ 选品勾选（admin）。
(function () {
  const L = window.RD.lib;
  const { $, state, el, opt, toast, galleryCard, isAdmin } = L;

  function uploaderOptions() {
    const seen = new Map();
    state.items.forEach((it) => { if (it.uploader_id && !seen.has(it.uploader_id)) seen.set(it.uploader_id, it.uploader_name || "（已删除）"); });
    return [...seen].map(([id, name]) => ({ id, name }));
  }
  function matchFilter(it) {
    if (state.filterBrand && !(it.brands || []).includes(state.filterBrand)) return false;
    if (state.filterCategory && it.category !== state.filterCategory) return false;
    if (state.filterUploader && it.uploader_id !== state.filterUploader) return false;
    return true;
  }

  function renderFilter() {
    const bar = $("#libFilter"); bar.innerHTML = "";
    const brandRow = el("div", "filter-row");
    const chip = (label, val) => {
      const b = el("button", "filter-chip" + (state.filterBrand === val ? " sel" : ""), label); b.type = "button";
      b.addEventListener("click", () => { state.filterBrand = val; afterFilterChange(); });
      return b;
    };
    brandRow.appendChild(chip("全部品牌", ""));
    (state.config.brands || []).forEach((br) => brandRow.appendChild(chip(br.name, br.name)));
    bar.appendChild(brandRow);

    const selRow = el("div", "filter-row");
    const catSel = el("select", "filter-select"); catSel.appendChild(opt("", "全部分类"));
    // 产品灵感库只列产品分类（创意分类归创意灵感库，别混进选品筛选）。
    (state.config.categories || []).filter((c) => c.kind === "product").forEach((c) => catSel.appendChild(opt(c.name, c.name)));
    catSel.value = state.filterCategory;
    catSel.addEventListener("change", () => { state.filterCategory = catSel.value; afterFilterChange(); });

    const upSel = el("select", "filter-select"); upSel.appendChild(opt("", "全部上传人"));
    uploaderOptions().forEach((u) => upSel.appendChild(opt(u.id, u.name)));
    upSel.value = state.filterUploader;
    upSel.addEventListener("change", () => { state.filterUploader = upSel.value; afterFilterChange(); });

    selRow.append(catSel, upSel);
    bar.appendChild(selRow);
  }

  function afterFilterChange() {
    if (state.selectMode) { state.selected.clear(); updateSelbar(); } // 切筛选清空已选（Ray 定）
    renderGrid();
  }

  function renderGrid() {
    const g = $("#gallery"), empty = $("#galleryEmpty");
    g.innerHTML = "";
    g.classList.toggle("selectable", state.selectMode);
    if (!state.items.length) { empty.hidden = false; empty.textContent = "还没有灵感图，去首页点「+ 上传灵感」。"; return; }
    const list = state.items.filter(matchFilter);
    if (!list.length) { empty.hidden = false; empty.textContent = "没有符合筛选条件的图。"; return; }
    empty.hidden = true;
    list.forEach((it) => g.appendChild(galleryCard(it, { showUploader: true })));
  }

  function render() { renderFilter(); renderGrid(); }

  function setSelectMode(on) {
    if (on && !isAdmin()) return;
    state.selectMode = on; state.selected.clear();
    const btn = $("#btnSelectMode"); if (btn) { btn.textContent = on ? "退出选品" : "选品"; btn.classList.toggle("sel", on); }
    renderGrid();
    updateSelbar();
  }
  function toggleSelect(it, cardEl) {
    if (state.selected.has(it.id)) { state.selected.delete(it.id); cardEl.classList.remove("sel"); }
    else { state.selected.set(it.id, it); cardEl.classList.add("sel"); }
    updateSelbar();
  }
  function updateSelbar() {
    $("#selCount").textContent = `已选 ${state.selected.size}`;
    $("#selbar").hidden = !(state.view === "library" && state.selectMode && state.selected.size > 0);
  }
  function gen() {
    const picks = Array.from(state.selected.values());
    if (!picks.length) return;
    // 选品时若按某品牌筛选，把该品牌带进生成页整批锁定。
    const filterBrand = state.filterBrand || "";
    if (window.RD.reqformMulti && window.RD.reqformMulti.start) window.RD.reqformMulti.start(picks, filterBrand);
    else toast("研发需求模块未就绪", true);
  }

  L.gallery = { render, setSelectMode, toggleSelect, gen, initEvents() {} };
})();
