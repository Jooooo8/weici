# -*- coding: utf-8 -*-
"""从 chinese-gushiwen（MIT）原始数据提取唐诗三百首 / 宋词三百首，生成诗词鉴赏数据 JS"""
import json, io, glob, os

TMP = u"C:\\Users\\LENOVO\\Desktop\\新建文件夹\\微词\\tools\\tmp"
OUT = u"C:\\Users\\LENOVO\\Desktop\\新建文件夹\\微词\\data\\诗词集数据.js"

COLLECTIONS = ["唐诗三百首", "宋词三百首"]

def clean_text(s):
    if not s:
        return ""
    s = s.replace("\u3000", " ")
    return s.strip()

def split_lines(content):
    out = []
    for ln in content.split("\n"):
        ln = clean_text(ln)
        if ln:
            out.append(ln)
    return out

works = []
seen = set()
for path in sorted(glob.glob(os.path.join(TMP, "guwen*.json"))):
    with io.open(path, encoding="utf-8") as f:
        for ln in f:
            ln = ln.strip()
            if not ln:
                continue
            obj = json.loads(ln)
            tags = obj.get("type", []) or []
            hit = [t for t in COLLECTIONS if t in tags]
            if not hit:
                continue
            title = (obj.get("title") or "").strip()
            key = (title, obj.get("writer") or "", (obj.get("content") or "")[:30])
            if key in seen:
                continue
            seen.add(key)
            is_ci = "宋词三百首" in tags
            ci_pai = ""
            pure_title = title
            if is_ci and "·" in title:
                parts = title.split("·", 1)
                ci_pai = parts[0].strip()
                pure_title = parts[1].strip()
            works.append({
                "t": pure_title,
                "p": ci_pai,
                "d": (obj.get("dynasty") or "").strip(),
                "a": (obj.get("writer") or "").strip(),
                "c": split_lines(obj.get("content") or ""),
                "tags": [t for t in tags if t in COLLECTIONS],
                "z": clean_text(obj.get("remark") or ""),
                "y": clean_text(obj.get("translation") or ""),
                "s": clean_text(obj.get("shangxi") or ""),
            })

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

def dump(v, indent=""):
    if isinstance(v, str):
        return "\"" + js_str(v) + "\""
    if isinstance(v, list):
        if not v:
            return "[]"
        if all(isinstance(x, str) for x in v):
            return "[" + ",".join(dump(x) for x in v) + "]"
        inner = ",\n".join(dump(x, indent + "  ") for x in v)
        return "[\n" + indent + "  " + inner + "\n" + indent + "]"
    if isinstance(v, dict):
        if not v:
            return "{}"
        inner = ",\n".join(indent + "  " + k + ":" + dump(val, indent + "  ") for k, val in v.items())
        return "{\n" + inner + "\n" + indent + "}"
    return json.dumps(v)

lines = ["/* 唐诗三百首 · 宋词三百首（注评）数据，来源 chinese-gushiwen（MIT），请勿手工修改 */"]
lines.append("window.SHIJI = " + dump(works, "") + ";")
lines.append("window.SHIJI_META = {\"collections\":[\"唐诗三百首\",\"宋词三百首\"],\"count\":" + str(len(works)) + "};")

with io.open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

n_remark = sum(1 for w in works if w["z"])
n_trans = sum(1 for w in works if w["y"])
n_shang = sum(1 for w in works if w["s"])
size = os.path.getsize(OUT)
print("works:", len(works), "| 有注释:", n_remark, "有译文:", n_trans, "有赏析:", n_shang)
print("size:", size)
