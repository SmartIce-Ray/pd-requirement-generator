// 图片处理管线（调研线程3定）：校验/HEIC拦截 → 转正解码 → canvas高质量降采样 → JPEG编码。
// 关键：缩放只用 canvas（createImageBitmap 的 resize 选项 Safari 不支持，会让 iPhone 用户的图不缩）。
window.RD = window.RD || {};
(function () {
  const MAX_EDGE = 1600;   // 长边上限：体积与清晰的平衡（命门，糊则升 2000）
  const QUALITY = 0.8;     // JPEG 质量

  // 读前 12 字节判 HEIC（iPhone 原图，浏览器多半打不开）。file.type 对 HEIC 常为空，不可只靠它。
  async function isHeic(file) {
    if (/\.(heic|heif)$/i.test(file.name)) return true;
    try {
      const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const ftyp = String.fromCharCode(buf[4], buf[5], buf[6], buf[7]);
      const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
      return ftyp === "ftyp" && /heic|heix|hevc|hevx|mif1|msf1|heif/i.test(brand);
    } catch (_) { return false; }
  }

  // 解码 + EXIF 转正。优先 createImageBitmap，失败降级 <img>+objectURL（覆盖老 Safari）。
  // 返回 {src, url}：url 为本次创建的 objectURL（需调用方 revoke），createImageBitmap 路径为 null。
  // 不用共享静态变量存 url —— 否则并发(如粘贴叠加拖拽)会互相覆盖、错误 revoke。
  async function decode(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return { src: await createImageBitmap(file, { imageOrientation: "from-image" }), url: null };
      } catch (_) { /* 降级 */ }
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      if (img.decode) { await img.decode(); }
      else { await new Promise((res, rej) => { img.onload = res; img.onerror = rej; }); }
    } catch (e) { URL.revokeObjectURL(url); throw e; }
    if (!img.naturalWidth) { URL.revokeObjectURL(url); throw new Error("decode-failed"); }
    return { src: img, url };
  }

  function srcSize(src) {
    if (src.width && src.height) return { w: src.width, h: src.height };       // ImageBitmap
    return { w: src.naturalWidth, h: src.naturalHeight };                       // <img>
  }

  // 处理单个文件 → {dataURL, w, h, name}。失败抛 {code, message}。
  async function process(file) {
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|gif|webp|heic|heif)$/i.test(file.name)) {
      throw { code: "TYPE", message: `不支持的文件类型：${file.name}` };
    }
    if (await isHeic(file)) {
      throw { code: "HEIC", message: `「${file.name}」是 iPhone 原图(HEIC)格式，浏览器读不了。请在 iPhone 设置→相机→格式选「兼容性最佳」，或先转成 JPG/PNG，或直接传截图。` };
    }
    let dec;
    try { dec = await decode(file); }
    catch (_) { throw { code: "DECODE", message: `「${file.name}」读取失败，可能是损坏或不支持的图片。` }; }
    const src = dec.src;

    const { w: sw, h: sh } = srcSize(src);
    const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh)); // 只缩不放
    const dw = Math.round(sw * scale), dh = Math.round(sh * scale);

    const canvas = document.createElement("canvas");
    canvas.width = dw; canvas.height = dh;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, dw, dh);

    const dataURL = canvas.toDataURL("image/jpeg", QUALITY);

    if (src.close) src.close();                                   // 释放 ImageBitmap
    if (dec.url) URL.revokeObjectURL(dec.url);                     // 释放本次 objectURL

    return { dataURL, w: dw, h: dh, name: file.name };
  }

  window.RD.images = { process, isHeic, MAX_EDGE, QUALITY };
})();
