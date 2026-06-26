// 选品库核心：登录/登出 + 首页日志（按天→按人）+ 视图编排 + 各模块初始化。
window.RD = window.RD || {};
(function () {
  const L = window.RD.lib;
  const { $, $$, state, el, fmtDate, toast, galleryCard, isAdmin, setView, loadData } = L;
  const api = L.api;

  // ---------- 角色 UI（[data-admin] 仅 admin 可见）----------
  function applyRoleUI() {
    const admin = isAdmin();
    $$("[data-admin]").forEach((e) => { e.hidden = !admin; });
    $("#userName").textContent = state.me ? state.me.name : "";
    $("#userBox").hidden = !state.me;
  }

  // ---------- 首页日志：按天 → 按人 ----------
  function renderHome() {
    const g = $("#homeLog"), empty = $("#homeLogEmpty");
    g.innerHTML = "";
    if (!state.items.length) { empty.hidden = false; empty.textContent = "还没有上传记录，点「+ 上传灵感」开始。"; return; }
    empty.hidden = true;
    const sorted = [...state.items].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    const byDay = new Map();
    sorted.forEach((it) => { const d = fmtDate(it.created_at); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(it); });
    byDay.forEach((items, day) => g.appendChild(dayGroup(day, items)));
  }
  function dayGroup(day, items) {
    const wrap = el("div", "log-group");
    const head = el("button", "log-day"); head.type = "button";
    head.append(el("span", "day", day), el("span", "count", `· 共 ${items.length} 张`), el("span", "chev", "›"));
    const body = el("div", "log-day-body");
    const byUser = new Map();
    items.forEach((it) => { const k = it.uploader_name || "（已删除）"; if (!byUser.has(k)) byUser.set(k, []); byUser.get(k).push(it); });
    byUser.forEach((arr, uname) => {
      const sub = el("div", "log-user");
      sub.appendChild(el("div", "log-user-head", `${uname} · ${arr.length} 张`));
      const grid = el("div", "log-user-grid");
      arr.forEach((it) => grid.appendChild(galleryCard(it, { showUploader: false })));
      sub.appendChild(grid); body.appendChild(sub);
    });
    head.addEventListener("click", () => { const open = head.classList.toggle("open"); body.classList.toggle("open", open); });
    wrap.append(head, body);
    return wrap;
  }
  L.home = { render: renderHome };

  // ---------- 鉴权 ----------
  function applyConfig(cfg) {
    state.config = { brands: cfg.brands || [], categories: cfg.categories || [] };
    state.me = cfg.me || null;
    applyRoleUI();
  }
  function hideAllViews() {
    ["#view-home", "#view-library", "#view-account", "#view-reqform", "#view-reqmulti"].forEach((s) => { const e = $(s); if (e) e.hidden = true; });
    $("#selbar").hidden = true;
  }
  function showLogin() { $("#loginScreen").hidden = false; hideAllViews(); $("#userBox").hidden = true; }
  function showApp() { $("#loginScreen").hidden = true; setView("home"); loadData(); }

  async function boot() {
    try { const cfg = await api.config(); applyConfig(cfg); showApp(); }
    catch (e) { showLogin(); if (e.status !== 401) toast(e.message || "加载失败", true); }
  }
  async function doLogin() {
    const name = $("#loginName").value.trim(), pw = $("#loginPw").value;
    $("#loginErr").textContent = "";
    if (!name || !pw) { $("#loginErr").textContent = "请输入账号和密码"; return; }
    const btn = $("#loginBtn"); btn.disabled = true;
    try {
      await api.login(name, pw);
      applyConfig(await api.config());
      $("#loginPw").value = "";
      showApp();
    } catch (e) { $("#loginErr").textContent = e.status === 401 ? "用户名或密码错误" : (e.message || "登录失败"); }
    finally { btn.disabled = false; }
  }
  async function doLogout() {
    // 令牌无状态：登出失败=服务端没清 cookie，刷新会被原 cookie 自动登回。共享设备上要让用户知道。
    let cleared = true;
    try { await api.logout(); } catch (_) { cleared = false; }
    state.me = null; state.items = []; state.selected.clear(); state.selectMode = false;
    $("#loginName").value = "";
    showLogin();
    if (!cleared) toast("登出请求失败，请刷新确认或关闭浏览器", true);
  }

  // ---------- init ----------
  function init() {
    $$("#viewSwitch button").forEach((b) => b.addEventListener("click", () => { if (!b.hidden) setView(b.dataset.view); }));
    $("#loginBtn").addEventListener("click", doLogin);
    $("#loginName").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#loginPw").focus(); });
    $("#loginPw").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
    $("#btnLogout").addEventListener("click", doLogout);
    $("#btnAccount").addEventListener("click", () => setView("account"));
    $("#btnUpload").addEventListener("click", () => L.upload.open());
    $("#btnOpenLibrary").addEventListener("click", () => setView("library"));
    $("#btnBackHome").addEventListener("click", () => setView("home"));
    $("#btnBackHome2").addEventListener("click", () => setView("home"));
    $("#btnSelectMode").addEventListener("click", () => L.gallery.setSelectMode(!state.selectMode));
    $("#btnSelCancel").addEventListener("click", () => L.gallery.setSelectMode(false));
    $("#btnGenReq").addEventListener("click", () => L.gallery.gen());
    $("#btnAddUser").addEventListener("click", () => L.account.openCreate());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") ["#uploadModal", "#detailModal", "#userModal"].forEach((s) => { const m = $(s); if (m) m.hidden = true; });
    });

    // 各功能模块的弹窗/拖拽事件
    L.upload.initEvents();
    L.detail.initEvents();
    L.account.initEvents();
    if (L.gallery.initEvents) L.gallery.initEvents();

    api.onUnauth(() => { state.me = null; showLogin(); });
    boot();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // 供 reqform-multi.js / app.js 复用：切视图 + 拿配置 + 重载。
  window.RD.library = { reload: loadData, setView, getConfig: () => state.config };
})();
