# -*- coding: utf-8 -*-
"""把 raw_中华新韵.json 转成与词林正韵数据.js 同构的 window.XINYUN / window.XINYUN_META"""
import json, io

TMP = u"C:\\Users\\LENOVO\\Desktop\\新建文件夹\\微词\\tools\\tmp\\raw_中华新韵.json"
OUT = u"C:\\Users\\LENOVO\\Desktop\\新建文件夹\\微词\\data\\中华新韵数据.js"

with io.open(TMP, encoding="utf-8") as f:
    data = json.load(f)

yuns = []   # [韵目名, 声调]
chars = {}  # 字 -> "bu,yi;bu,yi"

def add(ch, bu, yi):
    old = chars.get(ch)
    key = "%d,%d" % (bu, yi)
    if not old:
        chars[ch] = key
    elif key not in old.split(";"):
        chars[ch] = old + ";" + key

for bu, item in enumerate(data, start=1):
    for k, v in item.items():
        for tone, lst in (("平", v["平"]), ("仄", v["仄"])):
            yi = len(yuns)
            yuns.append([k + "韵", tone])
            for ch in lst:
                add(ch, bu, yi)

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

lines = []
lines.append("/* 由《中华新韵（十四韵）》整理生成，请勿手工修改 */")
meta = {"name": "中华新韵", "yuns": yuns, "sectionCount": len(data), "charCount": len(chars)}
lines.append("window.XINYUN_META = " + json.dumps(meta, ensure_ascii=False) + ";")
lines.append("window.XINYUN = {")
keys = sorted(chars.keys())
for i, ch in enumerate(keys):
    comma = "," if i < len(keys) - 1 else ""
    lines.append("\"%s\":\"%s\"%s" % (js_str(ch), chars[ch], comma))
lines.append("};")

with io.open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("written:", OUT, "chars:", len(chars), "yuns:", len(yuns))
