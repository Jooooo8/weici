# -*- coding: utf-8 -*-
"""把 chinese-gushiwen 与 chinese-poetry 的本地素材整理成分片 JS，供鉴赏模块懒加载。

数据来源均位于 tools/tmp；脚本可重复运行，会按标题、作者、首句前 12 字去重。
"""
import json, io, glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = os.path.join(ROOT, "tools", "tmp")
OUT_DIR = os.path.join(ROOT, "data", "全库数据")
if not os.path.isdir(OUT_DIR):
    os.makedirs(OUT_DIR)

# 常见词牌（含 CIPU 之外可能出现的），用于判断"词"
CI_TUNES = set("""如梦令 浣溪沙 鹧鸪天 菩萨蛮 水调歌头 念奴娇 满江红 蝶恋花 西江月
临江仙 虞美人 卜算子 清平乐 渔家傲 踏莎行 青玉案 江城子 声声慢 沁园春 长相思
点绛唇 相见欢 浪淘沙 南乡子 定风波 一剪梅 行香子 采桑子 木兰花 减字木兰花
阮郎归 生查子 忆秦娥 鹊桥仙 苏幕遮 御街行 千秋岁 八声甘州 天仙子 望海潮
雨霖铃 永遇乐 兰陵王 桂枝香 扬州慢 暗香 疏影 六丑 莺啼序 高阳台 祝英台近
摸鱼儿 水龙吟 贺新郎 绮罗香 翠楼吟 齐天乐 瑞鹤仙 琐窗寒 花犯 解连环
夜飞鹊 惜红衣 石州慢 宴清都 渡江云 宝鼎现 玉蝴蝶 六州歌头
满庭芳 洞仙歌 蓦山溪 少年游 醉花阴 南歌子 渔歌子 忆江南 望江南
捣练子 十六字令 忆王孙 诉衷情 昭君怨 霜天晓角 山花子 眼儿媚 摊破浣溪沙
惜分飞 醉落魄 一斛珠 小重山 唐多令 一丛花 醉垂鞭 祝英台近
凤箫吟 汉宫春 迷神引 竹马子 归朝欢 黄莺儿 曲玉管 夜半乐 斗百花 甘草子
透碧霄 安公子 倾杯乐 木兰花慢 戚氏 帝台春 倦寻芳 驻马听 隔浦莲""".split())


def clean_text(s):
    if not s:
        return ""
    if isinstance(s, list):
        s = "\n".join(str(x) for x in s)
    return str(s).replace("\u3000", " ").strip()


def split_lines(content):
    raw = content if isinstance(content, list) else (content or "").split("\n")
    out = []
    for ln in raw:
        ln = clean_text(ln)
        if ln:
            out.append(ln)
    return out


def js_str(s):
    out = []
    for ch in s:
        c = ord(ch)
        if c == 34:
            out.append("\\\"")
        elif c == 92:
            out.append("\\\\")
        elif c == 10:
            out.append("\\n")
        elif c < 32:
            out.append("\\u%04x" % c)
        else:
            out.append(ch)
    return "".join(out)


def dump_str(v):
    return "\"" + js_str(v) + "\""


def dump_entry(w):
    parts = ["{"]
    parts.append("\"t\":" + dump_str(w["t"]))
    parts.append(",\"p\":" + dump_str(w["p"]))
    parts.append(",\"d\":" + dump_str(w["d"]))
    parts.append(",\"a\":" + dump_str(w["a"]))
    parts.append(",\"c\":" + json.dumps(w["c"], ensure_ascii=False))
    parts.append(",\"tags\":" + json.dumps(w["tags"], ensure_ascii=False))
    parts.append(",\"z\":" + dump_str(w["z"]))
    parts.append(",\"y\":" + dump_str(w["y"]))
    parts.append(",\"s\":" + dump_str(w["s"]))
    parts.append(",\"k\":" + json.dumps(w["k"], ensure_ascii=False))
    parts.append("}")
    return "".join(parts)


def classify(title, tags):
    ts = " ".join(tags)
    if "宋词" in ts or "词牌" in ts:
        return "词"
    if "文言文" in ts or "古文观止" in ts or "散文" in ts:
        return "文"
    m = title.split("·", 1)
    if len(m) == 2 and m[0].strip() in CI_TUNES:
        return "词"
    return "诗"


def app_key(w):
    return (w["t"], w["a"], ((w["c"] or [""])[0])[:12])


works = []
seen = set()
added = {}

# chinese-gushiwen：原全库的 10 个千行 JSONL 文件
for path in sorted(glob.glob(os.path.join(TMP, "guwen*.json"))):
    with io.open(path, encoding="utf-8") as f:
        for ln in f:
            ln = ln.strip()
            if not ln:
                continue
            obj = json.loads(ln)
            title = (obj.get("title") or "").strip()
            author = (obj.get("writer") or "").strip()
            content = obj.get("content") or ""
            key = (title, author, content[:30])
            if key in seen:
                continue
            seen.add(key)
            tags = obj.get("type") or []
            ci_pai = ""
            pure_title = title
            if "·" in title:
                parts = title.split("·", 1)
                ci_pai = parts[0].strip()
                pure_title = parts[1].strip()
            works.append({
                "t": pure_title,
                "p": ci_pai,
                "d": (obj.get("dynasty") or "").strip(),
                "a": author,
                "c": split_lines(content),
                "tags": [str(x) for x in tags],
                "z": clean_text(obj.get("remark") or ""),
                "y": clean_text(obj.get("translation") or ""),
                "s": clean_text(obj.get("shangxi") or ""),
                "k": classify(title, tags),
            })

