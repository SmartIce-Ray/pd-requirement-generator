import { describe, it, expect } from "vitest";
import { genId } from "../functions/_lib/ids.js";
import { sessionToken, parseCookies, timingSafeEqual, isAuthed } from "../functions/_lib/auth.js";
import { validateBrands, buildListQuery, parseRow } from "../functions/_lib/query.js";

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

describe("auth", () => {
  it("sessionToken 确定性、64 位 hex、非空", async () => {
    const a = await sessionToken("pw");
    const b = await sessionToken("pw");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await sessionToken("")).toBe("");
  });
  it("不同密码不同 token", async () => {
    expect(await sessionToken("a")).not.toBe(await sessionToken("b"));
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
  it("isAuthed 校验 cookie", async () => {
    const env = { APP_PASSWORD: "secret" };
    const token = await sessionToken("secret");
    const good = new Request("https://x/", { headers: { Cookie: `sid=${token}` } });
    expect(await isAuthed(good, env)).toBe(true);
    expect(await isAuthed(new Request("https://x/", { headers: { Cookie: "sid=wrong" } }), env)).toBe(false);
    expect(await isAuthed(new Request("https://x/"), env)).toBe(false);
    expect(await isAuthed(good, {})).toBe(false);
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
    expect(validateBrands([null, 123, "野百灵", {}])).toEqual(["野百灵"]); // 混杂数组净化
    expect(validateBrands('"野百灵"')).toEqual([]); // JSON 解析成字符串不是数组
  });
  it("buildListQuery 无筛选", () => {
    const { sql, params } = buildListQuery({});
    expect(sql).toContain("SELECT * FROM inspirations");
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(sql).not.toContain("WHERE");
    expect(params).toEqual([]);
  });
  it("buildListQuery 品牌+分类", () => {
    const { sql, params } = buildListQuery({ brand: "野百灵", category: "饮品" });
    expect(sql).toContain("brands LIKE ?");
    expect(sql).toContain("category = ?");
    expect(params).toEqual(['%"野百灵"%', "饮品"]);
  });
  it("buildListQuery untagged 优先于 category", () => {
    const { sql, params } = buildListQuery({ category: "饮品", untagged: true });
    expect(sql).toContain("category IS NULL");
    expect(sql).not.toContain("category = ?");
    expect(params).toEqual([]);
  });
  it("buildListQuery 仅品牌：LIKE 引号锚定 + 参数化(不拼原文)", () => {
    const { sql, params } = buildListQuery({ brand: "野百灵" });
    expect(params).toEqual(['%"野百灵"%']);
    expect(sql).toContain("brands LIKE ?");
    expect(sql).not.toContain("野百灵");
  });
  it("buildListQuery 品牌+未整理 并存", () => {
    const { sql, params } = buildListQuery({ brand: "野百灵", untagged: true });
    expect(sql).toContain("brands LIKE ?");
    expect(sql).toContain("category IS NULL");
    expect(params).toEqual(['%"野百灵"%']);
  });
  it("parseRow 解析 brands、不外泄 image_key", () => {
    const row = { id: "x", image_key: "x", image_type: "image/jpeg", brands: '["野百灵"]', category: null, notes: "hi", created_at: 123 };
    const out = parseRow(row);
    expect(out).toEqual({ id: "x", image_type: "image/jpeg", brands: ["野百灵"], category: null, notes: "hi", created_at: 123 });
    expect(out.image_key).toBeUndefined();
  });
  it("parseRow 容错坏 JSON", () => {
    expect(parseRow({ id: "x", brands: "broken", category: "菜品", notes: "", created_at: 1 }).brands).toEqual([]);
  });
});
