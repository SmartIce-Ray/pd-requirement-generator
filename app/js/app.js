// 单页 UI 编排：品牌/传图/填表/生成 全在一屏。
(function () {
  const $ = (s) => document.querySelector(s);
  const S = window.RD.schema;
  let idc = 0;
  let lastBlob = null, lastName = "";
  let activeBatches = 0; // 在途上传批次数：多批并发时只在全部结束才隐藏整批进度

  const state = {
    brand: "", reqName: "",
    desc: "",
    refs: [], avoidOverall: "", present: "",
    category: "", flavors: [], flavorNote: "", extras: {},
    owner: "", launchTime: "",
  };

  // ---------- 工具 ----------
  function save() { window.RD.store.save(state, (s) => { $("#saveStatus").textContent = s; }); }
  let toastTimer = null;
  function toast(msg, isErr) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false; t.classList.toggle("err", !!isErr);
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 250); }, 3200);
  }
  function flashInvalid(elm) { if (!elm) return; elm.classList.add("invalid"); setTimeout(() => elm.classList.remove("invalid"), 1500); }

  // ---------- 渲染：品牌 ----------
  function renderBrands() {
    const box = $("#brandPicker");
    box.innerHTML = "";
    window.RD.brands.forEach((b) => {
      const el = document.createElement("button");
      el.type = "button"; el.className = "brand-opt"; el.setAttribute("role", "radio");
      el.setAttribute("aria-checked", String(state.brand === b.name));
      if (state.brand === b.name) el.classList.add("sel");
      el.innerHTML = `<span class="check">✓</span>${b.name}`;
      el.addEventListener("click", () => {
        state.brand = b.name; renderBrands(); save();
      });
      box.appendChild(el);
    });
  }

  // ---------- 渲染：③ 品类 + 子字段 ----------
  function renderCategory() {
    const sel = $("#category");
    sel.innerHTML = `<option value="">请选择</option>` + S.categories.map((c) => `<option value="${c}">${c}</option>`).join("");
    sel.value = state.category || "";
    sel.addEventListener("change", () => { state.category = sel.value; renderExtras(); save(); });
  }
  function renderExtras() {
    const box = $("#extraFields"); box.innerHTML = "";
    const extras = S.categoryExtra[state.category] || [];
    extras.forEach((e) => {
      const wrap = document.createElement("div");
      wrap.innerHTML = `<label class="field-label" for="ex_${e.key}">${e.label}</label>`;
      const inp = document.createElement("input"); inp.type = "text"; inp.id = "ex_" + e.key;
      inp.placeholder = e.ph || ""; inp.value = state.extras[e.key] || "";
      inp.addEventListener("input", () => { state.extras[e.key] = inp.value; save(); });
      wrap.appendChild(inp); box.appendChild(wrap);
    });
  }

  // ---------- 参考图 ----------
  async function addRefFiles(fileList) {
    const files = [...fileList].filter((f) => f);
    const fails = [];
    const total = files.length;
    const up = $("#uploadProgress"), upText = $("#uploadProgressText");
    let done = 0;
    activeBatches++;
    if (total > 1) { up.hidden = false; upText.textContent = `处理中 0 / ${total}`; } // 整批进度仅多图时显示
    for (const file of files) {
      const ref = { id: ++idc, dataURL: "", w: 0, h: 0, name: file.name, note: "", source: "", loading: true };
      state.refs.push(ref); renderRefs();
      try {
        const r = await window.RD.images.process(file);
        ref.dataURL = r.dataURL; ref.w = r.w; ref.h = r.h; ref.loading = false;
      } catch (e) {
        state.refs = state.refs.filter((x) => x !== ref);
        fails.push({ name: file.name, code: e && e.code, msg: e && e.message });
      }
      done++;
      if (total > 1) upText.textContent = `处理中 ${done} / ${total}`;
      renderRefs(); save();
    }
    activeBatches--;
    if (activeBatches === 0) up.hidden = true; // 多批并发时只在全部结束才隐藏
    // 批量失败汇总成一条，避免多张同时失败时 toast 互相覆盖、只看到最后一条
    if (fails.length === 1) toast(fails[0].msg || "图片处理失败", true);
    else if (fails.length > 1) {
      const heic = fails.some((f) => f.code === "HEIC");
      toast(`${fails.length} 张图片未能添加${heic ? "（含 iPhone 原图 HEIC，请转 JPG 或传截图）" : ""}，其余已添加`, true);
    }
  }

  function renderRefs() {
    const box = $("#refList"); box.innerHTML = "";
    state.refs.forEach((ref, idx) => {
      const item = document.createElement("div");
      item.className = "ref-item"; item.draggable = true;
      const hasImg = ref.dataURL && !ref.loading;
      const thumb = ref.loading ? `<div class="ref-thumb loading"><span class="spinner" aria-hidden="true"></span>处理中…</div>`
        : hasImg ? `<img class="ref-thumb" alt="参考图">`
        : `<div class="ref-thumb loading">图片未存入草稿，请重新上传</div>`;
      // 仅静态结构走 innerHTML（无用户数据）；用户文本/图片用属性设置，防破坏 DOM 与 XSS。
      item.innerHTML = `
        <div class="ref-handle">⋮⋮ 拖动排序 · 第 ${idx + 1} 张</div>
        <button class="ref-del" type="button" aria-label="删除">×</button>
        ${thumb}
        <textarea data-k="note" rows="2" placeholder="要点说明：这张要借鉴 / 注意什么（杯型 / 配色 / 份量 / 命名…）"></textarea>
        <input data-k="source" type="text" placeholder="来源：小红书 / 抖音…">
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn-ghost up" type="button" aria-label="上移">↑</button>
          <button class="btn-ghost down" type="button" aria-label="下移">↓</button>
        </div>`;
      if (hasImg) item.querySelector("img.ref-thumb").src = ref.dataURL;
      item.querySelector('[data-k="note"]').value = ref.note || "";
      item.querySelector('[data-k="source"]').value = ref.source || "";
      item.querySelectorAll("[data-k]").forEach((inp) => {
        inp.addEventListener("input", () => { ref[inp.dataset.k] = inp.value; save(); });
      });
      item.querySelector(".ref-del").addEventListener("click", () => { state.refs.splice(idx, 1); renderRefs(); save(); });
      item.querySelector(".up").addEventListener("click", () => move(idx, -1));
      item.querySelector(".down").addEventListener("click", () => move(idx, 1));
      item.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", String(idx)); item.classList.add("dragging"); });
      item.addEventListener("dragend", () => item.classList.remove("dragging"));
      item.addEventListener("dragover", (e) => { e.preventDefault(); item.classList.add("over"); });
      item.addEventListener("dragleave", () => item.classList.remove("over"));
      item.addEventListener("drop", (e) => {
        e.preventDefault(); item.classList.remove("over");
        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (!isNaN(from) && from !== idx) { const [m] = state.refs.splice(from, 1); state.refs.splice(idx, 0, m); renderRefs(); save(); }
      });
      box.appendChild(item);
    });
  }
  function move(idx, dir) {
    const j = idx + dir; if (j < 0 || j >= state.refs.length) return;
    const [m] = state.refs.splice(idx, 1); state.refs.splice(j, 0, m); renderRefs(); save();
  }

  // ---------- 味型参考（多选 chips）----------
  function renderFlavors() {
    const box = $("#flavorPicker"); box.innerHTML = "";
    (S.flavorGroups || []).forEach((g) => {
      const wrap = document.createElement("div"); wrap.className = "flavor-group";
      const h = document.createElement("div"); h.className = "flavor-group-title"; h.textContent = g.group;
      wrap.appendChild(h);
      const row = document.createElement("div"); row.className = "flavor-chips";
      g.flavors.forEach((f) => {
        const chip = document.createElement("button");
        chip.type = "button"; chip.className = "flavor-chip"; chip.textContent = f;
        chip.setAttribute("aria-pressed", String(state.flavors.includes(f)));
        if (state.flavors.includes(f)) chip.classList.add("sel");
        chip.addEventListener("click", () => {
          const i = state.flavors.indexOf(f);
          if (i >= 0) state.flavors.splice(i, 1); else state.flavors.push(f);
          chip.classList.toggle("sel");
          chip.setAttribute("aria-pressed", String(i < 0));
          save();
        });
        row.appendChild(chip);
      });
      wrap.appendChild(row); box.appendChild(wrap);
    });
  }

  // ---------- 拖拽 / 粘贴 通用绑定 ----------
  function bindDrop(zoneId, inputId, onFiles, multiple) {
    const zone = $(zoneId), input = $(inputId);
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", () => { if (input.files.length) onFiles(multiple ? input.files : [input.files[0]]); input.value = ""; });
    ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("drag"); }));
    zone.addEventListener("drop", (e) => {
      const fs = [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(f.name));
      if (fs.length) onFiles(multiple ? fs : [fs[0]]);
    });
  }

  // ---------- 简单字段绑定 ----------
  function bindSimple(id, key) {
    const inp = $(id); inp.value = state[key] || "";
    inp.addEventListener("input", () => { state[key] = inp.value; save(); });
  }

  // ---------- 生成 ----------
  function toDeckData() {
    const extras = (S.categoryExtra[state.category] || []).map((e) => ({ label: e.label, value: state.extras[e.key] || "" }));
    return {
      brand: state.brand, reqName: state.reqName.trim(), date: new Date(),
      desc: state.desc, refs: state.refs.filter((r) => r.dataURL),
      avoidOverall: state.avoidOverall, present: state.present,
      category: state.category, flavors: state.flavors, flavorNote: state.flavorNote, extras,
      owner: state.owner, launchTime: state.launchTime,
    };
  }

  function showProgress(on, msg) { $("#genProgress").hidden = !on; if (msg) $("#genStatus").textContent = msg; }
  function resultEl(isErr) { const r = $("#genResult"); r.hidden = false; r.classList.toggle("err", !!isErr); r.innerHTML = ""; return r; }
  function boldNode(t) { const b = document.createElement("b"); b.textContent = t; return b; }

  async function generate() {
    if (!state.brand) { toast("请先选品牌", true); flashInvalid($("#brandPicker")); return; }
    if (!state.reqName.trim()) { toast("请填需求名", true); flashInvalid($("#reqName")); return; }
    if (state.refs.some((r) => r.loading)) { toast("图片还在处理，请稍候再生成", true); return; }

    const btn = $("#btnGenerate");
    const btnText = btn.textContent;
    btn.disabled = true; btn.textContent = "生成中…"; $("#genResult").hidden = true;
    showProgress(true, "排版中…");
    try {
      // 1) 先在用户手势内拿到目录授权（避免被后续 await 消耗手势）
      let root = null;
      if (window.RD.fs.supported) {
        try { root = await window.RD.fs.ensureRoot(); }
        catch (e) {
          root = null;
          // AbortError = 用户主动取消选目录（正常降级下载）；其它 = 真失败，要让用户知道不是"成功存文件夹"
          if (!(e && e.name === "AbortError")) {
            console.error("访问文件夹失败", e);
            toast("无法访问文件夹，已改为下载到下载文件夹", true);
          }
        }
      }
      // 2) 生成
      showProgress(true, "嵌入图片…");
      const blob = await window.RD.deck.buildDeck(toDeckData());
      lastBlob = blob; lastName = window.RD.fs.filename(state.brand, state.reqName.trim(), new Date());
      showProgress(true, "即将完成…");
      // 3) 落地
      let res;
      if (root) {
        const path = await window.RD.fs.write(root, state.brand, lastName, blob);
        res = { mode: "folder", path };
      } else {
        window.RD.fs.download(blob, lastName); res = { mode: "download", path: lastName };
      }
      if (res.mode === "folder") {
        const r = resultEl(); r.append("已生成并存入 ", boldNode(res.path));
        toast("已存入品牌文件夹");
      } else {
        const r = resultEl();
        r.append("已生成并下载：", boldNode(res.path), "（已放到下载文件夹，请拖进对应品牌的需求文件夹）");
        const btn = document.createElement("button"); btn.className = "link relink"; btn.type = "button"; btn.textContent = "重新下载";
        btn.addEventListener("click", () => window.RD.fs.download(lastBlob, lastName));
        r.append(btn);
        toast("已下载到下载文件夹");
      }
    } catch (e) {
      console.error(e);
      resultEl(true).textContent = `生成失败：${(e && e.message) || e}。已填内容仍在，可重试。`;
      toast("生成失败，请重试", true);
    } finally {
      btn.disabled = false; btn.textContent = btnText; showProgress(false);
    }
  }

  // ---------- 草稿恢复 ----------
  function applyDraft(d) {
    Object.assign(state, d);
    state.desc = d.desc || "";
    state.refs = (d.refs || []).map((r) => Object.assign({ id: ++idc, loading: false }, r));
    state.extras = d.extras || {};
    state.flavors = d.flavors || []; // 显式重置多选，避免导入草稿残留上一份
    renderAll();
  }
  function renderAll() {
    renderBrands(); renderCategory(); renderExtras(); renderFlavors(); renderRefs();
    $("#reqName").value = state.reqName || "";
    $("#reqDesc").value = state.desc || "";
    ["avoidOverall", "present", "flavorNote", "owner", "launchTime"].forEach((k) => { if ($("#" + k)) $("#" + k).value = state[k] || ""; });
  }

  // ---------- init ----------
  function init() {
    renderBrands(); renderCategory(); renderExtras(); renderFlavors();
    bindSimple("#reqName", "reqName");
    bindSimple("#reqDesc", "desc");
    bindSimple("#avoidOverall", "avoidOverall");
    bindSimple("#present", "present");
    bindSimple("#flavorNote", "flavorNote");
    bindSimple("#owner", "owner");
    bindSimple("#launchTime", "launchTime");

    bindDrop("#dropZone", "#fileInput", addRefFiles, true);

    // 全局粘贴：有图就进参考图
    document.addEventListener("paste", (e) => {
      const items = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith("image/"));
      if (items.length) { addRefFiles(items.map((i) => i.getAsFile()).filter(Boolean)); }
    });

    $("#btnGenerate").addEventListener("click", generate);
    $("#btnExport").addEventListener("click", () => window.RD.store.exportJSON(state));
    $("#btnImport").addEventListener("click", () => $("#fileImport").click());
    $("#fileImport").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { applyDraft(await window.RD.store.importJSON(f)); toast("草稿已导入"); save(); }
      catch (_) { toast("导入失败：不是有效的草稿文件", true); }
      e.target.value = "";
    });

    // 保存方式提示
    $("#saveModeHint").textContent = window.RD.fs.supported
      ? "生成后将存入你授权的文件夹下「品牌/需求/」，首次会让你授权一次（用 Chrome/Edge）。"
      : "当前浏览器不支持直接写文件夹，将下载到「下载文件夹」，命名为 品牌-需求名-日期.pptx。";

    // 草稿恢复
    const d = window.RD.store.load();
    if (d && (d.reqName || d.brand || (d.refs && d.refs.length))) {
      $("#draftBar").hidden = false;
      $("#btnRestore").addEventListener("click", () => { applyDraft(d); $("#draftBar").hidden = true; toast("已恢复上次草稿"); });
      $("#btnDiscard").addEventListener("click", () => { window.RD.store.clear(); $("#draftBar").hidden = true; });
    }

    // 侧栏滚动高亮
    const links = [...document.querySelectorAll(".sidenav a")];
    const secs = links.map((a) => document.getElementById(a.dataset.sec)).filter(Boolean);
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) { links.forEach((l) => l.classList.toggle("active", l.dataset.sec === en.target.id)); } });
    }, { rootMargin: "-40% 0px -55% 0px" });
    secs.forEach((s) => io.observe(s));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
