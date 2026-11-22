(function () {
  const cfg = window.WEICI_CLOUD_CONFIG;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };
  const toast = function (msg) {
    if (window.WeiciApp && typeof window.WeiciApp.toast === "function") window.WeiciApp.toast(msg);
    else setMsg(msg);
  };
  const setMsg = function (msg) { const el = $("cloud-msg"); if (el) el.textContent = msg || ""; };
  const setAuthMsg = function (msg) { const el = $("cloud-auth-msg"); if (el) el.textContent = msg || ""; };

  if (!window.WorkBuddyCloud || !cfg) {
    setAuthMsg("云服务脚本未加载，联网后重试");
    return;
  }

  const cloud = window.WorkBuddyCloud.createWorkBuddyCloud({
    endpoint: cfg.endpoint,
    oauthRelayBaseUrl: cfg.oauthRelayBaseUrl,
    publishableKey: cfg.publishableKey
  });

  let currentSession = null;
  let pendingOtp = null;
  let worksCache = [];

  function userLabel(session) {
    const u = session && session.user;
    if (!u) return "用户";
    return u.name || u.phone || u.email || "用户";
  }

  function updateAuthUI() {
    const authed = !!currentSession;
    const authView = $("cloud-auth-view");
    const userView = $("cloud-user-view");
    if (authView) authView.style.display = authed ? "none" : "";
    if (userView) userView.style.display = authed ? "" : "none";
    const name = $("cloud-user-name");
    if (name) name.textContent = authed ? userLabel(currentSession) : "";
    if (authed) listWorks();
  }

  async function getSession() {
    const r = await cloud.auth.getSession();
    currentSession = r.error ? null : (r.data || null);
    updateAuthUI();
    return currentSession;
  }

  async function restoreAuth() {
    const url = new URL(location.href);
    if (!url.searchParams.has("code") && !url.searchParams.has("error")) {
      await getSession();
      return;
    }
    const provider = url.searchParams.get("provider");
    if (provider !== "wechat") {
      setAuthMsg("登录回调无效，请重新登录");
      return;
    }
    const handler = cloud.auth.handleWechatWebCallback;
    if (typeof handler !== "function") {
      setAuthMsg("当前 SDK 不支持微信登录回调");
      return;
    }
    const r = await handler.call(cloud.auth);
    for (const key of ["code", "state", "provider"]) url.searchParams.delete(key);
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (r.error) {
      setAuthMsg(r.error.message || "微信登录失败");
      return;
    }
    currentSession = r.data || null;
    updateAuthUI();
    toast("已登录");
  }

  async function sendPhoneCode() {
    const input = $("cloud-phone");
    const phone = input ? input.value.trim() : "";
    if (!/^1\d{10}$/.test(phone)) {
      setAuthMsg("请输入正确的 11 位手机号");
      return;
    }
    setAuthMsg("正在发送验证码…");
    const sent = await cloud.auth.sendOtp({ phone: phone });
    if (sent.error) {
      setAuthMsg(sent.error.message || "验证码发送失败");
      return;
    }
    pendingOtp = { phone: phone, verificationId: sent.data.verificationId, isExistingUser: sent.data.isExistingUser };
    setAuthMsg("验证码已发送");
  }

  async function submitPhoneLogin() {
    const input = $("cloud-phone");
    const codeInput = $("cloud-code");
    const phone = input ? input.value.trim() : "";
    const token = codeInput ? codeInput.value.trim() : "";
    const p = pendingOtp;
    if (!p || p.phone !== phone) {
      setAuthMsg("请先获取当前手机号的验证码");
      return;
    }
    if (!token) {
      setAuthMsg("请输入验证码");
      return;
    }
    setAuthMsg("正在登录…");
    const r = await cloud.auth.verifyOtp({
      phone: p.phone,
      verificationId: p.verificationId,
      isExistingUser: p.isExistingUser,
      token: token
    });
    if (r.error) {
      setAuthMsg(r.error.message || "登录失败");
      return;
    }
    pendingOtp = null;
    currentSession = r.data || null;
    setAuthMsg("");
    updateAuthUI();
    toast("已登录");
  }

  async function wechatLogin() {
    if (location.protocol !== "https:") {
      setAuthMsg("微信登录需上线后使用，请先发布应用");
      return;
    }
    const r = await cloud.auth.signInWithOAuth({ provider: "wechat", redirectTo: location.origin });
    if (r.error) {
      setAuthMsg(r.error.message || "微信登录失败");
      return;
    }
    location.assign(r.data.url);
  }

  async function signOut() {
    const r = await cloud.auth.signOut();
    if (r.error) { toast(r.error.message || "退出失败"); return; }
    currentSession = null;
    worksCache = [];
    updateAuthUI();
    renderWorks();
    toast("已退出");
  }

  async function requireSession() {
    if (currentSession) return currentSession;
    return await getSession();
  }

  async function listWorks() {
    const session = await requireSession();
    if (!session) return;
    const r = await cloud.database
      .from("weici_works")
      .select("id, title, mode, tune, yun, content, file_path, file_name, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (r.error) {
      setMsg("云作品读取失败：" + (r.error.message || "未知错误"));
      worksCache = [];
    } else {
      worksCache = r.data || [];
      setMsg("");
    }
    renderWorks();
  }

  function renderWorks() {
    const box = $("cloud-works");
    if (!box) return;
    if (!worksCache.length) {
      box.innerHTML = "<div class='hint'>还没有云作品。填写当前作品后点「上传当前作品」。</div>";
      return;
    }
    box.innerHTML = worksCache.map(function (w) {
      const meta = [w.mode, w.tune, w.yun].filter(Boolean).join(" · ");
      const excerpt = String(w.content || "").replace(/\s+/g, " ").slice(0, 48);
      const fileBtn = w.file_path
        ? "<button class='small-btn' data-cloud-download='" + esc(w.file_path) + "'>附件</button>" : "";
      return "<div class='cloud-work-item'>" +
        "<div class='cloud-work-head'><b>" + esc(w.title || "无题") + "</b><span>" + esc(meta) + "</span></div>" +
        "<div class='cloud-work-excerpt'>" + esc(excerpt) + "</div>" +
        "<div class='cloud-work-date'>" + esc(new Date(w.created_at).toLocaleString()) + (w.file_name ? " · " + esc(w.file_name) : "") + "</div>" +
        "<div class='cloud-work-actions'>" +
        "<button class='small-btn' data-cloud-load='" + w.id + "'>载入编辑</button>" + fileBtn +
        "<button class='small-btn' data-cloud-delete='" + w.id + "' data-cloud-file='" + esc(w.file_path || "") + "'>删除</button>" +
        "</div></div>";
    }).join("");
  }

  function fileExt(name) {
    const m = /\.([a-zA-Z0-9]+)$/.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  async function saveCurrentWork() {
    const session = await requireSession();
    if (!session) { setMsg("请先登录"); return; }
    if (!window.WeiciApp || typeof window.WeiciApp.currentPayload !== "function") {
      setMsg("当前页面未提供可上传的作品");
      return;
    }
    const payload = window.WeiciApp.currentPayload();
    if (!payload) { setMsg("请先在写作页填写内容"); return; }
    const fileInput = $("cloud-file");
    const file = fileInput && fileInput.files && fileInput.files[0];
    const allowed = ["pdf", "txt", "md", "png", "jpg", "jpeg", "doc", "docx"];
    let filePath = null;
    let fileName = null;
    if (file) {
      const ext = fileExt(file.name);
      if (allowed.indexOf(ext) === -1) {
        setMsg("附件仅支持 PDF / TXT / MD / 图片 / Word");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setMsg("附件不能超过 20MB");
        return;
      }
      setMsg("正在上传附件…");
      filePath = cloud.storage.userPath(
        session.user.id,
        "works/" + Date.now() + "-" + Math.random().toString(36).slice(2, 10) + "." + ext
      );
      const up = await cloud.storage.upload(filePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });
      if (up.error) {
        setMsg("附件上传失败：" + (up.error.message || "未知错误"));
        return;
      }
      fileName = file.name;
    }
    setMsg("正在保存云作品…");
    const row = {
      title: payload.title || "无题",
      mode: payload.mode || "shi",
      tune: payload.tune || "",
      yun: payload.yun || "",
      content: payload.content || "",
      payload: payload,
      file_path: filePath,
      file_name: fileName,
      owner_name: session.user.name || null,
      is_public: false
    };
    const r = await cloud.database.from("weici_works").insert(row).select();
    if (r.error) {
      if (filePath) await cloud.storage.remove([filePath]);
      setMsg("保存失败：" + (r.error.message || "未知错误"));
      return;
    }
    if (fileInput) fileInput.value = "";
    setMsg("已保存到云端");
    toast("已保存到云端");
    await listWorks();
  }

  async function deleteWork(id, filePath) {
    if (!window.confirm("确定删除这首云作品吗？附件也会一并删除，且无法恢复。")) return;
    setMsg("正在删除…");
    const r = await cloud.database.from("weici_works").delete().eq("id", Number(id)).select();
    if (r.error) { setMsg("删除失败：" + (r.error.message || "未知错误")); return; }
    if (!Array.isArray(r.data) || r.data.length === 0) {
      setMsg("未删除：作品不存在或不是你的");
      return;
    }
    if (filePath) await cloud.storage.remove([filePath]);
    setMsg("已删除");
    await listWorks();
  }

  async function downloadFile(path) {
    const session = await requireSession();
    if (!session) { setMsg("请先登录"); return; }
    const r = await cloud.storage.createSignedUrl(path, 600);
    if (r.error || !r.data || !r.data.url) {
      setMsg("附件打开失败：" + ((r.error && r.error.message) || "未知错误"));
      return;
    }
    window.open(r.data.url, "_blank", "noopener");
  }

  function loadWork(id) {
    const row = worksCache.filter(function (w) { return String(w.id) === String(id); })[0];
    if (!row) { setMsg("找不到该作品"); return; }
    if (!window.WeiciApp || typeof window.WeiciApp.loadPayload !== "function") {
      setMsg("当前页面不支持载入云作品");
      return;
    }
    window.WeiciApp.loadPayload(row.payload || { title: row.title, content: row.content, mode: row.mode, tune: row.tune, yun: row.yun });
    $("cloud-overlay").classList.remove("show");
  }

  function openCloud() {
    $("cloud-overlay").classList.add("show");
    if (currentSession) listWorks();
    else getSession();
  }

  function bind() {
    const btn = $("btn-cloud");
    if (btn) btn.addEventListener("click", openCloud);
    if ($("cloud-send-code")) $("cloud-send-code").addEventListener("click", sendPhoneCode);
    if ($("cloud-login")) $("cloud-login").addEventListener("click", submitPhoneLogin);
    if ($("cloud-wechat")) $("cloud-wechat").addEventListener("click", wechatLogin);
    if ($("cloud-logout")) $("cloud-logout").addEventListener("click", signOut);
    if ($("cloud-save-current")) $("cloud-save-current").addEventListener("click", saveCurrentWork);
    const box = $("cloud-works");
    if (box) {
      box.addEventListener("click", function (e) {
        const load = e.target.closest("[data-cloud-load]");
        const del = e.target.closest("[data-cloud-delete]");
        const dl = e.target.closest("[data-cloud-download]");
        if (load) loadWork(load.getAttribute("data-cloud-load"));
        else if (del) deleteWork(del.getAttribute("data-cloud-delete"), del.getAttribute("data-cloud-file"));
        else if (dl) downloadFile(dl.getAttribute("data-cloud-download"));
      });
    }
    cloud.auth.onAuthStateChange(function (event, session) {
      currentSession = session || null;
      updateAuthUI();
    });
  }

  bind();
  restoreAuth();

  window.WeiciCloud = {
    open: openCloud,
    signOut: signOut,
    listWorks: listWorks,
    cloud: cloud
  };
})();
