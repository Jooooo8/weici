/* 界面 DOM 自检：例词加载、平仄标注、押韵判定 */
const { chromium } = require("playwright");
const fs = require("fs");
const URL = "file:///C:/Users/LENOVO/Desktop/新建文件夹/微词/index.html";

let fails = 0;
function assert(cond, msg) {
  if (cond) {
    console.log("  ✓", msg);
  } else {
    console.log("  ✗", msg);
    fails++;
  }
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  // 音乐/背景图片为留白文件，缺失属预期；资源加载失败按 URL 精确记录
  page.on("requestfailed", (req) => {
    if (!/music\/|backgrounds\//.test(req.url())) errors.push("FAILED: " + req.url());
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  console.log("== 写诗页 ==");
  assert(await page.locator("#shi-select option").count() === 16, "16 种诗格律");
  const shiMeta = await page.textContent("#meta-line");
  assert(shiMeta.includes("近体诗") && shiMeta.includes("平水韵"), "诗格律元信息显示");
  const exampleCounts = await page.evaluate(() => ({
    lishi: Object.keys(window.LISHI || {}).length,
    lici: Object.keys(window.LICI || {}).length,
    cipu: Object.keys(window.CIPU || {}).length
  }));
  assert(exampleCounts.lishi === 16, "16 种诗格律均配例诗（实际 " + exampleCounts.lishi + "）");
  assert(exampleCounts.lici === exampleCounts.cipu, "157 个词牌均配例词（实际 " + exampleCounts.lici + "/" + exampleCounts.cipu + "）");

  console.log("== 写诗页：载入例诗 ==");
  await page.selectOption("#shi-select", "0"); // 五绝仄起首句不入韵
  await page.click("#btn-example");
  await page.waitForTimeout(500);
  assert(await page.locator("#editor-body input[data-li]").count() === 4, "例诗载入 4 句");
  const shiExValues = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#editor-body input[data-li]")).map((i) => i.value)
  );
  assert(shiExValues.every((v) => v.length === 5), "例诗每句五字");
  assert((await page.textContent("#report-body")).includes("100%"), "例诗按格律 100% 合律");

  console.log("== 写词页：权威例词抽查 ==");
  await page.click("button[data-mode='ci']");
  for (const tune of ["玉蝴蝶", "三字令", "伤春怨", "忆馀杭", "十六字令", "平湖乐"]) {
    await page.selectOption("#tune-select", tune);
    await page.click("#btn-example");
    await page.waitForTimeout(350);
    const r = await page.evaluate(() => {
      const ex = window.LICI[document.querySelector("#tune-select").value];
      const filled = Array.from(document.querySelectorAll("#editor-body input[data-li]"))
        .filter((i) => i.value).length;
      return { author: ex ? ex.author : "", filled };
    });
    assert(r.filled > 0 && r.author, tune + " 例词载入（" + r.author + "）");
  }
  await page.selectOption("#tune-select", "玉蝴蝶");
  await page.click("#btn-example");
  await page.waitForTimeout(400);
  const yhdReport = await page.textContent("#report-body");
  assert(yhdReport.includes("100%"), "玉蝴蝶（温庭筠）100% 合律");

  console.log("== 写词页：如梦令 ==");
  await page.click("button[data-mode='ci']");
  await page.selectOption("#tune-select", "如梦令");
  await page.click("#btn-example");
  await page.waitForTimeout(600);
  assert(await page.locator("#editor-body input[data-li]").count() === 7, "7 句输入框");
  assert((await page.locator("#editor-body .tones .t.bad").count()) === 0, "例词无出律标注");
  const report = await page.textContent("#report-body");
  assert(report.includes("100%"), "平仄合格率 100%");
  assert(report.includes("同韵"), "押韵判定通过");
  assert(report.includes("第四部"), "韵部标注（词林正韵第四部）");

  console.log("== 写词页：满江红（双调、豆） ==");
  await page.selectOption("#tune-select", "满江红");
  await page.click("#btn-example");
  await page.waitForTimeout(600);
  assert(await page.locator("#editor-body .line").count() === 18, "18 句");
  assert(await page.locator("#editor-body input[data-li]").count() === 22, "22 个输入段（含豆）");
  assert((await page.textContent("#editor-body")).includes("下 阕"), "显示下阕分隔");
  assert((await page.locator("#editor-body .tones .t.bad").count()) === 0, "满江红例词无出律");

  console.log("== 写词页：水调歌头 ==");
  await page.selectOption("#tune-select", "水调歌头");
  await page.click("#btn-example");
  await page.waitForTimeout(600);
  assert(await page.locator("#editor-body input[data-li]").count() === 19, "19 句输入框");
  assert((await page.locator("#editor-body .tones .t.bad").count()) === 0, "水调歌头例词无出律");

  console.log("== 押韵错误检测：把韵脚改错 ==");
  await page.selectOption("#tune-select", "如梦令");
  await page.click("#btn-example");
  await page.waitForTimeout(400);
  // 把第 2 句末字（路）改成「楼」（第十二部平声）
  await page.locator("#editor-body input[data-li]").nth(1).fill("沉醉不知归楼");
  await page.waitForTimeout(600);
  const report2 = await page.textContent("#report-body");
  assert(report2.includes("出韵"), "改错韵脚后提示出韵");

  console.log("== 同韵字面板 ==");
  await page.locator("[data-suggest='ci'][data-group='0']").click();
  await page.waitForTimeout(300);
  const sug = await page.locator("#suggest-ci-0 .s").count();
  assert(sug > 50, "同韵字候选 > 50（实际 " + sug + "）");

  console.log("== 逐字对齐 ==");
  // 如梦令第一句为 6 字：格律行应有 6 个等宽格子，输入框宽度应为 6*30=180px
  const align = await page.evaluate(() => {
    const seg = document.querySelector("#editor-body .seg");
    const cells = seg.querySelectorAll(".pat-cell").length;
    const input = seg.querySelector("input");
    const cs = getComputedStyle(input);
    return {
      cells: cells,
      width: input.getBoundingClientRect().width,
      ls: cs.letterSpacing,
      firstCellX: seg.querySelector(".pat-cell").getBoundingClientRect().left,
      inputX: input.getBoundingClientRect().left
    };
  });
  assert(align.cells === 6 && Math.round(align.width) === 180, "格律 6 格、输入框宽 180px（实际 " + JSON.stringify(align) + "）");
  assert(Math.abs(align.firstCellX - align.inputX) < 2, "格律首字与输入框首字左对齐");
  const cellOverflow = await page.locator("#editor-body .seg input").first().evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  assert(cellOverflow.scroll <= cellOverflow.client + 1, "字框内文字不溢出，末字可见（" + JSON.stringify(cellOverflow) + "）");

  console.log("== 多音字竖排 ==");
  // 如梦令第三句「兴尽晚回舟」首字「兴」为平/去两读，应竖排两个标注
  const multi = await page.evaluate(() => {
    const inputs = document.querySelectorAll("#editor-body input[data-li]");
    const third = inputs[2];
    const cell = third.parentElement.querySelector(".tone-cell");
    return cell ? cell.querySelectorAll(".t").length : 0;
  });
  assert(multi >= 2, "多音字竖排标注 ≥ 2 个（实际 " + multi + "）");

  console.log("== 自动成句 ==");
  await page.click("#btn-gen");
  await page.waitForTimeout(600);
  const genLines = await page.locator("#gen-ci-0 .sugg-line").count();
  const genChips = await page.locator("#gen-ci-0 .w").count();
  assert(genLines > 0, "自动成句候选 > 0（实际 " + genLines + "）");
  assert(genChips > 0, "常用韵脚词 > 0（实际 " + genChips + "）");

  console.log("== 韵书查询：分部 / 支浏览 ==");
  await page.click("#btn-yunshu");
  await page.waitForTimeout(300);
  assert(await page.locator("#page-yunshu").isVisible(), "查韵书独立页面可见");
  const browse1 = await page.evaluate(() => ({
    partCount: document.getElementById("yun-part").options.length,
    firstPart: document.getElementById("yun-part").options[0].textContent,
    tuneCount: document.getElementById("yun-tune").options.length,
    firstTune: document.getElementById("yun-tune").options[0].textContent,
    tableLen: document.getElementById("yun-result").textContent.length
  }));
  assert(browse1.partCount === 19, "词林正韵按部查共 19 部");
  assert(/^[一二三四五六七八九十]+（.+）$/.test(browse1.firstPart) && !browse1.firstPart.includes("第"),
    "词林正韵部名格式为「一（例字）」（实际 " + browse1.firstPart + "）");
  assert(browse1.tuneCount >= 4, "第一部含平上去入多个韵目（实际 " + browse1.tuneCount + "）");
  assert(browse1.tableLen > 50, "韵目字表已显示");
  await page.selectOption("#yun-browse-book", "中华新韵");
  await page.waitForTimeout(200);
  const browse2 = await page.evaluate(() => ({
    partCount: document.getElementById("yun-part").options.length,
    firstPart: document.getElementById("yun-part").options[0].textContent,
    firstTune: document.getElementById("yun-tune").options[0].textContent,
    tableLen: document.getElementById("yun-result").textContent.length
  }));
  assert(browse2.partCount === 14, "中华新韵按部查共 14 部");
  assert(/^[一二三四五六七八九十]+[^（]+（.+）$/.test(browse2.firstPart),
    "中华新韵部名格式为「一麻（例字）」（实际 " + browse2.firstPart + "）");
  assert(browse2.firstTune.includes("平声") || browse2.firstTune.includes("仄声"), "新韵韵目含平 / 仄");
  assert(browse2.tableLen > 50, "新韵韵目字表已显示");
  await page.selectOption("#yun-browse-book", "词林正韵");
  await page.waitForTimeout(200);

  console.log("== 韵书查询：搜索字 ==");
  await page.fill("#yun-search", "秋");
  await page.waitForTimeout(300);
  const qiu = await page.textContent("#yun-result");
  assert(qiu.includes("十一尤") && qiu.includes("平声"), "「秋」词林正韵为十一尤·平声");
  assert(qiu.includes("七尤") || qiu.includes("七尤韵"), "「秋」中华新韵为七尤");
  assert(await page.locator("#yun-result .yun-chips .y").count() > 50, "同韵通押字 > 50（实际 " + await page.locator("#yun-result .yun-chips .y").count() + "）");
  assert(await page.locator("#yun-result .yun-chips .w").count() > 5, "常用通押词 > 5（实际 " + await page.locator("#yun-result .yun-chips .w").count() + "）");

  console.log("== 韵书查询：点击已输入的字 ==");
  await page.click("button[data-page='write']");
  await page.waitForTimeout(300);
  await page.selectOption("#tune-select", "如梦令");
  await page.click("#btn-example");
  await page.waitForTimeout(500);
  const lastYun = await page.evaluate(() => {
    const inputs = document.querySelectorAll("#editor-body input[data-li]");
    const last = inputs[inputs.length - 1].value;
    const shown = document.getElementById("yun-result").textContent;
    return { last: last[last.length - 1], shown: shown };
  });
  assert(lastYun.shown.includes(lastYun.last), "默认查询最后一个输入的字「" + lastYun.last + "」");
  await page.locator("#editor-body .tone-cell").first().click();
  await page.waitForTimeout(300);
  assert(await page.locator("#page-yunshu").isVisible(), "点击字后跳转到查韵书页");
  const clickShown = await page.textContent("#yun-result");
  assert(clickShown.includes("常"), "点击已输入的字后查询面板联动");

  console.log("== 粘贴导入 ==");
  await page.click("button[data-page='write']");
  await page.waitForTimeout(300);
  await page.click("button[data-mode='shi']");
  await page.selectOption("#shi-select", "0");
  await page.click("#btn-import");
  await page.waitForTimeout(200);
  await page.fill("#import-text", "床前明月光，疑是地上霜。举头望明月，低头思故乡。");
  await page.click("#import-confirm");
  await page.waitForTimeout(400);
  const impVals = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#editor-body input[data-li]")).map((i) => i.value)
  );
  assert(impVals.length === 4 && impVals[0] === "床前明月光" && impVals[3] === "低头思故乡", "五绝粘贴导入成功");
  assert(await page.locator("#import-overlay.show").count() === 0, "导入后弹窗关闭");
  await page.click("button[data-mode='ci']");
  await page.selectOption("#tune-select", "如梦令");
  await page.click("#btn-import");
  await page.waitForTimeout(200);
  await page.fill("#import-text", "常记溪亭日暮，沉醉不知归路。兴尽晚回舟，误入藕花深处。争渡，争渡，惊起一滩鸥鹭。");
  await page.click("#import-confirm");
  await page.waitForTimeout(400);
  const impCi = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#editor-body input[data-li]")).map((i) => i.value)
  );
  assert(impCi.length === 7 && impCi[0] === "常记溪亭日暮" && impCi[4] === "争渡", "如梦令粘贴导入成功");

  console.log("== 打印稿 ==");
  await page.evaluate(() => { window.print = function () {}; });
  await page.click("#btn-print");
  await page.waitForTimeout(300);
  const printHtml = await page.textContent("#print-area");
  assert(printHtml.includes("如梦令") && printHtml.includes("常记溪亭日暮"), "打印稿内容生成");
  await page.locator("[data-close='pdf-overlay']").click();
  await page.waitForTimeout(200);

  console.log("== 韵书切换：中华新韵 ==");
  await page.selectOption("#tune-select", "如梦令");
  await page.click("#btn-example");
  await page.waitForTimeout(400);
  // 第一句第 4 字为「平」，填入「发」：词林正韵为入声（仄）→ 标红；中华新韵为阴平 → 标绿
  await page.locator("#editor-body input[data-li]").first().fill("常记溪发日暮");
  await page.waitForTimeout(500);
  const badBefore = await page.locator("#editor-body .seg .tone-cell").nth(3).locator(".t.bad").count();
  assert(badBefore > 0, "词林正韵下「发」在平位标红（入声）");
  await page.selectOption("#yun-select", "中华新韵");
  await page.waitForTimeout(500);
  const metaNew = await page.textContent("#meta-line");
  assert(metaNew.includes("中华新韵"), "切换后元信息显示《中华新韵》");
  const okAfter = await page.locator("#editor-body .seg .tone-cell").nth(3).locator(".t.ok").count();
  assert(okAfter > 0, "中华新韵下「发」在平位标绿（阴平）");
  // 恢复例词原文，验证中华新韵下逐字标注完整、检测正常
  await page.click("#btn-example");
  await page.waitForTimeout(500);
  const xyStats = await page.evaluate(() => ({
    empty: document.querySelectorAll("#editor-body .tone-cell:empty").length,
    bad: document.querySelectorAll("#editor-body .tone-cell .t.bad").length,
    total: document.querySelectorAll("#editor-body .tone-cell .t").length
  }));
  const xyReport = await page.textContent("#report-body");
  assert(xyStats.empty === 0, "中华新韵下逐字标注无丢失（空标注 " + xyStats.empty + "）");
  assert(xyStats.total >= 30, "中华新韵下标注数量完整（共 " + xyStats.total + " 个）");
  assert(xyReport.includes("100%"), "中华新韵下格律检测正常（合格率 100%）");
  assert(xyReport.includes("中华新韵第十四部"), "中华新韵押韵标注正确（第十四部）");
  await page.selectOption("#yun-select", "词林正韵");
  await page.waitForTimeout(400);

  console.log("== Enter 换行 ==");
  await page.locator("#editor-body input[data-li]").first().fill("床前明月光");
  await page.locator("#editor-body input[data-li]").first().press("Enter");
  await page.waitForTimeout(200);
  const activeLi = await page.evaluate(() => {
    const a = document.activeElement;
    return a && a.dataset ? a.dataset.li + ":" + a.dataset.pi : "none";
  });
  assert(activeLi === "1:0" || activeLi === "0:1", "Enter 后焦点跳到下一输入框（实际 " + activeLi + "）");

  console.log("== 保存作品 / 我的作品 ==");
  await page.click("#btn-save-work");
  await page.waitForTimeout(300);
  assert(await page.locator("#save-overlay.show").count() === 1, "保存弹窗打开");
  await page.fill("#save-title", "测试作品");
  await page.click("#save-confirm");
  await page.waitForTimeout(300);
  assert(await page.locator("#save-overlay.show").count() === 0, "保存后弹窗关闭");
  await page.click("#btn-works");
  await page.waitForTimeout(300);
  assert((await page.textContent("#works-list")).includes("测试作品"), "我的作品列表出现新作品");
  await page.locator("[data-wload]").first().click();
  await page.waitForTimeout(400);
  assert(await page.locator("#works-overlay.show").count() === 0, "载入后弹窗关闭");
  await page.click("#btn-works");
  await page.waitForTimeout(300);
  await page.locator("[data-wdel]").first().click();
  await page.waitForTimeout(300);
  assert(!(await page.textContent("#works-list")).includes("测试作品"), "删除后列表移除");
  await page.locator("[data-close='works-overlay']").click();
  await page.waitForTimeout(200);

  console.log("== 主题与背景 ==");
  await page.click("#btn-settings");
  await page.waitForTimeout(300);
  await page.locator("#theme-grid [data-theme='mu']").click();
  await page.waitForTimeout(200);
  const themeAttr = await page.evaluate(() => document.body.dataset.theme);
  assert(themeAttr === "mu", "主题切换为暮色");
  await page.locator("#bg-row [data-bg='1']").click();
  await page.waitForTimeout(200);
  const bgAttr = await page.evaluate(() => document.body.dataset.bg);
  assert(bgAttr === "1", "背景切换为水墨");
  await page.locator("#theme-grid [data-theme='default']").click();
  await page.locator("#bg-row [data-bg='none']").click();
  await page.waitForTimeout(200);
  await page.locator("[data-close='settings-overlay']").click();
  await page.waitForTimeout(200);

  console.log("== 背景音乐 ==");
  const hasBgm = fs.existsSync("music/bgm.mp3");
  await page.click("#btn-settings");
  await page.waitForTimeout(300);
  await page.click("#music-play");
  await page.waitForTimeout(1000);
  const musicHint = await page.textContent("#music-hint");
  if (hasBgm) {
    assert(musicHint.includes("正在播放"), "检测到音乐文件并开始播放（" + musicHint + "）");
    assert((await page.textContent("#btn-music")).includes("播放中"), "音乐按钮显示播放中");
  } else {
    assert(musicHint.includes("未检测到"), "无音频文件时给出放置提示");
  }
  await page.locator("[data-close='settings-overlay']").click();
  await page.waitForTimeout(200);

  console.log("== 诗词鉴赏 ==");
  await page.click("button[data-page='appreciate']");
  // 等待全库全部分片加载完成
  await page.waitForFunction(() => {
    const n = window.QUAN_KU_MANIFEST && window.QUAN_KU_MANIFEST.parts;
    return n && window["QUAN_KU_PART_" + (n - 1)] !== undefined;
  }, null, { timeout: 90000 });
  await page.waitForFunction(
    () => document.getElementById("appr-loading").textContent === "" &&
          document.getElementById("appr-count").textContent.indexOf("共 ") !== -1,
    null,
    { timeout: 10000 }
  );
  assert(await page.locator("#page-appreciate").isVisible(), "鉴赏页可见");
  assert(await page.locator("#appr-list .poem-item").count() === 50, "列表分页默认显示 50 条");
  const totalText = await page.textContent("#appr-count");
  const totalNum = parseInt(totalText.match(/\d+/)[0], 10);
  assert(totalNum > 40000, "全库作品总数 > 40000（实际 " + totalNum + "）");
  await page.click("#appr-more");
  await page.waitForTimeout(300);
  assert(await page.locator("#appr-list .poem-item").count() === 100, "加载更多后显示 100 条");

  console.log("== 随机推荐 ==");
  // 注意：.rec-title 内含 <span class="pi-badge">词牌</span>，textContent 会把徽标文字一起带出，
  // 而详情页标题不含该徽标。故这里只取标题自身的文本节点，避免把徽标误当标题的一部分。
  const recTitleText = () => page.evaluate(() => {
    const el = document.querySelector("#appr-recommend .rec-title");
    if (!el) return "";
    return Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join("")
      .trim();
  });
  const rec1 = {
    title: await recTitleText(),
    meta: await page.evaluate(() =>
      (document.querySelector("#appr-recommend .rec-meta") || {}).textContent || "")
  };
  assert(rec1.title.length > 0 && rec1.meta.length > 0, "推荐卡片显示作品与信息");
  assert(/诗|词|曲|文/.test(rec1.meta), "推荐信息含体裁（" + rec1.meta.slice(0, 20) + "）");
  await page.click("#rec-refresh");
  await page.waitForTimeout(200);
  const rec2 = await recTitleText();
  assert(rec2 !== rec1.title, "换一首后作品变化");
  await page.click("#rec-view");
  await page.waitForTimeout(300);
  assert(await page.locator("#page-appr-detail").isVisible(), "查看全文进入独立详情页");
  const recDetail = await page.textContent("#appr-detail");
  assert(recDetail.includes(rec2), "查看全文显示推荐作品详情");
  await page.click("#appr-detail-back");
  await page.waitForTimeout(300);
  assert(await page.locator("#page-appreciate").isVisible(), "返回按钮回到鉴赏列表");

  console.log("== 鉴赏：作者 / 朝代 / 分类筛选 ==");
  await page.fill("#appr-author-kw", "李白");
  await page.waitForTimeout(200);
  const liAuthorCount = await page.locator("#appr-author option").count();
  const liAuthorText = await page.textContent("#appr-author");
  assert(liAuthorCount >= 2 && liAuthorText.includes("李白"), "作者搜索出现李白选项（" + liAuthorCount + " 个）");
  await page.selectOption("#appr-author", "李白");
  await page.waitForTimeout(300);
  const liTotal = parseInt((await page.textContent("#appr-count")).match(/\d+/)[0], 10);
  assert(liTotal > 50, "筛选李白后作品数 > 50（实际 " + liTotal + "）");
  await page.selectOption("#appr-author", "");
  await page.fill("#appr-author-kw", "");
  await page.waitForTimeout(300);
  await page.selectOption("#appr-dynasty", "唐");
  await page.waitForTimeout(300);
  const tangAll = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#appr-list .poem-item .pi-sub"))
      .every((el) => el.textContent.indexOf("唐") !== -1)
  );
  assert(tangAll, "朝代筛选「唐」后列表均为唐代作品");
  await page.selectOption("#appr-dynasty", "");
  await page.selectOption("#appr-tag", "唐诗三百首");
  await page.waitForTimeout(300);
  const tagNum = parseInt((await page.textContent("#appr-count")).match(/\d+/)[0], 10);
  assert(tagNum >= 250 && tagNum <= 290, "分类「唐诗三百首」约 268 首（实际 " + tagNum + "）");
  await page.selectOption("#appr-tag", "");
  await page.waitForTimeout(300);

  console.log("== 鉴赏：古文 ==");
  await page.selectOption("#appr-kind", "文");
  await page.waitForTimeout(300);
  const wenNum = parseInt((await page.textContent("#appr-count")).match(/\d+/)[0], 10);
  assert(wenNum >= 180 && wenNum <= 210, "文体筛选「文」约 190 篇（实际 " + wenNum + "）");
  await page.selectOption("#appr-kind", "");
  await page.fill("#appr-kw", "桃花源记");
  await page.waitForTimeout(300);
  assert(await page.locator("#appr-list .poem-item").count() >= 1, "搜索到《桃花源记》");
  await page.locator("#appr-list .poem-item").first().click();
  await page.waitForTimeout(300);
  assert((await page.locator("#appr-detail [data-appr-edit]").count()) === 0, "古文不显示载入校验按钮");
  assert((await page.textContent("#appr-detail")).includes("桃花源记"), "古文详情正常显示");
  await page.click("#appr-detail-back");
  await page.waitForTimeout(300);
  await page.fill("#appr-kw", "");
  await page.waitForTimeout(300);

  console.log("== 鉴赏：元曲 ==");
  await page.selectOption("#appr-kind", "曲");
  await page.waitForTimeout(300);
  const quNum = parseInt((await page.textContent("#appr-count")).match(/\d+/)[0], 10);
  assert(quNum > 10000, "新增元曲体裁可筛选（实际 " + quNum + " 首）");
  await page.locator("#appr-list .poem-item").first().click();
  await page.waitForTimeout(300);
  assert((await page.locator("#appr-detail [data-appr-edit]").count()) === 0, "元曲不显示载入校验按钮");
  assert((await page.locator("#appr-detail [data-appr-cmp]").count()) === 0, "元曲不显示谱式对照按钮");
  assert((await page.textContent("#appr-detail")).includes("元曲"), "元曲详情显示来源标签");
  await page.click("#appr-detail-back");
  await page.waitForTimeout(300);
  await page.selectOption("#appr-kind", "");
  await page.waitForTimeout(300);

  await page.selectOption("#appr-collection", "宋词三百首");
  await page.selectOption("#appr-tune", "水调歌头");
  await page.waitForTimeout(300);
  const sdtCount = await page.locator("#appr-list .poem-item").count();
  assert(sdtCount >= 3, "宋词三百首 × 水调歌头 至少 3 首（实际 " + sdtCount + "）");
  await page.locator("#appr-list .poem-item").first().click();
  await page.waitForTimeout(300);
  const secCount = await page.locator("#appr-detail .sec-block").count();
  assert(secCount >= 2, "详情含注释/译文/赏析至少 2 块（实际 " + secCount + "）");
  assert((await page.textContent("#appr-detail")).includes("明月几时有"), "详情展示原文");
  await page.locator("#appr-detail [data-appr-write]").first().click();
  await page.waitForTimeout(400);
  assert(await page.locator("#page-write").isVisible(), "用词牌试写回到写作页");
  assert(await page.inputValue("#tune-select") === "水调歌头", "词牌已选水调歌头");

  console.log("== 鉴赏载入原文校验 ==");
  await page.click("button[data-page='appreciate']");
  await page.waitForTimeout(300);
  await page.selectOption("#appr-collection", "唐诗三百首");
  await page.selectOption("#appr-tune", "");
  await page.fill("#appr-kw", "静夜思");
  await page.waitForTimeout(300);
  assert((await page.locator("#appr-list .poem-item").count()) >= 1, "搜索到静夜思");
  await page.locator("#appr-list .poem-item").first().click();
  await page.waitForTimeout(300);
  await page.locator("#appr-detail [data-appr-edit]").click();
  await page.waitForTimeout(400);
  assert(await page.locator("#page-write").isVisible(), "载入校验回到写作页");
  assert(await page.locator("#editor-body input[data-li]").count() === 4, "静夜思载入 4 句");
  assert(await page.locator("#editor-body input[data-li]").nth(0).inputValue() === "床前明月光", "首句内容正确");
  const shiIdx = await page.inputValue("#shi-select");
  assert(shiIdx === "0" || shiIdx === "2" || shiIdx === "4" || shiIdx === "6" || shiIdx === "8" || shiIdx === "10" || shiIdx === "12" || shiIdx === "14", "静夜思匹配五绝格律");
  await page.click("button[data-page='appreciate']");
  await page.selectOption("#appr-collection", "");
  await page.selectOption("#appr-tune", "");
  await page.fill("#appr-kw", "春花秋月何时了");
  await page.waitForTimeout(300);
  await page.locator("#appr-list .poem-item").first().click();
  await page.waitForTimeout(200);
  await page.locator("#appr-detail [data-appr-edit]").click();
  await page.waitForTimeout(400);
  const fallbackText = await page.locator("#editor-body input[data-li]").evaluateAll(els => els.map(el => el.value).join(""));
  assert(fallbackText.includes("春花秋月何时了"), "分段不一致的例词也按词谱顺序填入，不再留空（" + fallbackText.slice(0, 24) + "）");

  console.log("== 设置持久化（刷新后保留） ==");
  await page.click("#btn-settings");
  await page.waitForTimeout(300);
  await page.locator("#theme-grid [data-theme='mu']").click();
  await page.locator("#bg-row [data-bg='3']").click();
  await page.waitForTimeout(300);
  await page.locator("[data-close='settings-overlay']").click();
  await page.waitForTimeout(200);
  await page.selectOption("#yun-select", "中华新韵");
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const persist = await page.evaluate(() => ({
    theme: document.body.dataset.theme || "default",
    bg: document.body.dataset.bg || "none",
    yun: document.getElementById("yun-select").value
  }));
  assert(persist.theme === "mu", "刷新后主题仍为暮色（实际 " + persist.theme + "）");
  assert(persist.bg === "3", "刷新后背景仍为竹韵（实际 " + persist.bg + "）");
  assert(persist.yun === "中华新韵", "刷新后韵书仍为中华新韵（实际 " + persist.yun + "）");
  // 恢复默认，避免影响后续
  await page.selectOption("#yun-select", "词林正韵");
  await page.evaluate(() => {
    delete document.body.dataset.theme;
    delete document.body.dataset.bg;
    const s = JSON.parse(localStorage.getItem("sc-app-state-v1"));
    if (s) { s.theme = "default"; s.bg = "none"; localStorage.setItem("sc-app-state-v1", JSON.stringify(s)); }
  });

  console.log("== 署名 ID ==");
  await page.click("#btn-settings");
  await page.waitForTimeout(300);
  await page.fill("#author-id", "青崖客");
  await page.click("#author-id-save");
  await page.waitForTimeout(300);
  assert((await page.textContent("#author-id-hint")).includes("青崖客"), "署名 ID 保存并提示");
  await page.locator("[data-close='settings-overlay']").click();
  await page.waitForTimeout(200);

  // 打印稿自动署名
  await page.click("button[data-mode='ci']");
  await page.selectOption("#tune-select", "如梦令");
  await page.click("#btn-example");
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.print = function () {}; });
  await page.click("#btn-print");
  await page.waitForTimeout(300);
  const printArea = await page.textContent("#print-area");
  assert(await page.locator("#pdf-overlay.show").count() === 1, "查看原文预览弹窗打开");
  assert(printArea.includes("—— 词 │ 平仄依《词林正韵》 │ 青崖客 ——"), "PDF 预览底部短横线标注署名");
  assert(!printArea.includes("由微词生成"), "PDF 预览不再显示「由微词生成」");
  assert(!printArea.includes("作者："), "PDF 预览不含「作者：」前缀");
  assert(await page.locator("#print-area .pdf-bg").count() === 1, "PDF 预览应用纸纹背景");
  await page.locator("[data-close='pdf-overlay']").click();
  await page.waitForTimeout(200);

  // 导出作品自动署名
  const downloadPromise = page.waitForEvent("download");
  await page.click("#btn-save-work");
  await page.waitForTimeout(300);
  await page.click("#save-confirm");
  await page.waitForTimeout(300);
  await page.click("#btn-works");
  await page.waitForTimeout(300);
  await page.locator("[data-wexport]").first().click();
  const download = await downloadPromise;
  const dPath = await download.path();
  const dlContent = dPath ? fs.readFileSync(dPath, "utf8") : "";
  assert(dlContent.includes("—— 青崖客 ——"), "导出作品底部短横线标注署名");
  assert(!dlContent.includes("作者：") && !/\d{4}[年/]/.test(dlContent), "导出文件不含作者前缀与时间信息");
  // 清理测试作品
  await page.waitForTimeout(200);
  await page.locator("[data-wdel]").first().click();
  await page.waitForTimeout(300);
  await page.locator("[data-close='works-overlay']").click();
  await page.waitForTimeout(200);

  console.log("== 查看原文 / PDF 统一预览 ==");
  await page.click("#btn-view-example");
  await page.waitForTimeout(300);
  assert((await page.textContent("#print-area")).includes("常记溪亭日暮"), "内置例作可查看原文并导出 PDF");
  await page.selectOption("#pdf-font-poem", "song");
  await page.waitForTimeout(200);
  assert(await page.evaluate(() => document.body.dataset.fontPoem) === "song", "PDF 字体切换写入界面设置");
  assert((await page.evaluate(() => getComputedStyle(document.querySelector("#print-area")).fontFamily)).includes("SimSun"), "预览与 PDF 使用所选诗词字体");
  await page.selectOption("#pdf-bg", "5");
  await page.waitForTimeout(200);
  assert(await page.evaluate(() => document.querySelector("#print-area").dataset.dark) === "1", "星空纸纹自动切换深色保护罩");
  await page.selectOption("#pdf-font-poem", "kai");
  await page.selectOption("#pdf-bg", "1");
  await page.locator("[data-close='pdf-overlay']").click();
  await page.waitForTimeout(200);

  await page.click("#btn-settings");
  await page.selectOption("#font-ui-select", "fangsong");
  await page.waitForTimeout(200);
  assert(await page.evaluate(() => document.body.dataset.fontUi) === "fangsong", "界面字体可切换");
  await page.selectOption("#font-ui-select", "yahei");
  await page.locator("[data-close='settings-overlay']").click();
  await page.waitForTimeout(200);

  await page.click("#btn-save-work");
  await page.fill("#save-title", "PDF预览测试");
  await page.click("#save-confirm");
  await page.click("#btn-works");
  await page.waitForTimeout(300);
  await page.locator("[data-wview]").first().click();
  await page.waitForTimeout(300);
  assert((await page.textContent("#print-area")).includes("PDF预览测试"), "我的作品可查看原文并导出 PDF");
  await page.locator("[data-close='pdf-overlay']").click();
  await page.locator("[data-wdel]").first().click();
  await page.waitForTimeout(200);
  await page.locator("[data-close='works-overlay']").click();
  await page.waitForTimeout(200);

  await page.click("button[data-page='appreciate']");
  await page.waitForFunction(() => document.querySelector("#appr-loading").textContent === "" && document.querySelector("#appr-count").textContent.includes("共 "), null, { timeout: 90000 });
  await page.fill("#appr-kw", "静夜思");
  await page.waitForTimeout(300);
  await page.locator("#appr-list .poem-item").first().click();
  await page.waitForFunction(() => document.querySelector("#page-appr-detail").style.display !== "none" && document.querySelector("#appr-detail").style.display === "");
  await page.locator("[data-appr-view]").click();
  await page.waitForTimeout(300);
  const libPreview = await page.textContent("#print-area");
  assert(libPreview.includes("床前明月光") && !libPreview.includes("由微词生成"), "全库作品可查看原文并导出 PDF");
  await page.locator("[data-close='pdf-overlay']").click();
  await page.click("#appr-detail-back");
  await page.fill("#appr-kw", "");
  await page.waitForTimeout(200);

  console.log("== 详情页与 PDF 共用纸纹 ==");
  await page.click("#btn-settings");
  await page.locator("#bg-row [data-bg='3']").click();
  await page.waitForTimeout(200);
  assert(await page.evaluate(() => document.body.dataset.bg) === "3", "界面纸纹切换为竹韵");
  assert((await page.evaluate(() => document.body.style.getPropertyValue("--detail-bg"))).includes("bg3.jpg"), "详情页应用同一纸纹");
  await page.locator("[data-close='settings-overlay']").click();
  await page.click("button[data-page='write']");
  await page.click("#btn-print");
  await page.waitForTimeout(300);
  assert((await page.locator("#print-area .pdf-bg").getAttribute("src")) === "backgrounds/bg3.jpg", "PDF 预览跟随界面纸纹");
  await page.selectOption("#pdf-bg", "1");
  await page.locator("[data-close='pdf-overlay']").click();
  await page.waitForTimeout(200);

  console.log("== 艺术字体与 PDF 排版 ==");
  await page.click("#btn-view-example");
  await page.waitForTimeout(300);
  const fontMenu = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#pdf-font-poem option")).map((o) => o.value)
  );
  // 内置 Web 字体（随仓库分发）任何设备都必须出现
  assert(fontMenu.includes("xiaozhuan"), "内置小篆常驻字体菜单");
  assert(fontMenu.includes("guange"), "内置馆阁体常驻字体菜单");
  // 其余艺术字体依赖本机安装，装了才出现；此处按实际情况判定
  const probeFonts = ["shuti", "yaoti", "xingkai", "lishu"];
  const installed = probeFonts.filter((f) => fontMenu.includes(f));
  console.log("  本机已安装艺术字体：" + (installed.join("、") || "无"));
  assert(fontMenu.length >= 2, "字体菜单至少含内置小篆与馆阁体（实际 " + fontMenu.length + " 项）");
  assert(installed.every((f) => fontMenu.filter((v) => v === f).length === 1), "本机已装艺术字体各占一项，无重复");

  // 用内置馆阁体验证「换字体 → 真实生效」，不依赖本机安装
  await page.selectOption("#pdf-font-poem", "guange");
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.body.dataset.fontPoem) === "guange", "可选内置馆阁体");
  assert(
    (await page.evaluate(() => getComputedStyle(document.querySelector("#print-area")).fontFamily)).includes("WeiCi Guange"),
    "内置馆阁体应用到 PDF 页面"
  );
  const guangeLoaded = await page.evaluate(() => document.fonts.check('72px "WeiCi Guange"', "永和九年"));
  assert(guangeLoaded, "馆阁体 WOFF2 已解码可用");

  if (installed.includes("xingkai")) {
    await page.selectOption("#pdf-font-poem", "xingkai");
    await page.waitForTimeout(200);
    assert(await page.evaluate(() => document.body.dataset.fontPoem) === "xingkai", "可选华文行楷");
    assert((await page.evaluate(() => getComputedStyle(document.querySelector("#print-area")).fontFamily)).includes("STXingkai"), "艺术字体应用到 PDF 页面");
  }

  // 瘦金体没有任何合法开源字库，只能靠本机安装；装了就必须真生效，不能静默回退楷体
  if (fontMenu.includes("shoujin")) {
    await page.selectOption("#pdf-font-poem", "shoujin");
    await page.waitForTimeout(200);
    assert(await page.evaluate(() => document.body.dataset.fontPoem) === "shoujin", "可选本机安装的瘦金体");
    assert(
      (await page.evaluate(() => getComputedStyle(document.querySelector("#print-area")).fontFamily)).includes("瘦金体"),
      "瘦金体应用到 PDF 页面"
    );
    const glyphDiff = await page.evaluate(() => {
      const hash = (family) => {
        const cv = document.createElement("canvas");
        cv.width = 800; cv.height = 90;
        const ctx = cv.getContext("2d");
        ctx.font = "64px " + family;
        ctx.fillStyle = "#000";
        ctx.fillText("永和九年岁在癸丑", 0, 70);
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let h = 0;
        for (let i = 3; i < d.length; i += 4) h = (h * 31 + d[i]) >>> 0;
        return h;
      };
      return hash('"瘦金体", serif') !== hash('"KaiTi", serif');
    });
    assert(glyphDiff, "瘦金体字形与楷体不同（未静默回退）");
  } else {
    console.log("  - 本机未安装瘦金体，跳过该项（属正常）");
  }
  await page.locator("#pdf-weight").evaluate(el => { el.value = "700"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.locator("#pdf-size").evaluate(el => { el.value = "24"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.locator("#pdf-line-height").evaluate(el => { el.value = "2.5"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.locator("#pdf-letter-spacing").evaluate(el => { el.value = "20"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.selectOption("#pdf-align", "left");
  await page.selectOption("#pdf-layout", "vertical");
  await page.waitForTimeout(300);
  const typography = await page.evaluate(() => {
    const page = document.querySelector("#print-area");
    const body = document.querySelector("#print-area .pdf-body");
    const line = document.querySelector("#print-area .pdf-line");
    return {
      weight: page.style.getPropertyValue("--pdf-body-weight"),
      size: page.style.getPropertyValue("--pdf-body-size"),
      lineHeight: page.style.getPropertyValue("--pdf-line-height"),
      letterSpacing: page.style.getPropertyValue("--pdf-letter-spacing"),
      align: page.style.getPropertyValue("--pdf-align"),
      layout: page.dataset.layout,
      writingMode: getComputedStyle(line).writingMode
    };
  });
  assert(typography.weight === "700" && typography.size === "24pt" && typography.lineHeight === "2.5", "加粗 / 磅数 / 行距可调");
  assert(typography.letterSpacing === "0.2em" && typography.align === "left", "字距与对齐可调");
  assert(typography.layout === "vertical" && typography.writingMode === "vertical-rl", "竖排排列生效");
  await page.locator("[data-close='pdf-overlay']").click();
  await page.waitForTimeout(200);

  console.log("== 纸面图样与繁简转换 ==");
  await page.click("#btn-view-example");
  await page.waitForTimeout(300);
  const sheetPattern = await page.evaluate(() => getComputedStyle(document.querySelector("#print-area .pdf-sheet"), "::before").backgroundImage);
  assert(sheetPattern.includes("backgrounds/bg"), "PDF 正文纸面直接带图样");
  await page.selectOption("#pdf-script", "s2t");
  await page.waitForTimeout(200);
  assert((await page.textContent("#print-area")).includes("常記溪亭日暮"), "繁体转换生效并保持词组正确");
  await page.selectOption("#pdf-script", "t2s");
  await page.waitForTimeout(200);
  assert((await page.textContent("#print-area")).includes("常记溪亭日暮"), "简体转换可还原");
  await page.selectOption("#pdf-script", "original");
  if (installed.includes("shuti")) {
    await page.selectOption("#pdf-font-poem", "shuti");
    await page.waitForTimeout(200);
    assert(await page.evaluate(() => document.body.dataset.fontPoem) === "shuti", "方正舒体可选且生效");
    assert((await page.evaluate(() => getComputedStyle(document.querySelector("#print-area")).fontFamily)).includes("方正舒体"), "方正舒体应用到 PDF 页面");
  } else {
    await page.selectOption("#pdf-font-poem", "xiaozhuan");
    await page.waitForTimeout(600);
    assert(await page.evaluate(() => document.body.dataset.fontPoem) === "xiaozhuan", "内置小篆可选且生效");
  }
  await page.selectOption("#pdf-font-poem", "kai");
  await page.locator("[data-close='pdf-overlay']").click();
  await page.waitForTimeout(200);

  await page.click("button[data-page='appreciate']");
  await page.fill("#appr-kw", "静夜思");
  await page.waitForTimeout(300);
  await page.locator("#appr-list .poem-item").first().click();
  await page.waitForTimeout(300);
  const detailPattern = await page.evaluate(() => getComputedStyle(document.querySelector("#appr-detail"), "::before").backgroundImage);
  assert(detailPattern.includes("backgrounds/bg"), "鉴赏详情正文纸面直接带图样");
  await page.click("#appr-detail-back");
  await page.fill("#appr-kw", "");
  await page.waitForTimeout(200);

  console.log("== 字色纸色与配色样式 ==");
  await page.click("button[data-page='write']");
  await page.click("#btn-print");
  await page.waitForTimeout(300);
  assert(await page.locator("#pdf-palette option").count() >= 7, "配色样式预设齐全");
  await page.selectOption("#pdf-palette", "night");
  await page.waitForTimeout(200);
  const night = await page.evaluate(() => ({
    ink: getComputedStyle(document.querySelector("#print-area .pdf-body")).color,
    paper: getComputedStyle(document.querySelector("#print-area .pdf-sheet")).backgroundColor,
    contrast: document.querySelector("#pdf-contrast-val").textContent
  }));
  assert(night.ink === "rgb(243, 234, 214)", "夜读预设字色生效");
  assert(night.paper.includes("29, 27, 24") || night.paper.includes("rgba(29, 27, 24"), "夜读预设纸色生效");
  assert(parseFloat(night.contrast) >= 4.5, "夜读预设对比度达标（" + night.contrast + "）");
  await page.locator("#pdf-ink").evaluate(el => { el.value = "#a83232"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForTimeout(200);
  assert(await page.locator("#pdf-palette").inputValue() === "custom", "自定义颜色切换到自定义样式");
  assert(await page.evaluate(() => getComputedStyle(document.querySelector("#print-area .pdf-body")).color) === "rgb(168, 50, 50)", "自定义字色生效");
  await page.selectOption("#pdf-palette", "default");
  await page.locator("[data-close='pdf-overlay']").click();
  await page.waitForTimeout(200);

  await page.click("button[data-page='appreciate']");
  await page.fill("#appr-kw", "静夜思");
  await page.waitForTimeout(300);
  await page.locator("#appr-list .poem-item").first().click();
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => getComputedStyle(document.querySelector("#appr-detail")).color) === "rgb(43, 43, 43)", "配色同步到鉴赏详情正文");
  await page.click("#appr-detail-back");
  await page.fill("#appr-kw", "");
  await page.waitForTimeout(200);

  console.log("== 纸面印花图样 ==");
  await page.click("button[data-page='write']");
  await page.click("#btn-print");
  await page.waitForTimeout(300);
  assert(await page.locator("#pdf-motif option").count() >= 8, "纸面图样选项齐全");
  await page.selectOption("#pdf-motif", "plum");
  await page.locator("#pdf-motif-strength").evaluate(el => { el.value = "40"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForTimeout(300);
  const motif = await page.evaluate(() => {
    const st = getComputedStyle(document.querySelector("#print-area .pdf-sheet"), "::after");
    return { image: st.backgroundImage, opacity: st.opacity, label: document.querySelector("#pdf-motif-val").textContent };
  });
  assert(motif.image.includes("motifs/plum.png"), "水墨梅花素材绘制到纸面");
  assert(parseFloat(motif.opacity) >= .39 && motif.label === "40%", "图样浓度可调");
  for (const [id, path] of [["mountain", "motifs/mountain.png"], ["bamboo", "motifs/bamboo.png"], ["lotus", "motifs/lotus.png"], ["stars", "motifs/stars.png"]]) {
    await page.selectOption("#pdf-motif", id);
    await page.waitForTimeout(120);
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector("#print-area .pdf-sheet"), "::after").backgroundImage);
    assert(bg.includes(path), id + " 素材绘制到纸面");
  }
  await page.selectOption("#pdf-motif", "mountain");
  await page.waitForTimeout(120);
  await page.locator("[data-close='pdf-overlay']").click();
  await page.waitForTimeout(200);
  await page.click("button[data-page='appreciate']");
  await page.fill("#appr-kw", "静夜思");
  await page.waitForTimeout(300);
  await page.locator("#appr-list .poem-item").first().click();
  await page.waitForTimeout(300);
  const detailMotif = await page.evaluate(() => getComputedStyle(document.querySelector("#appr-detail"), "::after").backgroundImage);
  assert(detailMotif.includes("motifs/mountain.png"), "远山印花同步到鉴赏详情正文");
  await page.click("#appr-detail-back");
  await page.fill("#appr-kw", "");
  await page.click("button[data-page='write']");
  await page.click("#btn-print");
  await page.selectOption("#pdf-motif", "bamboo");
  await page.locator("#pdf-motif-strength").evaluate(el => { el.value = "34"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.locator("[data-close='pdf-overlay']").click();
  await page.waitForTimeout(200);

  console.log("== 云作品与登录入口 ==");
  assert(await page.evaluate(() => !!window.WorkBuddyCloud && !!window.WeiciCloud && !!window.WeiciApp), "云服务 SDK 与云作品模块已加载");
  assert(await page.evaluate(() => !!document.querySelector("#btn-cloud") && !!document.querySelector("#cloud-overlay")), "云作品入口和弹窗存在");
  await page.click("#btn-cloud");
  await page.waitForTimeout(200);
  assert(await page.locator("#cloud-overlay").evaluate(el => el.classList.contains("show")), "云作品弹窗可打开");
  await page.fill("#cloud-phone", "1380013800");
  await page.click("#cloud-send-code");
  await page.waitForTimeout(100);
  assert((await page.textContent("#cloud-auth-msg")).includes("11 位手机号"), "手机号校验生效且未发送请求");
  await page.locator("[data-close='cloud-overlay']").click();
  await page.waitForTimeout(200);

  console.log("== 控制台错误 ==");
  assert(errors.length === 0, "无 JS 错误" + (errors.length ? "：" + errors.join(" | ") : ""));

  await browser.close();
  console.log(fails ? "\n共 " + fails + " 项失败" : "\n全部通过");
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
