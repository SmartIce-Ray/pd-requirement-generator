import { describe, it, expect } from "vitest";
import deck from "../app/js/deck.js";
const { buildDeck, buildDeckMulti, multiDeckPlan } = deck;

const product = (over = {}) => ({
  brand: "野百灵", reqName: "夏季解腻冰饮", desc: "清爽解腻、夏季主打",
  refs: [], category: "饮品", flavors: ["清爽", "果香"], flavorNote: "",
  extras: [{ label: "冷 / 热", value: "冷饮(冰镇)" }], owner: "", launchTime: "", ...over,
});
const img = () => ({ dataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", w: 1, h: 1 });

describe("multiDeckPlan 页数", () => {
  it("目录 + Σ(2+refPages) + 落地节点", () => {
    const p = multiDeckPlan([
      product({ refs: [] }),                          // 2 + 1 = 3
      product({ refs: [img(), img(), img(), img()] }),// 4 图 → 2 页 → 2 + 2 = 4
    ]);
    expect(p.productCount).toBe(2);
    expect(p.totalPages).toBe(1 + 3 + 4 + 1); // 9
  });
  it("空列表 = 目录 + 落地节点", () => {
    expect(multiDeckPlan([]).totalPages).toBe(2);
  });
  it("过滤 falsy 产品", () => {
    expect(multiDeckPlan([product(), null, undefined]).productCount).toBe(1);
  });
});

describe("buildDeck 单产品（回归）", () => {
  it("生成非空 pptx buffer", async () => {
    const buf = await buildDeck(product({ refs: [img(), img()] }));
    expect(buf.length).toBeGreaterThan(10000);
  });
  it("空数据也不崩", async () => {
    const buf = await buildDeck({});
    expect(buf.length).toBeGreaterThan(8000);
  });
});

describe("buildDeckMulti 多产品", () => {
  // 品牌 / 总需求名是整批共享，放在 meta；产品只带需求描述与细节
  it("3 产品（整批一个品牌+总需求名、含图）生成合法非空 pptx", async () => {
    const buf = await buildDeckMulti([
      product({ desc: "清爽解腻冰饮", refs: [img()] }),
      product({ desc: "牛油果奶昔", category: "甜品", refs: [img(), img()] }),
      product({ desc: "麻辣拌面", category: "主食", owner: "张三", launchTime: "夏季旺季前" }),
    ], { date: new Date(2026, 5, 25), brand: "野百灵", reqName: "夏季解腻新品一批" });
    expect(buf.length).toBeGreaterThan(15000);
  });
  it("产品缺需求描述也能靠品类/序号定标题、不崩", async () => {
    const buf = await buildDeckMulti([
      product({ desc: "", category: "饮品" }),
      product({ desc: "", category: "" }),
    ], { date: new Date(2026, 5, 25), brand: "宁桂杏", reqName: "测一批" });
    expect(buf.length).toBeGreaterThan(8000);
  });
  it("空列表不崩", async () => {
    const buf = await buildDeckMulti([], { date: new Date(2026, 5, 25), brand: "野百灵", reqName: "测一批" });
    expect(buf.length).toBeGreaterThan(3000);
  });
  it("无 meta（缺品牌/需求名/日期）不崩", async () => {
    const buf = await buildDeckMulti([product()], {});
    expect(buf.length).toBeGreaterThan(8000);
  });
});