base_count = len(works)
seen = set(app_key(w) for w in works)


def add_work(group, title, tune, dynasty, author, paragraphs, tags, notes="", kind=None):
    c = split_lines(paragraphs)
    title = clean_text(title)
    if not c or not title:
        return
    w = {
        "t": title,
        "p": clean_text(tune),
        "d": clean_text(dynasty),
        "a": clean_text(author),
        "c": c,
        "tags": [str(x) for x in tags],
        "z": clean_text(notes),
        "y": "",
        "s": "",
        "k": kind or classify(title, tags),
    }
    k = app_key(w)
    if k in seen:
        return
    seen.add(k)
    works.append(w)
    added[group] = added.get(group, 0) + 1


# chinese-poetry 全宋词：22 个 JSON 数组分片
ci_files = glob.glob(os.path.join(TMP, "ci.song.*.json"))
ci_files.sort(key=lambda p: int(re.search(r"ci\.song\.(\d+)\.json", os.path.basename(p)).group(1)))
for path in ci_files:
    with io.open(path, encoding="utf-8-sig") as f:
        for obj in json.load(f):
            rhythmic = clean_text(obj.get("rhythmic") or "")
            paragraphs = obj.get("paragraphs") or []
            title = rhythmic or (clean_text(paragraphs[0])[:12] if paragraphs else "")
            add_work("全宋词", title, rhythmic, "宋代", obj.get("author") or "",
                     paragraphs, ["全宋词"], kind="词")

# chinese-poetry 宋词三百首
sct_path = os.path.join(TMP, "宋词三百首.json")
if os.path.exists(sct_path):
    with io.open(sct_path, encoding="utf-8-sig") as f:
        for obj in json.load(f):
            rhythmic = clean_text(obj.get("rhythmic") or "")
            paragraphs = obj.get("paragraphs") or []
            title = rhythmic or (clean_text(paragraphs[0])[:12] if paragraphs else "")
            tags = obj.get("tags") or ["宋词三百首"]
            add_work("宋词三百首", title, rhythmic, "宋代", obj.get("author") or "",
                     paragraphs, tags, kind="词")

# 花间集 / 南唐词（含注释）
extra_paths = glob.glob(os.path.join(TMP, "extra_huajianji-*-juan.json"))
extra_paths += [os.path.join(TMP, "extra_poetrys.json")]
for path in sorted(extra_paths):
    if not os.path.exists(path):
        continue
    name = os.path.basename(path)
    tag = "南唐词" if name == "extra_poetrys.json" else "花间集"
    with io.open(path, encoding="utf-8-sig") as f:
        for obj in json.load(f):
            rhythmic = clean_text(obj.get("rhythmic") or "")
            title = clean_text(obj.get("title") or rhythmic) or "无题"
            notes = clean_text(obj.get("notes") or "")
            add_work(tag, title, rhythmic, "五代", obj.get("author") or "",
                     obj.get("paragraphs") or [], [tag], notes, kind="词")

# 元曲：单独标为「曲」，不冒充词牌，也不套用近体诗谱式
yuan_path = os.path.join(TMP, "extra_yuanqu.json")
if os.path.exists(yuan_path):
    with io.open(yuan_path, encoding="utf-8-sig") as f:
        for obj in json.load(f):
            title = clean_text(obj.get("title") or "")
            add_work("元曲", title, "", "元代", obj.get("author") or "",
                     obj.get("paragraphs") or [], ["元曲"], kind="曲")

PER = 1000
parts = (len(works) + PER - 1) // PER
for old in glob.glob(os.path.join(OUT_DIR, "全库*.js")):
    os.remove(old)

for i in range(0, len(works), PER):
    part = works[i:i + PER]
    idx = i // PER
    lines = ["/* 全库分片 %d/%d，共 %d 首（chinese-gushiwen / chinese-poetry）*/" % (idx + 1, parts, len(part))]
    lines.append("window.QUAN_KU_PART_%d = [" % idx)
    for j, w in enumerate(part):
        lines.append("  " + dump_entry(w) + ("," if j < len(part) - 1 else ""))
    lines.append("];")
    with io.open(os.path.join(OUT_DIR, "全库%d.js" % idx), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

kind = {}
for w in works:
    kind[w["k"]] = kind.get(w["k"], 0) + 1
manifest = {
    "parts": parts,
    "works": len(works),
    "base": base_count,
    "added": added,
    "byKind": kind,
}
with io.open(os.path.join(OUT_DIR, "manifest.js"), "w", encoding="utf-8") as f:
    f.write("window.QUAN_KU_MANIFEST = " + json.dumps(manifest, ensure_ascii=False) + ";\n")

size = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT_DIR, "全库*.js")))
print("原有:", base_count, "新增:", added)
print("总条数:", len(works), "体裁:", kind, "分片:", parts, "总大小: %.1f MB" % (size / 1048576.0))
