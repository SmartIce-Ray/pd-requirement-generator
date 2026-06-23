// PPT 落地：File System Access API 自动写进 品牌/需求/<需求名>/，否则降级浏览器下载。
// 命名规范：品牌-需求名-日期.pptx
window.RD = window.RD || {};
(function () {
  const supported = typeof window.showDirectoryPicker === "function";

  // —— 极简 IndexedDB，用于跨会话记住授权过的根目录 handle ——
  const DB = "rd_fs", STORE = "handles", HKEY = "projectRoot";
  function idb(mode, fn) {
    return new Promise((res, rej) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => rej(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(STORE, mode);
        const r = fn(tx.objectStore(STORE));
        tx.oncomplete = () => res(r && r.result);
        tx.onerror = () => rej(tx.error);
      };
    });
  }
  const idbSet = (h) => idb("readwrite", (s) => s.put(h, HKEY));
  const idbGet = () => idb("readonly", (s) => s.get(HKEY));

  function sanitize(name) {
    return String(name || "").replace(/[\/\\:*?"<>|]/g, "_").trim() || "未命名";
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function dateStamp(d) { d = d || new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }
  function filename(brand, reqName, d) {
    return `${sanitize(brand)}-${sanitize(reqName)}-${dateStamp(d)}.pptx`;
  }

  async function verifyPerm(handle) {
    const opts = { mode: "readwrite" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    return (await handle.requestPermission(opts)) === "granted";
  }

  // 让用户挑一次项目根目录（含品牌文件夹的那一层），记住。
  async function pickRoot() {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await idbSet(handle);
    return handle;
  }

  // 取已授权的根目录；权限掉了就尝试重新确认。没有则返回 null（调用方再决定是否 pick）。
  async function getRoot() {
    let h = null;
    try { h = await idbGet(); } catch (_) { h = null; }
    if (!h) return null;
    try { return (await verifyPerm(h)) ? h : null; } catch (_) { return null; } // handle 失效(目录被删/移动) → 当无授权处理
  }

  async function subdir(parent, name, create) {
    return parent.getDirectoryHandle(sanitize(name), { create: !!create });
  }

  // 直接写进 品牌/需求/<filename>，返回相对路径字符串。
  // 文件名已含「品牌-需求名-日期」，足够区分，不再单独建需求名子文件夹（避免每个需求多一层空壳目录）。
  async function writeInto(root, brand, fname, blob) {
    const brandDir = await subdir(root, brand, true);
    const reqDir = await subdir(brandDir, "需求", true);
    const fh = await reqDir.getFileHandle(fname, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return `${sanitize(brand)}/需求/${fname}`;
  }

  function download(blob, fname) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // 取已授权根目录，没有就弹选择器（必须在用户手势内调用，故 app 在 build 前先调）。
  async function ensureRoot() {
    return (await getRoot()) || (await pickRoot());
  }

  window.RD.fs = {
    supported, filename, dateStamp, sanitize,
    pickRoot, getRoot, ensureRoot,
    write: writeInto,   // (root, brand, fname, blob) -> 相对路径
    download,
  };
})();
