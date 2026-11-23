# -*- coding: utf-8 -*-
"""构建「微词」Web 字体子集字符集。

策略：只覆盖「书写 / 品读」实际会出现的字，避免把整库 2 万字都塞进网页字体。
  1. GB2312 一二级汉字 + 符号（6763 字，覆盖现代常用与绝大多数诗词用字）
  2. 内置数据中出现频率最高的语料：诗词集、例词、常用字、词谱、诗格律
  3. 古典诗词补充字（GB2312 未收录，但读诗写诗会遇到）
不纳入：繁简转换表、词林正韵表、全库 43 个分卷（含大量异体/生僻字，
        这些字交给系统楷体回退，不影响观感）。
"""
import glob
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
chars = set()

# 1) GB2312
for b1 in range(0xA1, 0xF8):
    for b2 in range(0xA1, 0xFF):
        try:
            chars.add(bytes([b1, b2]).decode("gb2312"))
        except Exception:
            pass

# 2) 语料
CORPUS = [
    "data/例词.js",
    "data/常用字.js",
    "data/词谱数据.js",
    "data/诗格律.js",
    "data/诗格律补充.js",
    "data/诗词集数据.js",
]
for rel in CORPUS:
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        print("missing", rel)
        continue
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for ch in f.read():
            if ord(ch) > 0x2E7F and ch.isprintable():
                chars.add(ch)

# 3) 古籍 / 诗词常见补充字
EXTRA = (
    "癸丑暮春禊觞鹜榭槛檐簪鬓钗钿黛娥娟婵蟾阙阕麝衾衿帏帱帷幄"
    "醪醴醅觥斛罍樽斝笏珮玎珰琮璜琥琰琛瑁瑜瑾璆瓒甍甃堞雉翚翥翾"
    "漪涟潋滟潆洄溆浦溽澹濯瀛潇湘沅芷澧洧溱洎汜沚埼嵚崟峦嶂峤岫"
    "篁篙簟箦箧箫笳笙竽篪埙缶铎钲铙镛磬柷敔龠籥黍稷菽稌稔穑耒耜"
    "骖骅骝骠骢骆骓骐骥驽骀驯骈骊骍牝牡牯牸"
    "菡萏芙蕖蘅芷荪蕙荃葳蕤茝苾蘼芜薜荔女萝葭蒹荻菰莼蓴蓼蘋苹"
    "栉沐盥槃匜卮瓯盅瓠瓢箪笥箸匕鬯"
    "鹣鲽鹧鸪鹈鴂鶗鴃鳲鸠雎鸧鹒鹁鸬鹚鸂鶒鵁鶄"
    "蚱蜢蟋蟀促织螽斯蜉蝣蟪蛄蜩螗螓蛾蠓蠛"
    "杲杳曛曩曦晞旸暾昕旰昃昴觜参井鬼柳星张翼轸"
    "昉旻旃旌旄纛黼黻扆"
    "飔飗飕飐飏飖飚叆叇霡霂霢霈霪霭霁霰霙霿"
    "阊阖阆阇阛阓闾阎闬闳閈闉阽"
    "翛翯翙翚翈翭翦翩翳翾"
    "麇麈麋麛麚麂麀麃麅"
    "鲙鲈鲥鲟鲠鲛鲭鲋鲊鲒"
    "醵醍醐酴醾釄酹酬酢筹"
    "灺炧燔燧熸燡焜炜煜熠爝"
    "琤琮琚瑀璘璠璎珞瑷琬琰瑛瑶琪琳琦瑄瑾"
    "瓴甓塈墁墍墼圬塓"
    "髣髴髫髡髭髯鬒鬟鬋鬘鬖鬝"
    "阒阗阏阘陟隰隈隍隩隗"
    "芰荷蓑笠箬篷舴艋艅艎舳舻艨艟"
    "魑魅魍魉鬽鬾鬿"
    "鹔鹴鸑鷟鹓鶵鵷鶵"
    "龢龤龡"
    "嶰壑壒塬塱墺壔壖壗壜壝壣壤壧壨壩壪"
)
for ch in EXTRA:
    chars.add(ch)

for ch in "　、。，．·；：？！…—～《》〈〉「」『』【】〔〕（）［］｛｝“”‘’＂＇｜＋－＝％＃＆＊＠︐︑︒︓︔︕︖︗︘︙〇々〆":
    chars.add(ch)

text = "".join(sorted(chars))
out = os.path.join(os.path.dirname(__file__), "charset-web.txt")
with open(out, "w", encoding="utf-8") as f:
    f.write(text)
print("chars:", len(text), "->", out)
