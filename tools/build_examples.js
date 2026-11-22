/* 为 157 个词牌、16 种诗格律自动匹配例词/例诗
   候选来源：chinese-gushiwen（10000 首，含注评）、chinese-poetry 全宋词（21050 首，开源）
   选择标准：句读与谱式吻合、逐字按《词林正韵》合律率最高、优先三百首名篇 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const BASE = "C:/Users/LENOVO/Desktop/新建文件夹/微词";
const TMP = BASE + "/tools/tmp";

// ---------- 加载韵书 / 词谱 / 诗格律 ----------
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["data/词林正韵数据.js", "data/词谱数据.js", "data/诗格律.js", "data/常用字.js", "data/例词.js"]) {
  vm.runInContext(fs.readFileSync(BASE + "/" + f, "utf8"), ctx);
}
const CILIN = ctx.window.CILIN;
const YUNS = ctx.window.CILIN_META.yuns;
const CIPU = ctx.window.CIPU;
const SHI = ctx.window.SHI;
const COMMON_CHARS = ctx.window.COMMON_CHARS;
const OLD_LICI = ctx.window.LICI;

function commonRank(ch) {
  const i = COMMON_CHARS.indexOf(ch);
  return i === -1 ? 9999 : i;
}

function readingsOf(ch) {
  const s = CILIN[ch];
  if (!s) return [];
  return s.split(";").map((k) => {
    const p = k.split(",");
    const yi = +p[1];
    return { bu: +p[0], yi, tone: YUNS[yi][1] };
  });
}

function infoOf(ch) {
  const rs = readingsOf(ch);
  const tones = {};
  rs.forEach((r) => { tones[r.tone] = true; });
  return {
    rs,
    hasPing: !!tones["平"],
    hasZe: !!(tones["上"] || tones["去"] || tones["入"]),
    hasQu: !!tones["去"]
  };
}

// req: 平/仄/去/中；返回 true/false/null(不计)
function okTone(ch, req) {
  if (req === "中") return null;
  const info = infoOf(ch);
  if (!info.rs.length) return null;
  if (req === "平") return info.hasPing;
  if (req === "去") return info.hasQu;
  return info.hasZe;
}

function splitChunks(text) {
  return String(text)
    .replace(/[（(][^（）()]*[）)]/g, "")
    .split(/[，。！？；]/)
    .map((s) => s.replace(/[、：""''《》·\s]/g, ""))
    .filter(Boolean);
}

function matchWindow(chunks, lens) {
  if (chunks.length < lens.length) return -1;
  for (let off = 0; off <= chunks.length - lens.length; off++) {
    let ok = true;
    for (let k = 0; k < lens.length; k++) {
      if (chunks[off + k].length !== lens[k]) { ok = false; break; }
    }
    if (ok) return off;
  }
  return -1;
}

// 全偏移滑动切分（宽松降级用）：谱式豆位置与标点不一致时，取合律率最高的切分
function bestSoftCut(text, lens, parts) {
  const flat = String(text)
    .replace(/[（(][^（）()]*[）)]/g, "")
    .replace(/[，。！？；、：""''《》·\s]/g, "");
  const total = lens.reduce((a, b) => a + b, 0);
  if (flat.length < total) return null;
  let best = null, bestRate = -1;
  for (let off = 0; off <= flat.length - total; off++) {
    const lines = [];
    let pos = off;
    for (const len of lens) { lines.push(flat.slice(pos, pos + len)); pos += len; }
    const sc = scoreAgainst(lines, lens, parts);
    if (sc.rate > bestRate) { bestRate = sc.rate; best = { lines, rate: sc.rate }; }
  }
  return best;
}

// 统计一首作品对某谱式的合律情况
function scoreAgainst(lines, lens, parts) {
  // lines: 切好的每行字符串数组（每行长度=该行字数）
  let filled = 0, correct = 0;
  lines.forEach((src, li) => {
    const ps = parts[li];
    if (!ps) return;
    let pos = 0;
    ps.forEach((p) => {
      const seg = src.slice(pos, pos + p.length);
      pos += p.length;
      for (let i = 0; i < p.length; i++) {
        const r = okTone(seg[i], p[i]);
        if (r === null) continue;
        filled++;
        if (r) correct++;
      }
    });
  });
  return { filled, correct, rate: filled ? correct / filled : 0 };
}

// 词牌韵脚是否同韵（按词谱 rhyme 标记）
function rhymeOkCi(t, lines) {
  const groups = [];
  let cur = null, curTone = null;
  t.lines.forEach((l, i) => {
    if (!l.rhyme) return;
    const last = lines[i][lines[i].length - 1];
    const info = infoOf(last);
    if (!info.rs.length) return;
    const tone = l.parts.join("").slice(-1) === "平" ? "平" : "仄";
    if (t.mode === "叶") {
      if (!cur) { cur = []; groups.push(cur); }
      cur.push({ last, info });
    } else {
      if (!cur || curTone !== tone) { cur = []; curTone = tone; groups.push(cur); }
      cur.push({ last, info });
    }
  });
  let okGroups = 0, totalGroups = 0;
  groups.forEach((g) => {
    if (g.length < 2) return;
    totalGroups++;
    const ref = g[0].info;
    let ok = true;
    g.slice(1).forEach((e) => {
      let buOk = false, catOk = false;
      e.info.rs.forEach((r) => { if (ref.rs.some((rr) => rr.bu === r.bu)) buOk = true; });
      if (t.mode === "叶") {
        e.info.rs.forEach((r) => {
          ref.rs.forEach((rr) => {
            const c = r.tone === "平" ? "平" : r.tone === "入" ? "入" : "上去";
            const rc = rr.tone === "平" ? "平" : rr.tone === "入" ? "入" : "上去";
            if ((c === "入" && rc === "入") || (c !== "入" && rc !== "入")) catOk = true;
          });
        });
      } else {
        e.info.rs.forEach((r) => {
          ref.rs.forEach((rr) => {
            const c = r.tone === "平" ? "平" : r.tone === "入" ? "入" : "上去";
            const rc = rr.tone === "平" ? "平" : rr.tone === "入" ? "入" : "上去";
            if (c === rc) catOk = true;
          });
        });
      }
      if (!buOk || !catOk) ok = false;
    });
    if (ok) okGroups++;
  });
  return totalGroups && okGroups === totalGroups;
}

// ---------- 收集候选 ----------
const ciCands = {};  // 词牌名 -> [{text,title,author,prestige}]
const shiCands = []; // 诗候选 [{text,title,author,dynasty,prestige}]

const ALIAS = {
  "平湖乐": ["小桃红"],
  "十六字令": ["归字谣", "苍梧谣"],
  "忆馀杭": ["忆余杭"]
};
// 数据源缺失 / 断句有误的极少数词牌，内置权威名篇通行文本
const MANUAL = {
  "玉蝴蝶": { author: "温庭筠", title: "秋风凄切伤离", text: "秋风凄切伤离，行客未归时。塞外草先衰，江南雁到迟。芙蓉凋嫩脸，杨柳堕新眉。摇落使人悲，断肠谁得知。", src: "花间集" },
  "三字令": { author: "欧阳炯", title: "", text: "春欲尽，日迟迟，牡丹时。罗幌卷，翠帘垂。彩笺书，红粉泪，两心知。人不在，燕空归，负佳期。香烬落，枕函欹。月分明，花淡薄，惹相思。", src: "花间集" },
  "伤春怨": { author: "王安石", title: "雨打江南树", text: "雨打江南树。一夜花开无数。绿叶渐成阴，下有游人归路。与君相逢处。不道春将暮。把酒祝东风，且莫恁、匆匆去。", src: "临川集" },
  "忆馀杭": { author: "潘阆", title: "长忆西湖", text: "长忆西湖，尽日凭阑楼上望。三三两两钓鱼舟，岛屿正清秋。笛声依约芦花里，白鸟成行忽惊起。别来闲整钓鱼竿，思入水云寒。", src: "酒泉子·忆余杭" }
};
const aliasToMain = {};
Object.keys(ALIAS).forEach((m) => ALIAS[m].forEach((a) => { aliasToMain[a] = m; }));
const sortedNames = Object.keys(CIPU).sort((a, b) => b.length - a.length);

function resolveTune(name) {
  if (CIPU[name]) return name;
  if (aliasToMain[name]) return aliasToMain[name];
  return null;
}

function addCi(name, cand) {
  (ciCands[name] = ciCands[name] || []).push(cand);
}

// chinese-gushiwen
for (const f of fs.readdirSync(TMP).filter((x) => /^guwen\d+-\d+\.json$/.test(x))) {
  for (const ln of fs.readFileSync(TMP + "/" + f, "utf8").split("\n")) {
    if (!ln.trim()) continue;
    const o = JSON.parse(ln);
    const title = (o.title || "").trim();
    const tags = o.type || [];
    const m = title.match(/^(.+?)·(.+)$/);
    const isSong = tags.indexOf("宋词三百首") !== -1 || tags.indexOf("宋词精选") !== -1;
    let prestige = 0;
    if (tags.indexOf("宋词三百首") !== -1) prestige = 2;
    else if (tags.indexOf("宋词精选") !== -1) prestige = 1;
    let ciPai = null;
    if (m) {
      ciPai = resolveTune(m[1].trim());
      if (ciPai) {
        addCi(ciPai, { text: o.content || "", title: m[2].trim(), author: o.writer || "", prestige });
        continue;
      }
    }
    for (const nm of sortedNames) {
      if (title.startsWith(nm)) { ciPai = nm; break; }
    }
    if (ciPai) {
      addCi(ciPai, { text: o.content || "", title: title.slice(ciPai.length).replace(/^[\s·、，.。]+/, ""), author: o.writer || "", prestige });
    } else if (isSong && title) {
      const r = resolveTune(title);
      if (r) addCi(r, { text: o.content || "", title: "", author: o.writer || "", prestige });
      else shiCands.push({ text: o.content || "", title, author: o.writer || "", dynasty: (o.dynasty || "").replace("代", ""), prestige });
    } else {
      // 诗候选
      const d = (o.dynasty || "").replace("代", "");
      shiCands.push({ text: o.content || "", title, author: o.writer || "", dynasty: d, prestige: tags.indexOf("唐诗三百首") !== -1 ? 2 : 0 });
    }
  }
}

// chinese-poetry 全宋词
for (const f of fs.readdirSync(TMP).filter((x) => /^ci\.song\.\d+\.json$/.test(x))) {
  const arr = JSON.parse(fs.readFileSync(TMP + "/" + f, "utf8"));
  arr.forEach((o) => {
    const text = (o.paragraphs || []).join("");
    if (!text) return;
    const rhythmic = (o.rhythmic || "").trim();
    const names = rhythmic.split(/[・·]/).map((s) => s.trim()).filter(Boolean);
    names.forEach((n) => {
      const r = resolveTune(n);
      if (r) addCi(r, { text, title: "", author: o.author || "", prestige: 0 });
    });
  });
}

// chinese-poetry 宋词三百首
const sctPath = TMP + "/宋词三百首.json";
if (fs.existsSync(sctPath)) {
  JSON.parse(fs.readFileSync(sctPath, "utf8")).forEach((o) => {
    const text = (o.paragraphs || []).join("");
    if (!text) return;
    const rhythmic = (o.rhythmic || "").trim();
    const names = rhythmic.split(/[・·]/).map((s) => s.trim()).filter(Boolean);
    names.forEach((n) => {
      const r = resolveTune(n);
      if (r) addCi(r, { text, title: "", author: o.author || "", prestige: 2 });
    });
  });
}

// 五代花间集 / 南唐词 / 元曲
for (const f of fs.readdirSync(TMP).filter((x) => /^extra_huajianji-\d+-juan\.json$/.test(x) || x === "extra_poetrys.json")) {
  const arr = JSON.parse(fs.readFileSync(TMP + "/" + f, "utf8"));
  arr.forEach((o) => {
    const text = (o.paragraphs || []).join("");
    if (!text) return;
    const r = resolveTune((o.rhythmic || "").trim());
    if (r) addCi(r, { text, title: o.title || "", author: o.author || "", prestige: 1 });
  });
}
if (fs.existsSync(TMP + "/extra_yuanqu.json")) {
  JSON.parse(fs.readFileSync(TMP + "/extra_yuanqu.json", "utf8")).forEach((o) => {
    const text = (o.paragraphs || []).join("");
    if (!text) return;
    const t = o.title || "";
    let tune = t;
    let mm = t.match(/\/([^/・·\s]+)$/);
    if (mm) tune = mm[1].trim();
    else { mm = t.match(/[・·]([^・·\s]+)$/); if (mm) tune = mm[1].trim(); }
    const r = resolveTune(tune);
    if (r) addCi(r, { text, title: t, author: o.author || "", prestige: 0 });
  });
}

// ---------- 匹配词牌例词 ----------
const LICI = JSON.parse(JSON.stringify(OLD_LICI));
const missing = [];
const fallback = [];
let totalCands = 0;

for (const name of Object.keys(CIPU)) {
  const t = CIPU[name];
  const lens = t.lines.map((l) => l.parts.join("").length);
  const parts = t.lines.map((l) => l.parts.slice());
  const cands = ciCands[name] || [];
  totalCands += cands.length;
  const scored = [];
  if (MANUAL[name]) {
    const chunks = splitChunks(MANUAL[name].text);
    const off = matchWindow(chunks, lens);
    if (off !== -1) {
      const lines = lens.map((len, li) => chunks[off + li]);
      const sc = scoreAgainst(lines, lens, parts);
      scored.push({ cand: { author: MANUAL[name].author, title: MANUAL[name].title, text: MANUAL[name].text, prestige: 9 }, lines, off, rate: sc.rate, filled: sc.filled, correct: sc.correct, ry: rhymeOkCi(t, lines), score: sc.rate * 100 + 27 });
    }
  }
  if (MANUAL[name] && scored.length) {
    // 手工权威例词直接采用（数据源缺失 / 断句有误的词牌）
    const best = scored[0];
    const segLines = t.lines.map((l, li) => {
      const src = best.lines[li];
      let pos = 0;
      return l.parts.map((p) => {
        const s = src.slice(pos, pos + p.length);
        pos += p.length;
        return s;
      });
    });
    LICI[name] = {
      author: MANUAL[name].author,
      title: MANUAL[name].title,
      src: MANUAL[name].src,
      lines: segLines,
      rate: Math.round(best.rate * 100),
      manual: true
    };
    continue;
  }
  if (LICI[name]) continue; // 保留原有人工精校例词
  const candList = cands.slice().sort((a, b) => b.prestige - a.prestige).slice(0, 400);
  for (const c of candList) {
    const chunks = splitChunks(c.text);
    const off = matchWindow(chunks, lens);
    let lines = null;
    if (off !== -1) {
      lines = lens.map((len, li) => chunks[off + li]);
    } else {
      // 宽松降级：全偏移滑动，取合律率最高的切分
      const cut = bestSoftCut(c.text, lens, parts);
      if (cut) lines = cut.lines;
    }
    if (!lines) continue;
    const sc = scoreAgainst(lines, lens, parts);
    if (off !== -1 && sc.rate < 0.95) {
      // 严格匹配但合律率偏低：尝试滑动切分对比，取更高者
      const cut = bestSoftCut(c.text, lens, parts);
      if (cut && cut.rate > sc.rate) {
        lines = cut.lines;
      }
    }
    const ry = rhymeOkCi(t, lines);
    const score = sc.rate * 100 + c.prestige * 3 + (ry ? 2 : 0);
    scored.push({ cand: c, lines, off, rate: sc.rate, filled: sc.filled, correct: sc.correct, ry, score });
  }
  scored.sort((a, b) => b.score - a.score || b.correct - a.correct || commonRank((a.cand.author || "啊")[0]) - commonRank((b.cand.author || "啊")[0]));
  if (!scored.length) {
    missing.push(name);
    continue;
  }
  const best = scored[0];
  const segLines = t.lines.map((l, li) => {
    const src = best.lines[li];
    let pos = 0;
    return l.parts.map((p) => {
      const s = src.slice(pos, pos + p.length);
      pos += p.length;
      return s;
    });
  });
  LICI[name] = {
    author: best.cand.author || "佚名",
    title: best.cand.title || "",
    lines: segLines,
    rate: Math.round(best.rate * 100),
    fallback: best.off === -1 ? true : undefined
  };
  if (best.off === -1) fallback.push(name);
}

// ---------- 匹配诗格律例诗 ----------
// 人工锁定：优先用下列名篇，保证「例诗的体裁 = 该格的体裁」。
// 历史上曾有 4 个五绝、2 个七绝因自动匹配误载 8 句律诗（被截断成 4 句仍报 100%），
// 故此处显式指定，并对字数、平仄、韵脚做硬校验，任一不符即退回收批量。
// variant 非空 = 该篇整首无法「严格」合本式（公认拗句 / 又一体），界面会如实标注并给出真实合律率。
const SHI_FIXED = {
  "五言绝句·仄起不入韵": { title: "问刘十九", author: "白居易", dynasty: "唐",
    text: "绿蚁新醅酒，红泥小火炉。晚来天欲雪，能饮一杯无。" },
  "五言绝句·仄起入韵": { title: "塞下曲", author: "卢纶", dynasty: "唐",
    text: "月黑雁飞高，单于夜遁逃。欲将轻骑逐，大雪满弓刀。" },
  "五言绝句·平起不入韵": { title: "汾上惊秋", author: "苏颋", dynasty: "唐",
    text: "北风吹白云，万里渡河汾。心绪逢摇落，秋声不可闻。",
    variant: "首句「北风吹白云」为拗句：第 3 字应平而仄、第 4 字应仄而平自救，故首句末字不合本式。" },
  "五言绝句·平起入韵": { title: "汾上惊秋", author: "苏颋", dynasty: "唐",
    text: "北风吹白云，万里渡河汾。心绪逢摇落，秋声不可闻。",
    variant: "本式正体极少见。此篇首句用「平平仄平仄」拗救句式，第 2 字平、末句「秋声不可闻」合「平平仄仄平」，可作参考。" },
  "五言律诗·仄起不入韵": { title: "春望", author: "杜甫", dynasty: "唐",
    text: "国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。烽火连三月，家书抵万金。白头搔更短，浑欲不胜簪。" },
  "五言律诗·仄起入韵": { title: "月夜忆舍弟", author: "杜甫", dynasty: "唐",
    text: "戍鼓断人行，边秋一雁声。露从今夜白，月是故乡明。有弟皆分散，无家问死生。寄书长不达，况乃未休兵。" },
  "五言律诗·平起不入韵": { title: "山居秋暝", author: "王维", dynasty: "唐",
    text: "空山新雨后，天气晚来秋。明月松间照，清泉石上流。竹喧归浣女，莲动下渔舟。随意春芳歇，王孙自可留。" },
  "五言律诗·平起入韵": { title: "风雨", author: "李商隐", dynasty: "唐",
    text: "凄凉宝剑篇，羁泊欲穷年。黄叶仍风雨，青楼自管弦。新知遭薄俗，旧好隔良缘。心断新丰酒，销愁斗几千。" },
  "七言绝句·仄起不入韵": { title: "九月九日忆山东兄弟", author: "王维", dynasty: "唐",
    text: "独在异乡为异客，每逢佳节倍思亲。遥知兄弟登高处，遍插茱萸少一人。" },
  "七言绝句·仄起入韵": { title: "芙蓉楼送辛渐", author: "王昌龄", dynasty: "唐",
    text: "寒雨连江夜入吴，平明送客楚山孤。洛阳亲友如相问，一片冰心在玉壶。" },
  "七言绝句·平起不入韵": { title: "早发白帝城", author: "李白", dynasty: "唐",
    text: "朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。",
    variant: "首句第 5 字「彩」用仄，属七言「一三五不论」的常见放宽；严格口径下首句第 5 位不合。" },
  "七言绝句·平起入韵": { title: "凉州词", author: "王翰", dynasty: "唐",
    text: "葡萄美酒夜光杯，欲饮琵琶马上催。醉卧沙场君莫笑，古来征战几人回。" },
  "七言律诗·仄起不入韵": { title: "闻官军收河南河北", author: "杜甫", dynasty: "唐",
    text: "剑外忽传收蓟北，初闻涕泪满衣裳。却看妻子愁何在，漫卷诗书喜欲狂。白日放歌须纵酒，青春作伴好还乡。即从巴峡穿巫峡，便下襄阳向洛阳。" },
  "七言律诗·仄起入韵": { title: "锦瑟", author: "李商隐", dynasty: "唐",
    text: "锦瑟无端五十弦，一弦一柱思华年。庄生晓梦迷蝴蝶，望帝春心托杜鹃。沧海月明珠有泪，蓝田日暖玉生烟。此情可待成追忆，只是当时已惘然。" },
  "七言律诗·平起不入韵": { title: "客至", author: "杜甫", dynasty: "唐",
    text: "舍南舍北皆春水，但见群鸥日日来。花径不曾缘客扫，蓬门今始为君开。盘飧市远无兼味，樽酒家贫只旧醅。肯与邻翁相对饮，隔篱呼取尽馀杯。" },
  "七言律诗·平起入韵": { title: "隋宫", author: "李商隐", dynasty: "唐",
    text: "紫泉宫殿锁烟霞，欲取芜城作帝家。玉玺不缘归日角，锦帆应是到天涯。于今腐草无萤火，终古垂杨有暮鸦。地下若逢陈后主，岂宜重问后庭花。" }
};

// 校验一段文本能否直接按该格律切分为例诗：字数逐句相符、定式处平仄合规、偶句同韵
// 返回 { err, rate }：err 非空即不可用；rate 为定式处合律率（0–1）
function checkFixedAgainstSpec(s, text) {
  const chunks = splitChunks(text);
  if (chunks.length !== s.lines.length) return { err: "句数 " + chunks.length + " ≠ " + s.lines.length };
  for (let i = 0; i < s.lines.length; i++) {
    if (chunks[i].length !== s.lines[i].pat.length) {
      return { err: "第" + (i + 1) + "句 " + chunks[i].length + " 字 ≠ " + s.lines[i].pat.length };
    }
  }
  const sc = scoreAgainst(chunks, s.lines.map((l) => l.pat.length), s.lines.map((l) => [l.pat]));
  const bad = [];
  chunks.forEach((t, i) => {
    const pat = s.lines[i].pat;
    for (let k = 0; k < pat.length; k++) {
      const r = okTone(t[k], pat[k]);
      if (r === false) bad.push((i + 1) + "-" + (k + 1) + t[k]);
    }
  });
  let yiMain = -1;
  for (let i = 1; i < s.lines.length; i++) {
    if (!s.lines[i].rhyme) continue;
    const last = chunks[i][chunks[i].length - 1];
    const pings = readingsOf(last).filter((r) => r.tone === "平");
    if (!pings.length) return { err: "第" + (i + 1) + "句韵脚「" + last + "」非平声" };
    if (yiMain === -1) yiMain = pings[0].yi;
    else if (!pings.some((r) => r.yi === yiMain)) return { err: "第" + (i + 1) + "句韵脚「" + last + "」出韵" };
  }
  return { err: null, rate: sc.rate, bad: bad };
}

const LISHI = {};
const shiFallback = [];
for (const s of SHI) {
  // 1) 人工锁定优先：满合律直接用；带 variant 说明的按实合律率记录，绝不写 100
  const fixed = SHI_FIXED[s.name];
  if (fixed) {
    const r = checkFixedAgainstSpec(s, fixed.text);
    if (!r.err && (r.rate === 1 || fixed.variant)) {
      const chunks = splitChunks(fixed.text);
      LISHI[s.name] = {
        title: fixed.title,
        author: fixed.author,
        dynasty: fixed.dynasty || "",
        lines: chunks.map((x) => [x]),
        rate: Math.round(r.rate * 100)
      };
      if (fixed.variant) LISHI[s.name].variant = fixed.variant;
      continue;
    }
    console.log("!! SHI_FIXED 校验失败 [" + s.name + "]：" + (r.err || ("合律率 " + Math.round(r.rate * 100) + "% 且无 variant 说明")) + "（退回自动匹配）");
  }
  const lens = s.lines.map((l) => l.pat.length);
  const scored = [];
  for (const c of shiCands) {
    const chunks = splitChunks(c.text);
    const off = matchWindow(chunks, lens);
    if (off === -1) continue;
    const lines = lens.map((len, li) => chunks[off + li]);
    // 首句末字：入韵须平，不入韵须仄
    const last0 = lines[0][lens[0] - 1];
    const i0 = infoOf(last0);
    if (s.lines[0].rhyme ? !i0.hasPing : i0.hasPing) continue;
    // 偶句押平声韵且同韵
    let yiMain = -1, ry = true;
    for (let li = 1; li < s.lines.length; li += 2) {
      const last = lines[li][lens[li] - 1];
      const pings = readingsOf(last).filter((r) => r.tone === "平");
      if (!pings.length) { ry = false; break; }
      if (yiMain === -1) yiMain = pings[0].yi;
      else if (!pings.some((r) => r.yi === yiMain)) { ry = false; break; }
    }
    if (!ry) continue;
    // 首句入韵者可借邻韵，只需平声
    const sc = scoreAgainst(lines, lens, s.lines.map((l) => [l.pat]));
    scored.push({ cand: c, lines, rate: sc.rate, filled: sc.filled, correct: sc.correct,
      score: sc.rate * 100 + c.prestige * 3 });
  }
  scored.sort((a, b) => b.score - a.score || b.correct - a.correct);
  if (!scored.length) {
    console.log("!! 诗格律无匹配:", s.name);
    continue;
  }
  const best = scored[0];
  LISHI[s.name] = {
    title: best.cand.title,
    author: best.cand.author || "佚名",
    dynasty: best.cand.dynasty || "",
    lines: best.lines.map((x) => [x]),
    rate: Math.round(best.rate * 100)
  };
  if (best.rate < 1) shiFallback.push(s.name + ":" + Math.round(best.rate * 100) + "%");
}
if (shiFallback.length) console.log("例诗非满合律:", shiFallback.join(", "));

// ---------- 输出 ----------
function jsStr(s) {
  return JSON.stringify(String(s));
}

const out = [];
out.push("/* 经典例词 / 例诗（与所载词谱、诗格律正体对应），用于一键示例 */");
out.push("/* 例词 " + Object.keys(LICI).length + " 首（人工精校 + 自动匹配 / 内置权威）；例诗 " + Object.keys(LISHI).length + " 首 */");
out.push("window.LICI = {");
Object.keys(LICI).forEach((name, i) => {
  const ex = LICI[name];
  const comma = i < Object.keys(LICI).length - 1 ? "," : "";
  out.push("  " + jsStr(name) + ": {");
  out.push("    \"author\": " + jsStr(ex.author) + ",");
  if (ex.title) out.push("    \"title\": " + jsStr(ex.title) + ",");
  if (ex.rate !== undefined) out.push("    \"rate\": " + ex.rate + ",");
  if (ex.fallback) out.push("    \"fallback\": true,");
  out.push("    \"lines\": [");
  ex.lines.forEach((row, li) => {
    out.push("      " + JSON.stringify(row) + (li < ex.lines.length - 1 ? "," : ""));
  });
  out.push("    ]");
  out.push("  }" + comma);
});
out.push("};");
out.push("");
out.push("window.LISHI = {");
Object.keys(LISHI).forEach((name, i) => {
  const ex = LISHI[name];
  const comma = i < Object.keys(LISHI).length - 1 ? "," : "";
  out.push("  " + jsStr(name) + ": {");
  out.push("    \"title\": " + jsStr(ex.title) + ",");
  out.push("    \"author\": " + jsStr(ex.author) + ",");
  out.push("    \"dynasty\": " + jsStr(ex.dynasty) + ",");
  out.push("    \"rate\": " + ex.rate + ",");
  if (ex.variant) out.push("    \"variant\": " + jsStr(ex.variant) + ",");
  out.push("    \"lines\": " + JSON.stringify(ex.lines));
  out.push("  }" + comma);
});
out.push("};");
fs.writeFileSync(BASE + "/data/例词.js", out.join("\n"), "utf8");

console.log("词牌例词:", Object.keys(LICI).length, "/", Object.keys(CIPU).length);
console.log("  自动匹配:", Object.keys(LICI).length - Object.keys(OLD_LICI).length, "宽松降级:", fallback.length, "(" + fallback.join(",") + ")");
console.log("  缺失:", missing.length, missing.length ? "(" + missing.join(",") + ")" : "");
console.log("诗格律例诗:", Object.keys(LISHI).length, "/", SHI.length);
const lowRate = Object.keys(LICI).filter((n) => LICI[n].rate !== undefined && LICI[n].rate < 100);
console.log("合律率<100%的词牌例词:", lowRate.length, lowRate.slice(0, 20).map((n) => n + ":" + LICI[n].rate).join(", "));
const lowShi = Object.keys(LISHI).filter((n) => LISHI[n].rate < 100);
console.log("合律率<100%的诗格律例诗:", lowShi.length, lowShi.map((n) => n + ":" + LISHI[n].rate).join(", "));
