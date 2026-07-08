import { describe, it, expect } from "vitest";
import { genId } from "../functions/_lib/ids.js";
import {
  signToken, verifyToken, parseCookies, timingSafeEqual, sessionCookie, clearCookie,
} from "../functions/_lib/auth.js";
import { hashPassword, verifyPassword } from "../functions/_lib/passwords.js";
import { requireAdmin, isOwnerOrAdmin, getUser } from "../functions/_lib/access.js";
import { validateBrands, buildListQuery, parseRow, normalizeKind } from "../functions/_lib/query.js";
import { validateCuisine, CUISINE_NAMES } from "../functions/_lib/cuisines.js";

describe("genId", () => {
  it("生成 22 位 base62", () => {
    const id = genId();
    expect(id).toHaveLength(22);
    expect(id).toMatch(/^[0-9A-Za-z]+$/);
  });
  it("1000 个无碰撞", () => {
    const set = new Set(Array.from({ length: 1000 }, () => genId()));
    expect(set.size).toBe(1000);
  });
});

describe("auth token", () => {
  const secret = "sign-secret";
  it("sign/verify 往返带 uid/role/name", async () => {
    const t = await signToken({ uid: "u1", role: "admin", name: "Ray" }, secret);
    expect(t).toContain(".");
    expect(await verifyToken(t, secret)).toEqual({ uid: "u1", role: "admin", name: "Ray" });
  });
  it("无 name 也能签发/校验（name 归一为空串，下游不取到 undefined）", async () => {
    const t = await signToken({ uid: "u1", role: "admin" }, secret);
    expect(await verifyToken(t, secret)).toEqual({ uid: "u1", role: "admin", name: "" });
  });
  it("换签名密钥则验不过", async () => {
    const t = await signToken({ uid: "u1", role: "collector", name: "A" }, secret);
    expect(await verifyToken(t, "other-secret")).toBeNull();
  });
  it("篡改 payload 验不过（验签先于解析）", async () => {
    const t = await signToken({ uid: "u1", role: "collector", name: "A" }, secret);
    const [p, s] = t.split(".");
    const tampered = p.slice(0, -1) + (p.endsWith("A") ? "B" : "A") + "." + s;
    expect(await verifyToken(tampered, secret)).toBeNull();
  });
  it("过期验不过", async () => {
    const t = await signToken({ uid: "u1", role: "admin", name: "A" }, secret, { maxAgeDays: -1 });
    expect(await verifyToken(t, secret)).toBeNull();
  });
  it("垃圾输入返回 null", async () => {
    expect(await verifyToken("", secret)).toBeNull();
    expect(await verifyToken("no-dot", secret)).toBeNull();
    expect(await verifyToken(null, secret)).toBeNull();
    expect(await verifyToken("a.b", "")).toBeNull();
  });
  it("parseCookies", () => {
    expect(parseCookies("sid=abc; foo=bar")).toEqual({ sid: "abc", foo: "bar" });
    expect(parseCookies("")).toEqual({});
    expect(parseCookies(null)).toEqual({});
  });
  it("timingSafeEqual", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
    expect(timingSafeEqual("abc", null)).toBe(false);
  });
  it("sessionCookie / clearCookie 属性", () => {
    const c = sessionCookie("tok", { secure: true });
    expect(c).toContain("sid=tok");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Strict");
    expect(c).toContain("Secure");
    expect(sessionCookie("tok", { secure: false })).not.toContain("Secure");
    expect(clearCookie({ secure: false })).toContain("Max-Age=0");
  });
});

