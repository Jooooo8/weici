微词 Web 字体说明
==================

本目录只放「可合法随项目分发」的开源字体，均已子集化并改名。
所有字体授权均为 SIL Open Font License 1.1（允许商用、修改、再分发，
要求：修改后的字体不得使用原保留字体名；衍生作品仍须以 OFL 发布）。


一、馆阁体  WeiCi Guange
--------------------------------------------------
文件      guange.woff2        简体核心（7,755 字，覆盖 7,089 字）
          guange-trad.woff2   繁体补充（2,336 字，unicode-range 按需加载）
源字体    GuanGe Kai v1.7.3（家族名 GuanGe Kai）
来源      https://github.com/guan-ge-kai
字形依据  明《四書白文》写本（旧传姜立纲），真迹扫描字形 2,261 字经矢量化，
          其余字形由霞鹜文楷骨架合成；扫描与数字化由書格 shuge.org 完成
授权      SIL OFL 1.1，见 OFL-guange.txt
改名说明  源字体为 LXGW WenKai 衍生物，继承保留字体名「霞鹜 / LXGW」，
          本项目修改后改用新族名 WeiCi Guange
体积说明  该字体为写本描摹，单字轮廓细节多，压缩后体积偏大属正常现象


二、小篆  WeiCi Xiaozhuan
--------------------------------------------------
文件      xiaozhuan.woff2        简体核心（覆盖 2,755 字）
          xiaozhuan-trad.woff2   繁体补充（覆盖 892 字）
源字体    Chine-Culture Xiaozhuan v1.000
来源      https://chine-culture.com
字形依据  Wikimedia Commons「Ancient Chinese characters (ACC)」公有领域项目，
          逐字出处见源包 PROVENANCE.csv
授权      SIL OFL 1.1，保留字体名 "Chine-Culture"，见 OFL-xiaozhuan.txt
改名说明  修改后改用新族名 WeiCi Xiaozhuan
覆盖说明  该字体只收录「有古文字形」的字，共 3,883 字形 / 4,841 码位，
          简繁同形映射（国 与 國 显示同一篆形）。缺字的字自动回退到楷体。


三、为什么没有随包提供瘦金体 / 宋徽宗瘦金书 / 汉仪瘦金书
--------------------------------------------------
瘦金体（宋徽宗赵佶所创）现存字库均为商业授权字体（方正、汉仪、华康等），
未找到任何可确认授权、且字形完整的开源瘦金体实现。为避免把一个
来源不明的字体文件塞进项目带来授权风险，这三项保留为「本机已安装才显示」：
若你自行安装了具备商用授权的瘦金体，字体菜单里会自动出现该选项，
无需修改代码。相关探测逻辑见 app.js 中的 FONT_PROBES。

探测族名是一个数组，任一命中即算已安装——同一个字库不同发行版的
字体族名常常不一致（中文名 / 英文名 / 带字重后缀），所以：
  shoujin       瘦金体 / FZShouJinTi / 方正瘦金体 / DFPShouJinW3
  huizong       宋徽宗瘦金体 / 宋徽宗瘦金书
  hanyishoujin  汉仪瘦金书简 / 汉仪瘦金书繁 / 汉仪瘦金书

注意：本机安装的瘦金体文件属于商业字库，只能装在你自己电脑上用于
个人学习欣赏，不要提交到仓库、也不要随项目二次分发。


四、如何重新生成
--------------------------------------------------
字符集与构建脚本见 tools/tmp/fonts-download/：
  build_charset.py  生成本目录用的字符集 charset-web.txt
  build_webfonts.py 子集化 + 改族名 + 生成 @font-face 片段 fontface.css

依赖：python -m pip install fonttools brotli
命令：python tools/tmp/fonts-download/build_charset.py
      python tools/tmp/fonts-download/build_webfonts.py
