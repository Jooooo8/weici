# -*- coding: utf-8 -*-
"""构建微词 Web 字体（分片）：

  fonts/guange.woff2        馆阁体·简体核心（GB2312 + 内置语料 + 古籍补字）
  fonts/guange-trad.woff2   馆阁体·繁体补充（简体核心对应的繁体字形）
  fonts/xiaozhuan.woff2     小篆·简体核心
  fonts/xiaozhuan-trad.woff2 小篆·繁体补充

同时输出 fonts/fonts.css 片段（含 unicode-range 分片声明）。
两款源字体均为 SIL OFL 1.1，修改（子集化）后按 OFL 保留字体名条款改用新族名。
"""
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "fonts")
CORE = os.path.join(HERE, "charset-web.txt")

FONTS = [
    {
        "src": os.path.join(HERE, "gg3_out", "GuanGeKai-Regular.ttf"),
        "family": "WeiCi Guange",
        "shards": [("guange.woff2", "core", False), ("guange-trad.woff2", "trad", True)],
    },
    {
        "src": os.path.join(
            HERE, "xz_out", "Chine-Culture-Xiaozhuan-1.000", "Chine-Culture-Xiaozhuan.otf"
        ),
        "family": "WeiCi Xiaozhuan",
        "shards": [("xiaozhuan.woff2", "core", False), ("xiaozhuan-trad.woff2", "trad", True)],
    },
]


def load_core():
    with open(CORE, encoding="utf-8") as f:
        return set(f.read())


def build_trad(core):
    """从 OpenCC s2t 表里取出核心字对应的繁体写法。"""
    raw = open(os.path.join(ROOT, "data", "繁简转换数据.js"), encoding="utf-8").read()
    body = raw[raw.index("=") + 1:].strip().rstrip(";")
    data = json.loads(body)
    trad = set()
    for simp, t in data["s2t"]["chars"].items():
        if simp in core:
            trad.update(ch for ch in t if ch not in core)
    return trad


def rename(font, family, style="Regular"):
    full = family + " " + style
    ps = full.replace(" ", "")
    for rec in list(font["name"].names):
        nid = rec.nameID
        if nid in (1, 16):
            val = family
        elif nid in (2, 17):
            val = style
        elif nid == 4:
            val = full
        elif nid == 6:
            val = ps
        else:
            continue
        try:
            rec.string = val
        except Exception:
            pass
    if "OS/2" in font:
        font["OS/2"].usWeightClass = 400
    if "CFF " in font:
        for top in font["CFF "].cff.topDictIndex:
            top.FamilyName = family
            top.FullName = full
            top.Weight = style
            top.FontName = ps
            top.Notice = (
                "Subset of an SIL OFL 1.1 font; renamed per the OFL Reserved Font Name clause."
            )


def make(src, text, dst):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_legacy = True
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.drop_tables = ["ltag"]
    opts.passthrough_tables = False
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(options=opts)
    sub.populate(text=text)
    sub.subset(font)
    return font, opts


def unicode_range(chars):
    """把码位集合压缩成 U+XXXX-YYYY 形式的 unicode-range 串。"""
    cps = sorted(ord(c) for c in chars)
    if not cps:
        return ""
    parts = []
    start = prev = cps[0]
    for cp in cps[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        parts.append((start, prev))
        start = prev = cp
    parts.append((start, prev))
    out = []
    for a, b in parts:
        out.append("U+%04X" % a if a == b else "U+%04X-%04X" % (a, b))
    return ",".join(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    core = load_core()
    trad = build_trad(core)
    print("core %d chars / trad %d chars" % (len(core), len(trad)))

    css = []
    for spec in FONTS:
        for fname, kind, ranged in spec["shards"]:
            chars = core if kind == "core" else trad
            if not chars:
                continue
            dst = os.path.join(OUT, fname)
            font, opts = make(spec["src"], "".join(sorted(chars)), dst)
            rename(font, spec["family"])
            subset.save_font(font, dst, opts)
            real = font.getBestCmap() or {}
            covered = [c for c in chars if ord(c) in real]
            size = os.path.getsize(dst)
            print(
                "%-24s %5.2f MB  family=%-16s cmap=%5d / asked %d"
                % (fname, size / 1048576, spec["family"], len(real), len(chars))
            )
            block = [
                "@font-face{",
                '  font-family:"%s";' % spec["family"],
                '  src:url("%s") format("woff2");' % fname,
                "  font-weight:400;",
                "  font-style:normal;",
                "  font-display:swap;",
            ]
            if ranged:
                block.append("  unicode-range:%s;" % unicode_range(covered))
            block.append("}")
            css.append("\n".join(block))

    header = (
        "/* 微词 Web 字体 —— 两款 SIL OFL 1.1 开源字体（子集化 + 改名）\n"
        "   馆阁体：GuanGe Kai（github.com/guan-ge-kai），字形源自明《四書白文》写本\n"
        "   小篆：Chine-Culture Xiaozhuan（chine-culture.com），字形源自 Wikimedia ACC 公有领域\n"
        "   授权全文见 fonts/OFL-guange.txt 、fonts/OFL-xiaozhuan.txt */\n"
    )
    with open(os.path.join(HERE, "fontface.css"), "w", encoding="utf-8") as f:
        f.write(header + "\n".join(css) + "\n")
    print("css bytes:", os.path.getsize(os.path.join(HERE, "fontface.css")))


if __name__ == "__main__":
    sys.exit(main())
