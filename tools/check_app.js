/* 用经典例词验证检测逻辑 */
global.window = {};
require("../data/词林正韵数据.js");
require("../data/词谱数据.js");
require("../data/诗格律.js");
require("../data/例词.js");

const YUNS = window.CILIN_META.yuns;

function readingsOf(ch) {
  const s = window.CILIN[ch];
  if (!s) return [];
  return s.split(";").map((k) => {
    const [bu, yi] = k.split(",");
    return { bu: +bu, yi: +yi, tone: YUNS[+yi][1], yunName: YUNS[+yi][0] };
  });
}
function catOfTone(t) { return t === "平" ? "平" : t === "入" ? "入" : "上去"; }

function checkTone(ch, req) {
  const rs = readingsOf(ch);
  if (req === "中") return true;
  if (!rs.length) return null;
  if (req === "平") return rs.some((r) => r.tone === "平");
  if (req === "去") return rs.some((r) => r.tone === "去");
  return rs.some((r) => r.tone !== "平");
}

let passCount = 0, failCount = 0;
const fails = [];

function testTune(name) {
  const tune = window.CIPU[name];
  const ex = window.LICI[name];
  if (!tune || !ex) { fails.push(name + ": 缺数据"); failCount++; return; }
  if (tune.lines.length !== ex.lines.length) {
    fails.push(name + ": 句数不符 " + tune.lines.length + " vs " + ex.lines.length);
    failCount++;
    return;
  }
  const problems = [];
  tune.lines.forEach((line, li) => {
    const pat = line.parts.join("");
    const text = (ex.lines[li] || []).join("");
    if (pat.length !== text.length) {
      problems.push("第" + (li + 1) + "句字数 " + pat.length + " vs " + text.length);
    }
    for (let i = 0; i < pat.length; i++) {
      const ok = checkTone(text[i], pat[i]);
      if (ok === false) problems.push("第" + (li + 1) + "句" + (i + 1) + "字「" + text[i] + "」应" + pat[i]);
    }
  });
  if (problems.length) {
    fails.push(name + ": " + problems.join("; "));
    failCount++;
  } else {
    passCount++;
  }
}

Object.keys(window.LICI).forEach(testTune);
console.log("例词平仄通过:", passCount, " 失败:", failCount);
fails.slice(0, 40).forEach((f) => console.log(" -", f));

// 抽查韵脚判定：如梦令 李清照（仄韵，第7部？）
{
  const name = "如梦令";
  const tune = window.CIPU[name];
  const ex = window.LICI[name];
  const rhymeLines = [];
  tune.lines.forEach((l, i) => { if (l.rhyme) rhymeLines.push(i); });
  const chars = rhymeLines.map((i) => ex.lines[i][0][ex.lines[i][0].length - 1]);
  console.log("如梦令韵脚:", chars.join(","), "各读音:", chars.map((c) => readingsOf(c).map((r) => r.bu + "-" + r.tone).join("|")).join("  "));
}
// 诗：验证一首五绝（登鹳雀楼：白日依山尽，黄河入海流。欲穷千里目，更上一层楼。）
{
  const shi = window.SHI.find((s) => s.name === "五言绝句·仄起不入韵");
  const text = ["白日依山尽", "黄河入海流", "欲穷千里目", "更上一层楼"];
  let bad = 0;
  shi.lines.forEach((l, i) => {
    for (let k = 0; k < l.pat.length; k++) {
      const ok = checkTone(text[i][k], l.pat[k]);
      if (ok === false) { console.log("登鹳雀楼出律:", i + 1, k + 1, text[i][k], "应", l.pat[k]); bad++; }
    }
  });
  console.log("登鹳雀楼(仄起不入韵) 出律数:", bad);
}
