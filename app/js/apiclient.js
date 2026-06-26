// 选品库后端调用薄封装。cookie 鉴权（same-origin 自动带）；401 触发回登录。
window.RD = window.RD || {};
(function () {
  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }

  let onUnauth = null;

  async function req(path, opts = {}) {
    let res;
    try {
      res = await fetch(path, { credentials: "same-origin", ...opts });
    } catch (e) {
      throw new ApiError("网络错误，请检查连接", 0);
    }
    if (res.status === 401) {
      if (onUnauth) onUnauth();
      throw new ApiError("未登录", 401);
    }
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json().catch(() => null) : null;
    if (!res.ok) throw new ApiError((data && data.error) || `请求失败(${res.status})`, res.status);
    return data;
  }

  const api = {
    onUnauth(fn) { onUnauth = fn; },
    login(name, password) {
      return req("/api/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
    },
    logout() { return req("/api/logout", { method: "POST" }); },
    config() { return req("/api/config"); },
    list(filters = {}) {
      const qs = new URLSearchParams();
      if (filters.brand) qs.set("brand", filters.brand);
      if (filters.category) qs.set("category", filters.category);
      if (filters.uploader) qs.set("uploader", filters.uploader);
      const q = qs.toString();
      return req("/api/inspirations" + (q ? "?" + q : ""));
    },
    create(formData) { return req("/api/inspirations", { method: "POST", body: formData }); },
    update(id, patch) {
      return req("/api/inspirations/" + encodeURIComponent(id), {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    remove(id) { return req("/api/inspirations/" + encodeURIComponent(id), { method: "DELETE" }); },
    addCategory(name) {
      return req("/api/categories", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
    },
    delCategory(id) { return req("/api/categories/" + encodeURIComponent(id), { method: "DELETE" }); },
    // 账号管理（admin）
    listUsers() { return req("/api/users"); },
    createUser(body) {
      return req("/api/users", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    resetUserPassword(id, password) {
      return req("/api/users/" + encodeURIComponent(id), {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
    },
    deleteUser(id) { return req("/api/users/" + encodeURIComponent(id), { method: "DELETE" }); },
    imgUrl(id) { return "/api/img/" + encodeURIComponent(id); },
  };

  window.RD.api = api;
  window.RD.ApiError = ApiError;
})();