describe("passwords", () => {
  it("hash/verify 往返", async () => {
    const h = await hashPassword("s3cret!");
    expect(h).toMatch(/^pbkdf2\$sha256\$100000\$/);
    expect(await verifyPassword("s3cret!", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("每次 salt 不同 → 同密码不同 hash，但都能验过", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });
  it("坏存储格式安全失败", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$sha256$100000$only4")).toBe(false);
    expect(await verifyPassword("", "pbkdf2$sha256$100000$AAAA$BBBB")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$sha256$0$AAAA$BBBB")).toBe(false);    // 迭代<=0 → 不调 deriveBits 直接拒
    expect(await verifyPassword("x", "pbkdf2$sha256$abc$AAAA$BBBB")).toBe(false);  // 迭代 NaN
    expect(await verifyPassword("x", "bcrypt$sha256$100000$AAAA$BBBB")).toBe(false); // 算法前缀不符
  });
});

describe("access", () => {
  it("requireAdmin：admin 过、非 admin 返 403", () => {
    expect(requireAdmin({ data: { user: { role: "admin" } } })).toBeNull();
    const denied = requireAdmin({ data: { user: { role: "collector" } } });
    expect(denied).toBeInstanceOf(Response);
    expect(denied.status).toBe(403);
    expect(requireAdmin({}).status).toBe(403);
  });
  it("isOwnerOrAdmin：admin 全权、采集员仅自己", () => {
    const admin = { uid: "a", role: "admin" };
    const coll = { uid: "c", role: "collector" };
    expect(isOwnerOrAdmin({ uploader_id: "x" }, admin)).toBe(true);
    expect(isOwnerOrAdmin({ uploader_id: "c" }, coll)).toBe(true);
    expect(isOwnerOrAdmin({ uploader_id: "x" }, coll)).toBe(false);
    expect(isOwnerOrAdmin({ uploader_id: "c" }, null)).toBe(false);
    expect(isOwnerOrAdmin({}, coll)).toBe(false);
    // 防越权回归哨兵：两边 uploader_id/uid 都 null 不能因 null===null 误判为属主
    expect(isOwnerOrAdmin({ uploader_id: null }, { uid: null, role: "collector" })).toBe(false);
    expect(isOwnerOrAdmin(null, { role: "admin" })).toBe(true); // admin 短路，不解引用 item
  });
  it("getUser", () => {
    expect(getUser({ data: { user: { uid: "a" } } })).toEqual({ uid: "a" });
    expect(getUser({})).toBeNull();
    expect(getUser(null)).toBeNull();
  });
});

describe("query", () => {
  it("validateBrands 过滤非法/解析 JSON", () => {
    expect(validateBrands(["野百灵", "假品牌", "宁桂杏"])).toEqual(["野百灵", "宁桂杏"]);
    expect(validateBrands(["野百灵", "野百灵", "宁桂杏"])).toEqual(["野百灵", "宁桂杏"]); // 去重
    expect(validateBrands('["飞花小馆"]')).toEqual(["飞花小馆"]);
    expect(validateBrands("not json")).toEqual([]);
    expect(validateBrands(null)).toEqual([]);
    expect(validateBrands(123)).toEqual([]);
    expect(validateBrands([null, 123, "野百灵", {}])).toEqual(["野百灵"]);
    expect(validateBrands('"野百灵"')).toEqual([]);
  });
  it("buildListQuery 无筛选：LEFT JOIN users、无 WHERE", () => {
    const { sql, params } = buildListQuery({});
    expect(sql).toContain("FROM inspirations i");
    expect(sql).toContain("LEFT JOIN users u ON u.id = i.uploader_id");
    expect(sql).toContain("ORDER BY i.created_at DESC");
    expect(sql).not.toContain("WHERE");
    expect(params).toEqual([]);
  });
  it("buildListQuery 品牌+分类+上传人", () => {
    const { sql, params } = buildListQuery({ brand: "野百灵", category: "饮品", uploader: "usr_x" });
    expect(sql).toContain("i.brands LIKE ?");
    expect(sql).toContain("i.category = ?");
    expect(sql).toContain("i.uploader_id = ?");
    expect(params).toEqual(['%"野百灵"%', "饮品", "usr_x"]);
  });
  it("buildListQuery 仅品牌：参数化不拼原文", () => {
    const { sql, params } = buildListQuery({ brand: "野百灵" });
    expect(params).toEqual(['%"野百灵"%']);
    expect(sql).toContain("i.brands LIKE ?");
    expect(sql).not.toContain("野百灵");
  });
  it("buildListQuery 按 kind 过滤（产品/创意隔离）", () => {
    const { sql, params } = buildListQuery({ kind: "creative" });
    expect(sql).toContain("i.kind = ?");
    expect(params).toEqual(["creative"]);
  });
  it("buildListQuery kind + 品牌：params 与 SQL 占位符同序（kind 在前）", () => {
    const { sql, params } = buildListQuery({ brand: "野百灵", kind: "product" });
    expect(params).toEqual(["product", '%"野百灵"%']);
    // 隔离是安全边界：占位符顺序必须与 params 一一对应，防重构把 SQL/params 两侧拆脱钩。
    expect(sql.indexOf("i.kind = ?")).toBeLessThan(sql.indexOf("i.brands LIKE ?"));
  });
  it("buildListQuery 四筛选全开：WHERE 子句与 params 严格同序", () => {
    const { sql, params } = buildListQuery({ kind: "creative", brand: "野百灵", category: "设计视觉", uploader: "usr_x" });
    expect(sql).toContain("WHERE i.kind = ? AND i.brands LIKE ? AND i.category = ? AND i.uploader_id = ?");
    expect(params).toEqual(["creative", '%"野百灵"%', "设计视觉", "usr_x"]);
  });
  it("parseRow 带 uploader、不外泄 image_key", () => {
    const row = { id: "x", image_key: "x", image_type: "image/jpeg", brands: '["野百灵"]', category: "菜品", cuisine: "中餐", notes: "hi", created_at: 123, uploader_id: "usr_a", uploader_name: "Ray" };
    const out = parseRow(row);
    expect(out).toEqual({ id: "x", image_type: "image/jpeg", brands: ["野百灵"], category: "菜品", cuisine: "中餐", notes: "hi", kind: "product", created_at: 123, uploader_id: "usr_a", uploader_name: "Ray" });
    expect(out.image_key).toBeUndefined();
  });
  it("parseRow 容错坏 JSON + 空 uploader", () => {
    const out = parseRow({ id: "x", brands: "broken", category: "菜品", notes: "", created_at: 1 });
    expect(out.brands).toEqual([]);
    expect(out.uploader_id).toBeNull();
    expect(out.uploader_name).toBeNull();
  });
  it("parseRow 带出 kind；缺省归 product", () => {
    expect(parseRow({ id: "x", brands: "[]", category: null, notes: "", created_at: 1, kind: "creative" }).kind).toBe("creative");
    expect(parseRow({ id: "y", brands: "[]", category: null, notes: "", created_at: 1 }).kind).toBe("product");
  });
  it("normalizeKind：只认 creative，其余（缺省/非法/大小写/类型）归 product（默认拒绝）", () => {
    expect(normalizeKind("creative")).toBe("creative");
    expect(normalizeKind("product")).toBe("product");
    expect(normalizeKind("")).toBe("product");
    expect(normalizeKind(null)).toBe("product");
    expect(normalizeKind(undefined)).toBe("product");
    expect(normalizeKind("CREATIVE")).toBe("product");   // 大小写敏感
    expect(normalizeKind("creative ")).toBe("product");  // 不 trim
    expect(normalizeKind(123)).toBe("product");
  });
  it("validateCuisine：白名单内返回原名，非法/空/类型不符归 null（可留空）", () => {
    expect(validateCuisine("中餐")).toBe("中餐");
    expect(validateCuisine("日料")).toBe("日料");
    expect(validateCuisine("川菜")).toBeNull();   // 不在白名单
    expect(validateCuisine("")).toBeNull();
    expect(validateCuisine(null)).toBeNull();
    expect(validateCuisine(undefined)).toBeNull();
    expect(validateCuisine(123)).toBeNull();
    expect(validateCuisine("中餐 ")).toBeNull();  // 不 trim，精确匹配
    expect(CUISINE_NAMES).toContain("中餐");
  });
  it("buildListQuery 菜系分支：i.cuisine = ?，占位符在 category 之后 uploader 之前", () => {
    const { sql, params } = buildListQuery({ category: "菜品", cuisine: "中餐", uploader: "usr_x" });
    expect(sql).toContain("WHERE i.category = ? AND i.cuisine = ? AND i.uploader_id = ?");
    expect(params).toEqual(["菜品", "中餐", "usr_x"]);
  });
  it("buildListQuery 五筛选全开：菜系并入 WHERE 与 params 严格同序", () => {
    const { sql, params } = buildListQuery({ kind: "product", brand: "野百灵", category: "菜品", cuisine: "西餐", uploader: "usr_x" });
    expect(sql).toContain("WHERE i.kind = ? AND i.brands LIKE ? AND i.category = ? AND i.cuisine = ? AND i.uploader_id = ?");
    expect(params).toEqual(["product", '%"野百灵"%', "菜品", "西餐", "usr_x"]);
  });
  it("parseRow 带出 cuisine；缺省/空归 null", () => {
    expect(parseRow({ id: "x", brands: "[]", category: null, cuisine: "日料", notes: "", created_at: 1 }).cuisine).toBe("日料");
    expect(parseRow({ id: "y", brands: "[]", category: null, notes: "", created_at: 1 }).cuisine).toBeNull();
  });
});
