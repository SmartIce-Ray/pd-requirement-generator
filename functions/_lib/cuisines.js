// 后端菜系常量 —— 灵感库第三个标签轴「菜系」（与「品牌」「分类＝产品形态」并列、正交）。
// 值域固定写死（仿品牌 brands.js），要加菜系改这里；只用于产品选品库（kind=product）。
export const CUISINES = [
  { id: "zhongcan", name: "中餐" },
  { id: "xican", name: "西餐" },
  { id: "riliao", name: "日料" },
  { id: "hancan", name: "韩餐" },
  { id: "dongnanya", name: "东南亚菜" },
];
export const CUISINE_NAMES = CUISINES.map((c) => c.name);

// 把输入归一成合法菜系名，非法 / 空 → null（菜系可留空，故 null 合法）。
export function validateCuisine(input) {
  const name = input == null ? "" : String(input);
  return CUISINE_NAMES.includes(name) ? name : null;
}
