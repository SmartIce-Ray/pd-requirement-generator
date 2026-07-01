// 创意灵感库：设计视觉 / 活动创意 / 周边好物（独立板块）。图墙 + 筛选（品牌/分类/上传人）；无选品、不生成 PPT。
// 数据只装 kind=creative（state.creativeItems），与产品灵感库彻底隔离。首次进入才拉，之后内存重渲。
(function () {
  const L = window.RD.lib;
  const { $, state, el, opt, toast, galleryCard } = L;
  const api = L.api;

  let loaded = false;
  let fBrand = "", fCategory = "", fUploader = "";   // 创意库自己的筛选态，不与产品库串用

  function creativeCats() {
    return (state.config.categories || []).filter((c) => c.kind === "creative");
  }
  function uploaderOptions() {
    const seen = new Map();
    state.creativeItems.forEach((it) => { if (it.uploader_id && !seen.has(it.uploader_id)) seen.set(it.uploader_id, it.uploader_name || "（已删除）"); });
    return [...seen].map(([id, name]) => ({ id, name }));
  }
  function matchFilter(it) {
    if (fBrand && !(it.brands || []).includes(fBrand)) return false;
    if (fCategory && it.category !== fCategory) return false;
    if (fUploader && it.uploader_id !== fUploader) return false;
    return true;
  }

  function renderFilter() {
    const bar = $("#creativeFilter"); bar.innerHTML = "";
    const brandRow = el("div", "filter-row");
    const chip = (label, val) => {
      const b = el("button", "filter-chip" + (fBrand === val ? " sel" : ""), label); b.type = "button";
      b.addEventListener("click", () => { fBrand = val; renderFilter(); renderGrid(); });
      return b;
    };
    brandRow.appendChild(chip("全部品牌", ""));
    (state.config.brands || []).forEach((br) => brandRow.appendChild(chip(br.name, br.name)));
    bar.appendChild(brandRow);

    const selRow = el("div", "filter-row");
    const catSel = el("select", "filter-select"); catSel.appendChild(opt("", "全部分类"));
    creativeCats().forEach((c) => catSel.appendChild(opt(c.name, c.name)));
    catSel.value = fCategory;
    catSel.addEventListener("change", () => { fCategory = catSel.value; renderGrid(); });

    const upSel = el("select", "filter-select"); upSel.appendChild(opt("", "全部上传人"));
    uploaderOptions().forEach((u) => upSel.appendChild(opt(u.id, u.name)));
    upSel.value = fUploader;
    upSel.addEventListener("change", () => { fUploader = upSel.value; renderGrid(); });

    selRow.append(catSel, upSel);
    bar.appendChild(selRow);
  }

  function renderGrid() {
    const g = $("#creativeGallery"), empty = $("#creativeEmpty");
    g.innerHTML = "";
    if (!state.creativeItems.length) { empty.hidden = false; empty.textContent = "还没有创意灵感，点「+ 上传创意」开始。"; return; }
    const list = state.creativeItems.filter(matchFilter);
    if (!list.length) { empty.hidden = false; empty.textContent = "没有符合筛选条件的图。"; return; }
    empty.hidden = true;
    list.forEach((it) => g.appendChild(galleryCard(it, { showUploader: true })));
  }

  // 拉 kind=creative → 重渲。成功才标 loaded，失败下次进入会重试。
  async function reload() {
    try {
      const data = await api.list({ kind: "creative" });
      state.creativeItems = data.items || [];
      loaded = true;
    } catch (e) {
      if (e.status === 401) return;
      toast(e.message || "加载失败", true);
      // 失败别留白：内容区给持久提示，loaded 仍为 false，切走再进会重试。
      const empty = $("#creativeEmpty");
      if (empty && !state.creativeItems.length) { empty.hidden = false; empty.textContent = "加载失败，切换板块重进可重试。"; }
      return;
    }
    renderFilter(); renderGrid();
  }

  function render() {
    renderFilter();
    if (loaded) renderGrid();
    else reload();
  }

  // 登出/会话失效时清空创意状态：避免共享设备换人后看到上一会话缓存（下次进入重新拉）。
  function reset() { loaded = false; state.creativeItems = []; }

  L.creative = { render, reload, reset, initEvents() {} };
})();
