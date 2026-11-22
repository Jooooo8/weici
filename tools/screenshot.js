/* 用无头 Edge 渲染界面并截图，用于视觉自检 */
const { chromium } = require("playwright");
const path = require("path");

const OUT = "C:/Users/LENOVO/.codex/visualizations/2026/08/07/019fdcc6-3bca-7ac1-b4d4-bfe255c9f4bd";
const URL = "file:///C:/Users/LENOVO/Desktop/新建文件夹/微词/index.html";

(async () => {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text());
  });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "sc_shi.png"), fullPage: false });

  // 切到写词，选如梦令，载入例词
  await page.click("button[data-mode='ci']");
  await page.waitForTimeout(300);
  await page.selectOption("#tune-select", "如梦令");
  await page.waitForTimeout(300);
  await page.click("#btn-example");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "sc_rumengling.png"), fullPage: false });

  // 水调歌头
  await page.selectOption("#tune-select", "水调歌头");
  await page.waitForTimeout(300);
  await page.click("#btn-example");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "sc_shuidiao.png"), fullPage: false });

  // 满江红（双调+豆）
  await page.selectOption("#tune-select", "满江红");
  await page.waitForTimeout(300);
  await page.click("#btn-example");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "sc_manjianghong.png"), fullPage: true });

  // 写诗：七绝
  await page.click("button[data-mode='shi']");
  await page.waitForTimeout(300);
  await page.selectOption("#shi-select", "9"); // 七绝仄起不入韵
  await page.waitForTimeout(300);
  const inputs = await page.$$("#editor-body input[data-li]");
  const demo = ["两个黄鹂鸣翠柳", "一行白鹭上青天", "窗含西岭千秋雪", "门泊东吴万里船"];
  for (let i = 0; i < inputs.length; i++) {
    await inputs[i].fill(demo[i]);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "sc_qijue.png"), fullPage: false });

  // 界面设置弹窗
  await page.click("#btn-settings");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "sc_settings.png"), fullPage: false });
  await page.locator("[data-close='settings-overlay']").click();
  await page.waitForTimeout(300);

  // 暮色主题
  await page.evaluate(() => {
    document.body.dataset.theme = "mu";
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "sc_dark.png"), fullPage: false });
  await page.evaluate(() => {
    delete document.body.dataset.theme;
  });
  await page.waitForTimeout(300);

  // 诗词鉴赏页
  await page.click("button[data-page='appreciate']");
  await page.waitForTimeout(600);
  await page.selectOption("#appr-collection", "宋词三百首");
  await page.selectOption("#appr-tune", "水调歌头");
  await page.waitForTimeout(400);
  await page.locator("#appr-list .poem-item").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "sc_appreciate.png"), fullPage: false });

  // 我的作品弹窗
  await page.click("button[data-page='write']");
  await page.waitForTimeout(300);
  await page.click("#btn-save-work");
  await page.waitForTimeout(300);
  await page.fill("#save-title", "望江南 · 春思");
  await page.screenshot({ path: path.join(OUT, "sc_save.png"), fullPage: false });
  await page.locator("[data-close='save-overlay']").click();

  await browser.close();
  console.log("done");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
