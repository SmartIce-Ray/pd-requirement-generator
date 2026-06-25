// 多产品研发需求清单：从选品勾选进入，每个选品 = 一个产品块，补字段后一键生成清单 PPT。
// 生成即走：字段本地存草稿（不含图，图从选品再取），生成成功后清该批草稿。
window.RD = window.RD || {};
(function () {
  const api = window.RD.api;
  const S = () => window.RD.schema;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let blocks = []; // 产品块状态数组
  let batch = { reqName: "", brand: "", brandLocked: false }; // 整批共享：总需求名 + 品牌（品牌锁定时来自选品筛选）
  const DRAFT_KEY = "rd_multi_draft_v1";
  const BATCH_KEY = "rd_multi_batch_v1"; // 整批草稿，按选品集合分别存

  // ---------- 工具 ----------
  let toastTimer;
  function toast(msg, isErr) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.hidden = false; t.classList.toggle("err", !!isErr);
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 250); }, 3000);
  }
  function status(s) { $("#rmStatus").textContent = s || ""; }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fieldLabel(t) { return el("label", "field-label", t); }
  function option(v, t) { const o = document.createElement("option"); o.value = v; o.textContent = t; return o; }

  function blobToDataURL(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
  function imageDims(dataURL) { return new Promise((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 1, h: 1 }); im.src = dataURL; }); }
  async function pickToRef(id) {
    const res = await fetch(api.imgUrl(id), { credentials: "same-origin" });
    if (!res.ok) throw new Error("取图失败");
    const dataURL = await blobToDataURL(await res.blob());
    const { w, h } = await imageDims(dataURL);
    return { dataURL, w, h, note: "", source: "" };
  }

  // ---------- 草稿 ----------
  function loadDrafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch { return {}; } }
  let draftWarned = false;
  function saveDrafts(m) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(m)); }
    catch (e) {
      console.warn("draft_save_failed", e);
      if (!draftWarned) { draftWarned = true; toast("草稿无法自动保存（浏览器存储受限），请尽快生成", true); }
    }
  }
  // 品牌/分类的真源：优先用 library 从 /api/config 拿到的（后端单一真源 + 含自定义分类）。
  function cfgBrands() { const c = window.RD.library && window.RD.library.getConfig && window.RD.library.getConfig(); return (c && c.brands) || window.RD.brands || []; }
  function cfgCatNames() { const c = window.RD.library && window.RD.library.getConfig && window.RD.library.getConfig(); return (c && c.categories) ? c.categories.map((x) => x.name) : (S().categories || []); }
  // 整批草稿：总需求名 + 品牌，按选品集合（pickId 排序后拼成 key）分别存，换一批不串
  function loadBatches() { try { return JSON.parse(localStorage.getItem(BATCH_KEY)) || {}; } catch { return {}; } }
  // key 由 ids 派生（不传则用当前 blocks）；clearDraftFor 传入要清的 ids，保证存/清同一把 key
  function batchKey(ids) { return (ids || blocks.map((b) => b.pickId)).slice().sort().join(","); }
  function saveBatches(bm) {
    try { localStorage.setItem(BATCH_KEY, JSON.stringify(bm)); }
    catch (e) {
      console.warn("batch_draft_save_failed", e);
      if (!draftWarned) { draftWarned = true; toast("草稿无法自动保存（浏览器存储受限），请尽快生成", true); }
    }
  }
  let persistTimer;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const m = loadDrafts();
      blocks.forEach((b) => { m[b.pickId] = { desc: b.desc, present: b.present, avoidOverall: b.avoidOverall, category: b.category, flavors: b.flavors, flavorNote: b.flavorNote, extras: b.extras, owner: b.owner, launchTime: b.launchTime }; });
      saveDrafts(m);
      const bm = loadBatches(); bm[batchKey()] = { reqName: batch.reqName, brand: batch.brand }; saveBatches(bm);
    }, 500);
  }
  function clearDraftFor(ids) {
    const m = loadDrafts(); ids.forEach((id) => delete m[id]); saveDrafts(m);
    const bm = loadBatches(); delete bm[batchKey(ids)]; saveBatches(bm);
  }

  function isRealBrand(name) { return !!name && cfgBrands().some((b) => b.name === name); }
  // 选品全是同一个品牌时（哪怕筛选用的是「全部」）预填，混牌则留空让用户选一次
  function soleBrand(picks) {
    const set = new Set();
    picks.forEach((p) => (p.brands || []).forEach((b) => set.add(b)));
    return set.size === 1 ? [...set][0] : "";
  }

  // ---------- 入口 ----------
  // filterBrand：选品时的品牌筛选值；是真实品牌则整批锁定该品牌、只读显示，否则顶部让用户选一次
  async function start(picks, filterBrand) {
    const drafts = loadDrafts();
    blocks = picks.map((p) => {
      const d = drafts[p.id] || {};
      return {
        pickId: p.id,
        desc: d.desc != null ? d.desc : (p.notes || ""),
        present: d.present || "",
        avoidOverall: d.avoidOverall || "",
        category: d.category != null ? d.category : (p.category || ""),
        flavors: d.flavors || [],
        flavorNote: d.flavorNote || "",
        extras: d.extras || {},
        owner: d.owner || "",
        launchTime: d.launchTime || "",
        refs: [],
        _refsLoading: true,
      };
    });
    const locked = isRealBrand(filterBrand);
    const savedBatch = loadBatches()[batchKey()] || {};
    const sole = soleBrand(picks);
    // 非锁定时的预填都要过 isRealBrand 校验，避免已重命名/删除的旧品牌标签悄悄进 PPT
    const prefill = isRealBrand(savedBatch.brand) ? savedBatch.brand : (isRealBrand(sole) ? sole : "");
    batch = {
      reqName: savedBatch.reqName || "",
      brand: locked ? filterBrand : prefill,
      brandLocked: locked,
    };
    window.RD.library.setView("reqmulti");
    $("#rmTitle").textContent = `研发需求清单 · ${blocks.length} 个产品`;
    $("#rmGenResult").hidden = true;
    renderBatch();
    render();
    // 异步取每个选品的图作为首张参考图
    await Promise.all(blocks.map(async (b) => {
      try { b.refs = [await pickToRef(b.pickId)]; } catch (e) { console.warn("ref_fetch_failed", b.pickId, e); b.refs = []; }
      b._refsLoading = false;
      renderRefs(b);
    }));
  }

  // ---------- 渲染 ----------
  function render() {
    const list = $("#rmList"); list.innerHTML = "";
    blocks.forEach((b, i) => list.appendChild(renderBlock(b, i)));
  }

  // ---------- 整批头部：总需求名 + 品牌（锁定时只读，否则单选一次）----------
  function renderBatch() {
    const host = $("#rmBatch"); if (!host) return;
    host.innerHTML = "";
    const card = el("div", "rm-batch-card");

    card.appendChild(fieldLabel("总需求名"));
    const name = el("input"); name.type = "text"; name.placeholder = "给这一批起个名，如「夏季解腻新品一批」";
    name.value = batch.reqName || "";
    name.addEventListener("input", () => { batch.reqName = name.value; persist(); });
    card.appendChild(name);

    card.appendChild(fieldLabel("品牌"));
    if (batch.brandLocked) {
      const lk = el("div", "rm-brand-locked");
      lk.appendChild(el("span", "name", batch.brand));
      lk.appendChild(el("span", "from", "来自选品筛选"));
      card.appendChild(lk);
    } else {
      card.appendChild(batchBrandPicker());
    }
    host.appendChild(card);
  }
  function batchBrandPicker() {
    const row = el("div", "brand-picker");
    cfgBrands().forEach((br) => {
      const opt = el("button", "brand-opt" + (batch.brand === br.name ? " sel" : ""));
      opt.type = "button"; opt.dataset.name = br.name;
      const chk = el("span", "check", "✓"); opt.append(chk, document.createTextNode(br.name));
      opt.addEventListener("click", () => {
        batch.brand = br.name;
        $$(".brand-opt", row).forEach((o) => o.classList.toggle("sel", o.dataset.name === br.name));
        persist();
      });
      row.appendChild(opt);
    });
    return row;
  }

  function extrasBox(b) {
    const box = el("div", "grid2");
    (S().categoryExtra[b.category] || []).forEach((e) => {
      const wrap = el("div");
      wrap.appendChild(fieldLabel(e.label));
      const inp = el("input"); inp.type = "text"; inp.placeholder = e.ph || ""; inp.value = b.extras[e.key] || "";
      inp.addEventListener("input", () => { b.extras[e.key] = inp.value; persist(); });
      wrap.appendChild(inp); box.appendChild(wrap);
    });
    return box;
  }

  function flavorsDetails(b) {
    const d = el("details"); const sum = el("summary");
    const updSum = () => { sum.textContent = `味型 / 风味方向（已选 ${b.flavors.length}）`; };
    updSum();
    d.appendChild(sum);
    const picker = el("div", "flavor-picker");
    (S().flavorGroups || []).forEach((g) => {
      const wrap = el("div", "flavor-group");
      wrap.appendChild(el("div", "flavor-group-title", g.group));
      const chips = el("div", "flavor-chips");
      g.flavors.forEach((f) => {
        const chip = el("button", "flavor-chip" + (b.flavors.includes(f) ? " sel" : ""), f); chip.type = "button";
        chip.addEventListener("click", () => {
          const i = b.flavors.indexOf(f);
          if (i >= 0) b.flavors.splice(i, 1); else b.flavors.push(f);
          chip.classList.toggle("sel"); updSum(); persist();
        });
        chips.appendChild(chip);
      });
      wrap.appendChild(chips); picker.appendChild(wrap);
    });
    d.appendChild(picker);
    return d;
  }

  function renderRefs(b) {
    if (!b._refsEl) return;
    const box = b._refsEl; box.innerHTML = "";
    if (b._refsLoading) { box.appendChild(el("div", "rm-ref add", "取图中…")); return; }
    b.refs.forEach((r, idx) => {
      const w = el("div", "rm-ref");
      const img = el("img"); img.alt = "参考图"; img.src = r.dataURL;
      const del = el("button", "rm-ref-del", "×"); del.type = "button";
      del.addEventListener("click", () => { b.refs.splice(idx, 1); renderRefs(b); });
      w.append(img, del); box.appendChild(w);
    });
    const add = el("div", "rm-ref add", "+ 加图");
    add.addEventListener("click", () => addRef(b));
    box.appendChild(add);
  }
  function addRef(b) {
    const inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.hidden = true;
    document.body.appendChild(inp);
    inp.addEventListener("change", async () => {
      for (const f of Array.from(inp.files || [])) {
        try { const r = await window.RD.images.process(f); b.refs.push({ dataURL: r.dataURL, w: r.w, h: r.h, note: "", source: "" }); }
        catch (e) { toast(e && e.message || "图片处理失败", true); }
      }
      renderRefs(b); inp.remove();
    });
    inp.click();
  }

  function bindInput(node, b, key) {
    node.value = b[key] || "";
    node.addEventListener("input", () => {
      b[key] = node.value;
      persist();
    });
  }
  function whoText(b) { return b.category || "待填品类"; }

  function renderBlock(b, i) {
    const block = el("div", "rm-block"); b._el = block;
    const head = el("div", "rm-head");
    head.appendChild(el("div", "num", String(i + 1)));
    head.appendChild(el("div", "who", whoText(b)));
    block.appendChild(head);

    // 参考图
    const refsEl = el("div", "rm-refs"); b._refsEl = refsEl; block.appendChild(refsEl); renderRefs(b);

    // 需求描述
    block.appendChild(fieldLabel("需求描述"));
    const desc = el("textarea"); desc.rows = 3; desc.placeholder = "要研发什么、给谁、什么场景、对标什么…"; bindInput(desc, b, "desc"); block.appendChild(desc);

    // 品类
    block.appendChild(fieldLabel("品类"));
    const cat = el("select"); cat.appendChild(option("", "请选择"));
    const catNames = cfgCatNames();
    catNames.forEach((c) => cat.appendChild(option(c, c)));
    if (b.category && !catNames.includes(b.category)) cat.appendChild(option(b.category, b.category)); // 保留自定义/已删分类
    cat.value = b.category || "";
    const extrasWrap = el("div");
    extrasWrap.appendChild(extrasBox(b));
    cat.addEventListener("change", () => { b.category = cat.value; b.extras = {}; extrasWrap.innerHTML = ""; extrasWrap.appendChild(extrasBox(b)); $(".who", b._el).textContent = whoText(b); persist(); });
    block.appendChild(cat);
    block.appendChild(extrasWrap);

    // 味型（折叠）
    block.appendChild(flavorsDetails(b));

    // 更多（折叠）
    const more = el("details"); more.appendChild(el("summary", null, "更多：呈现 / 规避 / 味型备注 / 承接排期"));
    more.appendChild(fieldLabel("呈现要点"));
    const present = el("textarea"); present.rows = 2; present.placeholder = "摆盘 / 器皿 / 份量感 / 上桌效果 / 命名…"; bindInput(present, b, "present"); more.appendChild(present);
    more.appendChild(fieldLabel("整体不要 / 规避"));
    const avoid = el("textarea"); avoid.rows = 2; avoid.placeholder = "别人的翻车点、不符合本品牌的、成本不可行的…"; bindInput(avoid, b, "avoidOverall"); more.appendChild(avoid);
    more.appendChild(fieldLabel("味型备注"));
    const fn = el("textarea"); fn.rows = 2; fn.placeholder = "选项之外的口味方向 / 特别要求…"; bindInput(fn, b, "flavorNote"); more.appendChild(fn);
    const grid = el("div", "grid2");
    const ownerW = el("div"); ownerW.appendChild(fieldLabel("承接人")); const owner = el("input"); owner.type = "text"; owner.placeholder = "研发负责人"; bindInput(owner, b, "owner"); ownerW.appendChild(owner);
    const launchW = el("div"); launchW.appendChild(fieldLabel("期望上新")); const launch = el("input"); launch.type = "text"; launch.placeholder = "目标上新时间"; bindInput(launch, b, "launchTime"); launchW.appendChild(launch);
    grid.append(ownerW, launchW); more.appendChild(grid);
    block.appendChild(more);

    return block;
  }

  // ---------- 生成 ----------
  function toProductData(b) {
    const extras = (S().categoryExtra[b.category] || []).map((e) => ({ label: e.label, value: b.extras[e.key] || "" }));
    return {
      desc: b.desc, present: b.present, avoidOverall: b.avoidOverall,
      refs: b.refs.filter((r) => r.dataURL),
      category: b.category, flavors: b.flavors, flavorNote: b.flavorNote, extras,
      owner: b.owner, launchTime: b.launchTime,
    };
  }
  function result(msg, isErr) { const r = $("#rmGenResult"); r.hidden = false; r.classList.toggle("err", !!isErr); r.textContent = msg; }
  async function generate() {
    if (!(batch.reqName || "").trim()) { toast("请先填写总需求名", true); return; }
    if (!batch.brand) { toast("请先选择品牌", true); return; }
    if (blocks.some((b) => b._refsLoading)) { toast("参考图还在取，请稍候", true); return; }
    const btn = $("#rmGenerate"); btn.disabled = true; status("排版生成中…"); $("#rmGenResult").hidden = true;
    try {
      const products = blocks.map(toProductData);
      const blob = await window.RD.deck.buildDeckMulti(products, { date: new Date(), brand: batch.brand, reqName: (batch.reqName || "").trim() });
      const fname = `产品研发需求清单-${window.RD.fs.dateStamp(new Date())}.pptx`;
      window.RD.fs.download(blob, fname);
      clearDraftFor(blocks.map((b) => b.pickId));
      result(`已生成并下载：${fname}（在下载文件夹）`);
      toast("已生成研发需求清单");
    } catch (e) {
      console.error(e); result("生成失败：" + ((e && e.message) || e) + "。已填内容仍在，可重试。", true); toast("生成失败，请重试", true);
    } finally { btn.disabled = false; status(""); }
  }

  function init() {
    $("#rmBack").addEventListener("click", () => window.RD.library.setView("library"));
    $("#rmGenerate").addEventListener("click", generate);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.RD.reqformMulti = { start };
})();
