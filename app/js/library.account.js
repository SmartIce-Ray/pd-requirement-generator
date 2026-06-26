// 账号管理（admin 专属）：列账号 + 开通 / 重置密码 / 删除。
(function () {
  const L = window.RD.lib;
  const { $, state, el, fieldLabel, opt, toast, openModal, closeModal, bindModalClose } = L;
  const api = L.api;

  const ROLE_LABEL = { admin: "管理员", collector: "采集员" };

  async function render() {
    const host = $("#userList"); host.textContent = "加载中…";
    try {
      const data = await api.listUsers();
      host.innerHTML = "";
      (data.users || []).forEach((u) => host.appendChild(userRow(u)));
    } catch (e) { host.textContent = e.message || "加载失败"; }
  }

  function userRow(u) {
    const row = el("div", "user-row");
    const info = el("div", "user-info");
    info.append(
      el("span", "u-name", u.name),
      el("span", "u-role", ROLE_LABEL[u.role] || u.role),
      el("span", "u-count", `${u.upload_count} 张`)
    );
    const ops = el("div", "user-ops");
    const reset = el("button", "btn-ghost", "改密码"); reset.type = "button";
    reset.addEventListener("click", () => openReset(u));
    ops.appendChild(reset);
    if (!(state.me && state.me.uid === u.id)) { // 不给自己删除按钮
      const del = el("button", "btn-ghost danger", "删除"); del.type = "button";
      del.addEventListener("click", () => removeUser(u));
      ops.appendChild(del);
    }
    row.append(info, ops);
    return row;
  }

  let modalMode = null;   // "create" | "reset"
  let resetTarget = null;

  function openCreate() {
    modalMode = "create"; resetTarget = null;
    $("#userModalTitle").textContent = "开通账号";
    $("#userModalErr").textContent = "";
    const body = $("#userModalBody"); body.innerHTML = "";
    body.appendChild(fieldLabel("姓名（登录名，唯一）"));
    const name = el("input"); name.id = "umName"; name.type = "text"; name.placeholder = "如 张三"; body.appendChild(name);
    body.appendChild(fieldLabel("初始密码（≥6 位）"));
    const pw = el("input"); pw.id = "umPw"; pw.type = "text"; pw.placeholder = "设个初始密码，开通后告诉本人"; body.appendChild(pw);
    body.appendChild(fieldLabel("角色"));
    const role = el("select"); role.id = "umRole"; role.append(opt("collector", "采集员"), opt("admin", "管理员")); body.appendChild(role);
    openModal("#userModal");
  }

  function openReset(u) {
    modalMode = "reset"; resetTarget = u;
    $("#userModalTitle").textContent = `重置「${u.name}」的密码`;
    $("#userModalErr").textContent = "";
    const body = $("#userModalBody"); body.innerHTML = "";
    body.appendChild(fieldLabel("新密码（≥6 位）"));
    const pw = el("input"); pw.id = "umPw"; pw.type = "text"; pw.placeholder = "新密码"; body.appendChild(pw);
    openModal("#userModal");
  }

  async function save() {
    const errEl = $("#userModalErr"); errEl.textContent = "";
    const btn = $("#userModalSave"); btn.disabled = true;
    try {
      if (modalMode === "create") {
        const name = $("#umName").value.trim();
        const password = $("#umPw").value;
        const role = $("#umRole").value;
        if (!name) { errEl.textContent = "请填姓名"; return; }
        if (password.length < 6) { errEl.textContent = "初始密码至少 6 位"; return; }
        await api.createUser({ name, password, role });
        toast("已开通账号");
      } else {
        const password = $("#umPw").value;
        if (password.length < 6) { errEl.textContent = "新密码至少 6 位"; return; }
        await api.resetUserPassword(resetTarget.id, password);
        toast("已重置密码");
      }
      closeModal("#userModal");
      render();
    } catch (e) { errEl.textContent = e.message || "操作失败"; }
    finally { btn.disabled = false; }
  }

  async function removeUser(u) {
    if (!confirm(`删除账号「${u.name}」？其上传过的图保留（显示为「已删除」）。`)) return;
    try { await api.deleteUser(u.id); toast("已删除账号"); render(); }
    catch (e) { toast(e.message || "删除失败", true); }
  }

  function initEvents() {
    bindModalClose("#userModal");
    $("#userModalSave").addEventListener("click", save);
  }

  L.account = { render, openCreate, initEvents };
})();
