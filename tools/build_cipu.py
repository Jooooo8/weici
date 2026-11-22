# -*- coding: utf-8 -*-
"""生成词谱数据 JS：以龙榆生《唐宋词格律》为主，钦定词谱补充，韵脚按钦定词谱正体校准。"""
import csv
import json
import os
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE = r"C:\Users\LENOVO\Desktop\新建文件夹\微词\tools\tmp"
OUT = r"C:\Users\LENOVO\Desktop\新建文件夹\微词\data\词谱数据.js"

def load_bytes(path):
    with open(path, "rb") as f:
        return f.read()

def decode_text(data):
    for enc in ("utf-8-sig", "gb18030", "gbk"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")

def load_csv(name):
    text = decode_text(load_bytes(os.path.join(BASE, name)))
    return list(csv.reader(text.splitlines()))

tscgl = load_csv("raw_cipai_with_statistics_tscgl.csv")
qdcp = load_csv("raw_cipai_with_statistics_qdcp.csv")

# 精选词牌：韵脚句号（1 起）、韵式、前段句数（0=单调）、备注
CURATED = {
    "忆江南":   {"rhyme": [2, 4, 5], "mode": "平", "split": 0, "note": "又名《望江南》"},
    "渔歌子":   {"rhyme": [1, 2, 4, 5], "mode": "平", "split": 0},
    "捣练子":   {"rhyme": [2, 3, 5], "mode": "平", "split": 0},
    "长相思":   {"rhyme": [1, 2, 4, 5, 6, 8], "mode": "平", "split": 4, "note": "上下片各一叠韵"},
    "浣溪沙":   {"rhyme": [1, 2, 3, 5, 6], "mode": "平", "split": 3},
    "采桑子":   {"rhyme": [2, 3, 4, 6, 7, 8], "mode": "平", "split": 4},
    "阮郎归":   {"rhyme": [1, 2, 3, 4, 6, 7, 8, 9], "mode": "平", "split": 4},
    "画堂春":   {"rhyme": [1, 2, 3, 4, 6, 7, 8], "mode": "平", "split": 4},
    "朝中措":   {"rhyme": [1, 2, 4, 7, 9], "mode": "平", "split": 4},
    "武陵春":   {"rhyme": [2, 3, 4, 6, 7, 8, 9], "mode": "平", "split": 4, "source": "hand"},
    "临江仙":   {"rhyme": [2, 3, 5, 7, 8, 10], "mode": "平", "split": 5},
    "鹧鸪天":   {"rhyme": [1, 2, 4, 6, 7, 9], "mode": "平", "split": 4},
    "小重山":   {"rhyme": [1, 3, 4, 6, 7, 9, 10, 12], "mode": "平", "split": 5},
    "一剪梅":   {"rhyme": [1, 3, 6, 7, 9, 12], "mode": "平", "split": 6},
    "唐多令":   {"rhyme": [1, 2, 3, 6, 7, 8, 9, 12], "mode": "平", "split": 6},
    "破阵子":   {"rhyme": [2, 4, 5, 7, 9, 10], "mode": "平", "split": 5},
    "行香子":   {"rhyme": [2, 3, 5, 8, 10, 11, 13, 16], "mode": "平", "split": 8},
    "风入松":   {"rhyme": [1, 2, 4, 6, 7, 8, 10, 12], "mode": "平", "split": 6},
    "水调歌头": {"rhyme": [2, 4, 7, 9, 12, 14, 17, 19], "mode": "平", "split": 9},
    "满庭芳":   {"rhyme": [3, 5, 7, 10, 11, 14, 16, 18, 21], "mode": "平", "split": 11},
    "沁园春":   {"rhyme": [3, 7, 10, 13, 14, 15, 19, 22, 25], "mode": "平", "split": 13},
    "望海潮":   {"rhyme": [3, 6, 7, 9, 11, 12, 14, 17, 18, 20, 22], "mode": "平", "split": 11},
    "八声甘州": {"rhyme": [1, 2, 5, 7, 9, 12, 14, 16, 18], "mode": "平", "split": 9},
    "扬州慢":   {"rhyme": [3, 5, 8, 10, 12, 15, 17, 19], "mode": "平", "split": 10},
    "声声慢":   {"rhyme": [1, 3, 5, 7, 9, 10, 11, 13, 15, 17], "mode": "仄", "split": 9, "note": "宜用入声韵"},
    "高阳台":   {"rhyme": [3, 5, 7, 8, 9, 12, 14, 16, 17, 18], "mode": "平", "split": 9},
    "如梦令":   {"rhyme": [1, 2, 4, 5, 6, 7], "mode": "仄", "split": 0, "note": "第五、六句为叠句"},
    "生查子":   {"rhyme": [2, 4, 6, 8], "mode": "仄", "split": 4},
    "点绛唇":   {"rhyme": [2, 3, 4, 6, 7, 8, 9], "mode": "仄", "split": 4},
    "卜算子":   {"rhyme": [2, 4, 6, 8], "mode": "仄", "split": 4},
    "忆秦娥":   {"rhyme": [1, 2, 3, 5, 6, 7, 8, 10], "mode": "仄", "split": 5, "note": "宜用入声韵，第三、八句叠前句"},
    "谒金门":   {"rhyme": [1, 2, 3, 4, 5, 6, 7, 8], "mode": "仄", "split": 4},
    "好事近":   {"rhyme": [2, 4, 6, 8], "mode": "仄", "split": 4},
    "霜天晓角": {"rhyme": [1, 2, 4, 5, 6, 8], "mode": "仄", "split": 4},
    "蝶恋花":   {"rhyme": [1, 3, 4, 5, 6, 8, 9, 10], "mode": "仄", "split": 5},
    "渔家傲":   {"rhyme": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "mode": "仄", "split": 5},
    "苏幕遮":   {"rhyme": [2, 4, 5, 7, 9, 11, 12, 14], "mode": "仄", "split": 7},
    "青玉案":   {"rhyme": [1, 2, 3, 6, 7, 8, 9, 12], "mode": "仄", "split": 6},
    "满江红":   {"rhyme": [2, 4, 6, 8, 10, 12, 14, 16, 18], "mode": "仄", "split": 8, "note": "宜用入声韵"},
    "念奴娇":   {"rhyme": [], "mode": "仄", "split": 10, "note": "宜用入声韵，以龙榆生谱式为准"},
    "桂枝香":   {"rhyme": [1, 3, 5, 7, 10, 11, 13, 15, 17, 20], "mode": "仄", "split": 10},
    "水龙吟":   {"rhyme": [2, 5, 8, 12, 14, 17, 20, 23], "mode": "仄", "split": 11},
    "雨霖铃":   {"rhyme": [], "mode": "仄", "split": 10, "note": "宜用入声韵，以龙榆生谱式为准"},
    "永遇乐":   {"rhyme": [3, 6, 9, 11, 14, 17, 20, 22], "mode": "仄", "split": 11},
    "摸鱼儿":   {"rhyme": [1, 2, 4, 5, 6, 7, 10, 12, 13, 15, 16, 17, 18, 21], "mode": "仄", "split": 10},
    "贺新郎":   {"rhyme": [1, 3, 5, 6, 8, 10, 11, 13, 15, 16, 18, 20], "mode": "仄", "split": 10, "note": "宜用入声韵"},
    "菩萨蛮":   {"rhyme": [1, 2, 3, 4, 5, 6, 7, 8], "mode": "转", "split": 4, "note": "两句一换韵，仄韵转平韵"},
    "减字木兰花": {"rhyme": [1, 2, 3, 4, 5, 6, 7, 8], "mode": "转", "split": 4, "note": "两句一换韵，仄韵转平韵"},
    "清平乐":   {"rhyme": [1, 2, 3, 4, 5, 6, 8], "mode": "转", "split": 4, "note": "上片仄韵，下片平韵"},
    "更漏子":   {"rhyme": [2, 3, 5, 6, 7, 8, 9, 11, 12], "mode": "转", "split": 6, "note": "平仄韵交替"},
    "相见欢":   {"rhyme": [1, 2, 3, 5, 6, 7], "mode": "转", "split": 3, "note": "上片平韵，下片仄转平"},
    "虞美人":   {"rhyme": [1, 2, 3, 4, 5, 6, 7, 8], "mode": "转", "split": 4, "note": "两句一换韵"},
    "定风波":   {"rhyme": [1, 2, 4, 5, 6, 7, 8, 10, 11], "mode": "转", "split": 5},
    "西江月":   {"rhyme": [2, 3, 4, 6, 7, 8], "mode": "叶", "split": 4, "note": "平仄通叶"},
    "天净沙":   {"rhyme": [1, 2, 3, 4, 5], "mode": "叶", "split": 0, "note": "曲体，平仄通叶"},
    "平湖乐":   {"rhyme": [1, 2, 3, 4, 5, 8], "mode": "叶", "split": 4, "note": "曲体，平仄通叶"},
}

# 个别谱式按《钦定词谱》正体放宽（龙榆生谱个别位置标得过死）
PATTERN_FIX = {
    "如梦令": {0: ["中仄中平中仄"], 1: ["中仄中平中仄"], 3: ["中仄中平中仄"], 6: ["中仄中平中仄"]},
    "沁园春": {1: ["中仄平平"]},
    "摸鱼儿": {
        5: ["中中仄", "中平中仄平平仄"],
        16: ["中中仄", "中平中仄平平仄"],
        18: ["中仄仄平平"],
    },
}

GROUP_ORDER = ["平韵格", "仄韵格", "平仄转换", "平仄通叶"]

def tune_group(mode):
    return {"平": "平韵格", "仄": "仄韵格", "转": "平仄转换", "叶": "平仄通叶"}[mode]

def parse_tscgl(row):
    """返回 (name, pattern, seg_lens)"""
    name = row[0].strip()
    pattern = row[1]
    seg_lens = json.loads(row[6]) if len(row) > 6 else None
    return name, pattern, seg_lens

def split_tscgl(pattern):
    """按 ，。、 拆分：返回 [line1, line2...]，每条 line 为 [part1, part2...] 与 rhyme 标记。"""
    import re as _re
    p = pattern.replace("ˇ", "").replace("〖", "").replace("〗", "").replace("『", "").replace("』", "")
    p = _re.sub(r"（[^）]*）", "", p)
    lines = []
    cur = []
    for ch in p:
        if ch in "，。":
            rhyme = ch == "。"
            lines.append(("".join(cur), rhyme))
            cur = []
        else:
            cur.append(ch)
    if cur:
        lines.append(("".join(cur), False))
    result = []
    for text, rhyme in lines:
        parts = text.split("、")
        parts = [x for x in parts if x]
        if parts:
            result.append((parts, rhyme))
    return result

def first_qdcp_row(name):
    for r in qdcp[1:]:
        if r[0].strip() == name:
            return r
    return None

tunes = {}
auto_count = 0
missing = []

for row in tscgl[1:]:
    name, pattern, seg_lens = parse_tscgl(row)
    lines = split_tscgl(pattern)
    total = sum(len(p) for line, _ in lines for p in line)
    lengths = [len(p) for line, _ in lines for p in line]
    if seg_lens and lengths != seg_lens:
        print("WARN len mismatch", name, lengths, seg_lens)
    if name in tunes:
        continue  # 保留第一条（正体）
    entry = {
        "name": name,
        "mode": None,
        "note": "",
        "source": "龙榆生《唐宋词格律》",
        "lines": [{"parts": parts, "rhyme": rh} for parts, rh in lines],
        "total": total,
    }
    if name in CURATED:
        c = CURATED[name]
        entry["mode"] = c["mode"]
        entry["note"] = c.get("note", "")
        if c["rhyme"]:
            # 全量覆盖：先全部清掉，再按校准列表标记
            for ln in entry["lines"]:
                ln["rhyme"] = False
            for i in c["rhyme"]:
                if 1 <= i <= len(entry["lines"]):
                    entry["lines"][i - 1]["rhyme"] = True
        entry["curated"] = True
        entry["split"] = c["split"]
        if name in PATTERN_FIX:
            for li, parts in PATTERN_FIX[name].items():
                if li < len(entry["lines"]):
                    entry["lines"][li]["parts"] = list(parts)
    else:
        # 自动模式：以 。 标记的句为准
        entry["curated"] = False
        entry["split"] = 0
        auto_count += 1
    tunes[name] = entry

# 手工谱式（武陵春用李清照体 49 字正格）
# 注意：第 3、5 句的句型不能照抄第 1 句。李清照「物是人非事事休」= 仄仄平平仄仄平（平收句），
#      「闻说双溪春尚好」= 平仄平平平仄仄（仄收句），原先把两处句式放错，会把名篇标红 4 字。
hand = {
    "武陵春": {
        "mode": "平",
        "note": "李清照体，双调四十九字",
        "lines": [
            {"parts": ["中仄中平平仄仄"], "rhyme": False},
            {"parts": ["中仄仄平平"], "rhyme": True},
            {"parts": ["中仄平平中仄平"], "rhyme": True},
            {"parts": ["中仄仄平平"], "rhyme": True},
            {"parts": ["中仄中平平仄仄"], "rhyme": False},
            {"parts": ["中仄仄平平"], "rhyme": True},
            {"parts": ["仄仄平平中仄平"], "rhyme": True},
            {"parts": ["中仄仄", "中平平"], "rhyme": True},
        ],
        "split": 4,
        "curated": True,
    },
}
for name, h in hand.items():
    tunes[name] = {
        "name": name,
        "mode": h["mode"],
        "note": h.get("note", ""),
        "source": "《钦定词谱》",
        "lines": h["lines"],
        "total": sum(len(p) for ln in h["lines"] for p in ln["parts"]),
        "curated": True,
        "split": h["split"],
    }

# 钦定词谱补充
for name in ["减字木兰花", "天净沙", "平湖乐"]:
    if name in tunes:
        continue
    row = first_qdcp_row(name)
    if not row:
        missing.append(name)
        continue
    pattern = row[2]
    seg_lens = json.loads(row[7])
    parts = []
    idx = 0
    for ln in seg_lens:
        parts.append(pattern[idx:idx + ln])
        idx += ln
    lines = [{"parts": [p], "rhyme": False} for p in parts]
    c = CURATED[name]
    for i in c["rhyme"]:
        lines[i - 1]["rhyme"] = True
    tunes[name] = {
        "name": name,
        "mode": c["mode"],
        "note": c.get("note", ""),
        "source": "《钦定词谱》",
        "lines": lines,
        "total": sum(seg_lens),
        "curated": True,
        "split": c["split"],
    }

# 整理分组
groups = {g: [] for g in GROUP_ORDER}
for name, t in tunes.items():
    mode = t["mode"]
    if not mode:
        ends = []
        for ln in t["lines"]:
            if ln["rhyme"]:
                last = ln["parts"][-1][-1]
                if last in "平中":
                    ends.append("平" if last == "平" else "?")
                else:
                    ends.append("仄")
        mode = "平" if ends and all(e == "平" for e in ends) else \
               ("仄" if ends and all(e == "仄" for e in ends) else "转")
    groups[tune_group(mode)].append(name)

# 输出
payload = {name: {k: v for k, v in t.items() if k != "name"} for name, t in tunes.items()}
js = (
    "/* 词谱数据：龙榆生《唐宋词格律》为主，《钦定词谱》补充；韵脚按钦定词谱正体校准 */\n"
    "window.CIPU_GROUPS = %s;\n"
    "window.CIPU = %s;\n"
) % (json.dumps(groups, ensure_ascii=False), json.dumps(payload, ensure_ascii=False))
with open(OUT, "w", encoding="utf-8") as f:
    f.write(js)

print("tunes:", len(tunes), "auto:", auto_count, "missing:", missing)
print("groups:", {k: len(v) for k, v in groups.items()})
print("written:", OUT, os.path.getsize(OUT), "bytes")

# 打印精选词牌供人工核对
print("\n===== 精选词牌核对 =====")
for name in CURATED:
    t = tunes.get(name)
    if not t:
        print("!! missing", name)
        continue
    marks = []
    for i, ln in enumerate(t["lines"], 1):
        m = "韵" if ln["rhyme"] else "·"
        marks.append("%d[%s]%s" % (i, m, "/".join(ln["parts"])))
    print(name, "|", t["mode"], "|", " ".join(marks))
