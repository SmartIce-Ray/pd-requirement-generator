// 选品详情：看图 + 改标签。归属——admin 全权；采集员仅能改/删自己的（非本人只读，后端再校验）。
(function () {
  const L = window.RD.lib;
  const { $, state, el, fieldLabel, opt, brandOpt, pickedBrands, openModal, closeModal, bindModalClose, toast, isAdmin } = L;
  const api = L.api;

  function isOwner(it) { return isAdmin() || !!(state.me && it.uploader_id && it.uploader_id === state.me.uid); }
  // 按条目用途重载对应板块（产品→首页/产品库，创意→创意库）。
  function reloadBoard(it) {
    if ((it.kind || "product") === "creative") { if (L.creative) L.creative.reload(); }
    else L.loadData();
  }

  function open(it) {
    state.detailItem = it;
    const editable = isOwner(it);
    $("#detailModal .modal-head h3").textContent = (it.kind || "product") === "creative" ? "创意详情" : "选品详情";
    const body = $("#detailBody"); body.innerHTML = "";
    const img = el("img", "detail-img"); img.alt = "选品图"; img.src = api.imgUrl(it.id); body.appendChild(img);
    body.appendChild(el("div", "detail-uploader", "上传人：" + (it.uploader_name || "（已删除）")));

    body.appendChild(fieldLabel("品牌（可多选）"));
    const bp = el("div", "brand-picker"); bp.id = "detailBrands";
    (state.config.brands || []).forEach((b) => bp.appendChild(brandOpt(b.name, (it.brands || []).includes(b.name))));
    body.appendChild(bp);

    body.appendChild(fieldLabel("分类"));
    const sel = el("select"); sel.id = "detailCat"; sel.appendChild(opt("", "请选择分类"));
    // 分类下拉只列本条用途（product / creative）的分类，别把菜品和设计视觉混在一起。
    const cats = (state.config.categories || []).filter((c) => c.kind === (it.kind || "product"));
    cats.forEach((c) => sel.appendChild(opt(c.name, c.name)));
    // 兼容历史：当前分类已被删除/自定义时仍保留可选
    if (it.category && !cats.some((c) => c.name === it.category)) sel.appendChild(opt(it.category, it.category));
    sel.value = it.category || "";
    body.appendChild(sel);

    // 菜系（可留空）——仅产品条目；创意不涉及菜系。
    if ((it.kind || "product") !== "creative") {
      body.appendChild(fieldLabel("菜系（可留空）"));
      const cuiSel = el("select"); cuiSel.id = "detailCuisine"; cuiSel.appendChild(opt("", "（不限 / 暂不标）"));
      (state.config.cuisines || []).forEach((c) => cuiSel.appendChild(opt(c.name, c.name)));
      // 兼容历史：当前菜系已不在清单时仍保留可选
      if (it.cuisine && !(state.config.cuisines || []).some((c) => c.name === it.cuisine)) cuiSel.appendChild(opt(it.cuisine, it.cuisine));
      cuiSel.value = it.cuisine || "";
      body.appendChild(cuiSel);
    }

    body.appendChild(fieldLabel("想法"));
    const ta = el("textarea"); ta.id = "detailNotes"; ta.rows = 3; ta.value = it.notes || "";
    body.appendChild(ta);

    if (!editable) {
      body.querySelectorAll("button.brand-opt, select, textarea").forEach((e) => { e.disabled = true; });
      body.appendChild(el("div", "detail-readonly", "只有上传人本人或管理员可以修改 / 删除这条。"));
    }
    $("#detailSave").hidden = !editable;
    $("#detailDel").hidden = !editable;
    openModal("#detailModal");
  }

  async function saveDetail() {
    const it = state.detailItem; if (!it) return;
    const creative = (it.kind || "product") === "creative";
    const brands = pickedBrands($("#detailBrands"));
    const category = $("#detailCat").value;
    if (!creative && !brands.length) { toast("品牌不能为空", true); return; }  // 创意品牌可空
    if (!category) { toast("请选择分类", true); return; }
    const patch = { brands, category, notes: $("#detailNotes").value };
    const cuiEl = $("#detailCuisine");
    if (cuiEl) patch.cuisine = cuiEl.value;  // 产品条目才有菜系；空串 → 后端归 null（清空）
    const btn = $("#detailSave"); btn.disabled = true;
    try { await api.update(it.id, patch); closeModal("#detailModal"); toast("已保存"); reloadBoard(it); }
    catch (e) { toast(e.message || "保存失败", true); if (e.status === 404) { closeModal("#detailModal"); reloadBoard(it); } }
    finally { btn.disabled = false; }
  }

  async function deleteDetail() {
    const it = state.detailItem; if (!it) return;
    const noun = (it.kind || "product") === "creative" ? "创意" : "选品";
    if (!confirm(`删除这条${noun}？图片也会一并删除。`)) return;
    try { await api.remove(it.id); closeModal("#detailModal"); toast("已删除"); reloadBoard(it); }
    catch (e) { toast(e.message || "删除失败", true); if (e.status === 404) { closeModal("#detailModal"); reloadBoard(it); } }
  }

  function initEvents() {
    bindModalClose("#detailModal");
    $("#detailSave").addEventListener("click", saveDetail);
    $("#detailDel").addEventListener("click", deleteDetail);
  }

  L.detail = { open, initEvents };
})();
