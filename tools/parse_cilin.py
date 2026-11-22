# -*- coding: utf-8 -*-
"""解析《词林正韵》提取文本，生成每个字的平仄与韵部数据。"""
import json
import re
import sys

SRC = r"C:\Users\LENOVO\Desktop\新建文件夹\微词\tools\词林正韵_提取.txt"
OUT = r"C:\Users\LENOVO\Desktop\新建文件夹\微词\data\词林正韵数据.js"

# 平水韵 106 韵目（顺序即索引），并标注声调
YUNS = [
    # 上平声（平）
    ("一东", "平"), ("二冬", "平"), ("三江", "平"), ("四支", "平"),
    ("五微", "平"), ("六鱼", "平"), ("七虞", "平"), ("八齐", "平"),
    ("九佳", "平"), ("十灰", "平"), ("十一真", "平"), ("十二文", "平"),
    ("十三元", "平"), ("十四寒", "平"), ("十五删", "平"),
    # 下平声（平）
    ("一先", "平"), ("二萧", "平"), ("三肴", "平"), ("四豪", "平"),
    ("五歌", "平"), ("六麻", "平"), ("七阳", "平"), ("八庚", "平"),
    ("九青", "平"), ("十蒸", "平"), ("十一尤", "平"), ("十二侵", "平"),
    ("十三覃", "平"), ("十四盐", "平"), ("十五咸", "平"),
    # 上声（仄）
    ("一董", "上"), ("二肿", "上"), ("三讲", "上"), ("四纸", "上"),
    ("五尾", "上"), ("六语", "上"), ("七麌", "上"), ("八荠", "上"),
    ("九蟹", "上"), ("十贿", "上"), ("十一轸", "上"), ("十二吻", "上"),
    ("十三阮", "上"), ("十四旱", "上"), ("十五潸", "上"), ("十六铣", "上"),
    ("十七筱", "上"), ("十八巧", "上"), ("十九皓", "上"), ("二十哿", "上"),
    ("二十一马", "上"), ("二十二养", "上"), ("二十三梗", "上"),
    ("二十四迥", "上"), ("二十五有", "上"), ("二十六寝", "上"),
    ("二十七感", "上"), ("二十八俭", "上"), ("二十九豏", "上"),
    # 去声（仄）
    ("一送", "去"), ("二宋", "去"), ("三绛", "去"), ("四寘", "去"),
    ("五未", "去"), ("六御", "去"), ("七遇", "去"), ("八霁", "去"),
    ("九泰", "去"), ("十卦", "去"), ("十一队", "去"), ("十二震", "去"),
    ("十三问", "去"), ("十四愿", "去"), ("十五翰", "去"), ("十六谏", "去"),
    ("十七霰", "去"), ("十八啸", "去"), ("十九效", "去"), ("二十号", "去"),
    ("二十一箇", "去"), ("二十二祃", "去"), ("二十三漾", "去"),
    ("二十四敬", "去"), ("二十五径", "去"), ("二十六宥", "去"),
    ("二十七沁", "去"), ("二十八勘", "去"), ("二十九艳", "去"),
    ("三十陷", "去"),
    # 入声（仄）
    ("一屋", "入"), ("二沃", "入"), ("三觉", "入"), ("四质", "入"),
    ("五物", "入"), ("六月", "入"), ("七曷", "入"), ("八黠", "入"),
    ("九屑", "入"), ("十药", "入"), ("十一陌", "入"), ("十二锡", "入"),
    ("十三职", "入"), ("十四缉", "入"), ("十五合", "入"), ("十六叶", "入"),
    ("十七洽", "入"),
]

YUN_IDX = {name: i for i, (name, _) in enumerate(YUNS)}
CN_NUM = "一二三四五六七八九十"

# 文档中的简写别名（如“二十一箇”写作“二十一个”）
YUN_ALIAS = {"二十一个": "二十一箇"}

def cn_to_int(s):
    """中文数字转整数（支持一~三十，含“一十一”这类写法）。"""
    digits = {c: i + 1 for i, c in enumerate("一二三四五六七八九")}
    total = 0
    for ch in s:
        if ch == "十":
            total = total * 10 if total else 10
        else:
            total += digits[ch]
    return total

def main():
    with open(SRC, encoding="utf-8") as f:
        raw = f.read()

    # 按行切分（提取文本用换行符分行，控制符 \v 一并去掉）
    lines = [ln.strip() for ln in raw.replace("\v", "").splitlines() if ln.strip()]

    # 词林正韵十九部 -> 韵目分组
    current_bu = 0
    sections = []  # 记录 (bu, yun)，用于自检
    all_names = list(YUN_IDX) + list(YUN_ALIAS)
    header_re = re.compile(
        r"^(%s)(半)?" % "|".join(sorted(all_names, key=len, reverse=True))
    )

    # 逐行提取汉字
    readings = {}  # char -> set of "bu,yunIdx"
    current_yun = None
    section_count = 0
    for p in lines:
        m = re.match(r"^第([一二三四五六七八九十]+)部$", p)
        if m:
            current_bu = cn_to_int(m.group(1))
            continue
        head = p.split("其它僻字")[0].strip()
        m2 = header_re.match(head) if head else None
        if m2:
            current_yun = YUN_ALIAS.get(m2.group(1), m2.group(1))
            section_count += 1
            sections.append((current_bu, current_yun))
            body = head[len(m2.group(0)):]
        else:
            body = head
        if not current_yun:
            continue
        body = re.sub(r"\[[^\]]*\]", "", body)
        key = "%d,%d" % (current_bu, YUN_IDX[current_yun])
        for ch in body:
            if "\u4e00" <= ch <= "\u9fff" or "\u3400" <= ch <= "\u4dbf" or "\U00020000" <= ch <= "\U0002ffff":
                readings.setdefault(ch, set()).add(key)

    # 输出紧凑 JS：字符 -> "bu,yunIdx;bu,yunIdx..."
    seen = set()
    for _, yun in sections:
        seen.add(yun)
    missing = [name for name in YUN_IDX if name not in seen]
    if missing:
        print("WARNING missing yun sections:", missing)
    extra = sorted(set(seen) - set(YUN_IDX))
    if extra:
        print("WARNING unknown yun names:", extra)

    entries = []
    for ch in sorted(readings):
        entries.append('"%s":"%s"' % (ch, ";".join(sorted(readings[ch]))))

    meta = {
        "yuns": YUNS,
        "sectionCount": section_count,
        "charCount": len(readings),
    }
    js = (
        "/* 由《词林正韵》解析生成，请勿手工修改 */\n"
        "window.CILIN_META = %s;\n"
        "window.CILIN = {\n%s\n};\n"
    ) % (json.dumps(meta, ensure_ascii=False), ",\n".join(entries))

    import os
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)

    print("sections:", section_count)
    print("unique chars:", len(readings))
    print("meta:", meta)
    print("written:", OUT, os.path.getsize(OUT), "bytes")

if __name__ == "__main__":
    sys.exit(main())
