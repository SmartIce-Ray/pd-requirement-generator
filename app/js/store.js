// 草稿持久化：localStorage 自动存（防刷新丢）+ JSON 导出/导入（完整存档，含图片）。
window.RD = window.RD || {};
(function () {
  const KEY = "rd_draft_v1";
  let timer = null;
  let lastStatus = "";

  // 防抖保存。images 较大时 localStorage 可能超额 → 退回只存文字，绝不报错卡死。
  function save(state, onStatus) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        setStatus("已保存", onStatus);
      } catch (e) {
        try {
          // 直接构造"去图"轻量版，不先深拷贝重对象（省内存，避免在内存紧张时再翻倍）。
          const light = Object.assign({}, state, {
            refs: (state.refs || []).map((r) => ({ id: r.id, name: r.name, note: r.note, source: r.source, dataURL: "", w: 0, h: 0 })),
            _imagesDropped: true,
          });
          localStorage.setItem(KEY, JSON.stringify(light));
          setStatus("已保存(图片太大未存入草稿)", onStatus);
        } catch (e2) {
          // 连去图都存不下(localStorage 被禁/隐私模式)：别静默丢数据，指一条逃生路
          console.error("草稿自动保存失败", e2);
          setStatus("保存失败 — 请用「导出草稿」备份", onStatus);
        }
      }
    }, 600);
  }

  function setStatus(s, onStatus) {
    lastStatus = s;
    if (onStatus) onStatus(s);
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); }
    catch (e) { console.warn("草稿损坏，已忽略", e); return null; }
  }

  function clear() { localStorage.removeItem(KEY); }

  function exportJSON(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (x) => (window.RD.fs ? window.RD.fs.sanitize(x) : String(x || "").replace(/[\/\\:*?"<>|]/g, "_"));
    const stamp = safe(state.brand || "需求") + "-" + safe(state.reqName || "草稿");
    a.href = url; a.download = `${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importJSON(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => { try { res(JSON.parse(fr.result)); } catch (e) { rej(e); } };
      fr.onerror = rej;
      fr.readAsText(file);
    });
  }

  window.RD.store = { save, load, clear, exportJSON, importJSON };
})();
