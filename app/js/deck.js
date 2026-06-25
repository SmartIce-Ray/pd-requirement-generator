// PPTX 生成器：编辑风高级版式 + 内容自适应（按字数测高、卡片/行自动撑高、超长自动缩字号、整页放不下整体收档），任意文字长度不溢出。
// 图片一律 fit-to-box（自算宽高，禁用 sizing，否则变形）。配色 M 暖米石墨。
// 双模：浏览器用 window.PptxGenJS；Node 用 require('pptxgenjs') 以便单测。
// buildDeck(data) = 单产品任务书（原版，输出不变）；buildDeckMulti(products, meta) = 多产品研发需求清单。
(function (global) {
  const isNode = typeof module !== "undefined" && module.exports;
  const PPTX = isNode ? require("pptxgenjs") : global.PptxGenJS;

  const INK = "1A1918", INK2 = "403C36", MUTED = "6B6760", SAND = "A89F8C",
    BG = "F4F1EA", SURF = "FAF7F0", WHITE = "FFFFFF",
    ACC = "C15F3C", ACC2 = "D4875F", DARK = "201F1C",
    LINE = "E8E3D7", LINE2 = "D6CFBF", DLINE = "44403A", TINT = "EFE0D9";
  const F = "PingFang SC";
  const PW = 13.33, PH = 7.5, MX = 0.85, CW = PW - MX * 2;
  const CARD_BODY_W = CW - 1.2;

  function pad(n) { return String(n).padStart(2, "0"); }
  function fmtDate(d) { d = d || new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  // 多产品里每个产品的小标题：需求名已是整批共享，故用 需求描述首行 / 品类 / 产品N 来区分单个产品
  function firstLine(t) { return String(t == null ? "" : t).split("\n")[0].trim(); }
  function clip(t, n) { t = String(t == null ? "" : t); return t.length > n ? t.slice(0, n) + "…" : t; }
  function productLabel(prod, i) { return clip(firstLine(prod && prod.desc), 28) || (prod && prod.category) || `产品 ${i + 1}`; }

  // —— 文本测量（CJK 约 1 字 1em）——
  // cpl=一行能放多少字；保守估行：减文本框内边距(~0.3in) + 0.88 安全系数，宁可略小不溢出
  // （不同字体/渲染器换行点不一）。
  function cpl(w, pt) { return Math.max(1, Math.floor((Math.max(0.5, w - 0.3) * 72) / pt * 0.88)); }
  function nlines(t, w, pt) { return String(t == null ? "" : t).split("\n").reduce((a, s) => a + Math.max(1, Math.ceil(s.length / cpl(w, pt))), 0); }
  function textH(t, w, pt, lsp) { return nlines(t, w, pt) * (pt / 72) * (lsp || 1.32); } // 文本块所需高度(英寸)
  function fitH(t, w, h, maxPt, minPt, lsp) { for (let pt = maxPt; pt >= minPt; pt--) { if (textH(t, w, pt, lsp) <= h) return pt; } return minPt; }
  function fitFont(t, w, maxLines, maxPt, minPt) { for (let pt = maxPt; pt >= minPt; pt--) { if (nlines(t, w, pt) <= maxLines) return pt; } return minPt; }
  function fitBox(box, img) {
    const r = (img.w || 1) / (img.h || 1);
    let w = box.w, h = box.w / r;
    if (h > box.h) { h = box.h; w = box.h * r; }
    return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
  }

  // ===== 共享版式 helper（ctx = { p, foot, pageNo, totalPages }）=====
  function head(s, idx, title) {
    if (idx) {
      s.addText(idx, { x: MX, y: 0.6, w: 1.0, h: 0.66, fontFace: F, fontSize: 30, bold: true, color: ACC, valign: "middle" });
      s.addText(title, { x: MX + 0.95, y: 0.6, w: CW - 0.95, h: 0.66, fontFace: F, fontSize: fitFont(title, CW - 0.95, 1, 22, 13), bold: true, color: INK, valign: "middle", charSpacing: 1 });
    } else {
      s.addText(title, { x: MX, y: 0.6, w: CW, h: 0.66, fontFace: F, fontSize: fitFont(title, CW, 1, 22, 13), bold: true, color: INK, valign: "middle", charSpacing: 1 });
    }
  }
  function foots(ctx, s) {
    s.addShape("line", { x: MX, y: 6.98, w: CW, h: 0, line: { color: LINE2, width: 0.75 } });
    s.addText(ctx.foot, { x: MX, y: 7.04, w: CW - 2, h: 0.32, fontFace: F, fontSize: 9, color: SAND, charSpacing: 1, valign: "middle" });
    s.addText(`${pad(ctx.pageNo)} / ${pad(ctx.totalPages)}`, { x: PW - MX - 1.6, y: 7.04, w: 1.6, h: 0.32, fontFace: F, fontSize: 9, color: SAND, align: "right", valign: "middle" });
    ctx.pageNo++;
  }
  function newContent(ctx, idx, title) {
    const s = ctx.p.addSlide(); s.background = { color: BG };
    head(s, idx, title); foots(ctx, s);
    return s;
  }
  // 信息卡：高度由调用方按内容算好；正文字号在卡内高度自适应
  function card(s, y, h, label, body, tint) {
    s.addShape("roundRect", { x: MX, y: y, w: CW, h: h, rectRadius: 0.1, fill: { color: tint ? TINT : SURF } });
    s.addShape("rect", { x: MX + 0.3, y: y + 0.3, w: 0.16, h: 0.16, fill: { color: ACC } });
    s.addText(label, { x: MX + 0.6, y: y + 0.16, w: CW - 1.0, h: 0.4, fontFace: F, fontSize: 13, bold: true, color: ACC, charSpacing: 1 });
    const bh = h - 0.78;
    s.addText(body, { x: MX + 0.6, y: y + 0.6, w: CW - 1.2, h: bh, fontFace: F, fontSize: fitH(body, CW - 1.2, bh, 15, 9, 1.3), color: INK2, valign: "top", wrap: true, lineSpacingMultiple: 1.3 });
  }

  // ===== 封面 =====
  function addCoverSingle(p, data) {
    const brand = data.brand || "品牌";
    const reqName = data.reqName || "未命名需求";
    const s = p.addSlide(); s.background = { color: DARK };
    s.addText("产品研发需求", { x: MX, y: 0.95, w: 10, h: 0.4, fontFace: F, fontSize: 12, color: SAND, charSpacing: 5 });
    s.addShape("rect", { x: MX + 0.02, y: 2.35, w: 0.9, h: 0.05, fill: { color: ACC } });
    s.addText(`${brand} · ${reqName}`, { x: MX, y: 2.62, w: CW, h: 1.55, fontFace: F, fontSize: fitFont(`${brand} · ${reqName}`, CW, 2, 46, 24), bold: true, color: SURF, valign: "top" });
    s.addText("研发需求任务书", { x: MX + 0.02, y: 4.2, w: CW, h: 0.5, fontFace: F, fontSize: 17, color: ACC2, charSpacing: 2 });
    s.addShape("line", { x: MX, y: 6.5, w: CW, h: 0, line: { color: DLINE, width: 0.75 } });
    s.addText(`品牌：${brand}`, { x: MX, y: 6.62, w: 8, h: 0.35, fontFace: F, fontSize: 12, color: SAND });
    s.addText(fmtDate(data.date), { x: PW - MX - 4, y: 6.62, w: 4, h: 0.35, fontFace: F, fontSize: 12, color: SAND, align: "right" });
  }
  function addCoverList(p, meta) {
    const brand = meta.brand || "品牌";
    const reqName = meta.reqName || "研发需求清单";
    const title = `${brand} · ${reqName}`;
    const s = p.addSlide(); s.background = { color: DARK };
    s.addText("产品研发需求", { x: MX, y: 0.95, w: 10, h: 0.4, fontFace: F, fontSize: 12, color: SAND, charSpacing: 5 });
    s.addShape("rect", { x: MX + 0.02, y: 2.35, w: 0.9, h: 0.05, fill: { color: ACC } });
    s.addText(title, { x: MX, y: 2.62, w: CW, h: 1.55, fontFace: F, fontSize: fitFont(title, CW, 2, 46, 24), bold: true, color: SURF, valign: "top" });
    s.addText(`研发需求清单 · 共 ${meta.count || 0} 个产品`, { x: MX + 0.02, y: 4.2, w: CW, h: 0.5, fontFace: F, fontSize: 17, color: ACC2, charSpacing: 1 });
    s.addShape("line", { x: MX, y: 6.5, w: CW, h: 0, line: { color: DLINE, width: 0.75 } });
    s.addText(`品牌：${brand}`, { x: MX, y: 6.62, w: 8.5, h: 0.35, fontFace: F, fontSize: 12, color: SAND });
    s.addText(fmtDate(meta.date), { x: PW - MX - 4, y: 6.62, w: 4, h: 0.35, fontFace: F, fontSize: 12, color: SAND, align: "right" });
  }

  // ===== 目录（多产品）=====
  function addTocPage(ctx, products) {
    const s = newContent(ctx, "", "目录");
    const yTop = 1.7, yBot = 6.7, avail = yBot - yTop;
    const n = Math.max(1, products.length);
    const rowH = Math.min(0.62, avail / n);
    const fs = Math.max(10, Math.min(15, Math.floor(rowH * 24)));
    products.forEach((prod, i) => {
      const y = yTop + i * rowH;
      const label = productLabel(prod, i);
      if (i > 0) s.addShape("line", { x: MX, y: y, w: CW, h: 0, line: { color: LINE, width: 0.5 } });
      s.addText(pad(i + 1), { x: MX, y: y, w: 0.7, h: rowH, fontFace: F, fontSize: Math.min(14, fs + 1), bold: true, color: ACC, valign: "middle" });
      s.addText(label, { x: MX + 0.8, y: y, w: CW - 3.0, h: rowH, fontFace: F, fontSize: fs, color: INK, valign: "middle" });
      if (prod.category && prod.category !== label) s.addText(prod.category, { x: PW - MX - 2.0, y: y, w: 2.0, h: rowH, fontFace: F, fontSize: Math.max(9, fs - 1), color: MUTED, align: "right", valign: "middle" });
    });
  }

  // ===== ① 需求描述 =====
  function addDescPage(ctx, data, headLabel, headTitle) {
    const s = newContent(ctx, headLabel, headTitle);
    const desc = data.desc || data.reqName || "（待填需求描述）";
    const items = [];
    if (data.present) items.push(["呈现要点", data.present, false]);
    if (data.avoidOverall) items.push(["整体不要 / 规避", data.avoidOverall, true]);
    const yTop = 1.55, yBot = 6.8, GAP = 0.22, descMin = 1.3;
    let cardHs = items.map((it) => Math.max(1.0, Math.min(2.3, 0.82 + textH(it[1], CARD_BODY_W, 13, 1.3))));
    const avail1 = yBot - yTop;
    let cardsTotal = cardHs.reduce((a, b) => a + b + GAP, 0);
    if (cardsTotal > avail1 - descMin) { const sc = (avail1 - descMin) / cardsTotal; cardHs = cardHs.map((h) => h * sc); cardsTotal = cardHs.reduce((a, b) => a + b + GAP, 0); }
    const descH = Math.max(descMin, avail1 - cardsTotal);
    s.addText(desc, { x: MX, y: yTop, w: CW, h: descH, fontFace: F, fontSize: fitH(desc, CW, descH, 23, 12, 1.45), color: INK, valign: "top", wrap: true, lineSpacingMultiple: 1.45 });
    let cy = yTop + descH + GAP;
    items.forEach((it, i) => { card(s, cy, cardHs[i], it[0], it[1], it[2]); cy += cardHs[i] + GAP; });
  }

  // ===== ② 参考图（3/页）=====
  function addRefPages(ctx, data, headLabel, headTitleBase) {
    const refs = (data.refs || []).filter((r) => r && r.dataURL);
    const refPages = Math.max(1, Math.ceil(refs.length / 3));
    for (let pi = 0; pi < refPages; pi++) {
      const title = headTitleBase + (refPages > 1 ? `（${pi + 1}/${refPages}）` : "");
      const s = newContent(ctx, headLabel, title);
      const group = refs.slice(pi * 3, pi * 3 + 3);
      if (group.length === 0) {
        s.addText("（本需求暂无参考图）", { x: MX, y: 3.2, w: CW, h: 0.6, fontFace: F, fontSize: 15, color: MUTED, align: "center" });
      } else {
        const colW = 3.75, gap = (CW - colW * group.length) / Math.max(1, group.length - 1);
        const startX = group.length === 1 ? MX + (CW - colW) / 2 : MX;
        const imgH = 3.0, imgY = 1.7, annY = imgY + imgH + 0.22, annH = 6.8 - annY;
        group.forEach((r, i) => {
          const cx = startX + i * (colW + (group.length > 1 ? gap : 0));
          s.addShape("roundRect", { x: cx, y: imgY, w: colW, h: imgH, rectRadius: 0.06, fill: { color: SURF }, line: { color: LINE, width: 1 } });
          s.addImage(Object.assign({ data: r.dataURL }, fitBox({ x: cx + 0.08, y: imgY + 0.08, w: colW - 0.16, h: imgH - 0.16 }, r)));
          let ann = r.note || "";
          if (r.source) ann += (ann ? "\n" : "") + `来源：${r.source}`;
          if (ann) s.addText(ann, { x: cx + 0.05, y: annY, w: colW - 0.1, h: annH, fontFace: F, fontSize: fitH(ann, colW - 0.1, annH, 12, 8, 1.2), color: INK2, valign: "top", lineSpacingMultiple: 1.2, wrap: true });
        });
      }
    }
  }

  // ===== ③ 产品要求（extraRows：多产品时附 承接人/期望上新）=====
  function addRequirePage(ctx, data, headLabel, headTitle, extraRows) {
    const s = newContent(ctx, headLabel, headTitle);
    const rows = [];
    if (data.category) rows.push(["品类", data.category]);
    const flavorVal = [(data.flavors || []).join("、"), data.flavorNote].filter(Boolean).join("；");
    if (flavorVal) rows.push(["味型 / 风味方向", flavorVal]);
    (data.extras || []).forEach((e) => { if (e && e.value) rows.push([e.label, e.value]); });
    (extraRows || []).forEach((r) => rows.push(r));
    if (rows.length === 0) rows.push(["（待填）", ""]);
    const rTop = 1.8, rBot = 6.5, rAvail = rBot - rTop, valW = CW - 4.3, RPAD = 0.34, RMIN = 0.6;
    const rowHsAt = (pt) => rows.map((r) => Math.max(RMIN, textH(r[1], valW, pt, 1.25) + RPAD));
    let vPt = 15, rH = rowHsAt(vPt), rTot = rH.reduce((a, b) => a + b, 0);
    while (rTot > rAvail && vPt > 10) { vPt--; rH = rowHsAt(vPt); rTot = rH.reduce((a, b) => a + b, 0); }
    if (rTot > rAvail) { const sc = rAvail / rTot; rH = rH.map((h) => h * sc); rTot = rAvail; }
    let ry = rTop;
    rows.forEach((r, i) => {
      const h = rH[i];
      if (i > 0) s.addShape("line", { x: MX, y: ry, w: CW, h: 0, line: { color: LINE, width: 0.75 } });
      s.addText(pad(i + 1), { x: MX, y: ry, w: 0.7, h: h, fontFace: F, fontSize: 13, color: ACC, valign: "middle" });
      s.addText(r[0], { x: MX + 0.8, y: ry, w: 3.3, h: h, fontFace: F, fontSize: fitH(r[0], 3.3, h, 15, 11, 1.15), bold: true, color: INK, valign: "middle", wrap: true });
      s.addText(r[1], { x: MX + 4.3, y: ry, w: valW, h: h, fontFace: F, fontSize: fitH(r[1], valW, h - 0.12, vPt, 10, 1.25), color: INK2, valign: "middle", wrap: true, lineSpacingMultiple: 1.25 });
      ry += h;
    });
    s.addText("份量 / 成本 / 售价不在本表 —— 研发出成品后按成本定价法定。", { x: MX, y: Math.min(ry + 0.12, 6.55), w: CW, h: 0.35, fontFace: F, fontSize: 12, color: MUTED });
  }

  // ===== ④ 承接与排期 / 落地节点（showOwner=false 时只画流程，用于多产品共享页）=====
  function addSchedulePage(ctx, data, headLabel, headTitle, opts) {
    const showOwner = !opts || opts.showOwner !== false;
    const s = newContent(ctx, headLabel, headTitle);
    if (showOwner) {
      s.addText([
        { text: "承接人　", options: { color: SAND, charSpacing: 1 } },
        { text: (data.owner || "（研发填）"), options: { color: INK } },
        { text: "        想什么时候上　", options: { color: SAND, charSpacing: 1 } },
        { text: (data.launchTime || "（研发填）"), options: { color: INK } },
      ], { x: MX, y: 1.7, w: CW, h: 0.5, fontFace: F, fontSize: 15, valign: "middle", wrap: true });
    }
    s.addText("落地节点", { x: MX, y: 2.75, w: 6, h: 0.4, fontFace: F, fontSize: 13, bold: true, color: ACC, charSpacing: 1 });
    const steps = ["试制", "内部试吃", "成本核算 + 定价", "门店测试", "上新"];
    const cyT = 3.7, d = 0.7, xs = [1.55, 3.95, 6.35, 8.75, 11.15];
    s.addShape("line", { x: xs[0] + d / 2, y: cyT + d / 2, w: xs[4] - xs[0], h: 0, line: { color: LINE2, width: 1.25 } });
    steps.forEach((t, i) => {
      const x = xs[i];
      s.addShape("ellipse", { x, y: cyT, w: d, h: d, fill: { color: i === 0 ? ACC : SURF }, line: { color: ACC, width: 1.5 } });
      s.addText(String(i + 1), { x, y: cyT, w: d, h: d, fontFace: F, fontSize: 16, bold: true, color: i === 0 ? WHITE : ACC, align: "center", valign: "middle" });
      s.addText(t, { x: x - 0.75, y: cyT + d + 0.16, w: d + 1.5, h: 0.6, fontFace: F, fontSize: 12, color: INK2, align: "center" });
    });
    card(s, 5.5, 1.1, "内部试吃看两件事", "样子对不对参考、口味对不对方向。");
  }

  function newDeck() {
    const p = new PPTX();
    p.defineLayout({ name: "W", width: PW, height: PH });
    p.layout = "W";
    return p;
  }

  // ===== 单产品任务书（原版，输出不变）=====
  function buildDeck(data) {
    data = data || {};
    const p = newDeck();
    const brand = data.brand || "品牌";
    const reqName = data.reqName || "未命名需求";
    const refs = (data.refs || []).filter((r) => r && r.dataURL);
    const refPages = Math.max(1, Math.ceil(refs.length / 3));
    const ctx = { p, foot: `${brand} · ${reqName}`, pageNo: 1, totalPages: 3 + refPages };
    addCoverSingle(p, data);
    addDescPage(ctx, data, "01", "需求描述");
    addRefPages(ctx, data, "02", "参考图");
    addRequirePage(ctx, data, "03", "产品要求");
    addSchedulePage(ctx, data, "04", "承接与排期");
    return p.write({ outputType: isNode ? "nodebuffer" : "blob" });
  }

  // 多产品清单页数：目录(1) + Σ每产品(需求描述1 + 参考图refPages + 产品要求1) + 落地节点(1)。封面不编号。
  function multiDeckPlan(products) {
    products = (products || []).filter(Boolean);
    let perProduct = 0;
    products.forEach((prod) => {
      const refs = (prod.refs || []).filter((r) => r && r.dataURL);
      perProduct += 2 + Math.max(1, Math.ceil(refs.length / 3));
    });
    return { productCount: products.length, totalPages: 1 + perProduct + 1 };
  }

  // ===== 多产品研发需求清单 =====
  function buildDeckMulti(products, meta) {
    products = (products || []).filter(Boolean);
    meta = meta || {};
    const p = newDeck();
    const { totalPages } = multiDeckPlan(products);
    const brand = meta.brand || "品牌";
    const reqName = meta.reqName || "研发需求清单";
    const ctx = { p, foot: `${brand} · ${reqName}`, pageNo: 1, totalPages };
    addCoverList(p, { date: meta.date, count: products.length, brand: meta.brand, reqName: meta.reqName });
    addTocPage(ctx, products);
    products.forEach((prod, i) => {
      const tag = productLabel(prod, i);
      const label = pad(i + 1);
      addDescPage(ctx, prod, label, `${tag} ｜ 需求描述`);
      addRefPages(ctx, prod, label, `${tag} ｜ 参考图`);
      const extraRows = [];
      if (prod.owner) extraRows.push(["承接人", prod.owner]);
      if (prod.launchTime) extraRows.push(["期望上新", prod.launchTime]);
      addRequirePage(ctx, prod, label, `${tag} ｜ 产品要求`, extraRows);
    });
    addSchedulePage(ctx, {}, "", "落地节点", { showOwner: false });
    return p.write({ outputType: isNode ? "nodebuffer" : "blob" });
  }

  const api = { buildDeck, buildDeckMulti, multiDeckPlan, fitBox, fitFont, fitH, textH };
  if (isNode) module.exports = api;
  global.RD = global.RD || {}; global.RD.deck = api;
})(typeof window !== "undefined" ? window : globalThis);
