# -*- coding: utf-8 -*-
"""从词频表提取常用字顺序（用于同韵字排序）。"""
import csv
import os
import sys
from collections import Counter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SRC = r"C:\Users\LENOVO\Desktop\新建文件夹\微词\tools\tmp\raw_词频分析.csv"
OUT = r"C:\Users\LENOVO\Desktop\新建文件夹\微词\data\常用字.js"

with open(SRC, "rb") as f:
    text = f.read().decode("utf-8-sig")
rows = list(csv.reader(text.splitlines()))[1:]
freq = Counter()
for r in rows:
    if len(r) < 3:
        continue
    word, _, cnt = r[0], r[1], r[2]
    try:
        n = int(cnt)
    except ValueError:
        n = 1
    for ch in word:
        if "\u4e00" <= ch <= "\u9fff":
            freq[ch] += n

ordered = [ch for ch, _ in freq.most_common()]
words = [r[0] for r in rows if len(r) >= 1 and len(r[0]) >= 2 and
         all("\u4e00" <= ch <= "\u9fff" for ch in r[0])]
js = (
    "/* 由诗词词频表提取的常用字顺序与常用词，用于同韵字排序与自动成句 */\n"
    "window.COMMON_WORDS = %s;\n"
    "window.COMMON_CHARS = %s;\n"
) % (
    "[" + ",".join('"%s"' % w for w in words) + "]",
    "[" + ",".join('"%s"' % ch for ch in ordered) + "]"
)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(js)
print("common chars:", len(ordered))
print("".join(ordered[:40]))
