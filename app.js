    (function () {
      "use strict";

      // ---------- 工具 ----------
      function $(id) { return document.getElementById(id); }
      function esc(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      }
      let toastTimer = null;
      function toast(msg) {
        const t = $("toast");
        t.textContent = msg;
        t.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
      }

      // ---------- 韵书（词林正韵 / 中华新韵 可切换） ----------
      let yunKey = "词林正韵";
      function yunChars() {
        return yunKey === "中华新韵" ? window.XINYUN : window.CILIN;
      }
      function yunMeta() {
        return yunKey === "中华新韵" ? window.XINYUN_META : window.CILIN_META;
      }
      function yunLabel() {
        return yunKey === "中华新韵" ? "中华新韵" : "词林正韵";
      }
      function readingsOf(ch) {
        const s = yunChars()[ch];
        if (!s) return [];
        const YUNS = yunMeta().yuns;
        return s.split(";").map(function (k) {
          const p = k.split(",");
          const yi = +p[1];
          return { bu: +p[0], yi: yi, tone: YUNS[yi][1], yunName: YUNS[yi][0] };
        });
      }
      function infoOf(ch) {
        const rs = readingsOf(ch);
        const tones = {};
        rs.forEach(function (r) { tones[r.tone] = true; });
        return {
          readings: rs,
          tones: ["平", "上", "去", "入", "仄"].filter(function (t) { return tones[t]; }),
          hasPing: !!tones["平"],
          hasZe: !!(tones["上"] || tones["去"] || tones["入"] || tones["仄"]),
          hasQu: !!tones["去"],
          hasRu: !!tones["入"],
          hasShang: !!tones["上"],
          toneLabel: rs.length ? Object.keys(tones).join("·") : ""
        };
      }
      function checkTone(ch, req) {
        const info = infoOf(ch);
        if (req === "中") return { ok: true, info: info };
        if (!info.readings.length) return { ok: null, info: info };
        if (req === "平") return { ok: info.hasPing, info: info };
        if (req === "去") {
          return yunKey === "中华新韵" ? { ok: info.hasZe, info: info } : { ok: info.hasQu, info: info };
        }
        return { ok: info.hasZe, info: info };
      }
      function catOfTone(tone) {
        if (yunKey === "中华新韵") return tone === "平" ? "平" : "仄";
        if (tone === "平") return "平";
        if (tone === "入") return "入";
        return "上去";
      }
      const CN_NUM = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
        "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九"];
      function cnNum(n) { return CN_NUM[n] !== undefined ? CN_NUM[n] : String(n); }

      // 随项目分发的内置 Web 字体（SIL OFL 1.1，子集化后改名，见 fonts/README.txt）
      // 这两款不依赖本机安装，任何设备打开都可用
      const WEB_FONTS = {
        xiaozhuan: { family: "WeiCi Xiaozhuan", label: "小篆（内置）" },
        guange: { family: "WeiCi Guange", label: "馆阁体（内置）" }
      };

      // 字体栈：艺术字体未安装时自动回退到系统楷体 / 黑体，离线可用
      const FONT_STACKS = {
        yahei: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
        song: '"SimSun", "Songti SC", "STSong", serif',
        fangsong: '"FangSong", "STFangsong", "FangSong_GB2312", serif',
        kai: '"KaiTi", "STKaiti", "Kaiti SC", "BiauKai", serif',
        hei: '"SimHei", "Microsoft YaHei", "PingFang SC", sans-serif',
        wenkai: '"LXGW WenKai", "霞鹜文楷", "KaiTi", "STKaiti", serif',
        lishu: '"LiSu", "隶书", "STLiti", "华文隶书", "SimSun", serif',
        xingkai: '"STXingkai", "华文行楷", "行楷", "KaiTi", "STKaiti", serif',
        xinwei: '"STXinwei", "华文新魏", "新魏", "SimHei", serif',
        shuti: '"方正舒体", "FZShuTi", "STXingkai", "KaiTi", serif',
        yaoti: '"方正姚体", "FZYTK", "STSong", "SimSun", serif',
        youyuan: '"YouYuan", "幼圆", "Microsoft YaHei", sans-serif',
        hupo: '"STHupo", "华文琥珀", "SimHei", sans-serif',
        caiyun: '"STCaiyun", "华文彩云", "SimHei", sans-serif',
        xiaozhuan: '"WeiCi Xiaozhuan", "FZXiaoZhuanTi", "方正小篆体", "KaiTi", "STKaiti", serif',
        shoujin: '"瘦金体", "FZShouJinTi", "方正瘦金体", "KaiTi", serif',
        huizong: '"宋徽宗瘦金体", "瘦金体", "KaiTi", serif',
        hanyishoujin: '"汉仪瘦金书繁", "汉仪瘦金书简", "KaiTi", serif',
        guange: '"WeiCi Guange", "翰林馆阁体", "KaiTi", "STKaiti", serif'
      };
      // 本机字体探测：只有真正装了的才出现在菜单里，避免瘦金 / 小篆都回退成楷体造成误导。
      // 小篆、馆阁体已内置，不走探测，绕开 canvas 比对带来的额外字体下载。
      // [显示标签, 探测族名]；探测族名可以是数组，任一命中即算已安装（同一字库不同版本的族名常不一致）。
      const FONT_PROBES = {
        lishu: ["隶书", "LiSu"],
        xingkai: ["华文行楷", "STXingkai"],
        xinwei: ["华文新魏", "STXinwei"],
        shuti: ["方正舒体", "方正舒体"],
        yaoti: ["方正姚体", "方正姚体"],
        youyuan: ["幼圆", "YouYuan"],
        hupo: ["华文琥珀", "STHupo"],
        caiyun: ["华文彩云", "STCaiyun"],
        shoujin: ["瘦金体", ["瘦金体", "FZShouJinTi", "方正瘦金体", "DFPShouJinW3"]],
        huizong: ["宋徽宗瘦金体", ["宋徽宗瘦金体", "宋徽宗瘦金书"]],
        hanyishoujin: ["汉仪瘦金书", ["汉仪瘦金书简", "汉仪瘦金书繁", "汉仪瘦金书"]]
      };
      const FONT_LABELS = {
        lishu: "隶书", xingkai: "华文行楷", xinwei: "华文新魏", shuti: "方正舒体",
        yaoti: "方正姚体", youyuan: "幼圆", hupo: "华文琥珀", caiyun: "华文彩云",
        xiaozhuan: "小篆", shoujin: "瘦金体", huizong: "宋徽宗瘦金体",
        hanyishoujin: "汉仪瘦金书", guange: "馆阁体"
      };
      function fontInstalled(probe) {
        try {
          const cv = document.createElement("canvas");
          cv.width = 800; cv.height = 90;
          const ctx = cv.getContext("2d");
          const text = "永和九年岁在癸丑暮春之初";
          const hash = function (family) {
            ctx.clearRect(0, 0, cv.width, cv.height);
            ctx.font = '64px ' + family;
            ctx.fillStyle = "#000";
            ctx.fillText(text, 0, 70);
            const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
            let h = 0;
            for (let i = 3; i < data.length; i += 4) h = (h * 31 + data[i]) >>> 0;
            return h;
          };
          return hash('"' + probe + '", serif') !== hash("serif");
        } catch (e) { return false; }
      }
      function artFontItems() {
        const items = Object.keys(WEB_FONTS).map(function (id) {
          return [id, WEB_FONTS[id].label];
        });
        Object.keys(FONT_PROBES).forEach(function (id) {
          const cfg = FONT_PROBES[id];
          const probes = Array.isArray(cfg[1]) ? cfg[1] : [cfg[1]];
          const hit = probes.some(function (p) { return fontInstalled(p); });
          if (hit) items.push([id, cfg[0] || FONT_LABELS[id]]);
        });
        return items;
      }
      // 内置字体的 WOFF2 体积较大（馆阁体 3.3MB），只在真正选中时才解码加载
      const webFontWarm = {};
      function warmWebFont(id) {
        const wf = WEB_FONTS[id];
        if (!wf || !document.fonts || !document.fonts.load) return;
        if (webFontWarm[id]) return;
        webFontWarm[id] = true;
        try {
          document.fonts.load('64px "' + wf.family + '"', "永和九年岁在癸丑暮春之初").then(function () {
            // 字形就绪后重排一次预览，避免打印稿停留在回退字体上
            const ov = $("pdf-overlay");
            if (ov && ov.classList.contains("show")) renderPdfViewer();
          }).catch(function () {});
        } catch (e) { /* 老浏览器无 FontFaceSet，交给 CSS 自然回退 */ }
      }
      const FONT_UI_OPTIONS = [
        { label: "清晰", items: [["yahei", "微软雅黑（默认）"], ["song", "宋体"], ["fangsong", "仿宋"], ["hei", "黑体"], ["wenkai", "霞鹜文楷"]] },
        { label: "艺术", items: artFontItems() }
      ];
      const FONT_POEM_OPTIONS = [
        { label: "端正", items: [["kai", "楷体（默认）"], ["song", "宋体"], ["fangsong", "仿宋"], ["hei", "黑体"], ["wenkai", "霞鹜文楷"]] },
        { label: "艺术", items: artFontItems() }
      ];

      // PDF / 原文查看配色预设：字色与纸色成对出现，避免只改一半导致不可读
      const PDF_PALETTES = {
        default: { name: "宣纸墨字", ink: "#2b2b2b", paper: "#fffdf7" },
        plain: { name: "素白黑字", ink: "#111111", paper: "#ffffff" },
        elegant: { name: "淡雅灰蓝", ink: "#39506b", paper: "#f4f7fa" },
        cinnabar: { name: "朱砂笺", ink: "#8f2f24", paper: "#fff8f3" },
        jade: { name: "墨绿笺", ink: "#254434", paper: "#f1f5ee" },
        night: { name: "夜读", ink: "#f3ead6", paper: "#1d1b18" },
        custom: { name: "自定义", ink: null, paper: null }
      };

      // 纸面印花：梅枝 / 远山 / 竹影 / 荷影 / 星点均使用真实素材裁剪，云纹与水波仍为水墨 SVG
      const PDF_MOTIFS = {
        none: { name: "无", svg: "", repeat: "no-repeat", size: "0", position: "center" },
        bamboo: {
          name: "竹影", repeat: "no-repeat", size: "48% auto", position: "right bottom",
          imageSrc: "motifs/bamboo.png",
          colors: { stroke: "#24402c", fill: "#2f6b3d", accent: "#4f8a4a" },
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"><defs><filter id="b"><feGaussianBlur stdDeviation="2.4"/></filter></defs><g filter="url(#b)" fill="none" stroke="{{A}}" stroke-linecap="round" opacity=".34"><path d="M318 350 C300 280 292 200 258 92" stroke-width="11"/><path d="M268 92 C244 140 232 192 242 236" stroke-width="7"/><path d="M286 250 C250 214 218 204 180 208 C218 226 250 242 286 250Z" fill="{{A}}" stroke="none"/></g><g stroke="{{S}}" fill="none" stroke-linecap="round" opacity=".86"><path d="M318 350 C300 280 292 200 258 92" stroke-width="3.2"/><path d="M268 92 C244 140 232 192 242 236" stroke-width="2.2"/><path d="M210 350 C198 288 196 220 176 142" stroke-width="2.6"/><path d="M176 142 C158 180 152 220 160 252" stroke-width="1.8"/><path d="M276 184 L306 174"/><path d="M292 276 L322 268"/><path d="M188 224 L216 216"/><path d="M170 312 L198 306"/></g><g fill="{{F}}" opacity=".72"><path d="M286 250 C256 220 228 212 196 216 C228 232 256 246 286 250Z"/><path d="M272 170 C248 140 220 134 190 142 C220 156 246 166 272 170Z"/><path d="M306 304 C278 284 252 282 224 290 C252 300 278 306 306 304Z"/><path d="M262 112 C282 88 306 86 330 94 C306 104 282 110 262 112Z"/><path d="M250 212 C224 204 200 210 180 226 C206 226 230 220 250 212Z"/><path d="M196 270 C170 244 146 240 120 246 C146 258 170 268 196 270Z"/><path d="M184 190 C162 166 140 162 118 170 C140 180 162 186 184 190Z"/><path d="M166 130 C182 108 202 106 222 112 C202 122 182 128 166 130Z"/><path d="M172 306 C148 288 124 288 102 296 C126 304 148 310 172 306Z"/></g></svg>'
        },
        plum: {
          name: "梅枝", repeat: "no-repeat", size: "58% auto", position: "right top",
          imageSrc: "motifs/plum.png",
          colors: { stroke: "#33231e", fill: "#c42f45", accent: "#a3243b" },
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"><defs><filter id="b"><feGaussianBlur stdDeviation="2"/></filter></defs><g filter="url(#b)" fill="{{A}}" opacity=".26"><circle cx="232" cy="150" r="17"/><circle cx="190" cy="198" r="14"/><circle cx="150" cy="226" r="12"/><circle cx="120" cy="266" r="10"/></g><g stroke="{{S}}" fill="none" stroke-linecap="round" opacity=".86"><path d="M360 64 C302 76 266 112 232 158 C204 196 166 222 118 240" stroke-width="3.8"/><path d="M232 158 C246 124 266 104 294 94" stroke-width="2.4"/><path d="M166 222 C156 256 138 282 108 302" stroke-width="2.2"/><path d="M232 158 C208 124 176 110 142 116" stroke-width="2"/><path d="M190 198 C200 170 216 152 244 140" stroke-width="1.8"/></g><g fill="{{F}}" opacity=".78"><g transform="translate(232 150) scale(.85)"><circle cx="0" cy="-8" r="5"/><circle cx="7" cy="-2.5" r="5"/><circle cx="4.5" cy="6" r="5"/><circle cx="-4.5" cy="6" r="5"/><circle cx="-7" cy="-2.5" r="5"/></g><g transform="translate(190 198) scale(.75)"><circle cx="0" cy="-8" r="5"/><circle cx="7" cy="-2.5" r="5"/><circle cx="4.5" cy="6" r="5"/><circle cx="-4.5" cy="6" r="5"/><circle cx="-7" cy="-2.5" r="5"/></g><g transform="translate(150 226) scale(.68)"><circle cx="0" cy="-8" r="5"/><circle cx="7" cy="-2.5" r="5"/><circle cx="4.5" cy="6" r="5"/><circle cx="-4.5" cy="6" r="5"/><circle cx="-7" cy="-2.5" r="5"/></g><g transform="translate(278 116) scale(.66)"><circle cx="0" cy="-8" r="5"/><circle cx="7" cy="-2.5" r="5"/><circle cx="4.5" cy="6" r="5"/><circle cx="-4.5" cy="6" r="5"/><circle cx="-7" cy="-2.5" r="5"/></g><g transform="translate(126 246) scale(.62)"><circle cx="0" cy="-8" r="5"/><circle cx="7" cy="-2.5" r="5"/><circle cx="4.5" cy="6" r="5"/><circle cx="-4.5" cy="6" r="5"/><circle cx="-7" cy="-2.5" r="5"/></g><g transform="translate(214 154) scale(.7)"><circle cx="0" cy="-8" r="5"/><circle cx="7" cy="-2.5" r="5"/><circle cx="4.5" cy="6" r="5"/><circle cx="-4.5" cy="6" r="5"/><circle cx="-7" cy="-2.5" r="5"/></g></g><g fill="{{A}}" opacity=".75"><circle cx="294" cy="94" r="5"/><circle cx="120" cy="266" r="5"/><circle cx="142" cy="116" r="4"/><circle cx="244" cy="140" r="4"/></g><g stroke="{{S}}" stroke-width="1" opacity=".75"><g transform="translate(232 150)"><circle r="2.6" fill="none"/><path d="M0 0 L0 -6"/><path d="M0 0 L5 4"/><path d="M0 0 L-5 4"/></g><g transform="translate(190 198)"><circle r="2.4" fill="none"/><path d="M0 0 L0 -5"/><path d="M0 0 L4 3"/></g></g></svg>'
        },
        mountain: {
          name: "远山", repeat: "no-repeat", size: "72% auto", position: "center bottom",
          imageSrc: "motifs/mountain.png"
        },
        cloud: {
          name: "云纹", repeat: "repeat", size: "110px 74px", position: "center",
          colors: { stroke: "#24485c", fill: "#3f7b9b", accent: "#5a9bbc" },
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 100"><defs><filter id="b"><feGaussianBlur stdDeviation="2"/></filter></defs><g filter="url(#b)" fill="{{A}}" opacity=".24"><ellipse cx="48" cy="52" rx="34" ry="14"/><ellipse cx="102" cy="48" rx="30" ry="12"/></g><g fill="none" stroke="{{S}}" stroke-width="2.4" stroke-linecap="round" opacity=".82"><path d="M6 62 C22 36 50 36 64 56 C76 38 102 38 116 58 C130 50 142 56 148 66"/><path d="M20 78 C38 66 58 68 72 80 C90 66 114 70 132 82"/><path d="M38 52 C48 44 58 46 64 54"/><path d="M90 50 C100 42 110 46 116 54"/><path d="M8 88 C24 82 34 84 44 92"/><path d="M104 86 C116 78 128 80 138 90"/></g></svg>'
        },
        wave: {
          name: "水波", repeat: "repeat-x", size: "100% 64px", position: "center bottom",
          colors: { stroke: "#1f5063", fill: "#3b839c", accent: "#5fa6bd" },
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 90"><defs><filter id="b"><feGaussianBlur stdDeviation="2"/></filter></defs><g filter="url(#b)" fill="none" stroke="{{A}}" stroke-width="9" opacity=".24"><path d="M0 30 C40 12 80 48 120 30 C160 12 200 48 240 30 C280 12 320 48 360 30 C380 21 392 21 400 26"/></g><g fill="none" stroke="{{S}}" stroke-width="2.4" stroke-linecap="round" opacity=".82"><path d="M0 30 C40 12 80 48 120 30 C160 12 200 48 240 30 C280 12 320 48 360 30 C380 21 392 21 400 26"/><path d="M0 64 C40 46 80 82 120 64 C160 46 200 82 240 64 C280 46 320 82 360 64 C380 55 392 55 400 60"/><path d="M0 46 C40 28 80 64 120 46 C160 28 200 64 240 46 C280 28 320 64 360 46 C380 37 392 37 400 42"/><path d="M28 22 C36 14 48 14 56 22"/><path d="M208 22 C216 14 228 14 236 22"/><path d="M108 56 C116 48 128 48 136 56"/></g></svg>'
        },
        stars: {
          name: "星点", repeat: "repeat", size: "300px 300px", position: "center",
          imageSrc: "motifs/stars.png",
          colors: { stroke: "#6b5420", fill: "#c49a2e", accent: "#e0bd52" },
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 190"><defs><filter id="b"><feGaussianBlur stdDeviation="2.4"/></filter></defs><g filter="url(#b)" fill="{{A}}" opacity=".26"><circle cx="88" cy="78" r="9"/><circle cx="154" cy="108" r="7"/><circle cx="42" cy="84" r="6"/></g><g fill="{{F}}" opacity=".85"><circle cx="30" cy="36" r="2.2"/><circle cx="106" cy="24" r="2"/><circle cx="162" cy="54" r="2.2"/><circle cx="66" cy="116" r="1.8"/><circle cx="140" cy="142" r="2.2"/><circle cx="38" cy="158" r="2"/><circle cx="122" cy="170" r="1.8"/><circle cx="176" cy="126" r="1.8"/><circle cx="82" cy="48" r="1.8"/><path d="M88 60 L92 74 L106 78 L92 82 L88 96 L84 82 L70 78 L84 74Z"/><path d="M154 96 L157 104 L165 107 L157 110 L154 118 L151 110 L143 107 L151 104Z"/><path d="M42 72 L44 78 L50 80 L44 82 L42 88 L40 82 L34 80 L40 78Z"/><path d="M120 116 L122 122 L128 124 L122 126 L120 132 L118 126 L112 124 L118 122Z"/></g></svg>'
        },
        lotus: {
          name: "荷影", repeat: "no-repeat", size: "50% auto", position: "left bottom",
          imageSrc: "motifs/lotus.png",
          colors: { stroke: "#28452f", fill: "#c74461", accent: "#54865f" },
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"><defs><filter id="b"><feGaussianBlur stdDeviation="2.4"/></filter></defs><g filter="url(#b)" fill="{{A}}" opacity=".28"><path d="M30 340 C76 266 138 258 208 294 C158 328 88 344 30 340Z"/></g><g stroke="{{S}}" fill="none" stroke-linecap="round" opacity=".72"><path d="M96 300 C106 244 136 208 182 184" stroke-width="3"/><path d="M30 340 C78 268 140 260 208 294" stroke-width="2.4"/><path d="M58 322 C100 300 146 296 184 302" stroke-width="1.6" opacity=".65"/></g><g fill="{{F}}" opacity=".78"><path d="M182 184 C164 154 170 126 198 102 C204 136 198 164 182 184Z"/><path d="M182 184 C208 162 238 160 262 178 C234 196 206 198 182 184Z"/><path d="M182 184 C158 190 134 182 118 162 C148 156 172 168 182 184Z"/><path d="M182 184 C188 154 206 134 232 124 C226 156 208 176 182 184Z" opacity=".85"/><g transform="translate(-70 46) scale(.62)"><path d="M182 184 C164 154 170 126 198 102 C204 136 198 164 182 184Z"/><path d="M182 184 C208 162 238 160 262 178 C234 196 206 198 182 184Z"/><path d="M182 184 C158 190 134 182 118 162 C148 156 172 168 182 184Z"/></g></g></svg>'
        }
      };

      // ---------- 状态 ----------
      const state = {
        mode: "shi",
        shiIndex: 0,
        ciName: Object.keys(window.CIPU)[0] || "",
        values: [],   // 每句 -> 每段 -> 字符串
        yunKey: "词林正韵",
        theme: "default",
        bg: "1",
        fontUi: "yahei",
        fontPoem: "kai",
        printBg: "1",
        printStrength: 65,
        printMeta: true,
        printFontWeight: 400,
        printFontSize: 18,
        printLineHeight: 2.15,
        printLetterSpacing: 10,
        printAlign: "center",
        printLayout: "horizontal",
        printScript: "original",
        printPalette: "default",
        printInk: "#2b2b2b",
        printPaper: "#fffdf7",
        printMotif: "bamboo",
        printMotifStrength: 34,
        authorId: "",
        shiStrict: false   // 近体诗检测口径：false = 宽格（一三五不论，默认），true = 严格
      };
      const SAVE_KEY = "sc-app-state-v1";
      const WORKS_KEY = "wc-works-v1";

      function currentLines() {
        if (state.mode === "shi") {
          return window.SHI[state.shiIndex].lines.map(function (l) {
            return { parts: [l.pat], rhyme: l.rhyme, label: l.rhyme ? "韵" : "句" };
          });
        }
        const t = window.CIPU[state.ciName];
        if (!t) return [];
        return t.lines.map(function (l) {
          let label = l.rhyme ? "韵" : "句";
          return { parts: l.parts.slice(), rhyme: !!l.rhyme, label: label, src: l };
        });
      }

      function resetValues() {
        const lines = currentLines();
        state.values = lines.map(function (l) {
          return l.parts.map(function () { return ""; });
        });
      }

      function saveState() {
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        } catch (e) { /* ignore */ }
      }

      function loadState() {
        try {
          const s = JSON.parse(localStorage.getItem(SAVE_KEY));
          if (s && s.mode && window.SHI[s.shiIndex]) {
            state.mode = s.mode;
            state.shiIndex = s.shiIndex;
            if (window.CIPU[s.ciName]) state.ciName = s.ciName;
            if (Array.isArray(s.values)) state.values = s.values;
            if (s.yunKey === "中华新韵" || s.yunKey === "词林正韵") state.yunKey = s.yunKey;
            if (s.theme) state.theme = s.theme;
            if (s.bg) state.bg = s.bg;
            if (FONT_STACKS[s.fontUi]) state.fontUi = s.fontUi;
            if (FONT_STACKS[s.fontPoem]) state.fontPoem = s.fontPoem;
            if (["none", "1", "2", "3", "4", "5"].indexOf(s.printBg) !== -1) state.printBg = s.printBg;
            if (typeof s.printStrength === "number") {
              state.printStrength = Math.max(20, Math.min(100, Math.round(s.printStrength)));
            }
            if (typeof s.printMeta === "boolean") state.printMeta = s.printMeta;
            if (typeof s.printFontWeight === "number") {
              state.printFontWeight = Math.max(300, Math.min(900, Math.round(s.printFontWeight / 100) * 100));
            }
            if (typeof s.printFontSize === "number") {
              state.printFontSize = Math.max(12, Math.min(36, Math.round(s.printFontSize)));
            }
            if (typeof s.printLineHeight === "number") {
              state.printLineHeight = Math.max(1.2, Math.min(2.8, Math.round(s.printLineHeight * 10) / 10));
            }
            if (typeof s.printLetterSpacing === "number") {
              state.printLetterSpacing = Math.max(0, Math.min(30, Math.round(s.printLetterSpacing)));
            }
            if (["left", "center", "right"].indexOf(s.printAlign) !== -1) state.printAlign = s.printAlign;
            if (["horizontal", "vertical"].indexOf(s.printLayout) !== -1) state.printLayout = s.printLayout;
            if (["original", "s2t", "t2s"].indexOf(s.printScript) !== -1) state.printScript = s.printScript;
            if (PDF_PALETTES[s.printPalette]) state.printPalette = s.printPalette;
            if (typeof s.printInk === "string" && /^#[0-9a-fA-F]{6}$/.test(s.printInk)) state.printInk = s.printInk;
            if (typeof s.printPaper === "string" && /^#[0-9a-fA-F]{6}$/.test(s.printPaper)) state.printPaper = s.printPaper;
            if (PDF_MOTIFS[s.printMotif]) state.printMotif = s.printMotif;
            if (typeof s.printMotifStrength === "number") {
              state.printMotifStrength = Math.max(5, Math.min(60, Math.round(s.printMotifStrength)));
            }
            if (typeof s.authorId === "string") state.authorId = s.authorId;
            if (typeof s.shiStrict === "boolean") state.shiStrict = s.shiStrict;
          }
        } catch (e) { /* ignore */ }
      }

      // ---------- 渲染：选择区 ----------
      function renderSelects() {
        const shiSel = $("shi-select");
        shiSel.innerHTML = "";
        window.SHI.forEach(function (s, i) {
          const o = document.createElement("option");
          o.value = i;
          o.textContent = s.name;
          shiSel.appendChild(o);
        });
        shiSel.value = state.shiIndex;

        const tuneSel = $("tune-select");
        tuneSel.innerHTML = "";
        ["平韵格", "仄韵格", "平仄转换", "平仄通叶"].forEach(function (g) {
          const names = window.CIPU_GROUPS[g] || [];
          if (!names.length) return;
          const og = document.createElement("optgroup");
          og.label = g + "（" + names.length + "首）";
          names.forEach(function (n) {
            const t = window.CIPU[n];
            const o = document.createElement("option");
            o.value = n;
            o.textContent = n + " │ " + t.total + "字";
            o.dataset.group = g;
            og.appendChild(o);
          });
          tuneSel.appendChild(og);
        });
        if (state.ciName && window.CIPU[state.ciName]) {
          tuneSel.value = state.ciName;
        } else {
          state.ciName = tuneSel.options[0].value;
        }
      }

      function applyTuneSearch(q) {
        const tuneSel = $("tune-select");
        let count = 0;
        Array.prototype.forEach.call(tuneSel.options, function (o) {
          const hit = !q || o.text.indexOf(q) !== -1 || o.value.indexOf(q) !== -1;
          o.hidden = !hit;
          if (hit && !o.disabled) count++;
        });
        if (count === 0) {
          toast("没有匹配的词牌");
        }
      }

      function modeLabel() {
        return state.mode === "shi" ? "诗" : "词";
      }

      function renderMeta() {
        const el = $("meta-line");
        if (state.mode === "shi") {
          const s = window.SHI[state.shiIndex];
          el.innerHTML = "体裁：<b>近体诗 │ " + esc(s.name) + "</b>　│　" +
            (s.style === "五绝" ? "四句二十字" : s.style === "七绝" ? "四句二十八字" :
              s.style === "五律" ? "八句四十字" : "八句五十六字") +
            "　│　偶句押平声韵" + (/入韵/.test(s.name) ? "，首句入韵" : "，首句可不入韵") +
            "　│　平仄按《" + yunLabel() + "》" +
            (yunKey === "中华新韵" ? "（普通话，无入声）" : "（与平水韵一致）");
        } else {
          const t = window.CIPU[state.ciName];
          if (!t) return;
          const modeName = { "平": "平韵格", "仄": "仄韵格", "转": "平仄转换", "叶": "平仄通叶" }[t.mode] || "";
          el.innerHTML = "词牌：<b>《" + esc(state.ciName) + "》</b>　│　" + esc(t.total) + "字 │ " +
            t.lines.length + "句" + (t.split ? "（双调）" : "（单调）") +
            "　│　韵式：<b>" + linkTerms(esc(modeName)) + "</b>" +
            (t.note ? "　│　<span class='tune-note'>" + esc(t.note) + "</span>" : "") +
            "　│　平仄押韵按《" + yunLabel() + "》" +
            "　│　谱源：" + esc(t.source || "《唐宋词格律》") +
            (t.curated ? "" : "（韵脚为谱面标注，供参考）");
        }
      }

      // ---------- 渲染：编辑器 ----------
      function patternHtml(pat) {
        let html = "<div class='pattern-row'>";
        for (let i = 0; i < pat.length; i++) {
          const ch = pat[i];
          const cls = ch === "平" ? "ping" : ch === "仄" ? "ze" : ch === "去" ? "qu" : "zhong";
          const txt = ch === "去" ? "去" : ch;
          html += "<span class='pat-cell " + cls + "'>" + txt + "</span>";
        }
        return html + "</div>";
      }

      function toneCellHtml(ch, req) {
        if (!ch) return "<span class='tone-cell'></span>";
        const info = infoOf(ch);
        if (!info.readings.length) {
          return "<span class='tone-cell'><span class='t unknown'>？</span></span>";
        }
        // 多音字：多个读音的平仄竖向排列，逐个标注是否合律
        let html = "<span class='tone-cell'>";
        info.tones.forEach(function (t) {
          let cls;
          if (req === "中") cls = "neutral";
          else if (req === "平") cls = t === "平" ? "ok" : "bad";
          else if (req === "去") cls = (yunKey === "中华新韵" ? t === "仄" : t === "去") ? "ok" : "bad";
          else cls = t !== "平" ? "ok" : "bad";
          html += "<span class='t " + cls + "'>" + t + "</span>";
        });
        return html + "</span>";
      }

      function renderEditor() {
        const body = $("editor-body");
        const lines = currentLines();
        const tune = state.mode === "ci" ? window.CIPU[state.ciName] : null;
        if (!lines.length) {
          body.innerHTML = "<div class='empty'>暂无谱式</div>";
          return;
        }
        // 保证 values 结构
        state.values = lines.map(function (l, i) {
          const cur = state.values[i] || [];
          return l.parts.map(function (_, j) { return cur[j] || ""; });
        });

        let html = "";
        lines.forEach(function (line, li) {
          if (tune && tune.split > 0 && li === tune.split) {
            html += "<div style='text-align:center;color:var(--gold);font-size:14px;letter-spacing:6px;padding:6px 0;'>—— 下 阕 ——</div>";
          }
          html += "<div class='line'>";
          html += "<div class='line-no'>" + (li + 1) + "</div>";
          const badgeCls = line.rhyme ? "yun" : "ju";
          html += "<div class='badge " + badgeCls + "'>" + (line.rhyme ? "韵" : "句") + "</div>";
          html += "<div class='segments'>";
          line.parts.forEach(function (pat, pi) {
            const val = state.values[li][pi];
            const isRhymeSeg = line.rhyme && pi === line.parts.length - 1;
            let tones = "";
            for (let k = 0; k < pat.length; k++) {
              tones += toneCellHtml(val[k] || "", pat[k]);
            }
            html += "<div class='seg'>";
            html += patternHtml(pat);
            html += "<input type='text' maxlength='" + pat.length + "' " +
              "data-li='" + li + "' data-pi='" + pi + "' value='" + esc(val) + "'" +
              (isRhymeSeg ? " class='rhyme-input'" : "") + " placeholder='" + "　".repeat(pat.length) + "' autocomplete='off'" +
              " style='width:calc(var(--cell) * " + pat.length + ")'>";
            html += "<div class='tones-row'>" + tones + "</div>";
            html += "</div>";
            if (pi < line.parts.length - 1) html += "<span class='dou'>、</span>";
          });
          html += "</div></div>";
        });
        body.innerHTML = html;
        attachInputHandlers();
      }

      function attachInputHandlers() {
        document.querySelectorAll("#editor-body input[data-li]").forEach(function (inp) {
          inp.addEventListener("keydown", function (e) {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const all = Array.prototype.slice.call(document.querySelectorAll("#editor-body input[data-li]"));
            const idx = all.indexOf(inp);
            const next = all[idx + 1];
            if (next) {
              next.focus();
              next.select();
            } else {
              inp.blur();
            }
          });
          inp.addEventListener("input", function () {
            const li = +inp.dataset.li;
            const pi = +inp.dataset.pi;
            state.values[li][pi] = inp.value;
            // 原位刷新该字格的平仄标注，避免输入框失焦
            const pat = currentLines()[li].parts[pi];
            const tonesEl = inp.parentElement.querySelector(".tones-row");
            if (tonesEl) {
              let tones = "";
              for (let k = 0; k < pat.length; k++) {
                tones += toneCellHtml(inp.value[k] || "", pat[k]);
              }
              tonesEl.innerHTML = tones;
            }
            scheduleSave(400);
            scheduleReport(250);
            updateLastYunFromEditor();
          });
        });
      }

      let renderTimer = null, saveTimer = null;
      let reportTimer = null;
      function scheduleSave(ms) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveState, ms);
      }
      function scheduleReport(ms) {
        clearTimeout(reportTimer);
        reportTimer = setTimeout(renderReport, ms);
      }

      // ---------- 检测 ----------
      // 近体诗检测口径：wide = 宽格（一三五不论，通行做法，默认）；strict = 严格（中以外每格都要合）
      // 词不适用此口径（词谱的「中」本身就是谱面规定），故仅在 mode === "shi" 时生效
      function shiStrictMode() {
        return state.mode === "shi" && state.shiStrict === true;
      }

      function buildReport() {
        const lines = currentLines();
        const problems = [];          // 计入口径内的出律
        const relaxed = [];           // 严格口径下才算出律的放宽位（宽格时仅提示）
        let filled = 0, correct = 0;
        const strict = shiStrictMode();
        lines.forEach(function (line, li) {
          const pat = line.parts.join("");
          const text = (state.values[li] || []).join("");
          for (let ci = 0; ci < pat.length; ci++) {
            const req = pat[ci];
            const ch = text[ci];
            if (!ch) continue;
            if (req === "中") continue;
            const r = checkTone(ch, req);
            const isFree = state.mode === "shi" && shiFreePos(pat.length, ci);
            if (!strict && state.mode === "shi" && isFree) {
              // 宽格：放宽位不计入合格率（谱面上这些位置常写作「中」），但记录以便提示
              if (r.ok === false) relaxed.push({ li: li, ci: ci, ch: ch, req: req });
              continue;
            }
            filled++;
            if (r.ok) correct++;
            else if (r.ok === false) {
              problems.push({ li: li, ci: ci, ch: ch, req: req, free: isFree });
            }
          }
        });
        const pct = filled ? Math.round(correct / filled * 100) : null;
        return {
          problems: problems, relaxed: relaxed, pct: pct, filled: filled, correct: correct,
          strict: strict,
          totalChars: lines.reduce(function (n, l) { return n + l.parts.join("").length; }, 0)
        };
      }

      function lastCharOf(li) {
        const text = (state.values[li] || []).join("");
        return text[text.length - 1] || "";
      }

      function rhymeGroupsCi() {
        const t = window.CIPU[state.ciName];
        const lines = currentLines();
        const idx = [];
        lines.forEach(function (l, i) { if (l.rhyme) idx.push(i); });
        const groups = [];
        let cur = null;
        idx.forEach(function (i) {
          const pat = lines[i].parts.join("");
          const lastReq = pat[pat.length - 1];
          const tone = lastReq === "平" ? "平" : (lastReq === "中" ? "中" : "仄");
          if (t.mode === "叶") {
            if (!cur) { cur = { tone: "叶", lines: [] }; groups.push(cur); }
            cur.lines.push(i);
          } else {
            if (!cur || cur.tone !== tone) { cur = { tone: tone, lines: [] }; groups.push(cur); }
            cur.lines.push(i);
          }
        });
        return groups;
      }

      function charCats(ch) {
        const rs = readingsOf(ch);
        return {
          cats: new Set(rs.map(function (r) { return catOfTone(r.tone); })),
          bus: new Set(rs.map(function (r) { return r.bu; })),
          rs: rs
        };
      }

      function groupVerdict(g, isYe) {
        const entries = g.lines.map(function (i) {
          return { li: i, ch: lastCharOf(i), info: charCats(lastCharOf(i)) };
        });
        const filled = entries.filter(function (e) { return e.ch && e.info.rs.length; });
        const unknown = entries.filter(function (e) { return e.ch && !e.info.rs.length; });
        const empty = entries.filter(function (e) { return !e.ch; });
        if (!filled.length) return { status: "empty", entries: entries };
        if (filled.length === 1 && empty.length) return { status: "partial", entries: entries };

        const ref = filled[0];
        const refInfo = ref.info;
        const badList = [];
        filled.slice(1).forEach(function (e) {
          let buOk = false, catOk = false;
          e.info.bus.forEach(function (b) { if (refInfo.bus.has(b)) buOk = true; });
          if (isYe) {
            // 平仄通叶：平/上/去 互叶，入声独用
            e.info.cats.forEach(function (c) {
              refInfo.cats.forEach(function (rc) {
                if ((c === "入" && rc === "入") || (c !== "入" && rc !== "入")) catOk = true;
              });
            });
          } else {
            e.info.cats.forEach(function (c) {
              if (refInfo.cats.has(c)) catOk = true;
            });
          }
          if (!buOk || !catOk) badList.push(e);
        });
        if (badList.length) return { status: "bad", entries: entries, bad: badList };
        return { status: "ok", entries: entries };
      }

      function describeReading(rs) {
        if (!rs.length) return "未收录";
        const parts = rs.map(function (r) {
          return "第" + r.bu + "部·" + r.tone + "声(" + r.yunName + ")";
        });
        return parts.join("；");
      }

      function firstReadable(entries) {
        for (const e of entries) {
          if (e.ch && e.info.rs.length) return e.info.rs[0];
        }
        return null;
      }

      function renderReport() {
        const body = $("report-body");
        const r = buildReport();
        let html = "";
        const scoreColor = r.pct === null ? "var(--gray)" : r.pct >= 90 ? "var(--green)" : r.pct >= 70 ? "#c07f2a" : "var(--red)";
        html += "<div class='score-wrap'>";
        html += "<div class='score-bar'><div class='fill' style='width:" + (r.pct === null ? 0 : r.pct) + "%;background:" + scoreColor + "'></div></div>";
        html += "<div class='score-num' style='color:" + scoreColor + "'>" +
          (r.pct === null ? "—" : r.pct + "%") + "</div>";
        html += "<div class='hint'>已填 " + r.filled + " 处定式平仄，合格 " + r.correct + " 处" +
          "（可平可仄之位不计）" +
          (state.mode === "shi"
            ? "　│　口径：<b>" + (r.strict ? linkTerms("严格") : linkTerms("宽格")) + "</b>" +
              "<button class='fix-btn' data-shi-tone='" + (r.strict ? "0" : "1") + "'>" +
              (r.strict ? "切回宽格" : "改用严格") + "</button>"
            : "") +
          "</div></div>";

        if (r.problems.length) {
          html += "<h3 style='color:var(--red);margin-top:6px'>出律提示</h3>";
          html += "<div class='hint'>点「换字」可按该格要求的平仄（韵脚还需同韵）挑替换字，点候选字即就地替换。</div>";
          html += "<ul class='issue-list'>";
          r.problems.slice(0, 12).forEach(function (p) {
            const info = infoOf(p.ch);
            const label = p.req === "去" ? "去声" : p.req;
            html += "<li>第" + (p.li + 1) + "句第" + (p.ci + 1) + "字「" + esc(p.ch) + "」应为" + label +
              "，实为" + (info.toneLabel || "未收录") + "（" + esc(describeReading(info.readings)) + "）" +
              "<button class='fix-btn' data-fix='" + p.li + "," + p.ci + "'>换字</button>" +
              "<div class='suggest-box fix-box' id='fix-" + p.li + "-" + p.ci + "'></div></li>";
          });
          if (r.problems.length > 12) html += "<li>…共 " + r.problems.length + " 处</li>";
          html += "</ul>";
        } else if (r.filled > 0) {
          html += "<div class='hint' style='color:var(--green)'>✓ 定式平仄全部合律</div>";
        }

        // 宽格下被放宽的位置：如实列出，供切到「严格」时核对（如「朝辞白帝彩云间」的「彩」）
        if (r.relaxed && r.relaxed.length) {
          html += "<div class='hint' style='color:#8a7a4f'>放宽位 " + r.relaxed.length + " 处（" +
            linkTerms("一三五不论") + "范围，宽格不计入出律）：" +
            r.relaxed.slice(0, 8).map(function (p) {
              return "第" + (p.li + 1) + "句第" + (p.ci + 1) + "字「" + esc(p.ch) + "」应" +
                (p.req === "去" ? "去声" : p.req);
            }).join("；") + (r.relaxed.length > 8 ? " …" : "") + "</div>";
        }

        // 诗病检查（仅近体诗）
        if (state.mode === "shi") html += shiIssuesHtml();

        // 押韵
        html += "<h3 style='margin-top:12px'>押韵检测</h3>";
        if (state.mode === "shi") {
          html += shiRhymeHtml();
        } else {
          html += ciRhymeHtml();
        }
        body.innerHTML = html || "<div class='hint'>—</div>";
        attachReportHandlers();
        // 格律口径切换
        document.querySelectorAll("[data-shi-tone]").forEach(function (btn) {
          btn.onclick = function () {
            state.shiStrict = btn.dataset.shiTone === "1";
            renderReport();
            saveState();
            toast(state.shiStrict ? "已切换到「严格」口径：中以外每格都要合律" : "已切换到「宽格」口径：一三五不论");
          };
        });
      }

      // ---------- 出律字换字建议 ----------
      // 拼接文本下标 → (段号, 段内偏移)，与 buildReport 的下标口径一致
      function lineIndexMap(li) {
        const vals = state.values[li] || [];
        const map = [];
        vals.forEach(function (s, pi) {
          const str = s || "";
          for (let k = 0; k < str.length; k++) map.push({ pi: pi, off: k });
        });
        return map;
      }

      function setLineChar(li, ci, ch) {
        const pos = lineIndexMap(li)[ci];
        if (!pos) return false;
        const vals = state.values[li];
        const seg = vals[pos.pi] || "";
        vals[pos.pi] = seg.slice(0, pos.off) + ch + seg.slice(pos.off + 1);
        return true;
      }

      // 临时替换某字后执行 fn，再还原（用于"试填后看是否还押韵"）
      function trialReplace(li, ci, ch, fn) {
        const pos = lineIndexMap(li)[ci];
        if (!pos) return fn();
        const vals = state.values[li];
        const old = vals[pos.pi] || "";
        vals[pos.pi] = old.slice(0, pos.off) + ch + old.slice(pos.off + 1);
        let out;
        try { out = fn(); } finally { vals[pos.pi] = old; }
        return out;
      }

      // 试填后，押韵结论是否仍不出韵（复用界面同一套判定，保证与检测面板一致）
      function charKeepsRhyme(li, ci, ch) {
        return trialReplace(li, ci, ch, function () {
          if (state.mode === "shi") return shiRhymeHtml().indexOf("✗") === -1;
          const groups = rhymeGroupsCi();
          for (let i = 0; i < groups.length; i++) {
            if (groups[i].lines.indexOf(li) === -1) continue;
            return groupVerdict(groups[i], groups[i].tone === "叶").status !== "bad";
          }
          return true;
        });
      }

      function workUsedChars() {
        const set = new Set();
        (state.values || []).forEach(function (row) {
          (row || []).forEach(function (seg) {
            (seg || "").split("").forEach(function (c) { if (c) set.add(c); });
          });
        });
        return set;
      }

      // 候选字常用度分档：0 = 300 常用字，1 = 出现在常用词 / 诗语词中，2 = 其余生僻字
      let wordCharRankCache = null;
      function wordCharRank() {
        if (wordCharRankCache) return wordCharRankCache;
        const map = new Map();
        function add(list) {
          (list || []).forEach(function (w) {
            (w || "").split("").forEach(function (c) {
              if (c && !map.has(c)) map.set(c, map.size);
            });
          });
        }
        add(window.COMMON_WORDS);
        add(SHICI_WORDS);
        wordCharRankCache = map;
        return map;
      }

      function fixRank(ch) {
        const i = window.COMMON_CHARS.indexOf(ch);
        if (i !== -1) return { tier: 0, rank: i };
        const w = wordCharRank().get(ch);
        if (w !== undefined) return { tier: 1, rank: w };
        return { tier: 2, rank: 0 };
      }

      function fixSuggest(li, ci) {
        const lines = currentLines();
        const line = lines[li];
        if (!line) return [];
        const pat = line.parts.join("");
        const req = pat[ci];
        if (!req) return [];
        const cur = (state.values[li] || []).join("")[ci] || "";
        const isRhymeCell = !!line.rhyme && ci === pat.length - 1;
        const used = workUsedChars();
        const dict = yunChars();
        const pool = [];
        for (const ch in dict) {
          if (ch === cur) continue;
          const r = checkTone(ch, req);
          if (r.ok !== true) continue;
          const fr = fixRank(ch);
          pool.push({ ch: ch, tier: fr.tier, rank: fr.rank, info: r.info, used: used.has(ch) });
        }
        pool.sort(function (a, b) {
          if (a.used !== b.used) return a.used ? 1 : -1;
          if (a.tier !== b.tier) return a.tier - b.tier;
          return a.rank - b.rank;
        });
        const out = [];
        for (let i = 0; i < pool.length && out.length < 48; i++) {
          if (isRhymeCell && !charKeepsRhyme(li, ci, pool[i].ch)) continue;
          out.push(pool[i]);
        }
        return out;
      }

      function openFixBox(btn) {
        const parts = (btn.dataset.fix || "").split(",");
        const li = +parts[0], ci = +parts[1];
        const box = document.getElementById("fix-" + li + "-" + ci);
        if (!box) return;
        if (box.classList.contains("show")) { box.classList.remove("show"); return; }
        const lines = currentLines();
        const pat = lines[li] ? lines[li].parts.join("") : "";
        const req = pat[ci];
        const reqLabel = req === "去" ? "去声" : req;
        const isRhymeCell = !!(lines[li] && lines[li].rhyme && ci === pat.length - 1);
        const cands = fixSuggest(li, ci);
        if (!cands.length) {
          box.innerHTML = "<div class='hint'>没找到合适的替换字（该格要求「" + esc(reqLabel) +
            "」" + (isRhymeCell ? "，且须与同组韵脚同韵" : "") + "）。可先补全韵脚，或换个写法。</div>";
        } else {
          box.innerHTML = "<div class='hint'>该格须「" + esc(reqLabel) + "」" +
            (isRhymeCell ? "，且与同组韵脚押韵" : "") + "；按常用度排序：常用字在前，浅色表示该字已在作品中用过。</div>" +
            cands.map(function (c) {
              return "<span class='fx" + (c.used ? " used" : "") + "' data-fx-li='" + li + "' data-fx-ci='" + ci +
                "' title='" + esc(describeReading(c.info.readings)) + "'>" + esc(c.ch) + "</span>";
            }).join("");
        }
        box.classList.add("show");
      }

      // ---------- 诗病检查（近体诗） ----------
      // 覆盖：二四六分明 / 孤平 / 三平尾 / 三仄尾 / 失对 / 失粘 / 拗救句式 /
      //       上尾 / 鹤膝 / 大韵小韵 / 旁纽正纽 / 合掌（结构提示）
      // 单字平仄归类："平"、"仄"、"两读"（平仄两读）、"?"（未收录）
      function toneClassOf(ch) {
        const info = infoOf(ch);
        if (!info.readings.length) return "?";
        if (info.hasPing && info.hasZe) return "两读";
        return info.hasPing ? "平" : "仄";
      }

      function shiLineText(li) {
        return (state.values[li] || []).join("").replace(/\s+/g, "");
      }

      // 结合"该格要求"判定该字实际读作平还是仄：
      // 格要求平/仄时，只要有对应读音就按该读音算（多音字从宽）；格为「中」且字两读时不可判（返回 null）
      function toneAt(ch, req) {
        const info = infoOf(ch);
        if (!info.readings.length) return null;
        if (req === "平") return info.hasPing ? "平" : "仄";
        if (req === "仄" || req === "去") return info.hasZe ? "仄" : "平";
        if (info.hasPing && info.hasZe) return null;
        return info.hasPing ? "平" : "仄";
      }

      // 「一三五不论」放宽位：返回该格是否属于可放宽的位置（五言 1、3 位；七言 1、3、5 位，0 起）
      function shiFreePos(len, k) {
        if (len === 5) return k === 0 || k === 2;
        if (len === 7) return k === 0 || k === 2 || k === 4;
        return false;
      }

      // 该字在「本句这个位置」实际读平还是读仄（用于二四六 / 粘对等以「实际平仄」为准的判定）
      function shiActualTone(ch) {
        const t = toneClassOf(ch);
        return (t === "平" || t === "仄") ? t : null;
      }

      // 近体诗定式平仄：把「中」按本句的实际用字还原成具体平仄，供诗病判定使用
      function shiRealPattern(li) {
        const lines = currentLines();
        const line = lines[li];
        if (!line) return "";
        const text = shiLineText(li);
        let out = "";
        for (let k = 0; k < line.parts.join("").length; k++) {
          const req = line.parts.join("")[k];
          const ch = text[k] || "";
          if (!ch) { out += "中"; continue; }
          const t = toneAt(ch, req);
          out += (t === "平" || t === "仄") ? t : (req === "中" ? "中" : req);
        }
        return out;
      }

      function shiIssues() {
        const lines = currentLines();
        const issues = [];
        let anyChar = false;

        // ---------- 逐句：拗救 / 三平尾 / 三仄尾 / 孤平 ----------
        lines.forEach(function (line, li) {
          const text = shiLineText(li);
          if (!text) return;
          anyChar = true;
          const n = text.length;
          if (n < 3) return;
          const cls = text.split("").map(toneClassOf);
          if (cls.indexOf("?") !== -1) return;   // 含未收录字，本句跳过
          const no = li + 1;
          const pat = line.parts.join("");
          const rt = cls.map(function (c, i) { return toneAt(text[i], pat[i] || "中"); });

          // 常见拗救句式：五言「平平仄平仄」、七言「仄仄平平仄平仄」（第 3/5 字拗、第 4/6 字救）
          if (n === 5 || n === 7) {
            const seg = rt.slice(n - 5);
            if (seg.indexOf(null) === -1 && seg[0] === "平" && seg.slice(1).join("") === "平仄平仄") {
              issues.push({ level: "info", text: "第" + no + "句「" + text + "」是常见的拗救句式（第" +
                (n === 5 ? "3" : "5") + "字拗、第" + (n === 5 ? "4" : "6") + "字救），可按合律看待。" });
            }
          }

          // 本句对句「救」的判定：上句第 k 字拗（该平而仄），对句第 k 字改用平声即「救」
          const tail3 = text.slice(n - 3);
          const tailTones = rt.slice(n - 3);
          if (tailTones.indexOf(null) === -1) {
            if (tailTones.every(function (t) { return t === "平"; })) {
              issues.push({ level: "bad", text: "第" + no + "句末三字「" + tail3 +
                "」全平，是三平尾——近体诗大忌，韵句尤其要避免。" });
            } else if (tailTones.every(function (t) { return t === "仄"; })) {
              issues.push({ level: "warn", text: "第" + no + "句末三字「" + tail3 +
                "」全仄，是三仄尾——上句尚可容忍，韵句宜避免。" });
            }
          }

          // 孤平：只在平收的入韵句判定（除韵脚外无平声，或唯一平声与韵脚不相连）
          if (line.rhyme) {
            const body = text.slice(0, n - 1).split("");
            const pingIdx = [];
            body.forEach(function (c, i) {
              const info = infoOf(c);
              if (info.hasPing) pingIdx.push(i);   // 可平即可充当"平声"，两读字从宽
            });
            let lone = false, why = "";
            if (!pingIdx.length) {
              lone = true;
              why = "除韵脚外全句无平声";
            } else if (pingIdx.length === 1 && pingIdx[0] !== n - 2) {
              lone = true;
              why = "除韵脚「" + text[n - 1] + "」外只有「" + text[pingIdx[0]] + "」一个平声，且与韵脚不相连";
            }
            if (lone) {
              issues.push({ level: "bad", text: "第" + no + "句犯孤平（" + why + "）。补救：把第" +
                (n === 5 ? "3" : "5") + "字改用平声，成「" + (n === 5 ? "仄平平仄平" : "仄仄仄平平仄平") +
                "」；也可用上方出律提示里的「换字」挑平声字。" });
            }
          }
        });

        // ---------- 粘对 + 二四六分明 ----------
        // 以每句第二字判起式，同时检查第 4、6 字的平仄是否「分明」
        function secondTone(li) {
          const text = shiLineText(li);
          if (text.length < 2) return null;
          const t = toneClassOf(text[1]);
          return (t === "平" || t === "仄") ? { t: t, ch: text[1] } : null;
        }

        // 二四六分明：七言第 2/4/6 字、五言第 2/4 字必须分明 ——
        //   「对」：同一联的 出句(1)与对句(2) 同位应平仄相反；
        //   「粘」：上一联的对句(2) 与 下一联的出句(3) 同位应平仄相同（第 2 句粘第 3 句、第 4 句粘第 5 句…）
        // 注意：不是「第 2 句比第 4 句」——那是隔联，不构成粘对关系。
        lines.forEach(function (line, li) {
          const text = shiLineText(li);
          const n = text.length;
          if (n !== 5 && n !== 7) return;
          const evenPos = n === 5 ? [1, 3] : [1, 3, 5];
          // 只在不涉及「一三五不论」的偶位上检查（第 2 字另由失对/失粘统一判定，此处跳过以免重复）
          for (let e = 1; e < evenPos.length; e++) {
            const k = evenPos[e];
            const ch = text[k];
            const t = ch ? shiActualTone(ch) : null;
            if (!t) continue;
            const isJuzi = li % 2 === 0;        // true = 出句（第 1、3、5… 句）
            if (isJuzi) {
              // 对：与同联对句同位相反
              const pair = li + 1;
              if (pair >= lines.length) continue;
              const other = shiLineText(pair)[k] || "";
              const ot = other ? shiActualTone(other) : null;
              if (!ot) continue;
              if (t === ot) {
                issues.push({
                  level: "warn", text: "第" + (li + 1) + "、第" + (pair + 1) + "句第" + (k + 1) +
                    "字同为「" + t + "」（" + ch + "／" + other + "）：同一联这两句的第" + (k + 1) +
                    "字本应平仄相反（" + linkTerms("二四六分明") + "）。"
                });
              }
            } else {
              // 粘：与下一联出句（li+1）同位相同
              const next = li + 1;
              if (next >= lines.length) continue;
              const other = shiLineText(next)[k] || "";
              const ot = other ? shiActualTone(other) : null;
              if (!ot) continue;
              if (t !== ot) {
                issues.push({
                  level: "warn", text: "第" + (li + 1) + "、第" + (next + 1) + "句第" + (k + 1) +
                    "字一「" + t + "」一「" + ot + "」（" + ch + "／" + other + "）：相粘的两句第" + (k + 1) +
                    "字应平仄相同（" + linkTerms("二四六分明") + "）。"
                });
              }
            }
          }
        });

        for (let li = 0; li + 1 < lines.length; li += 2) {
          const a = secondTone(li), b = secondTone(li + 1);
          if (!a || !b) continue;
          if (a.t === b.t) {
            issues.push({ level: "bad", text: "第" + (li + 1) + "、第" + (li + 2) + "句第二字同为「" + a.t +
              "」（" + a.ch + "／" + b.ch + "）：本联失对，同联两句第二字应平仄相反。" });
          }
        }
        for (let li = 1; li + 1 < lines.length; li += 2) {
          const a = secondTone(li), b = secondTone(li + 1);
          if (!a || !b) continue;
          if (a.t !== b.t) {
            issues.push({ level: "bad", text: "第" + (li + 1) + "、第" + (li + 2) + "句第二字一「" + a.t +
              "」一「" + b.t + "」（" + a.ch + "／" + b.ch + "）：失粘，上联对句与下联出句第二字应平仄相同。" });
          }
        }
        // 粘对多处不合，多半是选错了起式
        const nZhan = issues.filter(function (it) {
          return it.text.indexOf("失对") !== -1 || it.text.indexOf("失粘") !== -1;
        }).length;
        if (nZhan >= 2) {
          issues.push({ level: "info", text: "粘对有多处不合，常见原因是选错了起式——可试试同一体裁（如五绝）下的另一种格式（平起／仄起、首句入韵／不入韵）。也有可能是「折腰体」：第三句故意失粘而意脉不断，唐人绝句中的特例。" });
        }

        // ---------- 上尾（上句末字连用上声）/ 鹤膝（上句末字连用同声） ----------
        // 近体诗上句（非韵句）末字本用仄声，且相邻两上句末字宜避免同声调
        const nonRhymeEnds = [];
        lines.forEach(function (line, li) {
          if (line.rhyme) return;
          const text = shiLineText(li);
          if (!text) return;
          const ch = text[text.length - 1];
          const rs = readingsOf(ch);
          if (!rs.length) return;
          nonRhymeEnds.push({ li: li, ch: ch, tones: rs.map(function (r) { return r.tone; }) });
        });
        for (let i = 0; i + 1 < nonRhymeEnds.length; i += 1) {
          const a = nonRhymeEnds[i], b = nonRhymeEnds[i + 1];
          if (b.li !== a.li + 2) continue;   // 只比相邻两联的上句
          const bothShang = a.tones.indexOf("上") !== -1 && a.tones.every(function (t) { return t === "上"; }) &&
            b.tones.indexOf("上") !== -1 && b.tones.every(function (t) { return t === "上"; });
          if (bothShang) {
            issues.push({ level: "info", text: "第" + (a.li + 1) + "句与第" + (b.li + 1) + "句末字「" + a.ch +
              "」「" + b.ch + "」都用上声，属「" + linkTerms("上尾") + "」之忌（宋以后已多有通融，可留意不必强改）。" });
          }
        }

        // ---------- 重字（非叠字、非有意复说的字重复） ----------
        const charCount = {};
        const charPos = {};
        const all = [];
        lines.forEach(function (line, li) {
          const text = shiLineText(li);
          for (let k = 0; k < text.length; k++) {
            const ch = text[k];
            if (!ch || !/[\u3400-\u9fff]/.test(ch)) continue;
            all.push({ ch: ch, li: li, k: k, text: text, k2: k });
            charCount[ch] = (charCount[ch] || 0) + 1;
            (charPos[ch] = charPos[ch] || []).push({ li: li, k: k });
          }
        });
        const dup = [];
        Object.keys(charCount).forEach(function (ch) {
          if (charCount[ch] < 2) return;
          // 叠字（相邻重复）视为允许
          const pos = charPos[ch];
          let allAdjacent = true;
          for (let i = 0; i + 1 < pos.length; i++) {
            const a = pos[i], b = pos[i + 1];
            if (!(a.li === b.li && b.k === a.k + 1)) allAdjacent = false;
          }
          if (allAdjacent) return;
          dup.push({ ch: ch, n: charCount[ch], pos: pos });
        });
        dup.sort(function (a, b) { return b.n - a.n; });
        if (dup.length) {
          const top = dup.slice(0, 6);
          issues.push({
            level: "info",
            text: "重字：" + top.map(function (d) { return "「" + d.ch + "」" + d.n + " 次"; }).join("、") +
              "。" + linkTerms("重字") + "在律绝中一般要避免（有意复说、叠字除外），可考虑换字。"
          });
        }

        // ---------- 合掌（仅提示）：同一联两句用同义 / 同类词对举 ----------
        const DUIPIN = [
          ["孤", "独"], ["千", "万"], ["来", "至"], ["往", "还"], ["朝", "晨"], ["暮", "晚"],
          ["视", "看"], ["听", "闻"], ["啼", "鸣"], ["悲", "哀"], ["喜", "欢"], ["高", "峻"]
        ];
        lines.forEach(function (line, li) {
          if (li % 2 !== 0) return;               // 只看每联出句
          const a = shiLineText(li), b = shiLineText(li + 1);
          if (!a || !b) return;
          const hit = [];
          DUIPIN.forEach(function (pair) {
            if (a.indexOf(pair[0]) !== -1 && b.indexOf(pair[1]) !== -1) hit.push("「" + pair[0] + "」／「" + pair[1] + "」");
            if (a.indexOf(pair[1]) !== -1 && b.indexOf(pair[0]) !== -1) hit.push("「" + pair[1] + "」／「" + pair[0] + "」");
          });
          if (hit.length) {
            issues.push({ level: "info", text: "第" + (li + 1) + "、第" + (li + 2) + "句出现" + hit.join("、") +
              "，可能是" + linkTerms("合掌") + "（两句意思重复），可检查对仗是否过于同义。" });
          }
        });

        return { issues: issues, anyChar: anyChar };
      }

      const SHI_ISSUE_ORDER = { bad: 0, warn: 1, info: 2 };

      function shiIssuesHtml() {
        const r = shiIssues();
        if (!r.anyChar) return "";
        let html = "<h3 style='margin-top:12px'>诗病检查</h3>";
        html += "<div class='hint'>" + linkTerms("查孤平、三平尾、三仄尾、失对、失粘、二四六分明、上尾、重字、合掌（两读字与未收录字不计）。") + "</div>";
        if (!r.issues.length) {
          return html + "<div class='hint' style='color:var(--green)'>✓ 未见诗病</div>";
        }
        r.issues.sort(function (a, b) { return SHI_ISSUE_ORDER[a.level] - SHI_ISSUE_ORDER[b.level]; });
        html += "<ul class='issue-list'>";
        r.issues.forEach(function (it) {
          const color = it.level === "bad" ? "var(--red)" : it.level === "warn" ? "#c07f2a" : "var(--gray)";
          const icon = it.level === "bad" ? "✗" : it.level === "warn" ? "△" : "○";
          html += "<li style='color:" + color + "'>" + icon + " " + linkTerms(esc(it.text)) + "</li>";
        });
        return html + "</ul>";
      }

      function shiRhymeHtml() {
        const lines = currentLines();
        const rhymeLines = [];
        lines.forEach(function (l, i) { if (l.rhyme) rhymeLines.push(i); });
        const chars = rhymeLines.map(lastCharOf);
        const infos = chars.map(charCats);
        const filledIdx = [];
        infos.forEach(function (info, i) { if (chars[i] && info.rs.length) filledIdx.push(i); });
        if (!filledIdx.length) return "<div class='hint'>填入韵脚字后自动检测（近体诗押平声韵，偶句用韵）。</div>";
        // 主韵取第 2 个韵脚（首句入韵者可借邻韵，故不作基准）
        const main = filledIdx.length > 1 && filledIdx[1] !== 0 ? filledIdx[1] : filledIdx[0];
        const mainInfo = infos[main];
        const mainPing = mainInfo.rs.filter(function (r) { return r.tone === "平"; });
        let html = "<div class='rhyme-group'>";
        html += "<div class='head'>韵脚：</div><div class='chars'>" + chars.map(function (c) { return esc(c) || "□"; }).join("　") + "</div>";
        if (!mainPing.length) {
          html += "<div class='detail' style='color:var(--red)'>✗ " + linkTerms("韵脚字须为平声") + "，「" + esc(chars[main]) + "」非平声。</div>";
        } else {
          const mainYi = new Set(mainPing.map(function (r) { return r.yi; }));
          const mainBu = new Set(mainInfo.rs.map(function (r) { return r.bu; }));
          const yunName = mainPing[0].yunName;
          const bad = [];
          const lin = [];
          const inGroup = [];   // 孤雁入群：末句借邻韵
          infos.forEach(function (info, i) {
            if (i === main || !chars[i] || !info.rs.length) return;
            const ping = info.rs.filter(function (r) { return r.tone === "平"; });
            if (!ping.length) { bad.push({ i: i, ch: chars[i], why: "非平声" }); return; }
            let sameYi = false;
            ping.forEach(function (r) { if (mainYi.has(r.yi)) sameYi = true; });
            if (sameYi) return;
            let sameBu = false;
            info.rs.forEach(function (r) { if (mainBu.has(r.bu)) sameBu = true; });
            if (i === 0 && sameBu) { lin.push({ i: i, ch: chars[i] }); return; }
            if (i === infos.length - 1 && sameBu) { inGroup.push({ i: i, ch: chars[i] }); return; }
            bad.push({ i: i, ch: chars[i], why: "出韵" });
          });
          const shiYunName = yunKey === "中华新韵" ? "中华新韵" : "平水韵";
          if (!bad.length) {
            html += "<div class='detail' style='color:var(--green)'>✓ " + linkTerms("同韵") + "（" + shiYunName + "·" + esc(yunName) + "）";
            if (lin.length) {
              html += "；首句" + lin.map(function (x) { return "「" + esc(x.ch) + "」"; }).join("") +
                "为" + linkTerms("孤雁出群格") + "（首句" + linkTerms("借邻韵") + "，可）";
            }
            if (inGroup.length) {
              html += "；末句" + inGroup.map(function (x) { return "「" + esc(x.ch) + "」"; }).join("") +
                "为" + linkTerms("孤雁入群格") + "（末韵借邻韵，争议较大，宜留意）";
            }
            html += "</div>";
          } else {
            html += "<div class='detail' style='color:var(--red)'>✗ " + bad.map(function (b) {
              return "「" + esc(b.ch) + "」" + b.why;
            }).join("，") + "；主韵为" + shiYunName + "·" + esc(yunName) + "</div>";
            // 出韵位置恰在末句时，给出「是否可能是孤雁入群格」的提示
            if (bad.length === 1 && bad[0].i === infos.length - 1) {
              html += "<div class='hint'>末句韵脚「" + esc(bad[0].ch) + "」若确与前韵相邻，可能是有意用" +
                linkTerms("孤雁入群格") + "；宋以后多不取此法，通常仍按" + linkTerms("出韵") + "处理。</div>";
            }
          }
        }
        html += "<button class='action' data-suggest='shi' style='margin-top:8px'>查看同韵字</button>";
        html += "<div class='suggest-box' id='suggest-shi'></div>";
        html += "<button class='action' data-gen='shi' style='margin-top:6px'>自动成句</button>";
        html += "<div class='suggest-box' id='gen-shi'></div>";
        html += "</div>";
        return html;
      }

      function ciRhymeHtml() {
        const t = window.CIPU[state.ciName];
        const groups = rhymeGroupsCi();
        let html = "";
        groups.forEach(function (g, gi) {
          const v = groupVerdict(g, t.mode === "叶");
          const entries = v.entries;
          const chars = entries.map(function (e) { return e.ch; });
          let cls = "rhyme-group";
          let statusHtml = "";
          if (v.status === "ok") {
            cls += " ok";
            const ref = entries.filter(function (e) { return e.ch && e.info.rs.length; })[0];
            const r0 = ref.info.rs[0];
            const catName = catOfTone(r0.tone) === "平" ? "平声"
              : catOfTone(r0.tone) === "入" ? "入声"
              : yunKey === "中华新韵" ? "仄声" : "上去声";
            statusHtml = "<div class='detail' style='color:var(--green)'>✓ " + linkTerms("同韵") + "（" + yunLabel() + "第" + cnNum(r0.bu) + "部·" + catName + "）</div>";
          } else if (v.status === "bad") {
            cls += " bad";
            const ref = entries.filter(function (e) { return e.ch && e.info.rs.length; })[0];
            statusHtml = "<div class='detail' style='color:var(--red)'>✗ " + linkTerms("出韵") + "：参照「" + esc(ref.ch) + "」" +
              esc(describeReading(ref.info.rs)) + "<br>" +
              v.bad.map(function (b) {
                return "「" + esc(b.ch) + "」：" + esc(describeReading(b.info.rs));
              }).join("<br>") + "</div>";
          } else if (v.status === "partial") {
            statusHtml = "<div class='detail' style='color:var(--gray)'>已填一个韵脚，再填一个即可检测。</div>";
          } else {
            statusHtml = "<div class='detail' style='color:var(--gray)'>韵脚尚未填写。</div>";
          }
          html += "<div class='" + cls + "' data-group='" + gi + "'>";
          html += "<div class='head'>第" + (gi + 1) + "组韵脚" + (g.tone === "叶" ? "（平仄通叶）" : g.tone === "平" ? "（平韵）" : "（仄韵）") + "：</div>";
          html += "<div class='chars'>" + chars.map(function (c) { return esc(c) || "□"; }).join("　") + "</div>";
          html += statusHtml;
          html += "<button class='action' data-suggest='ci' data-group='" + gi + "' style='margin-top:8px'>查看同韵字</button>";
          html += "<div class='suggest-box' id='suggest-ci-" + gi + "'></div>";
          html += "<button class='action' data-gen='ci' data-group='" + gi + "' style='margin-top:6px'>自动成句</button>";
          html += "<div class='suggest-box' id='gen-ci-" + gi + "'></div>";
          html += "</div>";
        });
        return html;
      }

      function attachReportHandlers() {
        document.querySelectorAll("[data-suggest]").forEach(function (btn) {
          btn.onclick = function () {
            const kind = btn.dataset.suggest;
            const boxId = kind === "shi" ? "suggest-shi" : "suggest-ci-" + btn.dataset.group;
            const box = document.getElementById(boxId);
            if (!box) return;
            if (box.classList.contains("show")) { box.classList.remove("show"); return; }
            const list = kind === "shi" ? suggestShi() : suggestCi(+btn.dataset.group);
            box.innerHTML = list.length
              ? list.map(function (c) { return "<span class='s'>" + esc(c) + "</span>"; }).join("")
              : "<div class='hint'>请先填写一个可识别的韵脚字。</div>";
            box.classList.add("show");
          };
        });
        document.querySelectorAll("[data-gen]").forEach(function (btn) {
          btn.onclick = function () { openGenerator(btn); };
        });
        document.querySelectorAll("[data-fix]").forEach(function (btn) {
          btn.onclick = function () { openFixBox(btn); };
        });
      }

      // 点击同韵字，自动填入主韵脚（事件委托）
      document.addEventListener("click", function (e) {
        if (!e.target.classList || !e.target.classList.contains("s")) return;
        const box = e.target.closest(".suggest-box");
        const groupEl = box ? box.closest(".rhyme-group") : null;
        const lines = currentLines();
        let targetLi = null;
        if (state.mode === "shi") {
          let count = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].rhyme) {
              count++;
              if (count === 2) { targetLi = i; break; }
            }
          }
          if (targetLi === null) {
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].rhyme) { targetLi = i; break; }
            }
          }
        } else if (groupEl) {
          const gi = +groupEl.dataset.group;
          const groups = rhymeGroupsCi();
          if (groups[gi]) targetLi = groups[gi].lines[0];
        }
        if (targetLi === null || !state.values[targetLi]) return;
        const pi = lines[targetLi].parts.length - 1;
        state.values[targetLi][pi] = e.target.textContent;
        renderEditor();
        renderReport();
        saveState();
        toast("已填入「" + e.target.textContent + "」");
      });

      // 成句建议的填入与换一批（事件委托）
      document.addEventListener("click", function (e) {
        const cls = e.target.classList;
        if (!cls) return;
        if (cls.contains("sugg-line")) {
          const li = +e.target.dataset.line;
          const lines = currentLines();
          const text = e.target.textContent;
          let off = 0;
          state.values[li] = lines[li].parts.map(function (p) {
            const s = text.slice(off, off + p.length);
            off += p.length;
            return s;
          });
          renderEditor();
          renderReport();
          saveState();
          toast("已填入第" + (li + 1) + "句建议");
        } else if (cls.contains("w")) {
          const box = e.target.closest(".suggest-box");
          const li = box ? +box.dataset.li : targetRhymeLine();
          const word = e.target.dataset.word;
          const lines = currentLines();
          const pi = lines[li].parts.length - 1;
          state.values[li][pi] = word[word.length - 1];
          renderEditor();
          renderReport();
          saveState();
          toast("已填入韵脚「" + word[word.length - 1] + "」");
        } else if (e.target.dataset && e.target.dataset.regen) {
          const box = e.target.closest(".suggest-box");
          if (box && box.dataset.genKind) {
            openGenerator({ dataset: { gen: box.dataset.genKind, group: box.dataset.genGroup } });
          }
        }
      });

      // 术语：点击就地解释，跳到术语表对应条目（事件委托）
      document.addEventListener("click", function (e) {
        if (!e.target.closest) return;
        const t = e.target.closest(".term");
        if (!t) return;
        openGlossary(t.dataset.term || "");
      });

      // 换字候选：点选即就地替换该字（事件委托）
      document.addEventListener("click", function (e) {
        const cls = e.target.classList;
        if (!cls || !cls.contains("fx")) return;        const li = +e.target.dataset.fxLi;
        const ci = +e.target.dataset.fxCi;
        const ch = e.target.textContent;
        if (!ch || !setLineChar(li, ci, ch)) return;
        renderEditor();
        renderReport();
        saveState();
        toast("已换为「" + ch + "」");
      });

      // 找词牌：用某词牌装入原文（事件委托）
      document.addEventListener("click", function (e) {
        if (!e.target.closest) return;
        const btn = e.target.closest("[data-tf-fit]");
        if (!btn) return;
        fitTextToTune(btn.dataset.tfFit, ($("tf-text").value || "").trim());
      });

      // 集句检索：用此句 / 复制（事件委托）
      document.addEventListener("click", function (e) {
        if (!e.target.closest) return;
        const use = e.target.closest("[data-jj-use]");
        if (use) {
          const row = JJU_RESULT_ROWS[+use.dataset.jjUse];
          if (row) jijuFill(row.s);
          return;
        }
        const cp = e.target.closest("[data-jj-copy]");
        if (cp) {
          const row = JJU_RESULT_ROWS[+cp.dataset.jjCopy];
          if (row) copyPlainText(row.s, "已复制「" + row.s + "」");
          return;
        }
        const op = e.target.closest("[data-jj-open]");
        if (op) {
          const row = JJU_RESULT_ROWS[+op.dataset.jjOpen];
          if (row && row.w) showApprDetailWork(row.w);
        }
      });

      // 点击写作区已输入的字 → 右侧韵书查询联动
      document.addEventListener("click", function (e) {
        const cell = e.target.closest(".tone-cell");
        if (!cell) return;
        const input = cell.closest(".seg") ? cell.closest(".seg").querySelector("input[data-li]") : null;
        if (!input) return;
        const cells = Array.prototype.slice.call(cell.parentElement.querySelectorAll(".tone-cell"));
        const idx = cells.indexOf(cell);
        const ch = input.value[idx];
        if (ch) {
          switchPage("yunshu");
          showYunChar(ch, true);
        }
      });

      // ---------- 查看原文 / PDF 导出（预览与打印共用同一张页面） ----------
      let PDF_DOC = null;

      function renderFontSelects() {
        const html = function (groups) {
          return groups.map(function (g) {
            return "<optgroup label='" + esc(g.label) + "'>" + g.items.map(function (it) {
              return "<option value='" + esc(it[0]) + "'>" + esc(it[1]) + "</option>";
            }).join("") + "</optgroup>";
          }).join("");
        };
        ["font-ui-select"].forEach(function (id) { const el = $(id); if (el) el.innerHTML = html(FONT_UI_OPTIONS); });
        ["font-poem-select", "pdf-font-poem"].forEach(function (id) { const el = $(id); if (el) el.innerHTML = html(FONT_POEM_OPTIONS); });
        const allIds = function (groups) { return groups.reduce(function (acc, g) { return acc.concat(g.items.map(function (it) { return it[0]; })); }, []); };
        if (allIds(FONT_UI_OPTIONS).indexOf(state.fontUi) === -1) { state.fontUi = "yahei"; applyFonts(); }
        if (allIds(FONT_POEM_OPTIONS).indexOf(state.fontPoem) === -1) { state.fontPoem = "kai"; applyFonts(); }
      }

      function renderPaletteSelects() {
        const html = Object.keys(PDF_PALETTES).map(function (id) {
          return "<option value='" + esc(id) + "'>" + esc(PDF_PALETTES[id].name) + "</option>";
        }).join("");
        ["print-palette-select", "pdf-palette"].forEach(function (id) {
          const el = $(id); if (el) el.innerHTML = html;
        });
      }

      function renderMotifSelects() {
        const html = Object.keys(PDF_MOTIFS).map(function (id) {
          return "<option value='" + esc(id) + "'>" + esc(PDF_MOTIFS[id].name) + "</option>";
        }).join("");
        ["print-motif-select", "pdf-motif"].forEach(function (id) {
          const el = $(id); if (el) el.innerHTML = html;
        });
      }

      function applyFonts() {
        document.body.dataset.fontUi = state.fontUi || "yahei";
        document.body.dataset.fontPoem = state.fontPoem || "kai";
        document.body.style.setProperty("--font-ui", FONT_STACKS[state.fontUi] || FONT_STACKS.yahei);
        document.body.style.setProperty("--font-poem", FONT_STACKS[state.fontPoem] || FONT_STACKS.kai);
        // 内置字体按需预载，避免首次切换时先看到楷体再跳字
        warmWebFont(state.fontUi);
        warmWebFont(state.fontPoem);
      }

      function hexRgb(hex) {
        const m = /^#([0-9a-fA-F]{6})$/.exec(hex || "");
        if (!m) return { r: 43, g: 43, b: 43 };
        const n = parseInt(m[1], 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      }
      function hexMix(a, b, t) {
        const x = hexRgb(a), y = hexRgb(b);
        const c = function (p, q) { return Math.round(p + (q - p) * t).toString(16).padStart(2, "0"); };
        return "#" + c(x.r, y.r) + c(x.g, y.g) + c(x.b, y.b);
      }
      function hexAlpha(hex, alpha) {
        const c = hexRgb(hex);
        return "rgba(" + c.r + ", " + c.g + ", " + c.b + ", " + alpha + ")";
      }
      function hexLum(hex) {
        const c = hexRgb(hex);
        const f = function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
        return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b);
      }
      function contrastRatio(a, b) {
        const l1 = hexLum(a), l2 = hexLum(b);
        return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
      }
      function isDarkColor(hex) { return hexLum(hex) < .22; }

      function applyPrintPalette() {
        const ink = state.printInk || "#2b2b2b";
        const paper = state.printPaper || "#fffdf7";
        const muted = hexMix(ink, paper, .44);
        const line = hexMix(ink, paper, .72);
        const detailSheet = hexAlpha(paper, .74);
        document.body.style.setProperty("--detail-ink", ink);
        document.body.style.setProperty("--detail-muted", muted);
        document.body.style.setProperty("--detail-line", line);
        document.body.style.setProperty("--detail-sheet-bg", detailSheet);
        applyPrintMotif();
      }

      function motifStyle() {
        const m = PDF_MOTIFS[state.printMotif] || PDF_MOTIFS.none;
        if (m.imageSrc) {
          return {
            image: "url(\"" + m.imageSrc + "\")",
            repeat: m.repeat,
            size: m.size,
            position: m.position,
            opacity: Math.max(5, Math.min(60, +state.printMotifStrength || 34)) / 100
          };
        }
        if (!m.svg) {
          return { image: "none", repeat: "no-repeat", size: "0", position: "center", opacity: 0 };
        }
        const ink = state.printInk || "#2b2b2b";
        const paper = state.printPaper || "#fffdf7";
        const dark = isDarkColor(paper);
        const palette = m.colors || { stroke: ink, fill: ink, accent: ink };
        const soften = function (hex) { return dark ? hexMix(hex, "#ffffff", .24) : hexMix(hex, paper, .02); };
        const stroke = soften(palette.stroke || ink);
        const fill = soften(palette.fill || palette.stroke || ink);
        const accent = soften(palette.accent || palette.stroke || ink);
        const svg = m.svg.replace(/\{\{S\}\}/g, stroke)
          .replace(/\{\{F\}\}/g, fill)
          .replace(/\{\{A\}\}/g, accent)
          .replace(/\{\{C\}\}/g, stroke);
        const image = "url(\"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg) + "\")";
        return {
          image: image,
          repeat: m.repeat,
          size: m.size,
          position: m.position,
          opacity: Math.max(5, Math.min(60, +state.printMotifStrength || 34)) / 100
        };
      }

      function applyPrintMotif() {
        const s = motifStyle();
        document.body.style.setProperty("--detail-motif-bg", s.image);
        document.body.style.setProperty("--detail-motif-repeat", s.repeat);
        document.body.style.setProperty("--detail-motif-size", s.size);
        document.body.style.setProperty("--detail-motif-position", s.position);
        document.body.style.setProperty("--detail-motif-opacity", s.opacity);
      }

      function specLinesFor(mode, shiIndex, ciName) {
        if (mode === "shi") {
          const s = window.SHI[shiIndex];
          return s ? s.lines.map(function (l) { return { rhyme: !!l.rhyme }; }) : [];
        }
        const t = window.CIPU[ciName];
        return t ? t.lines.map(function (l) { return { rhyme: !!l.rhyme }; }) : [];
      }

      function punctuatedLines(values, spec) {
        return (values || []).map(function (row, li) {
          const text = (row || []).join("、");
          if (!text) return "";
          return text + (spec[li] && spec[li].rhyme ? "。" : "，");
        }).filter(Boolean);
      }

      function pdfFooter(kind, yun, includeSignature) {
        const parts = [kind, "平仄依《" + yun + "》"];
        if (includeSignature && state.authorId) parts.push(state.authorId);
        return parts;
      }

      // 词组优先、字级兜底；OpenCC 身份词组用于避免「皇后」误转成「皇後」
      function convertText(text, mode) {
        if (!mode || mode === "original" || text === null || text === undefined) return text;
        const dict = window.HANZI_CONVERT && window.HANZI_CONVERT[mode];
        if (!dict) return text;
        const chars = Array.from(String(text));
        const maxPhrase = Math.min(dict.maxPhrase || 1, chars.length);
        let out = "";
        let i = 0;
        while (i < chars.length) {
          let hit = false;
          for (let len = Math.min(maxPhrase, chars.length - i); len >= 2; len--) {
            const seg = chars.slice(i, i + len).join("");
            if (Object.prototype.hasOwnProperty.call(dict.phrases, seg)) {
              out += dict.phrases[seg];
              i += len;
              hit = true;
              break;
            }
          }
          if (!hit) {
            const ch = chars[i];
            out += (Object.prototype.hasOwnProperty.call(dict.chars, ch) ? dict.chars[ch] : ch);
            i++;
          }
        }
        return out;
      }

      function convertDoc(doc, mode) {
        if (!doc || !mode || mode === "original") return doc;
        return {
          title: convertText(doc.title, mode),
          byline: convertText(doc.byline, mode),
          lines: (doc.lines || []).map(function (line) { return convertText(line, mode); }),
          footer: (doc.footer || []).map(function (line) { return convertText(line, mode); }),
          note: convertText(doc.note, mode),
          own: doc.own
        };
      }

      function buildCurrentDoc() {
        const lines = punctuatedLines(state.values, currentLines());
        if (!lines.length) return null;
        const kind = state.mode === "shi" ? "近体诗" : "词";
        return {
          title: state.mode === "shi" ? window.SHI[state.shiIndex].name : "《" + state.ciName + "》",
          byline: "",
          lines: lines,
          footer: pdfFooter(kind, yunLabel(), true),
          note: "",
          own: true
        };
      }

      function buildExampleDoc(mode, shiIndex, ciName) {
        const s = mode === "shi" ? window.SHI[shiIndex] : null;
        const ex = mode === "shi"
          ? (window.LISHI && s ? window.LISHI[s.name] : null)
          : window.LICI[ciName];
        if (!ex || !ex.lines) { toast("该格律 / 词牌暂无内置例作"); return null; }
        const spec = specLinesFor(mode, shiIndex, ciName);
        const lines = ex.lines.map(function (row, li) {
          const text = (row || []).join("、");
          return text ? text + (spec[li] && spec[li].rhyme ? "。" : "，") : "";
        }).filter(Boolean);
        if (!lines.length) { toast("该例作暂无正文"); return null; }
        const bylineParts = [];
        if (mode === "shi" && ex.dynasty) bylineParts.push(ex.dynasty);
        if (ex.author) bylineParts.push(ex.author);
        if (mode === "ci" && ex.title) bylineParts.push(ex.title);
        return {
          title: mode === "shi" ? (ex.title || s.name) : "《" + ciName + "》",
          byline: bylineParts.join(" │ "),
          lines: lines,
          footer: [mode === "shi" ? "近体诗" : "词", "平仄依《词林正韵》"],
          note: ex.variant || "",
          own: false
        };
      }

      function buildWorkDoc(w) {
        if (!w) return null;
        const spec = linesOfWork(w) || [];
        const lines = punctuatedLines(w.values, spec);
        if (!lines.length) return null;
        const yun = w.yunKey === "中华新韵" ? "中华新韵" : "词林正韵";
        const kind = w.mode === "shi" ? "近体诗" : "词";
        return {
          title: w.title || "无题",
          byline: w.mode === "shi"
            ? ((window.SHI[w.shiIndex] || {}).name || "近体诗")
            : "《" + (w.ciName || "") + "》",
          lines: lines,
          footer: pdfFooter(kind, yun, true),
          note: "",
          own: true
        };
      }

      function buildLibraryDoc(w) {
        if (!w) return null;
        const lines = (w.c || []).map(function (x) { return String(x).trim(); }).filter(Boolean);
        if (!lines.length) return null;
        const byline = [w.d, w.a, w.p ? "词牌 │ " + w.p : ""].filter(Boolean).join(" │ ");
        const footer = [w.d, w.a, kindOf(w)].filter(Boolean);
        return {
          title: w.t || "无题",
          byline: byline,
          lines: lines,
          footer: footer,
          note: "",
          own: false
        };
      }

      function pdfPaperSrc() {
        return state.printBg === "none" ? "" : "backgrounds/bg" + state.printBg + ".jpg";
      }

      function syncPdfControls() {
        const pairs = [
          ["font-ui-select", state.fontUi],
          ["font-poem-select", state.fontPoem],
          ["pdf-font-poem", state.fontPoem],
          ["print-bg-select", state.printBg],
          ["pdf-bg", state.printBg],
          ["print-script-select", state.printScript],
          ["pdf-script", state.printScript],
          ["print-palette-select", state.printPalette],
          ["pdf-palette", state.printPalette],
          ["print-ink", state.printInk],
          ["pdf-ink", state.printInk],
          ["print-paper", state.printPaper],
          ["pdf-paper", state.printPaper],
          ["print-motif-select", state.printMotif],
          ["pdf-motif", state.printMotif],
          ["print-motif-strength", state.printMotifStrength],
          ["pdf-motif-strength", state.printMotifStrength],
          ["print-strength", state.printStrength],
          ["pdf-strength", state.printStrength],
          ["pdf-weight", state.printFontWeight],
          ["pdf-size", state.printFontSize],
          ["pdf-line-height", state.printLineHeight],
          ["pdf-letter-spacing", state.printLetterSpacing],
          ["pdf-align", state.printAlign],
          ["pdf-layout", state.printLayout]
        ];
        pairs.forEach(function (p) { const el = $(p[0]); if (el) el.value = p[1]; });
        ["print-meta", "pdf-meta"].forEach(function (id) {
          const el = $(id); if (el) el.checked = !!state.printMeta;
        });
        const labels = {
          "pdf-weight-val": String(state.printFontWeight),
          "pdf-size-val": state.printFontSize + " pt",
          "pdf-line-height-val": (+state.printLineHeight).toFixed(1),
          "pdf-letter-spacing-val": (state.printLetterSpacing / 100).toFixed(2) + " em",
          "pdf-motif-val": state.printMotifStrength + "%",
          "pdf-contrast-val": contrastRatio(state.printInk, state.printPaper).toFixed(1) + ":1"
        };
        Object.keys(labels).forEach(function (id) { const el = $(id); if (el) el.textContent = labels[id]; });
      }

      function fitPdfPreview() {
        const wrap = $("pdf-preview-wrap");
        const page = $("print-area");
        if (!wrap || !page || !page.offsetWidth) return;
        const scale = Math.min(1, Math.max(.34, (wrap.clientWidth - 28) / page.offsetWidth));
        page.style.setProperty("--pdf-scale", scale);
        wrap.style.height = Math.ceil(page.offsetHeight * scale + 28) + "px";
      }

      function renderPdfViewer() {
        if (!PDF_DOC) return;
        const doc = convertDoc(PDF_DOC, state.printScript);
        const el = $("print-area");
        const dark = state.printBg === "5" || isDarkColor(state.printPaper);
        const src = pdfPaperSrc();
        const strength = Math.max(20, Math.min(100, +state.printStrength || 65));
        const footer = state.printMeta && doc.footer && doc.footer.length
          ? "—— " + doc.footer.join(" │ ") + " ——" : "";
        const bgHtml = src
          ? "<img class='pdf-bg' src='" + esc(src) + "' alt='' style='opacity:" + (strength / 100) + "'>"
          : "";
        el.dataset.dark = dark ? "1" : "0";
        el.dataset.layout = state.printLayout === "vertical" ? "vertical" : "horizontal";
        el.style.setProperty("--pdf-paper-bg", src ? "url('" + src + "')" : "none");
        el.style.setProperty("--pdf-paper-opacity", Math.min(.42, (strength / 100) * .48));
        el.style.setProperty("--pdf-page-bg", state.printPaper);
        el.style.setProperty("--pdf-sheet-bg", hexAlpha(state.printPaper, dark ? .70 : .74));
        el.style.setProperty("--pdf-ink", state.printInk);
        el.style.setProperty("--pdf-muted", hexMix(state.printInk, state.printPaper, .44));
        el.style.setProperty("--pdf-line", hexMix(state.printInk, state.printPaper, .72));
        const motif = motifStyle();
        el.style.setProperty("--pdf-motif-bg", motif.image);
        el.style.setProperty("--pdf-motif-repeat", motif.repeat);
        el.style.setProperty("--pdf-motif-size", motif.size);
        el.style.setProperty("--pdf-motif-position", motif.position);
        el.style.setProperty("--pdf-motif-opacity", motif.opacity);
        el.style.setProperty("--pdf-body-weight", state.printFontWeight);
        el.style.setProperty("--pdf-body-size", state.printFontSize + "pt");
        el.style.setProperty("--pdf-title-size", (state.printFontSize + 6) + "pt");
        el.style.setProperty("--pdf-line-height", state.printLineHeight);
        el.style.setProperty("--pdf-letter-spacing", (state.printLetterSpacing / 100) + "em");
        el.style.setProperty("--pdf-align", state.printAlign);
        el.innerHTML = bgHtml +
          "<div class='pdf-sheet'>" +
          "<div class='pdf-title'>" + esc(doc.title || "无题") + "</div>" +
          (doc.byline ? "<div class='pdf-byline'>" + esc(doc.byline) + "</div>" : "") +
          "<div class='pdf-rule'></div>" +
          "<div class='pdf-body'>" + doc.lines.map(function (line) {
            return "<div class='pdf-line'>" + esc(line) + "</div>";
          }).join("") + "</div>" +
          (doc.note ? "<div class='pdf-note'>" + esc(doc.note) + "</div>" : "") +
          (footer ? "<div class='pdf-footer'>" + esc(footer) + "</div>" : "") +
          "</div>";
        syncPdfControls();
        requestAnimationFrame(fitPdfPreview);
      }

      function openPdfViewer(doc) {
        if (!doc) { toast("没有可查看的原文"); return; }
        PDF_DOC = doc;
        $("pdf-overlay").classList.add("show");
        renderPdfViewer();
      }

      function printPoem() {
        const doc = buildCurrentDoc();
        if (!doc) { toast("请先填写内容再查看原文"); return; }
        openPdfViewer(doc);
      }

      function printPdf() {
        if (!PDF_DOC) return;
        renderPdfViewer();
        window.print();
      }

      function updatePdfSetting(key, value) {
        if (key === "printBg") {
          state.bg = value;
          state.printBg = value;
          applyBg();
        } else if (key === "printPalette") {
          const p = PDF_PALETTES[value] || PDF_PALETTES.default;
          state.printPalette = value;
          if (value !== "custom" && p.ink && p.paper) {
            state.printInk = p.ink;
            state.printPaper = p.paper;
          }
          applyPrintPalette();
        } else if (key === "printInk" || key === "printPaper") {
          state[key] = value;
          state.printPalette = "custom";
          applyPrintPalette();
        } else if (key === "printMotif" || key === "printMotifStrength") {
          state[key] = value;
          applyPrintMotif();
        } else {
          state[key] = value;
          if (key === "fontUi" || key === "fontPoem") applyFonts();
        }
        saveState();
        if ($("pdf-overlay").classList.contains("show")) renderPdfViewer();
        else syncPdfControls();
      }

      // ---------- 韵书查询 ----------
      let yunIdxCache = null;
      let yunSearchMode = false;

      function readingsOfBook(ch, yk) {
        const chars = yk === "中华新韵" ? window.XINYUN : window.CILIN;
        const yuns = (yk === "中华新韵" ? window.XINYUN_META : window.CILIN_META).yuns;
        const s = chars[ch];
        if (!s) return [];
        return s.split(";").map(function (k) {
          const p = k.split(",");
          const yi = +p[1];
          return { bu: +p[0], yi: yi, tone: yuns[yi][1], yunName: yuns[yi][0] };
        });
      }

      function catOfToneBook(tone, yk) {
        if (yk === "中华新韵") return tone === "平" ? "平" : "仄";
        if (tone === "平") return "平";
        if (tone === "入") return "入";
        return "上去";
      }

      function yunIdx() {
        if (yunIdxCache) return yunIdxCache;
        const out = {};
        ["词林正韵", "中华新韵"].forEach(function (yk) {
          const chars = yk === "中华新韵" ? window.XINYUN : window.CILIN;
          const yuns = (yk === "中华新韵" ? window.XINYUN_META : window.CILIN_META).yuns;
          const byBu = {};
          const charByYi = {};
          const catChars = {};
          const seen = {};
          for (const ch in chars) {
            if (!Object.prototype.hasOwnProperty.call(chars, ch)) continue;
            const rs = readingsOfBook(ch, yk);
            rs.forEach(function (r) {
              const key = r.bu + "|" + r.yi + "|" + ch;
              if (seen[key]) return;
              seen[key] = 1;
              if (!byBu[r.bu]) byBu[r.bu] = {};
              if (!byBu[r.bu][r.yi]) {
                byBu[r.bu][r.yi] = { yi: r.yi, name: yuns[r.yi][0], tone: yuns[r.yi][1], chars: [] };
              }
              byBu[r.bu][r.yi].chars.push(ch);
              (charByYi[r.yi] = charByYi[r.yi] || []).push(ch);
              const cat = catOfToneBook(r.tone, yk);
              (catChars[r.bu + "|" + cat] = catChars[r.bu + "|" + cat] || []).push(ch);
            });
          }
          const parts = [];
          Object.keys(byBu).forEach(function (bu) {
            const tunes = Object.keys(byBu[bu]).map(Number).sort(function (a, b) { return a - b; })
              .map(function (yi) {
                const t = byBu[bu][yi];
                t.chars.sort(function (a, b) { return commonRank(a) - commonRank(b); });
                return t;
              });
            let bestC = "", bestR = Infinity;
            tunes.forEach(function (t) {
              t.chars.forEach(function (c) {
                const r = commonRank(c);
                if (r < bestR) { bestR = r; bestC = c; }
              });
            });
            parts.push({ bu: +bu, tunes: tunes, best: bestC });
          });
          parts.sort(function (a, b) { return a.bu - b.bu; });
          Object.keys(catChars).forEach(function (k) {
            catChars[k].sort(function (a, b) { return commonRank(a) - commonRank(b); });
          });
          out[yk] = { parts: parts, charByYi: charByYi, catChars: catChars };
        });
        yunIdxCache = out;
        return out;
      }

      function fillYunBrowse() {
        const idx = yunIdx();
        const yk = $("yun-browse-book").value;
        const parts = idx[yk].parts;
        const partSel = $("yun-part");
        partSel.innerHTML = "";
        parts.forEach(function (p) {
          const o = document.createElement("option");
          o.value = p.bu;
          o.textContent = yunPartLabel(yk, p);
          partSel.appendChild(o);
        });
        partSel.value = parts[0] ? parts[0].bu : "";
        fillYunTuneSel();
      }

      function yunPartLabel(yk, part) {
        const ex = part.best ? "（" + part.best + "）" : "";
        if (yk === "中华新韵") {
          return (part.tunes[0] ? part.tunes[0].name.replace(/韵$/, "") : "") + ex;
        }
        return cnNum(part.bu) + ex;
      }

      function fillYunTuneSel() {
        const idx = yunIdx();
        const yk = $("yun-browse-book").value;
        const bu = +$("yun-part").value;
        const part = idx[yk].parts.filter(function (p) { return p.bu === bu; })[0];
        const tuneSel = $("yun-tune");
        tuneSel.innerHTML = "";
        if (!part) return;
        part.tunes.forEach(function (t) {
          const o = document.createElement("option");
          o.value = t.yi;
          const label = yk === "中华新韵"
            ? (t.name.replace(/韵$/, "") + " │ " + (t.tone === "平" ? "平声" : "仄声"))
            : (t.name + "（" + t.tone + "声）");
          o.textContent = label + " │ " + t.chars.length + "字";
          tuneSel.appendChild(o);
        });
        tuneSel.value = part.tunes[0] ? part.tunes[0].yi : "";
      }

      function renderYunBrowse() {
        const idx = yunIdx();
        const yk = $("yun-browse-book").value;
        const bu = +$("yun-part").value;
        const yi = +$("yun-tune").value;
        const part = idx[yk].parts.filter(function (p) { return p.bu === bu; })[0];
        if (!part) return;
        const tune = part.tunes.filter(function (t) { return t.yi === yi; })[0];
        if (!tune) return;
        const partName = yunPartLabel(yk, part);
        const tuneLabel = yk === "中华新韵"
          ? (tune.name.replace(/韵$/, "") + " │ " + (tune.tone === "平" ? "平声" : "仄声"))
          : (tune.name + "（" + tune.tone + "声）");
        $("yun-result").innerHTML =
          "<div class='yun-sec'><h4>" + esc(partName) + " │ " + esc(tuneLabel) + "</h4>" +
          "<div class='yun-hint'>共 " + tune.chars.length + " 字（按常用度排序，前 300 字，点击任意字可查韵）</div>" +
          "<div class='yun-table'>" + tune.chars.slice(0, 300).map(function (c) {
            return "<span class='y' data-yunchar='" + esc(c) + "'>" + esc(c) + "</span>";
          }).join("") + "</div></div>";
      }

      function yunWordChips(words) {
        return words.map(function (w) {
          return "<span class='w' data-yunchar='" + esc(w[w.length - 1]) + "'>" + esc(w) + "</span>";
        }).join("");
      }

      function showYunChar(ch, fromEditor) {
        if (!ch) return;
        yunSearchMode = true;
        if (!fromEditor && document.activeElement !== $("yun-search")) {
          $("yun-search").value = ch;
        }
        const idx = yunIdx();
        const allW = allWords();
        let html = "";
        ["词林正韵", "中华新韵"].forEach(function (yk) {
          const rs = readingsOfBook(ch, yk);
          html += "<div class='yun-sec'><h4>《" + yk + "》</h4>";
          if (!rs.length) {
            html += "<div class='yun-info'><b>" + esc(ch) + "</b>：未收录</div></div>";
            return;
          }
          const info = rs.map(function (r) {
            const partName = yk === "中华新韵"
              ? r.yunName.replace(/韵$/, "")
              : "第" + cnNum(r.bu) + "部";
            return partName + " │ " + r.yunName + " │ " + r.tone + "声";
          }).join("；");
          html += "<div class='yun-info'><b>" + esc(ch) + "</b>：" + esc(info) + "</div>";
          // 通押字（同部同类）
          const catKeys = {};
          rs.forEach(function (r) {
            catKeys[r.bu + "|" + catOfToneBook(r.tone, yk)] = true;
          });
          const sameChars = [];
          Object.keys(catKeys).forEach(function (k) {
            (idx[yk].catChars[k] || []).forEach(function (c) {
              if (c !== ch && sameChars.length < 100) sameChars.push(c);
            });
          });
          html += "<div class='yun-hint'>同韵通押字（同部同类）：</div>";
          html += "<div class='yun-chips'>" + sameChars.map(function (c) {
            return "<span class='y' data-yunchar='" + esc(c) + "'>" + esc(c) + "</span>";
          }).join("") + "</div>";
          // 通押词
          const sameSet = {};
          sameChars.forEach(function (c) { sameSet[c] = 1; });
          const words = allW.filter(function (w) {
            return sameSet[w[w.length - 1]];
          }).slice(0, 24);
          html += "<div class='yun-hint'>常用通押词（末字同韵）：</div>";
          html += "<div class='yun-chips'>" + (words.length ? yunWordChips(words) : "<span class='yun-hint'>暂无</span>") + "</div>";
          html += "</div>";
        });
        $("yun-result").innerHTML = html;
      }

      function updateLastYunFromEditor() {
        const inputs = document.querySelectorAll("#editor-body input[data-li]");
        let last = "";
        inputs.forEach(function (inp) {
          const v = inp.value;
          if (v) last = v[v.length - 1];
        });
        if (last && /[\u4e00-\u9fff]/.test(last)) {
          showYunChar(last, true);
        } else {
          $("yun-result").innerHTML = "";
        }
      }

      // ---------- 默写练习 ----------
      const PRA = { work: null, mode: "half", values: [], hiddenTotal: 0, hinted: {} };

      function praCandidates() {
        return allWorks().filter(function (w) {
          if (kindOf(w) === "文") return false;
          const chars = (w.c || []).join("").replace(/[（(][^（）()]*[）)]/g, "").match(/[\u3400-\u9fff]/g) || [];
          if (chars.length < 18 || chars.length > 60) return false;
          return (w.c || []).length >= 2;
        });
      }

      // 按标点切成默写行（与界面显示一致）
      function praLines(w) {
        const rows = [];
        (w.c || []).forEach(function (raw) {
          const txt = String(raw).replace(/[（(][^（）()]*[）)]/g, "").replace(/[·•]/g, "");
          txt.split(/[，。！？；：]/).forEach(function (seg) {
            const s = seg.replace(/[^\u3400-\u9fff]/g, "");
            if (s) rows.push(s);
          });
        });
        return rows;
      }

      // 返回该行要隐去的 [起, 止)，null 表示整行给出
      function praRange(len, mode, idx) {
        if (mode === "all") return [0, len];
        if (mode === "even") return idx % 2 === 1 ? [0, len] : null;
        const start = Math.max(2, Math.ceil(len / 2));
        return start >= len ? null : [start, len];
      }

      function praAnswerFor(inp) {
        const li = +inp.dataset.li, start = +inp.dataset.start, len = +inp.dataset.len;
        return (praLines(PRA.work)[li] || "").slice(start, start + len);
      }

      function markPraInput(inp) {
        const ans = praAnswerFor(inp);
        const v = inp.value || "";
        inp.classList.remove("ok", "bad", "part");
        if (!v) return;
        let wrong = false;
        for (let i = 0; i < v.length; i++) {
          if (v[i] !== ans[i]) { wrong = true; break; }
        }
        inp.classList.add(wrong ? "bad" : (v.length === ans.length ? "ok" : "part"));
      }

      function updatePraStat() {
        const inputs = $("pra-body").querySelectorAll(".pra-input");
        let typed = 0, right = 0, total = PRA.hiddenTotal;
        inputs.forEach(function (inp) {
          const ans = praAnswerFor(inp);
          const v = inp.value || "";
          for (let i = 0; i < ans.length; i++) {
            typed += v[i] ? 1 : 0;
            right += v[i] === ans[i] ? 1 : 0;
          }
        });
        const done = typed >= total && total > 0;
        const pct = total ? Math.round((right / total) * 100) : 0;
        $("pra-stat").innerHTML = "共 " + total + " 字要默写，已填 " + typed + " 字，正确 " + right +
          " 字（" + pct + "%）" + (done ? (right === total ? "　✓ 全对！" : "　✗ 有 " + (total - right) + " 字不同") : "");
        $("pra-stat").style.color = done ? (right === total ? "var(--green)" : "var(--red)") : "var(--gray)";
      }

      function renderPractice() {
        const w = PRA.work;
        if (!w) {
          $("pra-body").innerHTML = "<div class='hint'>全库尚未加载完成，请稍候再试。</div>";
          $("pra-stat").textContent = "";
          return;
        }
        const lines = praLines(w);
        $("pra-title").textContent = (w.d || "") + " │ " + (w.a || "") + "《" + (w.t || "") + "》" +
          (w.p ? " │ " + w.p : (kindOf(w) === "诗" ? " │ 诗" : ""));
        let html = "";
        let hidden = 0;
        lines.forEach(function (text, li) {
          const r = praRange(text.length, PRA.mode, li);
          if (!r) {
            html += "<div class='pra-row'><span class='pra-idx'>" + (li + 1) + "</span>" +
              "<span class='pra-line'>" + esc(text) + "</span></div>";
            return;
          }
          const n = r[1] - r[0];
          hidden += n;
          const prev = PRA.values[li] || "";
          html += "<div class='pra-row'><span class='pra-idx'>" + (li + 1) + "</span>" +
            "<span class='pra-line'>" + esc(text.slice(0, r[0])) +
            "<input class='pra-input' data-li='" + li + "' data-start='" + r[0] + "' data-len='" + n +
            "' maxlength='" + n + "' size='" + Math.max(4, n) + "' placeholder='" + n + " 字' " +
            "autocomplete='off' spellcheck='false' value='" + esc(prev) + "'>" +
            "</span></div>";
        });
        $("pra-body").innerHTML = html;
        PRA.hiddenTotal = hidden;
        $("pra-body").querySelectorAll(".pra-input").forEach(function (inp) {
          markPraInput(inp);
          inp.addEventListener("input", function () {
            PRA.values[+inp.dataset.li] = inp.value;
            markPraInput(inp);
            updatePraStat();
          });
        });
        updatePraStat();
        const first = $("pra-body").querySelector(".pra-input");
        if (first) setTimeout(function () { first.focus(); }, 80);
      }

      function praStart(work) {
        PRA.values = [];
        PRA.hinted = {};
        PRA.work = work || null;
        if (!PRA.work) {
          const cands = praCandidates();
          if (!cands.length) {
            toast("全库尚未加载完成，请稍候再试");
            return;
          }
          PRA.work = cands[Math.floor(Math.random() * cands.length)];
        }
        renderPractice();
        $("pra-overlay").classList.add("show");
      }

      function praHintOne() {
        const inputs = $("pra-body").querySelectorAll(".pra-input");
        for (let i = 0; i < inputs.length; i++) {
          const inp = inputs[i];
          const ans = praAnswerFor(inp);
          if ((inp.value || "") !== ans) {
            inp.value = ans;
            PRA.values[+inp.dataset.li] = ans;
            inp.classList.add("hinted");
            markPraInput(inp);
            updatePraStat();
            toast("已提示第 " + (+inp.dataset.li + 1) + " 句");
            return;
          }
        }
        toast("全部已填对了");
      }

      function praShowAnswer() {
        $("pra-body").querySelectorAll(".pra-input").forEach(function (inp) {
          const ans = praAnswerFor(inp);
          inp.value = ans;
          PRA.values[+inp.dataset.li] = ans;
          markPraInput(inp);
        });
        updatePraStat();
      }

      // ---------- 写作统计 ----------
      function linesOfWork(w) {
        if (w.mode === "shi") {
          const s = window.SHI[w.shiIndex];
          if (!s) return null;
          return s.lines.map(function (l) { return { parts: [l.pat], rhyme: !!l.rhyme }; });
        }
        const t = window.CIPU[w.ciName];
        if (!t) return null;
        return t.lines.map(function (l) { return { parts: l.parts.slice(), rhyme: !!l.rhyme }; });
      }

      // 按作品自己保存的韵书算合律情况（临时切换全局韵书，算完还原）
      function rateOfWork(w, lines) {
        const old = yunKey;
        yunKey = w.yunKey === "中华新韵" ? "中华新韵" : "词林正韵";
        let filled = 0, ok = 0, unknown = 0;
        let chars = 0;
        const rhymeChars = [];
        lines.forEach(function (line, li) {
          const pat = line.parts.join("");
          const text = (w.values[li] || []).join("");
          chars += text.replace(/\s/g, "").length;
          for (let i = 0; i < pat.length; i++) {
            const ch = text[i];
            if (!ch || ch === " ") continue;
            if (pat[i] === "中") continue;
            const r = checkTone(ch, pat[i]);
            if (r.ok === null) { unknown++; continue; }
            filled++;
            if (r.ok) ok++;
          }
          if (line.rhyme) {
            const last = text.replace(/\s/g, "").slice(-1);
            if (last) rhymeChars.push(last);
          }
        });
        const rhymeBus = {};
        rhymeChars.forEach(function (c) {
          const rs = readingsOf(c);
          if (!rs.length) return;
          const r = rs.filter(function (x) { return x.tone === "平"; })[0] || rs[0];
          const yk = yunKey === "中华新韵" ? "中华新韵" : "词林正韵";
          const key = yk + "|" + r.bu + "|" + r.yunName;
          rhymeBus[key] = (rhymeBus[key] || 0) + 1;
        });
        yunKey = old;
        return {
          filled: filled, ok: ok, unknown: unknown, chars: chars,
          rate: filled ? ok / filled : null, rhymeBus: rhymeBus
        };
      }

      function computeWorkStats() {
        const works = loadWorks();
        const st = {
          count: works.length, chars: 0, lines: 0, works: works,
          byKind: { 诗: 0, 词: 0 }, byTune: {}, yunBus: {}, charFreq: {},
          months: {}, rateSum: 0, rateN: 0, perfect: 0, noRate: 0,
          longest: null, newest: null
        };
        works.forEach(function (w) {
          const lines = linesOfWork(w);
          st.byKind[w.mode === "ci" ? "词" : "诗"]++;
          const tune = w.mode === "ci" ? (w.ciName || "?") : ((window.SHI[w.shiIndex] || {}).name || "?");
          st.byTune[tune] = (st.byTune[tune] || 0) + 1;
          if (!lines) { st.noRate++; return; }
          const r = rateOfWork(w, lines);
          st.chars += r.chars;
          st.lines += w.values.length;
          if (r.rate !== null) {
            st.rateSum += r.rate;
            st.rateN++;
            if (r.rate === 1) st.perfect++;
          }
          Object.keys(r.rhymeBus).forEach(function (k) {
            st.yunBus[k] = (st.yunBus[k] || 0) + r.rhymeBus[k];
          });
          (w.values || []).forEach(function (row) {
            (row || []).forEach(function (seg) {
              (seg || "").split("").forEach(function (ch) {
                if (!/[\u3400-\u9fff]/.test(ch)) return;
                st.charFreq[ch] = (st.charFreq[ch] || 0) + 1;
              });
            });
          });
          const mm = (w.savedAt || "").match(/(\d{4})\D+(\d{1,2})/);
          if (mm) {
            const key = mm[1] + "-" + ("0" + mm[2]).slice(-2);
            st.months[key] = (st.months[key] || 0) + 1;
          }
          if (!st.longest || r.chars > st.longest.chars) st.longest = { title: w.title, chars: r.chars };
          if (!st.newest || (w.savedAt || "") > (st.newest.savedAt || "")) st.newest = w;
        });
        st.avgRate = st.rateN ? st.rateSum / st.rateN : null;
        return st;
      }

      function statBars(pairs, total, limit) {
        const top = pairs.slice(0, limit || 10);
        const max = top.length ? top[0][1] : 1;
        return top.map(function (p) {
          const pct = Math.round((p[1] / max) * 100);
          return "<div class='st-row'><span class='st-name'>" + esc(p[0]) + "</span>" +
            "<span class='st-bar'><i class='st-fill' style='width:" + pct + "%'></i></span>" +
            "<span class='st-num'>" + p[1] + (total ? "（" + Math.round((p[1] / total) * 100) + "%）" : "") + "</span></div>";
        }).join("");
      }

      function sortPairs(obj) {
        return Object.keys(obj).map(function (k) { return [k, obj[k]]; })
          .sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
      }

      function renderStats() {
        const box = $("stats-body");
        const st = computeWorkStats();
        if (!st.count) {
          box.innerHTML = "<div class='hint'>还没有作品。先写一首并用「保存作品」存进作品库，这里就会开始统计。</div>";
          return;
        }
        let html = "";
        html += "<div class='st-cards'>" +
          "<div class='st-card'><b>" + st.count + "</b><span>作品</span></div>" +
          "<div class='st-card'><b>" + st.chars + "</b><span>总字数</span></div>" +
          "<div class='st-card'><b>" + st.lines + "</b><span>总句数</span></div>" +
          "<div class='st-card'><b>" + statDistinctChars(st) + "</b><span>用过的不同字</span></div>" +
          "<div class='st-card'><b>" + (st.avgRate === null ? "—" : Math.round(st.avgRate * 100) + "%") + "</b><span>平均合律率</span></div>" +
          "<div class='st-card'><b>" + st.perfect + "</b><span>完全合律</span></div>" +
          "</div>";
        html += "<div class='st-note'>合律率按每首作品保存时所用的韵书重算；" +
          (st.noRate ? "有 " + st.noRate + " 首因体式已不在谱中而跳过；" : "") +
          (st.chars ? "平均每首 " + Math.round(st.chars / st.count) + " 字。" : "") + "</div>";

        html += "<div class='st-sec'>体裁分布</div>";
        html += statBars([["诗", st.byKind["诗"]], ["词", st.byKind["词"]]], st.count, 2);

        html += "<div class='st-sec'>常用词牌 / 格律</div>";
        html += statBars(sortPairs(st.byTune), st.count, 10);

        const bus = sortPairs(st.yunBus).slice(0, 10);
        html += "<div class='st-sec'>常用韵部（韵脚统计）</div>";
        if (bus.length) {
          html += "<div class='st-chips'>" + bus.map(function (b) {
            const p = b[0].split("|");
            const label = (p[0] === "中华新韵" ? "新韵·" : "第" + cnNum(+p[1]) + "部·") + (p[2] || "");
            return "<span class='st-chip' title='" + esc(p[0]) + "'>" + esc(label) + "<i>" + b[1] + "</i></span>";
          }).join("") + "</div>";
        } else {
          html += "<div class='hint'>作品里还没有可判定的韵脚。</div>";
        }

        const freq = sortPairs(st.charFreq).slice(0, 16);
        html += "<div class='st-sec'>最常用的字</div>";
        html += freq.length
          ? "<div class='st-chips'>" + freq.map(function (f) {
            return "<span class='st-chip'>" + esc(f[0]) + "<i>" + f[1] + "</i></span>";
          }).join("") + "</div>"
          : "<div class='hint'>暂无。</div>";

        const months = Object.keys(st.months).sort();
        if (months.length) {
          html += "<div class='st-sec'>写作时间线</div>";
          html += statBars(months.map(function (m) { return [m, st.months[m]]; }), st.count, 24);
        }

        if (st.longest) {
          html += "<div class='st-note'>最长的一首：《" + esc(st.longest.title) + "》" + st.longest.chars + " 字" +
            (st.newest ? "　｜　最近保存：《" + esc(st.newest.title || "无题") + "》" + esc((st.newest.savedAt || "").slice(0, 10)) : "") +
            "</div>";
        }
        box.innerHTML = html;
      }

      function statDistinctChars(st) {
        return Object.keys(st.charFreq).length;
      }

      // ---------- 找词牌（按文字 / 条件反查词牌） ----------
      const TUNE_GROUP_OF = {};
      (function () {
        const g = window.CIPU_GROUPS || {};
        Object.keys(g).forEach(function (k) {
          (g[k] || []).forEach(function (n) { TUNE_GROUP_OF[n] = k; });
        });
      })();

      const TUNE_SHAPE_CACHE = {};
      function tuneShapeOf(name) {
        if (TUNE_SHAPE_CACHE[name]) return TUNE_SHAPE_CACHE[name];
        const t = window.CIPU[name];
        const lineLens = t.lines.map(function (l) { return l.parts.join("").length; });
        const flatLens = [];
        t.lines.forEach(function (l) { l.parts.forEach(function (p) { flatLens.push(p.length); }); });
        const pat = t.lines.map(function (l) { return l.parts.join(""); }).join("");
        // 韵脚在全文中的下标 + 该韵句要求的平仄
        const rhymeCells = [];
        let acc = 0;
        t.lines.forEach(function (l, li) {
          if (l.rhyme) rhymeCells.push({ idx: acc + lineLens[li] - 1, req: pat[acc + lineLens[li] - 1] });
          acc += lineLens[li];
        });
        // 按"相邻同调"分组，与 rhymeGroupsCi 同规则
        const groups = [];
        let cur = null;
        rhymeCells.forEach(function (c) {
          const tone = c.req === "平" ? "平" : (c.req === "中" ? "中" : "仄");
          if (t.mode === "叶") {
            if (!cur) { cur = { tone: "叶", cells: [] }; groups.push(cur); }
          } else if (!cur || cur.tone !== tone) {
            cur = { tone: tone, cells: [] };
            groups.push(cur);
          }
          cur.cells.push(c);
        });
        const shape = {
          lineLens: lineLens, flatLens: flatLens, pat: pat,
          total: pat.length, lines: t.lines.length, rhymeGroups: groups,
          group: TUNE_GROUP_OF[name] || "", mode: t.mode, note: t.note || ""
        };
        TUNE_SHAPE_CACHE[name] = shape;
        return shape;
      }

      // 一组韵脚是否同韵（与 groupVerdict 同规则：同部 + 同声调类，叶韵时平上去互叶、入声独用）
      function rhymeOkFor(gr, chars) {
        const infos = gr.cells.map(function (c) { return charCats(chars[c.idx] || ""); })
          .filter(function (x) { return x.rs.length; });
        if (infos.length < 2) return null;
        const ref = infos[0];
        const isYe = gr.tone === "叶";
        for (let i = 1; i < infos.length; i++) {
          const e = infos[i];
          let buOk = false, catOk = false;
          e.bus.forEach(function (b) { if (ref.bus.has(b)) buOk = true; });
          e.cats.forEach(function (c) {
            if (isYe) {
              ref.cats.forEach(function (rc) {
                if ((c === "入" && rc === "入") || (c !== "入" && rc !== "入")) catOk = true;
              });
            } else if (ref.cats.has(c)) catOk = true;
          });
          if (!buOk || !catOk) return false;
        }
        return true;
      }

      function tuneFindResults(text, filters) {
        const chunks = text ? splitPoemChunks({ c: [text] }) : [];
        const chars = chunks.join("");
        const total = chars.length;
        const hasShape = chunks.length >= 2;
        const rows = [];
        Object.keys(window.CIPU).forEach(function (name) {
          const s = tuneShapeOf(name);
          if (filters.group && s.group !== filters.group) return;
          if (filters.lines && s.lines !== filters.lines) return;
          if (filters.chars && s.total !== filters.chars) return;
          if (total && s.total !== total) return;

          let shapeRate = null;
          if (total && hasShape) {
            if (chunks.length === s.lineLens.length) {
              let same = 0;
              chunks.forEach(function (c, i) { if (c.length === s.lineLens[i]) same++; });
              shapeRate = same / s.lineLens.length;
            } else if (chunks.length === s.flatLens.length) {
              let same = 0;
              chunks.forEach(function (c, i) { if (c.length === s.flatLens[i]) same++; });
              shapeRate = (0.99 * same) / s.flatLens.length;   // 与"豆"分段逐段吻合，等同整齐断句
            } else {
              shapeRate = 0;
            }
            if (shapeRate < 0.5) return;   // 断句差得太远，不列为候选
          }

          let toneRate = null, rhymeRate = null;
          if (total) {
            let filled = 0, ok = 0;
            for (let i = 0; i < s.pat.length; i++) {
              if (s.pat[i] === "中") continue;
              const r = checkTone(chars[i], s.pat[i]);
              if (r.ok === null) continue;
              filled++;
              if (r.ok) ok++;
            }
            toneRate = filled ? ok / filled : null;
            let gTotal = 0, gOk = 0;
            s.rhymeGroups.forEach(function (gr) {
              if (gr.cells.length < 2) return;
              const v = rhymeOkFor(gr, chars);
              if (v === null) return;
              gTotal++;
              if (v) gOk++;
            });
            rhymeRate = gTotal ? gOk / gTotal : null;
          }

          let score;
          if (!total) {
            score = 100;   // 纯条件筛选
          } else {
            const tr = toneRate === null ? 0.5 : toneRate;
            const rr = rhymeRate === null ? 0.7 : rhymeRate;
            score = (shapeRate === null ? tr * 0.6 + rr * 0.4
              : shapeRate * 0.4 + tr * 0.4 + rr * 0.2) * 100;
          }
          rows.push({ name: name, score: score, shapeRate: shapeRate, toneRate: toneRate, rhymeRate: rhymeRate, s: s });
        });
        rows.sort(function (a, b) {
          if (b.score !== a.score) return b.score - a.score;
          return a.s.total - b.s.total;
        });
        return { rows: rows, total: total, chunks: chunks.length, hasShape: hasShape };
      }

      function renderTuneFind() {
        const box = $("tf-result");
        const text = ($("tf-text").value || "").trim();
        const filters = {
          chars: +$("tf-chars").value || 0,
          lines: +$("tf-lines").value || 0,
          group: $("tf-mode").value || ""
        };
        const r = tuneFindResults(text, filters);
        if (!r.rows.length) {
          box.innerHTML = "<div class='hint'>没有匹配的词牌。可放宽条件，或把完整句子（带标点）粘进来再试。</div>";
          return;
        }
        let html = "<div class='hint'>" + (r.total
          ? "已按你的文字（" + r.total + " 字、" + r.chunks + " 个句读段）比对 157 个词牌，得到 " +
            r.rows.length + " 个候选（按匹配度排序）："
          : "共 " + r.rows.length + " 个词牌符合条件：") + "</div>";
        r.rows.slice(0, 30).forEach(function (row) {
          const s = row.s;
          const pct = Math.round(row.score);
          const color = pct >= 85 ? "var(--green)" : pct >= 65 ? "#c07f2a" : "var(--gray)";
          const bits = [];
          if (row.shapeRate !== null) bits.push("句长吻合 " + Math.round(row.shapeRate * 100) + "%");
          if (row.toneRate !== null) bits.push("平仄合律 " + Math.round(row.toneRate * 100) + "%");
          if (row.rhymeRate !== null) bits.push("押韵 " + Math.round(row.rhymeRate * 100) + "%");
          html += "<div class='tf-item'>" +
            "<div class='tf-head'>" +
            "<span class='tf-name'>《" + esc(row.name) + "》</span>" +
            "<span class='tf-score' style='color:" + color + "'>匹配度 " + pct + "%</span>" +
            "<span class='tf-meta'>" + s.total + " 字 │ " + s.lines + " 句 │ " + linkTerms(esc(s.group || "未分组")) + "</span>" +
            "<button class='small-btn' data-tf-fit='" + esc(row.name) + "'>用此词牌填</button>" +
            "</div>" +
            (bits.length ? "<div class='tf-metrics'>" + esc(bits.join(" │ ")) + "</div>" : "") +
            (s.note ? "<div class='tf-meta'>注：" + esc(s.note) + "</div>" : "") +
            "</div>";
        });
        box.innerHTML = html;
      }

      function fitTextToTune(name, text) {
        const t = window.CIPU[name];
        if (!t) return;
        state.mode = "ci";
        state.ciName = name;
        if (!text) {
          resetValues();
          syncModeUI(); renderMeta(); renderEditor(); renderReport(); saveState();
          switchPage("write");
          toast("已切到《" + name + "》");
          return;
        }
        const lens = t.lines.map(function (l) { return l.parts.join("").length; });
        const chunks = splitPoemChunks({ c: [text] });
        let off = matchWindow(chunks, lens);
        let flatMode = false;
        if (off === -1) {
          // 带「豆」的词牌：允许按逐段（parts）长度对齐
          const flat = [];
          t.lines.forEach(function (l) { l.parts.forEach(function (p) { flat.push(p.length); }); });
          const off2 = matchWindow(chunks, flat);
          if (off2 !== -1) { off = off2; flatMode = true; }
        }
        if (off === -1) {
          resetValues();
          syncModeUI(); renderMeta(); renderEditor(); renderReport(); saveState();
          switchPage("write");
          toast("已切到《" + name + "》，但断句与词谱不一致，未自动填入");
          return;
        }
        if (flatMode) {
          let k = off;
          state.values = t.lines.map(function (l) {
            return l.parts.map(function () {
              const s = chunks[k] || "";
              k++;
              return s;
            });
          });
        } else {
          state.values = t.lines.map(function (l, li) {
            const src = chunks[off + li];
            let pos = 0;
            return l.parts.map(function (p) {
              const s = src.slice(pos, pos + p.length);
              pos += p.length;
              return s;
            });
          });
        }
        syncModeUI(); renderMeta(); renderEditor(); renderReport(); saveState();
        switchPage("write");
        updateLastYunFromEditor();
        toast("已用《" + name + "》装入你的文字");
      }

      // ---------- 集句检索（全库单句检索 / 平仄检索） ----------
      let jijuIndex = null;
      let jijuIndexKey = "";
      const TONE_CLASS_CACHE = {};

      function toneClassCached(ch) {
        const k = yunKey + "|" + ch;
        if (TONE_CLASS_CACHE[k]) return TONE_CLASS_CACHE[k];
        const info = infoOf(ch);
        let v;
        if (!info.readings.length) v = "?";
        else if (info.hasPing && info.hasZe) v = "中";
        else v = info.hasPing ? "平" : "仄";
        TONE_CLASS_CACHE[k] = v;
        return v;
      }

      // 把已加载的全库切成单句建索引（结果随全库加载进度自动重建）
      function jijuIndexRows() {
        const key = quanLoaded + ":" + (quanDone ? 1 : 0);
        if (jijuIndex && jijuIndexKey === key) return jijuIndex;
        const rows = [];
        allWorks().forEach(function (w) {
          const k = kindOf(w);
          if (k === "文") return;   // 古文散句不进集句库
          (w.c || []).forEach(function (raw) {
            const line = String(raw).replace(/[（(][^（）()]*[）)]/g, "").replace(/[·•]/g, "");
            line.split(/[，。！？；：、\s]+/).forEach(function (seg) {
              const s = seg.replace(/[^\u3400-\u9fff]/g, "");
              if (s.length < 4) return;
              rows.push({ s: s, t: w.t || "", a: w.a || "", d: w.d || "", p: w.p || "", k: k, w: w });
            });
          });
        });
        jijuIndex = rows;
        jijuIndexKey = key;
        return rows;
      }

      function jijuSearch(q) {
        const rows = jijuIndexRows();
        const kw = (q.kw || "").trim();
        const pat = (q.pat || "").replace(/[^\u4e00-\u9fff]/g, "");
        const len = q.len > 0 ? q.len : (pat ? pat.length : 0);
        const limit = q.limit || 60;
        const out = [];
        let matched = 0;
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (q.kind && r.k !== q.kind) continue;
          if (len && r.s.length !== len) continue;
          if (kw && r.s.indexOf(kw) === -1) continue;
          if (pat) {
            let ok = true;
            for (let j = 0; j < pat.length; j++) {
              const req = pat[j];
              if (req === "中" || req === "不") continue;
              const t = toneClassCached(r.s[j]);
              if (t === "?") { ok = false; break; }
              if (req === "平" && t === "仄") { ok = false; break; }
              if (req === "仄" && t === "平") { ok = false; break; }
            }
            if (!ok) continue;
          }
          matched++;
          if (out.length < limit) out.push(r);
        }
        return { rows: out, matched: matched, scanned: rows.length };
      }

      function toneStringOf(s) {
        return s.split("").map(function (c) { return toneClassCached(c); }).join("");
      }

      function jijuHl(s, kw) {
        if (!kw) return esc(s);
        const i = s.indexOf(kw);
        if (i === -1) return esc(s);
        return esc(s.slice(0, i)) + "<span class='hl'>" + esc(kw) + "</span>" + esc(s.slice(i + kw.length));
      }

      function renderJiju() {
        const box = $("jj-result");
        const q = {
          kw: $("jj-kw").value || "",
          len: +$("jj-len").value || 0,
          pat: $("jj-pat").value || "",
          kind: $("jj-kind").value || "",
          limit: +$("jj-limit").value || 60
        };
        if (!q.kw.trim() && !q.pat.trim() && !q.len) {
          box.innerHTML = "<div class='hint'>请至少填一项：关键词、字数或平仄。</div>";
          return;
        }
        const t0 = performance.now();
        const r = jijuSearch(q);
        const ms = Math.round(performance.now() - t0);
        if (!r.rows.length) {
          box.innerHTML = "<div class='hint'>没有找到符合条件的句子（已扫描 " + r.scanned + " 句，用时 " + ms + "ms）。可放宽字数或把平仄里的固定位置改成「中」。</div>";
          return;
        }
        let html = "<div class='hint'>在 " + r.scanned + " 句中命中 <b>" + r.matched + "</b> 句" +
          (r.matched > r.rows.length ? "，显示前 " + r.rows.length + " 句" : "") +
          "（用时 " + ms + "ms；平仄按当前韵书《" + esc(yunLabel()) + "》判定，「中」为平仄两读）：</div>";
        r.rows.forEach(function (row, i) {
          html += "<div class='jj-item'>" +
            "<div class='jj-line'>" + jijuHl(row.s, (q.kw || "").trim()) + "</div>" +
            "<div class='jj-src'>" +
            "<span>" + esc(row.d ? row.d + " │ " : "") + esc(row.a) + "《" + esc(row.t) + "》" +
            (row.p ? " │ " + esc(row.p) : "") + "</span>" +
            "<span class='jj-tone'>" + esc(toneStringOf(row.s)) + "</span>" +
            "<button class='small-btn' data-jj-use='" + i + "'>用此句</button>" +
            "<button class='small-btn' data-jj-copy='" + i + "'>复制</button>" +
            "<button class='small-btn' data-jj-open='" + i + "'>看全篇</button>" +
            "</div></div>";
        });
        box.innerHTML = html;
        JJU_RESULT_ROWS = r.rows;
      }

      let JJU_RESULT_ROWS = [];

      function copyPlainText(text, okMsg) {
        const msg = okMsg || "已复制到剪贴板";
        function legacy() {
          let ok = false;
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.top = "0";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          try {
            ta.focus();
            ta.select();
            ta.setSelectionRange(0, ta.value.length);
            ok = document.execCommand("copy");
          } catch (e) {
            ok = false;
          }
          document.body.removeChild(ta);
          toast(ok ? msg : "复制失败，请手动选择复制");
          return ok;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            return navigator.clipboard.writeText(text).then(function () {
              toast(msg);
              return true;
            }, function () {
              return legacy();
            });
          } catch (e) {
            return Promise.resolve(legacy());
          }
        }
        return Promise.resolve(legacy());
      }

      function jijuFill(text) {
        const lines = currentLines();
        let li = lastFocusLi;
        if (li === null || !lines[li]) {
          li = -1;
          for (let i = 0; i < lines.length; i++) {
            const need = lines[i].parts.join("").length;
            if ((state.values[i] || []).join("").length < need) { li = i; break; }
          }
          if (li === -1) li = 0;
        }
        const line = lines[li];
        if (!line) { copyPlainText(text, "已复制「" + text + "」"); return; }
        const need = line.parts.join("").length;
        if (text.length !== need) {
          copyPlainText(text, "这句 " + text.length + " 字，第" + (li + 1) + "句要 " + need + " 字，已复制到剪贴板");
          return;
        }
        let off = 0;
        state.values[li] = line.parts.map(function (p) {
          const s = text.slice(off, off + p.length);
          off += p.length;
          return s;
        });
        renderEditor();
        renderReport();
        saveState();
        switchPage("write");
        toast("已把「" + text + "」填入第" + (li + 1) + "句");
      }

      // 记录写作页当前聚焦的句，供"用此句"定位
      let lastFocusLi = null;
      document.addEventListener("focusin", function (e) {
        if (!e.target || !e.target.closest) return;
        const inp = e.target.closest("#editor-body input[data-li]");
        if (inp) lastFocusLi = +inp.dataset.li;
      });

      // ---------- 术语解释 ----------
      const GLOSSARY = [
        {
          group: "格律与平仄",
          terms: [
            ["平仄", "中古汉语声调的两大分类：平声为「平」，上声、去声、入声为「仄」。近体诗与词都靠平仄交错形成格律。"],
            ["近体诗", "唐代定型的格律诗，包括五绝、七绝、五律、七律，讲究平仄、粘对与押韵。与本程序里的「诗格律」十六式对应。"],
            ["中", "谱式里的「中」表示这一格平仄皆可（可平可仄），程序不计入合格率。"],
            ["两读字", "有平、仄两种读音的字（如「看」「重」「衣」）。程序中任一读音合律即算通过，界面标紫色。"],
            ["入声", "中古四声之一，属仄声。普通话已没有入声，所以按《词林正韵》写作、按普通话读时最容易看错（如「发」「白」「一」「不」）。"],
            ["孤平", "入韵的平收句里，除韵脚外没有平声，或只剩一个平声且与韵脚不相连（如「仄平仄仄平」），是律诗大忌。"],
            ["拗救", "该用平声处用了仄声叫「拗」，在本句或对句的相应位置改用平声补回叫「救」。常见如五言「平平仄平仄」、七言「仄仄平平仄平仄」。"],
            ["三平尾", "句末三字全是平声（如「仄仄平平平」），近体诗大忌，韵句尤其要避免。"],
            ["三仄尾", "句末三字全是仄声。上句尚可容忍，韵句宜避免。"],
            ["失对", "同一联内，出句与对句的第二字平仄应相反；相同即「失对」。"],
            ["失粘", "上一联的对句与下一联的出句，第二字平仄应相同；相反即「失粘」。"],
            ["粘对", "近体诗「对」（同联两句第二字相反）与「粘」（相邻两联第二字相同）的合称，都以每句第二字为准。"],
            ["一三五不论", "俗谚：七言的第一、三、五字平仄可放宽（五言为第一、三字）。「不论」以不犯孤平、三平尾为限；本程序分「宽格」「严格」两档，可在「格律详解」页切换。"],
            ["二四六分明", "与「一三五不论」相对：七言的第二、四、六字（五言为第二、四字）平仄必须分明，不可通融。这是判定粘对的依据。"],
            ["上尾", "相邻两联的上句（非韵句）末字都用同一声调（尤指都用上声），音节板滞，是「八病」之一。宋以后已多有通融。"],
            ["鹤膝", "「八病」之一：相邻两联的上句末字都用同一类声调，与上尾相近，现代写作多不计较。"],
            ["八病", "南朝沈约提出的作诗八忌：平头、上尾、蜂腰、鹤膝、大韵、小韵、旁纽、正纽。近体诗定型后只保留与平仄、粘对相关者，本程序查其中易判的部分。"],
            ["重字", "同一首诗中重复使用同一个字。律绝一般要避免（有意复说、叠字除外），但古人名篇中偶有为之。"],
            ["合掌", "一联中出句与对句意思重复、用同义词相对，如「孤」对「独」、「朝」对「晨」。对仗之忌。"],
            ["折腰体", "第三句与第二句本应相粘而故意失粘，称「折腰」。看似失粘，实则意脉不断，是唐人绝句中的特例（如王维《送元二使安西》）。本程序会照常报「失粘」，属正常提示。"],
            ["孤雁出群格", "首句入韵而借用邻韵（如东借冬、先借寒）。因首句本可入可不入，借韵无伤。本程序判为「可」并单独标注。"],
            ["孤雁入群格", "末句韵脚借用邻韵，与「孤雁出群」相对。更少见，古今争议更多；本程序按出韵处理，只在说明里提示可能是此格。"],
            ["仄韵绝句", "全篇押仄声（上去入）韵的绝句，如孟浩然《春晓》、柳宗元《江雪》。近体诗以平韵为正，仄韵属变体。"],
            ["排律", "又称长律，律诗的延长体：八句以上、句数成双，除首尾两联外每联都要对仗，粘对规则与律诗一致。"],
            ["宽格", "本程序的检测口径之一：按「一三五不论」放宽五言第 1、3 位与七言第 1、3、5 位的平仄要求，但仍查孤平、三平尾、粘对、押韵。"],
            ["严格", "本程序的检测口径之一：「中」以外的每一格都要合律，不适用「一三五不论」，用来发现唐诗中常见的放宽写法。"]
          ]
        },
        {
          group: "押韵",
          terms: [
            ["韵部", "韵书把可以通押的韵合并成的单位。《词林正韵》共 19 部；《中华新韵》共 14 部。"],
            ["韵目", "韵部之内具体的韵，如「一东」「二冬」「十一尤」。"],
            ["韵脚", "押韵的句子里末尾那个字。"],
            ["押韵", "各韵脚字的韵部相同（或依规则可通押）。"],
            ["同韵", "韵脚字在同一韵部，判定为押韵。"],
            ["出韵", "韵脚字与同组主韵不在同一韵部，且不能通押。若换了韵而未换韵式，多半就是出韵。"],
            ["叶韵", "又作「协韵」，指平、上、去三声互相押韵（入声依旧独用）。西江月、天净沙、平湖乐属「平仄通叶」。"],
            ["换韵", "一首词中途换到另一个韵部，常见平韵、仄韵交替，如菩萨蛮、南乡子等「平仄转换」的调子。"],
            ["借邻韵", "近体诗首句入韵时，可以借用相邻韵部的字。首句以外的韵脚一般不许借。"],
            ["首句入韵", "近体诗第一句就押韵。首句入韵与不入韵构成不同的格式（本程序十六式里分别标注）。"],
            ["平水韵", "宋以后通行的诗韵（106 韵），近体诗押韵的传统依据。《词林正韵》与之大体一致，只是把邻韵合并了。"],
            ["词林正韵", "清代戈载编的词韵，分 19 部，保留入声，是填词的传统依据。"],
            ["中华新韵", "按普通话分部的现代诗韵，共 14 部，没有入声；阴平、阳平为平，上声、去声为仄。"],
            ["平韵格", "全篇押平声韵的词调，数量最多，如忆江南、浣溪沙、水调歌头。"],
            ["仄韵格", "全篇押仄声韵的词调，如如梦令、念奴娇、满江红（多用人声韵）。"],
            ["平仄转换", "同一首词里平韵与仄韵交替使用（换韵），如菩萨蛮、南乡子、调笑令。"],
            ["平仄通叶", "平、上、去三声通押、入声独用的韵式，只有西江月、天净沙、平湖乐等少数词调。"]
          ]
        },
        {
          group: "词体与词谱",
          terms: [
            ["词牌", "词调的名称，如「水调歌头」。它决定这首词的字数、句式、平仄与韵式。"],
            ["词谱", "词牌的具体格式：每句多少字、逐字平仄如何、哪几句押韵。"],
            ["又一体", "同一词牌常有多种格式（字数、断句或平仄不同），先出的称「正体」，其余称「又一体」。遇到名篇与谱式不大合，多半是这个原因。"],
            ["正体", "一个词牌被韵书 / 词谱认定为标准的那一种格式，其余格式称「又一体」。本程序的谱式即以正体为主。"],
            ["单调", "不分段的词，如十六字令、如梦令（同为短调）。"],
            ["双调", "分上下两段的词，是最常见的形式。"],
            ["三叠", "分三段的词，如兰陵王、莺啼序（莺啼序实为四段，属长调中的特例）。"],
            ["上阕", "词的前一段，也叫上片。"],
            ["下阕", "词的后一段，也叫下片。"],
            ["过片", "下阕的开头。讲究与上阕衔接又另起新意。"],
            ["换头", "双调词下阕首句的句式与上阕首句不同，称为换头。"],
            ["豆", "即「读」，句中语气上的停顿，不等于一句。词谱里常以「、」表示；本程序把带豆的句子拆成同一句里的多个输入格。"],
            ["领字", "领起下文的字，如「望」「对」「念」「想」，多为一字领或二字领，平仄要求较宽。"],
            ["令", "词调按篇幅的一类，多指短小的调子，如十六字令、如梦令。"],
            ["引", "词调名目之一，篇幅介于令与慢之间，如太常引、千秋岁引。"],
            ["近", "词调名目之一，如祝英台近，篇幅略近于慢词。"],
            ["慢", "即慢词，篇幅较长、节奏舒缓的调子，如声声慢、扬州慢。"],
            ["摊破", "在原调基础上增加字数、拆破句式而成的变体，如摊破浣溪沙。"],
            ["减字", "在原调基础上减少字数而成的变体，如减字木兰花。"],
            ["添字", "在原调基础上增加字数而成的变体。"],
            ["倚声", "依照词调的声情、句度来填词，是古人填词的说法。"]
          ]
        }
      ];
      const TERM_MAP = {};
      GLOSSARY.forEach(function (g) {
        (g.terms || []).forEach(function (t) { TERM_MAP[t[0]] = t[1]; });
      });
      // 正文里自动加注的术语：只收多字词，避免把单字（如「中」）误标
      const LINK_TERMS = Object.keys(TERM_MAP).filter(function (t) { return t.length >= 2; })
        .sort(function (a, b) { return b.length - a.length; });
      const LINK_RE = new RegExp("(" + LINK_TERMS.join("|") + ")", "g");

      // 传入「已经转义过」的纯文本，返回带术语标注的 HTML
      function linkTerms(text) {
        if (!text) return text;
        return String(text).replace(LINK_RE, function (m) {
          return "<span class='term' data-term='" + esc(m) + "' data-tip='" + esc(TERM_MAP[m]) + "'>" + m + "</span>";
        });
      }

      function renderGlossary(kw) {
        const q = (kw || "").trim();
        let html = "";
        GLOSSARY.forEach(function (g) {
          const items = (g.terms || []).filter(function (t) {
            return !q || t[0].indexOf(q) !== -1 || t[1].indexOf(q) !== -1;
          });
          if (!items.length) return;
          html += "<div class='gloss-group'>" + esc(g.group) + "</div>";
          items.forEach(function (t) {
            html += "<div class='gloss-item' id='gloss-" + esc(t[0]) + "'>" +
              "<span class='gloss-term'>" + esc(t[0]) + "</span>" +
              "<span class='gloss-def'>" + esc(t[1]) + "</span></div>";
          });
        });
        $("glossary-body").innerHTML = html || "<div class='hint'>没有匹配的术语。</div>";
      }

      function openGlossary(term) {
        $("glossary-search").value = term || "";
        renderGlossary(term || "");
        $("glossary-overlay").classList.add("show");
        if (term) {
          const el = document.getElementById("gloss-" + term);
          if (el) {
            el.classList.add("hit");
            setTimeout(function () {
              if (el.scrollIntoView) el.scrollIntoView({ block: "center" });
            }, 60);
          }
        }
      }

      // ---------- 粘贴导入 ----------
      function openImportModal() {
        $("import-text").value = "";
        $("import-overlay").classList.add("show");
        setTimeout(function () { $("import-text").focus(); }, 50);
      }

      function confirmImport() {
        const text = $("import-text").value;
        if (!text.trim()) {
          toast("请先粘贴内容");
          return;
        }
        const lines = currentLines();
        const lens = lines.map(function (l) { return l.parts.join("").length; });
        const chunks = splitPoemChunks({ c: [text] });
        const off = matchWindow(chunks, lens);
        if (off === -1) {
          toast("内容分段与当前" + (state.mode === "shi" ? "格律" : "词谱") + "不一致，无法导入");
          return;
        }
        state.values = lines.map(function (l, li) {
          const src = chunks[off + li];
          let pos = 0;
          return l.parts.map(function (p) {
            const s = src.slice(pos, pos + p.length);
            pos += p.length;
            return s;
          });
        });
        renderEditor();
        renderReport();
        saveState();
        $("import-overlay").classList.remove("show");
        updateLastYunFromEditor();
        toast("已按" + (state.mode === "shi" ? "格律" : "词谱") + "导入");
      }

      function commonRank(ch) {
        const i = window.COMMON_CHARS.indexOf(ch);
        return i === -1 ? 9999 : i;
      }

      // ---------- 自动成句（灵感参考） ----------
      const SHICI_WORDS = [
        "明月", "清风", "落花", "流水", "青山", "白云", "天涯", "故人", "归舟", "夕阳",
        "暮色", "寒江", "孤城", "远山", "春雨", "秋风", "飞雪", "断肠", "相思", "离愁",
        "醉眼", "疏影", "暗香", "青梅", "竹马", "梧桐", "芭蕉", "燕子", "杜鹃", "黄莺",
        "碧水", "红蕖", "金风", "玉露", "银河", "星斗", "月色", "花香", "鸟语", "泉声",
        "松涛", "竹影", "书声", "琴韵", "剑影", "萍踪", "客路", "乡愁", "家书", "雁字",
        "鱼书", "柳絮", "杨花", "桃李", "桂子", "荷花", "莲叶", "菱歌", "渔火", "江枫",
        "边草", "塞雁", "胡尘", "羌笛", "芦管", "戍楼", "烽烟", "战马", "金戈", "铁马",
        "玉关", "阳关", "灞桥", "长亭", "短亭", "古道", "西风", "瘦马", "断桥", "残雪",
        "孤舟", "远帆", "轻舟", "画舫", "朱楼", "画堂", "绮户", "雕栏", "玉砌", "朱门",
        "柴扉", "竹篱", "茅檐", "瓦舍", "烟村", "水村", "山村", "渔村", "江村", "故园",
        "家山", "海角", "关山", "万水", "千山", "层云", "暮霭", "朝霞", "晚照", "斜晖",
        "残阳", "落日", "新月", "残月", "皓月", "婵娟", "姮娥", "织女", "牛郎", "鹊桥",
        "七夕", "中秋", "重阳", "寒食", "清明", "端午", "除夕", "元夕", "元宵", "上元",
        "花朝", "谷雨", "霜降", "大雪", "小雪", "白露", "惊蛰", "春分", "夏至", "秋分",
        "冬至", "绿荫", "翠竹", "红梅", "白莲", "黄菊", "紫藤", "青苔", "碧梧", "丹枫",
        "竹篱", "荷锄", "采菊", "种瓜", "垂钓", "泛舟", "听雨", "观云", "赏月", "品茶",
        "吟诗", "作赋", "抚琴", "吹箫", "舞剑", "挥毫", "泼墨", "焚香", "煮酒", "对弈",
        "登高", "望远", "凭栏", "倚楼", "回首", "凝眸", "低眉", "举杯", "把酒", "临风",
        "踏雪", "寻梅", "折柳", "赠别", "送客", "迎春", "惜别", "怀人", "忆旧", "思亲",
        "边关", "故城", "孤村", "野渡", "荒丘", "古寺", "禅房", "钟声", "梵音", "渔灯",
        "牧笛", "樵歌", "市声", "车马", "尘埃", "浮云", "逝水", "流光", "岁月", "年华",
        "青衫", "素衣", "罗裙", "玉簪", "金钗", "红豆", "青丝", "白发", "朱颜", "红颜"
      ];

      let allWordsCache = null;
      function allWords() {
        if (allWordsCache) return allWordsCache;
        const seen = {};
        const out = [];
        function add(list) {
          (list || []).forEach(function (w) {
            if (w && w.length >= 2 && !seen[w]) { seen[w] = 1; out.push(w); }
          });
        }
        add(window.COMMON_WORDS);
        add(SHICI_WORDS);
        allWordsCache = out;
        return out;
      }

      function wordFitsAt(word, pat, pos) {
        for (let i = 0; i < word.length; i++) {
          const req = pat[pos + i];
          if (!req) return false;
          if (req === "中") continue;
          const info = infoOf(word[i]);
          if (!info.readings.length) return false;
          if (req === "平" && !info.hasPing) return false;
          if (req === "去" && !info.hasQu) return false;
          if (req === "仄" && !info.hasZe) return false;
        }
        return true;
      }

      let genSeed = 0;
      function buildLine(pat, R) {
        const n = pat.length;
        const chosen = new Array(n).fill("");
        chosen[n - 1] = R;
        if (!wordFitsAt(R, pat, n - 1)) return null;
        const used = new Set([R]);
        const ws = allWords();
        let i = 0, words = 0;
        while (i < n - 1) {
          let placed = false;
          const fits = [];
          for (const word of ws) {
            if (word.length !== 2 || i + 1 > n - 2) continue;
            if (used.has(word[0]) || used.has(word[1])) continue;
            if (wordFitsAt(word, pat, i)) fits.push(word);
          }
          if (fits.length) {
            // 按常用度排序后带随机性地挑选，偏向常用词
            fits.sort(function (a, b) {
              return (commonRank(a[0]) + commonRank(a[1])) - (commonRank(b[0]) + commonRank(b[1]));
            });
            const pick = fits[Math.floor(Math.pow(Math.random(), 0.7) * fits.length)];
            chosen[i] = pick[0];
            chosen[i + 1] = pick[1];
            used.add(pick[0]);
            used.add(pick[1]);
            i += 2;
            words++;
            placed = true;
          } else {
            const cfits = window.COMMON_CHARS.filter(function (c) {
              return !used.has(c) && wordFitsAt(c, pat, i);
            });
            if (cfits.length) {
              const pick = cfits[Math.floor(Math.random() * cfits.length)];
              chosen[i] = pick;
              used.add(pick);
              i++;
              placed = true;
            }
          }
          if (!placed) return null;
        }
        return { text: chosen.join(""), words: words };
      }

      function generateLines(pat, rhymeChars, limit) {
        const out = [];
        const seen = {};
        const cands = rhymeChars.slice(0, 48);
        // 每个韵脚字尝试多次，增加多样性
        for (let attempt = 0; attempt < 3; attempt++) {
          cands.forEach(function (R) {
            const line = buildLine(pat, R);
            if (!line || line.words === 0) return;
            if (seen[line.text]) return;
            seen[line.text] = 1;
            let score = -line.words * 60;
            const repeatPenalty = new Set(line.text.split("")).size === line.text.length ? 0 : 40;
            for (let k = 0; k < line.text.length; k++) score += commonRank(line.text[k]);
            score += repeatPenalty;
            out.push({ text: line.text, score: score, words: line.words });
          });
        }
        out.sort(function (a, b) { return a.score - b.score; });
        return out.slice(0, limit);
      }

      function targetRhymeLine() {
        const lines = currentLines();
        if (state.mode === "shi") {
          let count = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].rhyme) {
              count++;
              if (count === 2) return i;
            }
          }
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].rhyme) return i;
          }
          return 0;
        }
        const groups = rhymeGroupsCi();
        return groups.length ? groups[0].lines[0] : 0;
      }

      function rhymeWordChips(rhymeSet, limit) {
        const words = allWords();
        const out = [];
        words.forEach(function (w) {
          const last = w[w.length - 1];
          if (rhymeSet.has(last)) out.push(w);
        });
        out.sort(function (a, b) {
          return commonRank(a[a.length - 1]) - commonRank(b[b.length - 1]) ||
            (a < b ? -1 : 1);
        });
        return out.slice(0, limit);
      }

      function openGenerator(btn) {
        const kind = btn.dataset.gen;
        const gi = kind === "ci" ? +btn.dataset.group : 0;
        const boxId = kind === "shi" ? "gen-shi" : "gen-ci-" + gi;
        const box = document.getElementById(boxId);
        if (!box) return;
        const targetLi = targetRhymeLine();
        const lines = currentLines();
        const pat = lines[targetLi].parts.join("");
        const rhymeChars = kind === "shi" ? suggestShi() : suggestCi(gi);
        if (!rhymeChars.length) {
          box.innerHTML = "<div class='hint'>请先填写一个可识别的韵脚字。</div>";
          box.classList.add("show");
          return;
        }
        genSeed++;
        const suggs = generateLines(pat, rhymeChars, 8);
        const rhymeSet = new Set(rhymeChars.slice(0, 120));
        const chips = rhymeWordChips(rhymeSet, 12);
        let html = "<div class='word-chips'>";
        if (chips.length) {
          html += "<span class='hint'>常用韵脚词：</span>";
          chips.forEach(function (w) {
            html += "<span class='w' data-word='" + esc(w) + "'>" + esc(w) + "</span>";
          });
        }
        html += "</div>";
        html += "<div class='hint'>以下为按格律与韵部机械组合的参考句，仅供灵感，请自行润色。</div>";
        suggs.forEach(function (s) {
          html += "<span class='sugg-line' data-line='" + targetLi + "'>" + esc(s.text) + "</span>";
        });
        if (!suggs.length) html += "<div class='hint'>暂未能组合出合适的句子，换个韵脚或词牌试试。</div>";
        html += "<button class='action' data-regen='1' style='margin-top:6px'>换一批</button>";
        box.innerHTML = html;
        box.classList.add("show");
        box.dataset.li = targetLi;
        box.dataset.genKind = kind;
        box.dataset.genGroup = gi;
      }

      function suggestShi() {
        const lines = currentLines();
        const rhymeLines = [];
        lines.forEach(function (l, i) { if (l.rhyme) rhymeLines.push(i); });
        const infos = rhymeLines.map(function (i) { return charCats(lastCharOf(i)); });
        let main = -1;
        infos.forEach(function (info, i) {
          if (main === -1 && info.rs.some(function (r) { return r.tone === "平"; })) main = i;
        });
        if (main === -1) return [];
        const mainYi = infos[main].rs.filter(function (r) { return r.tone === "平"; })[0].yi;
        const out = [];
        const CHARS = yunChars();
        for (const ch in CHARS) {
          if (!Object.prototype.hasOwnProperty.call(CHARS, ch)) continue;
          if (readingsOf(ch).some(function (r) { return r.yi === mainYi && r.tone === "平"; })) out.push(ch);
        }
        out.sort(function (a, b) { return commonRank(a) - commonRank(b) || (a < b ? -1 : 1); });
        return out.slice(0, 200);
      }

      function suggestCi(gi) {
        const t = window.CIPU[state.ciName];
        const groups = rhymeGroupsCi();
        const g = groups[gi];
        if (!g) return [];
        const entries = g.lines.map(function (i) {
          return { li: i, ch: lastCharOf(i), info: charCats(lastCharOf(i)) };
        });
        const filled = entries.filter(function (e) { return e.ch && e.info.rs.length; });
        if (filled.length) {
          const ref = filled[0].info;
          const refBu = ref.rs[0].bu;
          const refCat = catOfTone(ref.rs[0].tone);
          const isYe = t.mode === "叶";
          const out = [];
          const CHARS = yunChars();
          for (const ch in CHARS) {
            if (!Object.prototype.hasOwnProperty.call(CHARS, ch)) continue;
            const rs = readingsOf(ch);
            if (rs.some(function (r) {
              if (r.bu !== refBu) return false;
              const c = catOfTone(r.tone);
              if (isYe) return (c === "入" && refCat === "入") || (c !== "入" && refCat !== "入");
              return c === refCat;
            })) out.push(ch);
          }
          out.sort(function (a, b) { return commonRank(a) - commonRank(b) || (a < b ? -1 : 1); });
          return out.slice(0, 220);
        }
        // 未填韵脚：优先用内置例词的韵脚定韵部
        const ex = window.LICI[state.ciName];
        if (ex && g.lines.length) {
          const exline = ex.lines[g.lines[0]];
          if (exline) {
            const ch = exline.join("").slice(-1);
            const ref = charCats(ch);
            if (ref.rs.length) {
              const refBu = ref.rs[0].bu;
              const refCat = catOfTone(ref.rs[0].tone);
              const isYe = t.mode === "叶";
              const out = [];
              const CHARS2 = yunChars();
              for (const c2 in CHARS2) {
                if (!Object.prototype.hasOwnProperty.call(CHARS2, c2)) continue;
                const rs = readingsOf(c2);
                if (rs.some(function (r) {
                  if (r.bu !== refBu) return false;
                  const c3 = catOfTone(r.tone);
                  if (isYe) return (c3 === "入" && refCat === "入") || (c3 !== "入" && refCat !== "入");
                  return c3 === refCat;
                })) out.push(c2);
              }
              out.sort(function (a, b) { return commonRank(a) - commonRank(b) || (a < b ? -1 : 1); });
              return out.slice(0, 220);
            }
          }
        }
        // 未填韵脚：按词牌韵式给出
        const mode = t.mode;
        const wantCat = mode === "平" ? "平" : (yunKey === "中华新韵" ? "仄" : "上去");
        const bu = firstBuOfTune(t);
        if (!bu) return [];
        const out = [];
        const CHARS = yunChars();
        for (const ch in CHARS) {
          if (!Object.prototype.hasOwnProperty.call(CHARS, ch)) continue;
          const rs = readingsOf(ch);
          if (rs.some(function (r) { return r.bu === bu && (mode === "叶" ? catOfTone(r.tone) !== "入" || wantCat === "入" : catOfTone(r.tone) === wantCat); })) out.push(ch);
        }
        out.sort(function (a, b) { return commonRank(a) - commonRank(b) || (a < b ? -1 : 1); });
        return out.slice(0, 220);
      }

      function firstBuOfTune(t) {
        // 取第一个韵脚句模式末字的韵部范围（无法确定时返回第一部）
        for (const ln of t.lines) {
          if (ln.rhyme) {
            const pat = ln.parts.join("");
            const last = pat[pat.length - 1];
            if (last === "平") {
              const CHARS = yunChars();
              for (const ch in CHARS) {
                if (!Object.prototype.hasOwnProperty.call(CHARS, ch)) continue;
                const rs = readingsOf(ch);
                if (rs.some(function (r) { return r.tone === "平"; })) return rs.filter(function (r) { return r.tone === "平"; })[0].bu;
              }
            }
            return 1;
          }
        }
        return 1;
      }

      // ---------- 操作 ----------
      function copyText() {
        const lines = currentLines();
        const parts = [];
        if (state.mode === "shi") {
          parts.push(window.SHI[state.shiIndex].name);
        } else {
          parts.push("《" + state.ciName + "》");
        }
        lines.forEach(function (line, li) {
          const text = (state.values[li] || []).join("、");
          parts.push(text + (line.rhyme ? "。" : "，"));
        });
        const out = parts.join("\n");
        copyPlainText(out, "已复制到剪贴板（" + parts.length + " 行）");
      }

      function loadExample() {
        const lines = currentLines();
        let ex = null, fallbackTitle = "";
        if (state.mode === "shi") {
          ex = window.LISHI ? window.LISHI[window.SHI[state.shiIndex].name] : null;
          fallbackTitle = window.SHI[state.shiIndex].name;
        } else {
          ex = window.LICI[state.ciName];
          fallbackTitle = state.ciName;
        }
        if (!ex) {
          toast("该体裁 / 词牌暂无内置例作");
          return;
        }
        state.values = lines.map(function (l, li) {
          const src = ex.lines[li] || [];
          return l.parts.map(function (_, pi) { return src[pi] || ""; });
        });
        renderEditor();
        renderReport();
        saveState();
        const who = ex.author ? ex.author + (ex.title ? " │ " + ex.title : "") : fallbackTitle;
        // 载入后按「当前韵书」实时复核，真有出律才提示（与右侧检测面板口径一致）
        let badCount = 0;
        lines.forEach(function (line, li) {
          const pat = line.parts.join("");
          const text = (state.values[li] || []).join("");
          for (let i = 0; i < pat.length; i++) {
            if (!text[i]) continue;
            if (checkTone(text[i], pat[i]).ok === false) badCount++;
          }
        });
        const note = badCount
          ? "（此例作按《" + yunLabel() + "》有 " + badCount + " 字出律，属谱式与通行体式差异，供参考）"
          : "";
        updateLastYunFromEditor();
        toast("已载入「" + who + "」" + note);
      }

      function clearAll() {
        resetValues();
        renderEditor();
        renderReport();
        saveState();
        updateLastYunFromEditor();
        toast("已清空");
      }

      // ---------- 事件 ----------
      function bindEvents() {
        $("mode-switch").querySelectorAll("button").forEach(function (btn) {
          btn.addEventListener("click", function () {
            state.mode = btn.dataset.mode;
            $("mode-switch").querySelectorAll("button").forEach(function (b) {
              b.classList.toggle("active", b === btn);
            });
            $("shi-wrap").style.display = state.mode === "shi" ? "flex" : "none";
            $("ci-wrap").style.display = state.mode === "ci" ? "flex" : "none";
            resetValues();
            renderMeta();
            renderEditor();
            renderReport();
            saveState();
          });
        });
        $("shi-select").addEventListener("change", function () {
          state.shiIndex = +this.value;
          resetValues();
          renderMeta();
          renderEditor();
          renderReport();
          saveState();
        });
        $("tune-select").addEventListener("change", function () {
          state.ciName = this.value;
          resetValues();
          renderMeta();
          renderEditor();
          renderReport();
          saveState();
        });
        $("tune-search").addEventListener("input", function () {
          applyTuneSearch(this.value.trim());
        });
        $("btn-copy").addEventListener("click", copyText);
        $("btn-example").addEventListener("click", loadExample);
        $("btn-view-example").addEventListener("click", function () {
          openPdfViewer(buildExampleDoc(state.mode, state.shiIndex, state.ciName));
        });
        $("btn-gen").addEventListener("click", function () {
          const first = document.querySelector("[data-gen]");
          if (first) {
            first.click();
            first.scrollIntoView({ behavior: "smooth", block: "center" });
          } else {
            toast("请先选择词牌");
          }
        });
        $("btn-print").addEventListener("click", printPoem);
        $("btn-clear").addEventListener("click", clearAll);

        // 韵书切换
        $("yun-select").addEventListener("change", function () {
          yunKey = this.value;
          state.yunKey = yunKey;
          renderMeta();
          renderEditor();
          renderReport();
          saveState();
          toast("已切换为《" + yunLabel() + "》");
        });

        // 导航
        $("nav-tabs").querySelectorAll("button").forEach(function (b) {
          b.addEventListener("click", function () { switchPage(b.dataset.page); });
        });

        // 作品
        $("btn-works").addEventListener("click", openWorks);
        $("btn-open-works").addEventListener("click", openWorks);
        $("btn-save-work").addEventListener("click", openSaveModal);
        $("save-confirm").addEventListener("click", confirmSave);
        $("save-title").addEventListener("keydown", function (e) {
          if (e.key === "Enter") confirmSave();
        });
        $("btn-works-export").addEventListener("click", exportWorksJson);
        $("btn-stats").addEventListener("click", function () {
          renderStats();
          $("stats-overlay").classList.add("show");
        });
        $("btn-works-import").addEventListener("click", function () { $("works-import-file").click(); });
        $("works-import-file").addEventListener("change", function (e) {
          const f = e.target.files && e.target.files[0];
          if (f) importWorksJson(f);
          e.target.value = "";
        });

        // 格律详解：检测口径切换
        $("sd-tone-mode").addEventListener("change", function () {
          state.shiStrict = this.value === "strict";
          saveState();
          renderShiDetail(SD_CUR);
          if (state.mode === "shi") renderReport();
          toast(state.shiStrict ? "已切换到「严格」口径" : "已切换到「宽格」口径");
        });

        // 找词牌
        $("btn-tf-find").addEventListener("click", renderTuneFind);
        $("btn-tf-clear").addEventListener("click", function () {
          $("tf-text").value = "";
          $("tf-chars").value = "";
          $("tf-lines").value = "";
          $("tf-mode").value = "";
          $("tf-result").innerHTML = "<div class='hint'>粘贴句子后点「开始匹配」（在输入框里按 Ctrl+Enter 也可以）。</div>";
        });
        $("tf-text").addEventListener("keydown", function (e) {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            renderTuneFind();
          }
        });

        // 集句检索
        $("btn-jj-find").addEventListener("click", renderJiju);        ["jj-kw", "jj-len", "jj-pat", "jj-limit"].forEach(function (id) {
          $(id).addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); renderJiju(); }
          });
        });
        $("jj-kind").addEventListener("change", function () { renderJiju(); });

        // 术语说明
        $("btn-glossary").addEventListener("click", function () { openGlossary(""); });
        $("glossary-search").addEventListener("input", function () { renderGlossary(this.value); });

        // 默写练习
        $("pra-mode").addEventListener("change", function () {
          PRA.mode = this.value;
          PRA.values = [];
          renderPractice();
        });
        $("pra-hint").addEventListener("click", praHintOne);
        $("pra-answer").addEventListener("click", praShowAnswer);
        $("pra-next").addEventListener("click", function () {
          PRA.mode = $("pra-mode").value;
          praStart(null);
        });

        // 设置与音乐
        $("btn-settings").addEventListener("click", openSettings);
        $("btn-music").addEventListener("click", toggleMusic);
        $("author-id-save").addEventListener("click", function () {
          state.authorId = ($("author-id").value || "").trim();
          saveState();
          openSettings();
          toast(state.authorId ? "署名已设为「" + state.authorId + "」" : "已清空署名");
        });
        $("author-id").addEventListener("keydown", function (e) {
          if (e.key === "Enter") $("author-id-save").click();
        });
        $("font-ui-select").addEventListener("change", function () { updatePdfSetting("fontUi", this.value); });
        $("font-poem-select").addEventListener("change", function () { updatePdfSetting("fontPoem", this.value); });
        $("print-bg-select").addEventListener("change", function () { updatePdfSetting("printBg", this.value); });
        $("print-strength").addEventListener("input", function () { updatePdfSetting("printStrength", +this.value); });
        $("print-meta").addEventListener("change", function () { updatePdfSetting("printMeta", this.checked); });
        $("pdf-font-poem").addEventListener("change", function () { updatePdfSetting("fontPoem", this.value); });
        $("pdf-bg").addEventListener("change", function () { updatePdfSetting("printBg", this.value); });
        $("pdf-strength").addEventListener("input", function () { updatePdfSetting("printStrength", +this.value); });
        $("pdf-meta").addEventListener("change", function () { updatePdfSetting("printMeta", this.checked); });
        $("print-script-select").addEventListener("change", function () { updatePdfSetting("printScript", this.value); });
        $("pdf-script").addEventListener("change", function () { updatePdfSetting("printScript", this.value); });
        $("print-palette-select").addEventListener("change", function () { updatePdfSetting("printPalette", this.value); });
        $("pdf-palette").addEventListener("change", function () { updatePdfSetting("printPalette", this.value); });
        $("print-motif-select").addEventListener("change", function () { updatePdfSetting("printMotif", this.value); });
        $("pdf-motif").addEventListener("change", function () { updatePdfSetting("printMotif", this.value); });
        ["print-motif-strength", "pdf-motif-strength"].forEach(function (id) {
          const el = $(id);
          if (el) el.addEventListener("input", function () { updatePdfSetting("printMotifStrength", +this.value); });
        });
        [
          ["print-ink", "printInk"],
          ["pdf-ink", "printInk"],
          ["print-paper", "printPaper"],
          ["pdf-paper", "printPaper"]
        ].forEach(function (p) {
          const el = $(p[0]);
          if (el) el.addEventListener("input", function () { updatePdfSetting(p[1], this.value); });
        });
        [
          ["pdf-weight", "printFontWeight"],
          ["pdf-size", "printFontSize"],
          ["pdf-line-height", "printLineHeight"],
          ["pdf-letter-spacing", "printLetterSpacing"],
          ["pdf-align", "printAlign"],
          ["pdf-layout", "printLayout"]
        ].forEach(function (p) {
          const el = $(p[0]);
          if (!el) return;
          const evt = el.type === "range" ? "input" : "change";
          el.addEventListener(evt, function () {
            updatePdfSetting(p[1], el.type === "range" ? +this.value : this.value);
          });
        });
        $("pdf-print").addEventListener("click", printPdf);
        window.addEventListener("resize", function () {
          if ($("pdf-overlay").classList.contains("show")) fitPdfPreview();
        });
        window.addEventListener("beforeprint", function () {
          if (!PDF_DOC) PDF_DOC = buildCurrentDoc();
          renderPdfViewer();
        });
        $("music-play").addEventListener("click", toggleMusic);
        $("music-next").addEventListener("click", nextMusic);
        $("music-vol-down").addEventListener("click", function () {
          audioEl.volume = Math.max(0, +(audioEl.volume - 0.1).toFixed(2));
          toast("音量 " + Math.round(audioEl.volume * 100) + "%");
        });
        $("music-vol-up").addEventListener("click", function () {
          audioEl.volume = Math.min(1, +(audioEl.volume + 0.1).toFixed(2));
          toast("音量 " + Math.round(audioEl.volume * 100) + "%");
        });

        // 鉴赏筛选
        $("appr-collection").addEventListener("change", function () {
          APPR_STATE.collection = this.value;
          apprResetList();
        });
        $("appr-kind").addEventListener("change", function () {
          APPR_STATE.kind = this.value;
          apprResetList();
        });
        $("appr-dynasty").addEventListener("change", function () {
          APPR_STATE.dynasty = this.value;
          apprResetList();
        });
        $("appr-tune").addEventListener("change", function () {
          APPR_STATE.tune = this.value;
          apprResetList();
        });
        $("appr-tag").addEventListener("change", function () {
          APPR_STATE.tag = this.value;
          apprResetList();
        });
        $("appr-author").addEventListener("change", function () {
          APPR_STATE.author = this.value;
          apprResetList();
        });
        $("appr-author-kw").addEventListener("input", function () {
          APPR_STATE.authorKw = this.value;
          fillAuthorSelect(this.value);
        });
        $("appr-kw").addEventListener("input", function () {
          APPR_STATE.kw = this.value;
          apprResetList();
        });
        $("appr-more").addEventListener("click", function () {
          APPR_STATE.visible += 50;
          renderApprList();
        });
        $("appr-list").addEventListener("click", function (e) {
          const item = e.target.closest(".poem-item");
          if (!item) return;
          showApprDetail(+item.dataset.ai);
        });
        $("appr-recommend").addEventListener("click", function (e) {
          const t = e.target.closest("button");
          if (!t) return;
          if (t.id === "rec-refresh") { renderRecommend(true); return; }
          if (t.id === "rec-practice") { praStart(recommendWork); return; }
          if (t.id === "rec-view") {
            if (recommendWork) {
              showApprDetailWork(recommendWork);
              $("appr-detail").scrollIntoView({ behavior: "smooth", block: "start" });
            }
            return;
          }
          if (t.id === "rec-edit") { loadWorkIntoEditor(recommendWork); return; }
          if (t.id === "rec-write" && recommendWork && recommendWork.p) {
            switchToWrite(recommendWork.p);
            return;
          }
        });
        $("appr-detail").addEventListener("click", function (e) {
          const wb = e.target.closest("[data-appr-write]");
          if (wb) { switchToWrite(wb.dataset.apprWrite); return; }
          if (e.target.closest("[data-appr-edit]")) {
            if (APPR_STATE.activeIdx !== -1) loadApprIntoEditor(APPR_STATE.activeIdx);
            return;
          }
          if (e.target.closest("[data-appr-cmp]")) {
            if (APPR_CUR_WORK) renderApprCompare(APPR_CUR_WORK);
            return;
          }
          if (e.target.closest("[data-appr-pra]")) {
            if (APPR_CUR_WORK) praStart(APPR_CUR_WORK);
            return;
          }
          if (e.target.closest("[data-appr-copy]")) {
            const w = APPR_CUR_WORK;
            if (w) {
              const head = (w.d ? w.d + " │ " : "") + (w.a || "") + "《" + (w.t || "无题") + "》" + (w.p ? " │ " + w.p : "");
              copyPlainText(head + "\n" + (w.c || []).join("\n"), "已复制原文（" + (w.t || "无题") + "）");
            }
            return;
          }
          if (e.target.closest("[data-appr-view]")) {
            if (APPR_CUR_WORK) openPdfViewer(buildLibraryDoc(APPR_CUR_WORK));
            return;
          }
        });

        // 韵书查询
        $("yun-search").addEventListener("input", function () {
          const v = this.value.trim();
          if (v) {
            showYunChar(v[v.length - 1], false);
          } else {
            yunSearchMode = false;
            $("yun-result").innerHTML = "";
          }
        });
        $("yun-browse-book").addEventListener("change", function () {
          fillYunBrowse();
          yunSearchMode = false;
          renderYunBrowse();
        });
        $("yun-part").addEventListener("change", function () {
          fillYunTuneSel();
          yunSearchMode = false;
          renderYunBrowse();
        });
        $("yun-tune").addEventListener("change", function () {
          yunSearchMode = false;
          renderYunBrowse();
        });
        $("yun-result").addEventListener("click", function (e) {
          const t = e.target.closest("[data-yunchar]");
          if (t) showYunChar(t.dataset.yunchar, false);
        });

        // 粘贴导入
        $("btn-import").addEventListener("click", openImportModal);
        $("import-confirm").addEventListener("click", confirmImport);
        $("import-text").addEventListener("keydown", function (e) {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) confirmImport();
        });
        $("btn-yunshu").addEventListener("click", function () {
          switchPage("yunshu");
        });
        $("appr-detail-back").addEventListener("click", function () {
          switchPage("appreciate");
        });

        // 弹窗通用：关闭
        document.querySelectorAll("[data-close]").forEach(function (b) {
          b.addEventListener("click", function () {
            $(b.dataset.close).classList.remove("show");
          });
        });
        document.querySelectorAll(".overlay").forEach(function (ov) {
          ov.addEventListener("click", function (e) {
            if (e.target === ov) ov.classList.remove("show");
          });
        });

        // 我的作品列表操作
        $("works-list").addEventListener("click", function (e) {
          const t = e.target;
          if (t.dataset.wload) loadWork(+t.dataset.wload);
          else if (t.dataset.wdel) deleteWork(+t.dataset.wdel);
          else if (t.dataset.wexport) exportWork(+t.dataset.wexport);
          else if (t.dataset.wview) {
            const w = loadWorks().filter(function (x) { return x.id === +t.dataset.wview; })[0];
            if (w) openPdfViewer(buildWorkDoc(w));
          } else if (t.dataset.wcopy) {
            const w = loadWorks().filter(function (x) { return x.id === +t.dataset.wcopy; })[0];
            if (w) copyPlainText(workText(w), "已复制《" + (w.title || "无题") + "》");
          }
        });

        // 主题与背景选择
        $("theme-grid").addEventListener("click", function (e) {
          const b = e.target.closest("[data-theme]");
          if (!b) return;
          state.theme = b.dataset.theme;
          applyTheme();
          renderThemeGrid();
          saveState();
        });
        $("bg-row").addEventListener("click", function (e) {
          const b = e.target.closest("[data-bg]");
          if (!b) return;
          state.bg = b.dataset.bg;
          applyBg();
          renderBgRow();
          saveState();
        });
      }

      // ---------- 界面设置：主题与背景 ----------
      const THEMES = [
        { id: "default", name: "默认 │ 宣纸", sw: "#faf6ee" },
        { id: "lan", name: "黛蓝", sw: "#33507a" },
        { id: "mo", name: "墨绿", sw: "#3b5d47" },
        { id: "ou", name: "藕荷", sw: "#8b5a9e" },
        { id: "zhu", name: "朱砂", sw: "#a83232" },
        { id: "mu", name: "暮色", sw: "#2a2620" }
      ];
      const BGS = [
        { id: "none", name: "无 │ 纯色" },
        { id: "1", name: "水墨" },
        { id: "2", name: "远山" },
        { id: "3", name: "竹韵" },
        { id: "4", name: "荷塘" },
        { id: "5", name: "星空" }
      ];

      function applyTheme() {
        if (state.theme && state.theme !== "default") {
          document.body.dataset.theme = state.theme;
        } else {
          delete document.body.dataset.theme;
        }
      }

      function applyBg() {
        state.bg = ["none", "1", "2", "3", "4", "5"].indexOf(state.bg) !== -1 ? state.bg : "1";
        state.printBg = state.bg;
        document.body.dataset.bg = state.bg;
        document.body.style.setProperty("--detail-bg", state.bg === "none"
          ? "none" : "url('backgrounds/bg" + state.bg + ".jpg')");
        syncPdfControls();
      }

      function renderThemeGrid() {
        const el = $("theme-grid");
        el.innerHTML = THEMES.map(function (t) {
          return "<button class='theme-card" + (state.theme === t.id ? " active" : "") + "' data-theme='" + t.id + "'>" +
            "<span class='sw' style='background:" + t.sw + "'></span>" + esc(t.name) + "</button>";
        }).join("");
      }

      function renderBgRow() {
        const el = $("bg-row");
        el.innerHTML = BGS.map(function (b) {
          return "<button class='bg-btn" + (state.bg === b.id ? " active" : "") + "' data-bg='" + b.id + "'>" + esc(b.name) + "</button>";
        }).join("");
      }

      function openSettings() {
        renderThemeGrid();
        renderBgRow();
        syncPdfControls();
        $("author-id").value = state.authorId || "";
        $("author-id-hint").textContent = state.authorId
          ? "当前署名：" + state.authorId + "（打印与导出作品时自动填入）"
          : "尚未设置，导出时作者位置将留空待填。";
        updateMusicHint();
        $("settings-overlay").classList.add("show");
      }

      // ---------- 我的作品 ----------
      function loadWorks() {
        try { return JSON.parse(localStorage.getItem(WORKS_KEY)) || []; }
        catch (e) { return []; }
      }

      function saveWorks(list) {
        try { localStorage.setItem(WORKS_KEY, JSON.stringify(list)); }
        catch (e) { toast("保存失败：浏览器存储不可用"); }
      }

      function currentTitle() {
        return state.mode === "shi" ? window.SHI[state.shiIndex].name : state.ciName;
      }

      function workText(w) {
        const parts = [];
        if (w.mode === "shi") {
          parts.push((window.SHI[w.shiIndex] || {}).name || "近体诗");
        } else {
          parts.push("《" + (w.ciName || "") + "》");
        }
        const lines = linesOfWork(w);
        (w.values || []).forEach(function (row, i) {
          const text = (row || []).join("、");
          if (!text) return;
          const rhyme = lines && lines[i] ? lines[i].rhyme : false;
          parts.push(text + (rhyme ? "。" : "，"));
        });
        return parts.join("\n");
      }

      function downloadText(name, content) {
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          URL.revokeObjectURL(a.href);
          document.body.removeChild(a);
        }, 300);
        toast("已导出 " + name);
      }

      // ---------- 作品库整库备份 / 恢复 ----------
      function workKeyOf(w) {
        return [(w.title || ""), (w.values || []).map(function (r) {
          return Array.isArray(r) ? r.join("") : "";
        }).join("")].join("|");
      }

      function exportWorksJson() {
        const works = loadWorks();
        if (!works.length) { toast("还没有作品可导出"); return; }
        const day = new Date().toISOString().slice(0, 10);
        const blob = new Blob([JSON.stringify({ app: "微词", version: 1, exportedAt: new Date().toISOString(), works: works }, null, 2)],
          { type: "application/json;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "微词作品备份-" + day + ".json";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          URL.revokeObjectURL(a.href);
          document.body.removeChild(a);
        }, 300);
        toast("已导出 " + works.length + " 首作品的备份");
      }

      function importWorksJson(file) {
        const reader = new FileReader();
        reader.onload = function () {
          let data = null;
          try {
            data = JSON.parse(String(reader.result));
          } catch (e) {
            toast("导入失败：不是有效的 JSON 文件");
            return;
          }
          const incoming = Array.isArray(data) ? data : (data && Array.isArray(data.works) ? data.works : null);
          if (!incoming) { toast("导入失败：文件里没有作品列表"); return; }
          const works = loadWorks();
          const seen = {};
          works.forEach(function (w) { seen[workKeyOf(w)] = 1; });
          let added = 0, dup = 0, invalid = 0;
          incoming.forEach(function (w) {
            if (!w || typeof w !== "object") { invalid++; return; }
            const item = {
              id: typeof w.id === "number" ? w.id : Date.now() + added,
              title: String(w.title || "（无题）"),
              mode: w.mode === "ci" ? "ci" : "shi",
              shiIndex: +w.shiIndex >= 0 ? +w.shiIndex : 0,
              ciName: typeof w.ciName === "string" ? w.ciName : "",
              yunKey: w.yunKey === "中华新韵" ? "中华新韵" : "词林正韵",
              values: Array.isArray(w.values) ? w.values.map(function (r) {
                return Array.isArray(r) ? r.map(String) : [];
              }) : [],
              savedAt: typeof w.savedAt === "string" ? w.savedAt : ""
            };
            const k = workKeyOf(item);
            if (seen[k]) { dup++; return; }
            seen[k] = 1;
            works.push(item);
            added++;
          });
          const skipped = dup + invalid;
          if (!added) {
            toast("没有新增作品（重复 " + dup + " 条，无效 " + invalid + " 条）");
            return;
          }
          saveWorks(works);
          openWorks();
          toast("已导入 " + added + " 首" + (skipped ? "，跳过重复 " + dup + " 条、无效 " + invalid + " 条" : ""));
        };
        reader.onerror = function () { toast("导入失败：读取文件出错"); };
        reader.readAsText(file, "utf-8");
      }

      function openSaveModal() {
        $("save-title").value = "";
        $("save-title").placeholder = "如：秋夜感怀（默认《" + currentTitle() + "》）";
        $("save-overlay").classList.add("show");
        setTimeout(function () { $("save-title").focus(); }, 50);
      }

      function confirmSave() {
        const title = ($("save-title").value || "").trim() || currentTitle();
        const works = loadWorks();
        works.unshift({
          id: Date.now(),
          title: title,
          mode: state.mode,
          shiIndex: state.shiIndex,
          ciName: state.ciName,
          yunKey: yunKey,
          values: state.values.map(function (row) { return row.slice(); }),
          savedAt: new Date().toLocaleString("zh-CN", { hour12: false })
        });
        saveWorks(works);
        $("save-overlay").classList.remove("show");
        toast("已保存《" + title + "》");
      }

      function openWorks() {
        const list = loadWorks();
        const el = $("works-list");
        if (!list.length) {
          el.innerHTML = "<div class='empty'>还没有作品，先写一首再保存吧。</div>";
        } else {
          el.innerHTML = list.map(function (w) {
            const typeName = w.mode === "shi"
              ? "诗 │ " + ((window.SHI[w.shiIndex] || {}).name || "?")
              : "词 │ 《" + (w.ciName || "?") + "》";
            const excerpt = (w.values || []).map(function (r) { return r.join("、"); })
              .filter(Boolean).join("。") || "（空）";
            return "<div class='works-item'>" +
              "<div class='wi-title'>" + esc(w.title) + "</div>" +
              "<div class='wi-meta'>" + esc(typeName) + "<br>" + esc(w.savedAt || "") + "</div>" +
              "<div class='wi-actions'>" +
              "<button class='small-btn' data-wload='" + w.id + "'>载入</button>" +
              "<button class='small-btn' data-wview='" + w.id + "'>查看原文 / PDF</button>" +
              "<button class='small-btn' data-wcopy='" + w.id + "'>复制</button>" +
              "<button class='small-btn' data-wexport='" + w.id + "'>导出文本</button>" +
              "<button class='small-btn danger' data-wdel='" + w.id + "'>删除</button>" +
              "</div>" +
              "<div class='pi-excerpt'>" + esc(excerpt) + "</div>" +
              "</div>";
          }).join("");
        }
        $("works-overlay").classList.add("show");
      }

      function loadWork(id) {
        const w = loadWorks().filter(function (x) { return x.id === id; })[0];
        if (!w) return;
        state.mode = w.mode === "ci" ? "ci" : "shi";
        state.shiIndex = window.SHI[w.shiIndex] ? w.shiIndex : 0;
        if (window.CIPU[w.ciName]) state.ciName = w.ciName;
        state.values = Array.isArray(w.values)
          ? w.values.map(function (r) { return Array.isArray(r) ? r.slice() : []; })
          : [];
        $("mode-switch").querySelectorAll("button").forEach(function (b) {
          b.classList.toggle("active", b.dataset.mode === state.mode);
        });
        $("shi-wrap").style.display = state.mode === "shi" ? "flex" : "none";
        $("ci-wrap").style.display = state.mode === "ci" ? "flex" : "none";
        $("shi-select").value = state.shiIndex;
        $("tune-select").value = state.ciName;
        renderMeta();
        renderEditor();
        renderReport();
        saveState();
        updateLastYunFromEditor();
        $("works-overlay").classList.remove("show");
        toast("已载入《" + w.title + "》");
      }

      function deleteWork(id) {
        let works = loadWorks();
        works = works.filter(function (x) { return x.id !== id; });
        saveWorks(works);
        openWorks();
        toast("已删除");
      }

      function exportWork(id) {
        const w = loadWorks().filter(function (x) { return x.id === id; })[0];
        if (!w) return;
        let body = "《" + w.title + "》\n" +
          (w.mode === "shi" ? "近体诗 │ " + ((window.SHI[w.shiIndex] || {}).name || "") : "词 │ " + w.ciName) +
          "\n\n" + workText(w);
        if (state.authorId) body += "\n\n—— " + state.authorId + " ——";
        downloadText(w.title + ".txt", body);
      }

      // ---------- 背景音乐 ----------
      const MUSIC_FILES = ["bgm.mp3", "bgm2.mp3", "bgm3.mp3", "bgm4.mp3", "bgm5.mp3", "bgm6.mp3"];
      let musicIdx = 0;
      let musicTried = false;
      const audioEl = $("bgm");

      function updateMusicHint() {
        const el = $("music-hint");
        if (musicTried) {
          el.textContent = "未检测到 music/ 中的音频文件，请放入 " + MUSIC_FILES.slice(0, 2).join("、") + " 后重试。";
        } else if (audioEl.src) {
          el.textContent = "正在播放：music/" + (audioEl.dataset.file || "");
        } else {
          el.textContent = "点击「播放 / 暂停」开始（音频放 music/bgm.mp3 起）。";
        }
      }

      function loadMusic(i) {
        musicIdx = ((i % MUSIC_FILES.length) + MUSIC_FILES.length) % MUSIC_FILES.length;
        audioEl.src = "music/" + MUSIC_FILES[musicIdx];
        audioEl.dataset.file = MUSIC_FILES[musicIdx];
      }

      function setMusicBtn(playing) {
        $("btn-music").classList.toggle("playing", playing);
        $("btn-music").textContent = playing ? "♪ 播放中" : "♪ 音乐";
      }

      function tryPlay() {
        return audioEl.play().then(function () {
          setMusicBtn(true);
          musicTried = false;
          updateMusicHint();
        }).catch(function () {
          setMusicBtn(false);
          updateMusicHint();
        });
      }

      function toggleMusic() {
        if (!audioEl.src || musicTried) loadMusic(0);
        if (audioEl.paused) {
          tryPlay();
        } else {
          audioEl.pause();
          setMusicBtn(false);
          updateMusicHint();
        }
      }

      function nextMusic() {
        loadMusic(musicIdx + 1);
        tryPlay();
      }

      audioEl.addEventListener("error", function () {
        if (!audioEl.src) return;
        if (musicIdx < MUSIC_FILES.length - 1) {
          loadMusic(musicIdx + 1);
          tryPlay();
        } else {
          musicTried = true;
          setMusicBtn(false);
          updateMusicHint();
        }
      });

      // ---------- 诗词鉴赏 ----------
      let apprInited = false;
      const QUAN_PARTS = (window.QUAN_KU_MANIFEST && window.QUAN_KU_MANIFEST.parts) || 10;
      const QUAN_WORKS = (window.QUAN_KU_MANIFEST && window.QUAN_KU_MANIFEST.works) || 9933;
      let quanLoaded = 0;
      let quanDone = false;
      let quanBusy = false;
      let allWorksCache = null;
      let authorIdxCache = null;
      let tagIdxCache = null;

      const APPR_STATE = { collection: "", kind: "", dynasty: "", tune: "", tag: "", author: "", authorKw: "", kw: "", visible: 50, activeIdx: -1 };

      function kindOf(w) {
        return w.k || (w.p ? "词" : "诗");
      }

      function allWorks() {
        if (allWorksCache) return allWorksCache;
        const seen = {};
        const out = [];
        function push(w) {
          const key = (w.t || "") + "|" + (w.a || "") + "|" + ((w.c || [])[0] || "").slice(0, 12);
          if (seen[key]) return;
          seen[key] = 1;
          out.push(w);
        }
        window.SHIJI.forEach(push);
        for (let i = 0; i < quanLoaded; i++) {
          (window["QUAN_KU_PART_" + i] || []).forEach(push);
        }
        allWorksCache = out;
        return out;
      }

      function invalidateQuanCaches() {
        allWorksCache = null;
        authorIdxCache = null;
        tagIdxCache = null;
        jijuIndex = null;
        jijuIndexKey = "";
      }

      function updateQuanProgress() {
        const txt = quanDone
          ? ""
          : "正在加载全库数据… 已完成 " + quanLoaded + " / " + QUAN_PARTS + "（约 " + Math.round(quanLoaded / QUAN_PARTS * QUAN_WORKS) + " 首）";
        $("appr-loading").textContent = txt;
        const jp = $("jj-progress");
        if (jp) jp.textContent = quanDone ? "" : "全库加载中… " + quanLoaded + " / " + QUAN_PARTS + "（当前可检索范围会随之增大）";
      }

      function ensureQuanKu() {
        if (quanDone || quanBusy) return;
        quanBusy = true;
        updateQuanProgress();
        function loadNext() {
          if (quanLoaded >= QUAN_PARTS) {
            quanDone = true;
            quanBusy = false;
            invalidateQuanCaches();
            updateQuanProgress();
            fillApprSelects();
            apprResetList();
            renderRecommend(true); // 全库就绪后换一首全库推荐
            return;
          }
          const s = document.createElement("script");
          s.src = "data/全库数据/全库" + quanLoaded + ".js";
          function loaded() {
            quanLoaded++;
            invalidateQuanCaches();
            updateQuanProgress();
            loadNext();
          }
          s.onload = loaded;
          s.onerror = loaded;
          document.head.appendChild(s);
        }
        loadNext();
      }

      function authorIdx() {
        if (!authorIdxCache) {
          const counts = {};
          allWorks().forEach(function (w) { if (w.a) counts[w.a] = (counts[w.a] || 0) + 1; });
          const names = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : 1); });
          authorIdxCache = { names: names, counts: counts };
        }
        return authorIdxCache;
      }

      function tagIdx() {
        if (!tagIdxCache) {
          const counts = {};
          allWorks().forEach(function (w) {
            (w.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
          });
          tagIdxCache = counts;
        }
        return tagIdxCache;
      }

      function fillApprSelects() {
        const tuneSel = $("appr-tune");
        const tunes = {};
        allWorks().forEach(function (w) { if (w.p) tunes[w.p] = (tunes[w.p] || 0) + 1; });
        tuneSel.innerHTML = "<option value=''>全部词牌</option>";
        Object.keys(tunes).sort(function (a, b) { return tunes[b] - tunes[a] || (a < b ? -1 : 1); })
          .slice(0, 150).forEach(function (t) {
            const o = document.createElement("option");
            o.value = t;
            o.textContent = t + "（" + tunes[t] + "）";
            tuneSel.appendChild(o);
          });
        const tagSel = $("appr-tag");
        tagSel.innerHTML = "<option value=''>全部分类</option>";
        Object.keys(tagIdx()).sort(function (a, b) { return tagIdx()[b] - tagIdx()[a]; })
          .slice(0, 60).forEach(function (t) {
            const o = document.createElement("option");
            o.value = t;
            o.textContent = t + "（" + tagIdx()[t] + "）";
            tagSel.appendChild(o);
          });
        fillAuthorSelect(APPR_STATE.authorKw);
      }

      function fillAuthorSelect(kw) {
        const auSel = $("appr-author");
        const idx = authorIdx();
        const kwTrim = (kw || "").trim();
        const list = idx.names.filter(function (a) { return !kwTrim || a.indexOf(kwTrim) !== -1; }).slice(0, 200);
        auSel.innerHTML = "<option value=''>" +
          (kwTrim ? "全部作者（“" + esc(kwTrim) + "”共 " + idx.names.length + " 位）" : "全部作者（共 " + idx.names.length + " 位）") +
          "</option>";
        list.forEach(function (a) {
          const o = document.createElement("option");
          o.value = a;
          o.textContent = a + "（" + idx.counts[a] + "）";
          auSel.appendChild(o);
        });
        if (APPR_STATE.author && idx.names.indexOf(APPR_STATE.author) !== -1) auSel.value = APPR_STATE.author;
      }

      const DYNASTY_KEYS = {
        "先秦": ["先秦", "春秋", "战国"],
        "两汉": ["西汉", "东汉", "两汉", "汉代", "汉"],
        "魏晋南北朝": ["魏晋", "南北朝", "南朝", "北朝", "北魏", "东晋", "西晋", "晋"],
        "隋": ["隋"],
        "唐": ["唐代", "唐"],
        "五代": ["五代", "南唐", "后唐", "后周", "前蜀"],
        "宋": ["宋代", "北宋", "南宋", "宋"],
        "金": ["金代", "金"],
        "元": ["元代", "元"],
        "明": ["明代", "明"],
        "清": ["清代", "清"],
        "近现代": ["近现代", "近代", "现代", "当代"]
      };

      function filterWorks() {
        const kw = APPR_STATE.kw.trim();
        const dKeys = DYNASTY_KEYS[APPR_STATE.dynasty];
        return allWorks().filter(function (w) {
          if (APPR_STATE.collection && (w.tags || []).indexOf(APPR_STATE.collection) === -1) return false;
          if (APPR_STATE.kind && APPR_STATE.kind !== kindOf(w)) return false;
          if (APPR_STATE.dynasty && dKeys && !dKeys.some(function (dk) { return w.d.indexOf(dk) !== -1; })) return false;
          if (APPR_STATE.tune && w.p !== APPR_STATE.tune) return false;
          if (APPR_STATE.tag && (w.tags || []).indexOf(APPR_STATE.tag) === -1) return false;
          if (APPR_STATE.author && w.a !== APPR_STATE.author) return false;
          if (kw) {
            const hay = (w.t + w.a + (w.c || []).join("")).toLowerCase();
            if (hay.indexOf(kw.toLowerCase()) === -1) return false;
          }
          return true;
        });
      }

      function apprResetList() {
        APPR_STATE.activeIdx = -1;
        APPR_STATE.visible = 50;
        $("appr-detail").style.display = "none";
        renderApprList();
      }

      function renderApprList() {
        const list = filterWorks();
        const shown = list.slice(0, APPR_STATE.visible);
        $("appr-count").textContent = "共 " + list.length + " 首" +
          (list.length > shown.length ? "，显示前 " + shown.length + " 首" : "");
        $("appr-more").style.display = list.length > shown.length ? "" : "none";
        const el = $("appr-list");
        if (!shown.length) {
          el.innerHTML = "<div class='empty'>没有符合条件的作品，换个筛选试试。</div>";
          return;
        }
        el.innerHTML = shown.map(function (w, i) {
          const first = (w.c[0] || "").replace(/[，。！？、；：""''（）《》\s]/g, "");
          return "<div class='poem-item" + (APPR_STATE.activeIdx === i ? " active" : "") + "' data-ai='" + i + "'>" +
            "<span class='pi-title'>" + esc(w.t || "无题") + "</span>" +
            (w.p ? "<span class='pi-badge'>" + esc(w.p) + "</span>" : "") +
            "<span class='pi-sub'>" + esc(w.d + " │ " + w.a) + "</span>" +
            "<span class='pi-excerpt'>" + esc(first) + "</span></div>";
        }).join("");
      }

      // ---------- 名篇与谱式并排对照（鉴赏详情页只读视图） ----------
      let APPR_CUR_WORK = null;

      function cmpSpecFor(w) {
        if (w.p && window.CIPU[w.p]) {
          const t = window.CIPU[w.p];
          return {
            name: w.p, kind: "词谱", mode: t.mode,
            lines: t.lines.map(function (l) { return { parts: l.parts.slice(), rhyme: !!l.rhyme }; })
          };
        }
        const k = kindOf(w);
        if (k === "文" || k === "曲") return null;
        // 近体诗：逐个格律试对齐，取合律率最高的一式
        let best = null, bestRate = -1;
        window.SHI.forEach(function (s) {
          const spec = {
            name: s.name, kind: "格律", mode: "平",
            lines: s.lines.map(function (l) { return { parts: [l.pat], rhyme: !!l.rhyme }; })
          };
          const al = cmpAlign(spec, w);
          if (!al) return;
          const st = cmpStats(spec, al.rows);
          const r = st.rate === null ? -1 : st.rate;
          if (r > bestRate) { bestRate = r; best = spec; }
        });
        return best;
      }

      function cmpAlign(spec, w) {
        const raw = (w.c || []).join("").replace(/[（(][^（）()]*[）)]/g, "").replace(/[·•]/g, "");
        const chars = raw.match(/[\u3400-\u9fff]/g) || [];
        const pat = spec.lines.map(function (l) { return l.parts.join(""); }).join("");
        const total = pat.length;
        if (!chars.length || chars.length < total) return null;
        // 按谱式总字数在原文里滑动，取"最合律"的那一段（可跳过小序 / 题注，容忍标点断句差异）
        function rateAt(off) {
          let filled = 0, ok = 0;
          for (let i = 0; i < total; i++) {
            if (pat[i] === "中") continue;
            const t = toneClassCached(chars[off + i]);
            if (t === "?") continue;
            filled++;
            if (pat[i] === "平" ? t !== "仄" : t !== "平") ok++;
          }
          return filled ? ok / filled : 0;
        }
        let off = 0, rate = rateAt(0);
        if (chars.length > total) {
          for (let o = 1; o <= chars.length - total; o++) {
            const r = rateAt(o);
            if (r > rate + 1e-9) { rate = r; off = o; }
          }
        }
        const seg = chars.slice(off, off + total);
        const rows = [];
        let acc = 0;
        spec.lines.forEach(function (l) {
          const len = l.parts.join("").length;
          rows.push(seg.slice(acc, acc + len).join(""));
          acc += len;
        });
        return { rows: rows, offset: off, rate: rate, aligned: seg.join(""), total: total };
      }

      function cmpStats(spec, rows) {
        let filled = 0, ok = 0, unknown = 0;
        const problems = [];
        rows.forEach(function (text, li) {
          const pat = spec.lines[li].parts.join("");
          for (let i = 0; i < pat.length; i++) {
            const ch = text[i];
            if (!ch) continue;
            const info = infoOf(ch);
            if (!info.readings.length) { unknown++; continue; }
            if (pat[i] === "中") continue;
            filled++;
            if (checkTone(ch, pat[i]).ok === true) ok++;
            else problems.push({ li: li, ci: i, ch: ch, req: pat[i] });
          }
        });
        return { filled: filled, ok: ok, unknown: unknown, rate: filled ? ok / filled : null, problems: problems };
      }

      function cmpCellHtml(ch, req) {
        const info = infoOf(ch);
        let cls = "cmp-t";
        if (!info.readings.length) cls += " unknown";
        else if (info.hasPing && info.hasZe) cls += checkTone(ch, req).ok === false ? " bad" : " two";
        else cls += checkTone(ch, req).ok === true || req === "中" ? " ok" : " bad";
        const title = info.readings.length ? describeReading(info.readings) : "韵书未收录";
        return "<span class='cmp-cell'><i class='cmp-p'>" + esc(req) + "</i>" +
          "<i class='" + cls + "' title='" + esc(title) + "'>" + esc(ch) + "</i></span>";
      }

      function cmpRhymeHtml(spec, w, aligned) {
        let groups;
        if (spec.kind === "词谱") {
          groups = tuneShapeOf(spec.name).rhymeGroups;
        } else {
          const idx = [];
          let acc = 0;
          spec.lines.forEach(function (l) {
            const len = l.parts.join("").length;
            if (l.rhyme) idx.push({ idx: acc + len - 1 });
            acc += len;
          });
          groups = [{ tone: "平", cells: idx }];
        }
        const parts = [];
        groups.forEach(function (gr) {
          if (gr.cells.length < 2) return;
          const chars = gr.cells.map(function (c) { return aligned[c.idx] || "□"; }).join("");
          const v = rhymeOkFor(gr, aligned);
          parts.push("「" + chars + "」" + (v === null ? "（字未收录）" : v ? "同韵 ✓" : "出韵 ✗"));
        });
        if (!parts.length) return "";
        return "<div class='hint'>" + linkTerms("韵脚") + "：" + esc(parts.join("　")) +
          (spec.kind === "格律" ? "（首句" + linkTerms("借邻韵") + "时这里也会显示为" + linkTerms("出韵") + "，以写作页检测为准）" : "") + "</div>";
      }

      function renderApprCompare(w) {
        const box = $("appr-compare");
        if (!box) return;
        if (box.classList.contains("show")) {
          box.classList.remove("show");
          box.innerHTML = "";
          return;
        }
        const spec = cmpSpecFor(w);
        if (!spec) {
          box.innerHTML = "<div class='hint'>这篇没有可对应的近体诗格律或词谱，无法逐字对照。</div>";
          box.classList.add("show");
          return;
        }
        const al = cmpAlign(spec, w);
        if (!al) {
          box.innerHTML = "<div class='hint'>原文比《" + esc(spec.name) + "》谱式还短（谱需 " +
            esc(spec.lines.map(function (l) { return l.parts.join("").length; }).reduce(function (a, b) { return a + b; }, 0)) +
            " 字），无法对照。此篇可能只是摘句，或属未收录的体式。</div>";
          box.classList.add("show");
          return;
        }
        const st = cmpStats(spec, al.rows);
        const aligned = al.aligned;
        const pctTxt = st.rate === null ? "—" : Math.round(st.rate * 100) + "%";
        const color = st.rate === null ? "var(--gray)" : st.rate === 1 ? "var(--green)" : st.rate >= 0.9 ? "#c07f2a" : "var(--red)";
        let html = "<div class='cmp-box-inner'>";
        html += "<div class='cmp-head'><span class='cmp-title'>谱式对照 │ " + esc(spec.kind) + "《" + esc(spec.name) + "》</span>" +
          "<span class='cmp-sum' style='color:" + color + "'>定式平仄 " + st.filled + " 处，合律 " + st.ok + " 处（" + pctTxt + "）</span>" +
          (al.offset > 0 ? "<span class='cmp-meta'>（已跳过开头 " + al.offset + " 字，多为小序或题注）</span>" : "") + "</div>";
        html += "<div class='hint'>上行为谱式要求，下行为原文逐字：绿=合律，红=出律，紫=平仄两读（任一读合律即通过），灰=韵书未收录。鼠标悬停可看该字的韵部与声调。原文按谱式分段显示，与原文标点断句可能略有出入。</div>";
        html += "<div class='cmp-table'>";
        al.rows.forEach(function (text, li) {
          const pat = spec.lines[li].parts.join("");
          let cells = "";
          for (let i = 0; i < pat.length; i++) cells += cmpCellHtml(text[i] || "", pat[i]);
          html += "<div class='cmp-row'><span class='cmp-idx'>" + (li + 1) + "</span>" +
            "<span class='cmp-rh'>" + (spec.lines[li].rhyme ? "韵" : "句") + "</span>" +
            "<span class='cmp-cells'>" + cells + "</span></div>";
        });
        html += "</div>";
        html += cmpRhymeHtml(spec, w, aligned);
        if (st.problems.length) {
          html += "<div class='hint' style='color:var(--red)'>出律 " + st.problems.length + " 处：" +
            st.problems.slice(0, 14).map(function (p) {
              return "第" + (p.li + 1) + "句第" + (p.ci + 1) + "字「" + esc(p.ch) + "」应" + (p.req === "去" ? "去声" : p.req);
            }).join("；") + (st.problems.length > 14 ? " …" : "") + "</div>";
          html += "<div class='hint'>若这是公认名篇却出律较多，多半是本程序所收谱式与该篇所用体式（又一体）不同，可作参考、不必较真。</div>";
        }
        if (st.unknown) html += "<div class='hint'>另有 " + st.unknown + " 字为韵书未收录，未计入合律率。</div>";
        html += "</div>";
        box.innerHTML = html;
        box.classList.add("show");
      }

      function showApprDetailWork(w) {
        if (!w) return;
        APPR_CUR_WORK = w;
        const el = $("appr-detail");
        let html = "<div class='pd-head'>";
        html += "<span class='pd-title'>" + esc(w.t || "无题") + "</span>";
        if (w.p) html += "<span class='pi-badge'>" + esc(w.p) + "</span>";
        html += "<span class='pd-meta'>" + esc(w.d + " │ " + w.a + (w.tags && w.tags.length ? " │ " + w.tags.join(" / ") : "")) + "</span>";
        html += "</div>";
        html += "<div class='pd-content'>" + (w.c || []).map(esc).join("<br>") + "</div>";
        html += "<div class='actions'>";
        if (w.p && window.CIPU[w.p]) {
          html += "<button class='action' data-appr-write='" + esc(w.p) + "'>用《" + esc(w.p) + "》试写</button>";
        }
        const k = kindOf(w);
        if (k !== "文" && k !== "曲") {
          html += "<button class='action' data-appr-edit='1'>载入到写作页校验</button>";
          html += "<button class='action' data-appr-cmp='1'>谱式对照</button>";
        }
        if (k !== "文") {
          html += "<button class='action' data-appr-pra='1'>默写练习</button>";
          html += "<button class='action' data-appr-copy='1'>复制原文</button>";
        }
        html += "<button class='action' data-appr-view='1'>查看原文 / 导出 PDF</button>";
        html += "</div>";
        html += "<div id='appr-compare' class='cmp-box'></div>";
        if (w.z) html += "<div class='sec-block'><h4>注释</h4><div class='sec-body'>" + esc(w.z) + "</div></div>";
        if (w.y) html += "<div class='sec-block'><h4>译文</h4><div class='sec-body'>" + esc(w.y) + "</div></div>";
        if (w.s) html += "<div class='sec-block'><h4>赏析</h4><div class='sec-body'>" + esc(w.s) + "</div></div>";
        el.innerHTML = html;
        el.style.display = "";
        switchPage("appr-detail");
      }

      function showApprDetail(i) {
        const list = filterWorks();
        const w = list[i];
        if (!w) return;
        APPR_STATE.activeIdx = i;
        renderApprList();
        showApprDetailWork(w);
      }

      // ---------- 随机推荐 ----------
      let recommendWork = null;

      function renderRecommend(forceNew) {
        if (forceNew || !recommendWork) {
          const pool = allWorks();
          if (!pool.length) return;
          let pick = pool[Math.floor(Math.random() * pool.length)];
          if (forceNew && recommendWork) {
            for (let i = 0; i < 20 && pick === recommendWork; i++) {
              pick = pool[Math.floor(Math.random() * pool.length)];
            }
          }
          recommendWork = pick;
        }
        const w = recommendWork;
        const kind = kindOf(w);
        const meta = [w.d, w.a, kind, (w.tags || []).slice(0, 3).join(" / ")]
          .filter(Boolean).join(" │ ");
        const preview = (w.c || []).slice(0, 3).join(" ");
        let html = "<div class='rec-head'><span class='rec-label'>随 机 推 荐</span>" +
          "<span><button class='rec-refresh' id='rec-practice'>随机默写</button> " +
          "<button class='rec-refresh' id='rec-refresh'>换一首 ↻</button></span></div>";
        html += "<div class='rec-title'>" + esc(w.t || "无题") +
          (w.p ? " <span class='pi-badge'>" + esc(w.p) + "</span>" : "") + "</div>";
        html += "<div class='rec-meta'>" + esc(meta) + "</div>";
        html += "<div class='rec-preview'>" + esc(preview) + "</div>";
        html += "<div class='rec-actions'>";
        html += "<button class='small-btn' id='rec-view'>查看全文</button>";
        if (kind !== "文" && kind !== "曲") {
          html += "<button class='small-btn' id='rec-edit'>载入到写作页校验</button>";
        }
        if (w.p && window.CIPU[w.p]) {
          html += "<button class='small-btn' id='rec-write'>用《" + esc(w.p) + "》试写</button>";
        }
        html += "</div>";
        $("appr-recommend").innerHTML = html;
      }

      function splitPoemChunks(w) {
        const joined = (w.c || []).join("");
        return joined
          .replace(/[（(][^（）()]*[）)]/g, "")
          .split(/[，。！？；]/)
          .map(function (s) { return s.replace(/[、：""''《》·\s]/g, ""); })
          .filter(function (s) { return s; });
      }

      function matchWindow(chunks, lens) {
        if (chunks.length < lens.length) return -1;
        for (let off = 0; off <= chunks.length - lens.length; off++) {
          let ok = true;
          for (let k = 0; k < lens.length; k++) {
            if (chunks[off + k].length !== lens[k]) { ok = false; break; }
          }
          if (ok) return off;
        }
        return -1;
      }

      function loadWorkIntoEditor(w) {
        if (!w) return;
        const k = kindOf(w);
        if (k === "文") {
          toast("古文仅作欣赏，暂不支持载入校验");
          return;
        }
        if (k === "曲") {
          toast("元曲仅作欣赏，暂不支持载入校验");
          return;
        }
        const isCi = !!w.p;
        if (isCi && window.CIPU[w.p]) {
          const t = window.CIPU[w.p];
          const chunks = splitPoemChunks(w);
          const lens = t.lines.map(function (l) { return l.parts.join("").length; });
          const off = matchWindow(chunks, lens);
          if (off !== -1) {
            state.mode = "ci";
            state.ciName = w.p;
            state.values = t.lines.map(function (l, li) {
              const src = chunks[off + li];
              let pos = 0;
              return l.parts.map(function (p) {
                const s = src.slice(pos, pos + p.length);
                pos += p.length;
                return s;
              });
            });
            syncModeUI();
            renderMeta(); renderEditor(); renderReport(); saveState();
            switchPage("write");
            updateLastYunFromEditor();
            toast("已载入《" + w.t + "》原文");
            return;
          }
          // 分段不一致：按词谱长度顺序填入，不再留空
          const flat = chunks.join("");
          let pos = 0;
          const fallbackValues = t.lines.map(function (l) {
            return l.parts.map(function (p) {
              const s = flat.slice(pos, pos + p.length);
              pos += p.length;
              return s;
            });
          });
          if (pos < flat.length) {
            const lastLine = fallbackValues[fallbackValues.length - 1];
            if (lastLine && lastLine.length) lastLine[lastLine.length - 1] += flat.slice(pos);
          }
          state.mode = "ci";
          state.ciName = w.p;
          state.values = fallbackValues;
          syncModeUI();
          renderMeta(); renderEditor(); renderReport(); saveState();
          switchPage("write");
          updateLastYunFromEditor();
          toast("已按词谱顺序填入原文，分段与原词谱略有出入");
          return;
        }
        // 诗：尝试匹配近体诗格律
        const chunks = splitPoemChunks(w);
        let match = -1, matchOff = -1;
        window.SHI.forEach(function (s, si) {
          if (match !== -1) return;
          const lineLens = s.lines.map(function (l) { return l.pat.length; });
          const off = matchWindow(chunks, lineLens);
          if (off !== -1) { match = si; matchOff = off; }
        });
        if (match !== -1) {
          state.mode = "shi";
          state.shiIndex = match;
          state.values = chunks.slice(matchOff, matchOff + window.SHI[match].lines.length)
            .map(function (s) { return [s]; });
          syncModeUI();
          renderMeta(); renderEditor(); renderReport(); saveState();
          switchPage("write");
          updateLastYunFromEditor();
          toast("已载入《" + w.t + "》并按" + window.SHI[match].name + "格律校验");
        } else {
          toast("该诗非近体诗五七言格式，仅作欣赏");
        }
      }

      function loadApprIntoEditor(i) {
        const list = filterWorks();
        loadWorkIntoEditor(list[i]);
      }

      function syncModeUI() {
        $("mode-switch").querySelectorAll("button").forEach(function (b) {
          b.classList.toggle("active", b.dataset.mode === state.mode);
        });
        $("shi-wrap").style.display = state.mode === "shi" ? "flex" : "none";
        $("ci-wrap").style.display = state.mode === "ci" ? "flex" : "none";
        $("shi-select").value = state.shiIndex;
        $("tune-select").value = state.ciName;
      }

      // ---------- 页面导航 ----------
      // ---------- 格律详解页 ----------
      let SD_CUR = 0;   // 当前查看的格律下标

      function sdGroupsHtml() {
        // SHI[].style 的取值是「五绝 / 五律 / 七绝 / 七律」，据此分组
        const groups = [["五绝", "五言绝句", "四句二十字"], ["五律", "五言律诗", "八句四十字"],
          ["七绝", "七言绝句", "四句二十八字"], ["七律", "七言律诗", "八句五十六字"]];
        let html = "";
        groups.forEach(function (g) {
          const idxs = [];
          window.SHI.forEach(function (s, i) { if (s.style === g[0]) idxs.push(i); });
          if (!idxs.length) return;
          html += "<div class='sd-g'>" + esc(g[1]) + "<span class='sd-gsub'>" + esc(g[2]) + "</span></div>";
          idxs.forEach(function (i) {
            const s = window.SHI[i];
            html += "<button class='sd-item" + (i === SD_CUR ? " on" : "") + "' data-sd='" + i + "'>" +
              esc(s.name.replace(/^[\u4e00-\u9fff]{2}言[\u4e00-\u9fff]{2}·/, "")) + "</button>";
          });
        });
        return html;
      }

      function sdPatternRow(pat) {
        let html = "<div class='pattern-row'>";
        for (let i = 0; i < pat.length; i++) {
          const ch = pat[i];
          const cls = ch === "平" ? "ping" : ch === "仄" ? "ze" : "chi";
          const free = shiFreePos(pat.length, i);
          html += "<span class='pat-cell " + cls + (free ? " free" : "") + "'>" + esc(ch) + "</span>";
        }
        return html + "</div>";
      }

      // 例作逐字对照：上行为谱式，下行为原文，逐格标合律情况
      function sdCompareHtml(s, ex, strict) {
        if (!ex) return "<div class='hint'>本式暂无内置例作。</div>";
        const tips = (window.SHI_NOTES && window.SHI_NOTES.tips && window.SHI_NOTES.tips[s.name]) || [];
        let filled = 0, ok = 0, relaxedN = 0;
        let html = "<table class='sd-table'>";
        s.lines.forEach(function (l, li) {
          const text = (ex.lines[li] || []).join("");
          let patHtml = "", charHtml = "";
          for (let k = 0; k < l.pat.length; k++) {
            const req = l.pat[k];
            const ch = text[k] || "";
            const free = shiFreePos(l.pat.length, k);
            let cls = "sd-char";
            let title = "";
            if (!ch) {
              cls += " empty";
            } else {
              const rs = readingsOf(ch);
              if (!rs.length) { cls += " unknown"; title = "韵书未收录"; }
              else if (req === "中") { cls += " free-ok"; title = describeReading(rs); }
              else {
                const r = checkTone(ch, req);
                if (!strict && free) {
                  cls += r.ok === false ? " relax" : " ok";
                  if (r.ok === false) relaxedN++;
                } else {
                  cls += r.ok ? " ok" : " bad";
                  filled++;
                  if (r.ok) ok++;
                }
                title = describeReading(rs);
              }
            }
            charHtml += "<span class='" + cls + "' title='" + esc(title) + "'>" + (ch ? esc(ch) : "□") + "</span>";
            patHtml += sdPatternRow(req).replace("<div class='pattern-row'>", "").replace(/<\/div>$/, "");
          }
          html += "<tr><td class='sd-no'>" + (li + 1) + "</td>" +
            "<td class='sd-badge " + (l.rhyme ? "yun" : "ju") + "'>" + (l.rhyme ? "韵" : "句") + "</td>" +
            "<td class='sd-pat'>" + patHtml + "</td>" +
            "<td class='sd-txt'>" + charHtml + "</td></tr>";
        });
        html += "</table>";
        const pct = filled ? Math.round(ok / filled * 100) : null;
        let note = "<div class='hint'>" + (strict ? linkTerms("严格") : linkTerms("宽格")) + "口径：定式 " + filled +
          " 处，合律 " + ok + " 处" + (pct === null ? "" : "（" + pct + "%）");
        if (relaxedN) note += "；另有 " + relaxedN + " 处属" + linkTerms("一三五不论") + "放宽位，宽格不计";
        note += "。</div>";
        if (ex.variant) {
          note += "<div class='hint sd-variant'>△ 本例属公认变体：" + linkTerms(esc(ex.variant)) + "</div>";
        }
        if (tips.length) {
          note += "<div class='sd-tips'><div class='sd-tips-h'>本式要点</div><ul>" +
            tips.map(function (t) { return "<li>" + linkTerms(esc(t)) + "</li>"; }).join("") + "</ul></div>";
        }
        return note + html;
      }

      function renderShiDetail(i) {
        SD_CUR = (typeof i === "number") ? i : SD_CUR;
        if (!window.SHI[SD_CUR]) SD_CUR = 0;
        $("sd-groups").innerHTML = sdGroupsHtml();
        const s = window.SHI[SD_CUR];
        const ex = window.LISHI ? window.LISHI[s.name] : null;
        const strict = shiStrictMode();
        let html = "<div class='sd-head'><span class='sd-name'>" + esc(s.name) + "</span>" +
          "<span class='sd-meta'>" + esc(s.style) + " │ " + s.lines.length + " 句 " +
          (s.lines.reduce(function (n, l) { return n + l.pat.length; }, 0)) + " 字 │ " +
          (s.lines[0].rhyme ? "首句入韵" : "首句不入韵") + "</span>" +
          "<span class='sd-acts'><button class='small-btn' id='sd-use'>按此格律写</button>" +
          "<button class='small-btn' id='sd-load'>载入例作校验</button>" +
          "<button class='small-btn' id='sd-view'>查看例作原文 / PDF</button></span></div>";
        html += "<div class='hint'>" + linkTerms(esc("谱式中「中」表示可平可仄；底色标浅的位置即「一三五不论」的放宽位。")) + "</div>";
        html += sdCompareHtml(s, ex, strict);
        $("sd-main").innerHTML = html;
        // 变体区
        const vs = (window.SHI_NOTES && window.SHI_NOTES.variants) || [];
        const vEl = $("sd-variants");
        if (vEl) {
          vEl.innerHTML = "<div class='sd-tips-h'>近体诗的常见变体</div>" + vs.map(function (v) {
            return "<div class='sd-vbox'><div class='sd-vname'>" + linkTerms(esc(v.name)) +
              "<span class='sd-vtar'>常出现在：" + esc(v.target) + "</span></div>" +
              "<div class='hint'>" + linkTerms(esc(v.desc)) + "</div></div>";
          }).join("");
        }
        // 口径说明
        const modeEl = $("sd-tone-mode");
        if (modeEl) modeEl.value = strict ? "strict" : "wide";
        const hintEl = $("sd-mode-hint");
        if (hintEl) {
          hintEl.innerHTML = linkTerms(
            "「宽格」按通行口诀一三五不论（五言为一三不论）放宽五言第 1、3 位与七言第 1、3、5 位的平仄要求，但仍查孤平、三平尾、粘对与押韵；" +
            "「严格」则要求「中」以外的每一格都合律，用来发现唐诗中常见的放宽写法（如「朝辞白帝彩云间」的「彩」）。" +
            "切换后写作页会立刻按新口径重算。"
          );
        }
        // 按钮
        const useBtn = $("sd-use"); if (useBtn) useBtn.onclick = function () {
          state.mode = "shi"; state.shiIndex = SD_CUR;
          resetValues(); syncModeUI();
          renderMeta(); renderEditor(); renderReport(); saveState();
          switchPage("write");
          toast("已选择「" + window.SHI[SD_CUR].name + "」");
        };
        const loadBtn = $("sd-load"); if (loadBtn) loadBtn.onclick = function () {
          state.mode = "shi"; state.shiIndex = SD_CUR;
          syncModeUI(); renderMeta(); renderEditor();
          loadExample();
          renderReport(); saveState();
          switchPage("write");
        };
        const viewBtn = $("sd-view"); if (viewBtn) viewBtn.onclick = function () {
          openPdfViewer(buildExampleDoc("shi", SD_CUR, ""));
        };
        $("sd-groups").querySelectorAll("[data-sd]").forEach(function (btn) {
          btn.onclick = function () { renderShiDetail(+btn.dataset.sd); };
        });
      }

      function switchPage(page) {
        $("page-write").style.display = page === "write" ? "" : "none";
        $("page-appreciate").style.display = page === "appreciate" ? "" : "none";
        $("page-tunefind").style.display = page === "tunefind" ? "" : "none";
        $("page-jiju").style.display = page === "jiju" ? "" : "none";
        $("page-yunshu").style.display = page === "yunshu" ? "" : "none";
        $("page-shidetail").style.display = page === "shidetail" ? "" : "none";
        $("page-appr-detail").style.display = page === "appr-detail" ? "" : "none";
        $("nav-tabs").querySelectorAll("button").forEach(function (b) {
          const active = b.dataset.page === page ||
            (page === "appr-detail" && b.dataset.page === "appreciate");
          b.classList.toggle("active", active);
        });
        if (page === "appreciate") {
          if (!apprInited) {
            apprInited = true;
            fillApprSelects();
          }
          ensureQuanKu();
          renderApprList();
          renderRecommend(false);
        }
        if (page === "yunshu" && !yunSearchMode) {
          renderYunBrowse();
        }
        if (page === "jiju") {
          ensureQuanKu();
          updateQuanProgress();
        }
        if (page === "shidetail") {
          renderShiDetail(state.mode === "shi" ? state.shiIndex : SD_CUR);
        }
      }

      function switchToWrite(tuneName) {
        switchPage("write");
        if (tuneName && window.CIPU[tuneName]) {
          state.mode = "ci";
          state.ciName = tuneName;
          resetValues();
          syncModeUI();
          renderMeta(); renderEditor(); renderReport(); saveState();
        }
      }

      window.WeiciApp = {
        currentPayload: function () {
          const doc = buildCurrentDoc();
          if (!doc) return null;
          const titleInput = $("cloud-title");
          return {
            title: (titleInput && titleInput.value.trim()) || doc.title || "无题",
            mode: state.mode,
            tune: state.mode === "ci" ? state.ciName : "",
            shiIndex: state.shiIndex,
            yun: state.yunKey,
            content: (doc.lines || []).join("\n"),
            values: JSON.parse(JSON.stringify(state.values || []))
          };
        },
        loadPayload: function (p) {
          if (!p) return;
          state.mode = p.mode || "shi";
          if (typeof p.shiIndex === "number") state.shiIndex = p.shiIndex;
          if (p.tune && window.CIPU[p.tune]) state.ciName = p.tune;
          if (p.yun) { state.yunKey = p.yun; yunKey = p.yun; }
          if (Array.isArray(p.values) && p.values.length) state.values = p.values;
          saveState();
          syncModeUI();
          renderSelects();
          $("yun-select").value = yunKey;
          renderMeta();
          renderEditor();
          renderReport();
          switchPage("write");
          toast("已载入云作品");
        },
        toast: toast
      };

      // ---------- 启动 ----------
      loadState();
      yunKey = state.yunKey || "词林正韵";
      applyTheme();
      applyBg();
      applyFonts();
      applyPrintPalette();
      renderFontSelects();
      renderPaletteSelects();
      renderMotifSelects();
      syncPdfControls();
      renderSelects();
      bindEvents();
      $("yun-select").value = yunKey;
      if (!state.values || !state.values.length) resetValues();
      renderMeta();
      renderEditor();
      renderReport();
      updateMusicHint();
      renderRecommend(false); // 打开网页即随机选一首推荐
      fillYunBrowse();
      renderYunBrowse();
    })();
