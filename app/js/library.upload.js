// 上传：先囤后理——倒图后逐张打标，「品牌+分类」必填才能入库（前端拦，后端再拦）。
(function () {
  const L = window.RD.lib;
  const { $, $$, state, el, toast, brandOpt, pickedBrands, opt, openModal, closeModal, bindModalClose, dataURLtoBlob, fieldLabel } = L;
  const api = L.api;

  function cardComplete(c) {
    if (!c.dataURL || !c.catEl.value) return false;
    if (state.uploadKind === "creative") return true;   // 创意：品牌可空，选了分类即算完整
    return pickedBrands(c.brandsEl).length > 0;
  }
  function updateUploadState() {
    const ready = state.upCards.filter((c) => c.dataURL);
    const incomplete = ready.filter((c) => !cardComplete(c));
    const btn = $("#upSaveBtn");
    btn.disabled = ready.length === 0 || incomplete.length > 0;
    btn.textContent = ready.length ? `保存全部（${ready.length} 张）` : "保存全部";
    state.upCards.forEach((c) => { if (c.el) c.el.classList.toggle("incomplete", !!c.dataURL && !cardComplete(c)); });
    const lack = state.uploadKind === "creative" ? "未选分类" : "未选品牌/分类";
    $("#upStatus").textContent = (ready.length && incomplete.length) ? `还有 ${incomplete.length} 张${lack}` : "";
    $("#upDrop").classList.toggle("small", state.upCards.length > 0);
  }

  function open(kind) {
    state.uploadKind = kind === "creative" ? "creative" : "product";
    const creative = state.uploadKind === "creative";
    $("#uploadModal .modal-head h3").textContent = creative ? "上传创意" : "上传灵感";
    $("#uploadModal .modal-body .sec-hint").textContent = creative
      ? "每张图选「分类」才能入库；品牌可选、想法可空。"
      : "每张图都要选「品牌 + 分类」才能入库；想法可空。";
    state.upCards = []; $("#upList").innerHTML = ""; $("#upStatus").textContent = "";
    updateUploadState();
    openModal("#uploadModal");
  }

  function makeUploadCard() {
    const card = el("div", "up-card");
    const thumbWrap = el("div", "up-thumb-wrap");
    const thumb = el("img", "up-thumb loading"); thumb.alt = "预览";
    const del = el("button", "up-del", "×"); del.type = "button"; del.setAttribute("aria-label", "移除这张图");
    thumbWrap.append(thumb, del);
    const right = el("div");
    const bp = el("div", "brand-picker");
    (state.config.brands || []).forEach((b) => bp.appendChild(brandOpt(b.name, false)));
    $$(".brand-opt", bp).forEach((x) => (x._onToggle = updateUploadState));
    const catSel = el("select"); catSel.appendChild(opt("", "请选择分类"));
    (state.config.categories || []).filter((c) => c.kind === state.uploadKind).forEach((c) => catSel.appendChild(opt(c.name, c.name)));
    catSel.addEventListener("change", updateUploadState);
    const notes = el("textarea"); notes.rows = 2; notes.placeholder = "想法 / 灵感（可空）";
    const brandLabel = state.uploadKind === "creative" ? "品牌（可选，可多选）" : "品牌（必选，可多选）";
    right.append(fieldLabel(brandLabel), bp, fieldLabel("分类（必选）"), catSel, notes);
    card.append(thumbWrap, right);
    $("#upList").appendChild(card);
    const obj = { dataURL: "", w: 0, h: 0, el: card, thumb, brandsEl: bp, catEl: catSel, notesEl: notes };
    del.addEventListener("click", () => { card.remove(); state.upCards = state.upCards.filter((c) => c !== obj); updateUploadState(); });
    state.upCards.push(obj);
    return obj;
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
        cardObj.el.remove(); state.upCards = state.upCards.filter((c) => c !== cardObj);
        fails.push(e && e.message);
      }
      updateUploadState();
    }
    if (fails.length) toast(fails.length === 1 ? (fails[0] || "图片处理失败") : `${fails.length} 张未能添加（其余已加）`, true);
  }

  async function saveUpload() {
    const ready = state.upCards.filter((c) => c.dataURL);
    if (!ready.length) return;
    const kind = state.uploadKind;
    if (ready.some((c) => !cardComplete(c))) {
      toast(kind === "creative" ? "每张图都要选分类才能入库" : "每张图都要选品牌和分类才能入库", true);
      updateUploadState(); return;
    }
    const btn = $("#upSaveBtn"); btn.disabled = true;
    let done = 0, fail = 0; const failMsgs = [];
    for (const c of ready) {
      $("#upStatus").textContent = `保存中 ${done + fail + 1} / ${ready.length}`;
      const fd = new FormData();
      fd.append("image", dataURLtoBlob(c.dataURL), "inspiration.jpg");
      fd.append("brands", JSON.stringify(pickedBrands(c.brandsEl)));
      fd.append("category", c.catEl.value || "");
      fd.append("notes", c.notesEl.value || "");
      fd.append("kind", kind);
      try { await api.create(fd); done++; }
      catch (e) { fail++; failMsgs.push(e && e.message); console.error("upload_create_failed", e); if (e.status === 401) break; }
    }
    btn.disabled = false;
    closeModal("#uploadModal");
    const label = kind === "creative" ? "创意" : "灵感";
    toast(fail ? `已存 ${done} 条，${fail} 条失败（${failMsgs[0] || "未知原因"}）` : `已存 ${done} 条${label}`, !!fail);
    if (kind === "creative") { if (L.creative) L.creative.reload(); } else L.loadData();
  }

  function initEvents() {
    bindModalClose("#uploadModal");
    $("#upSaveBtn").addEventListener("click", saveUpload);
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
  }

  L.upload = { open, initEvents };
})();
