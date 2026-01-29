// ======================= LocalStorage Keys =======================
const LS_BANK = "bank_questions_v3";
const LS_CAT  = "bank_category_map_v3";
const LS_NOTES = "notes_v3";
const LS_ALL_SESS = "all_sessions_v3";
const LS_LAST_SESSION = "last_session_v3";
const LS_THEME = "theme_v3";

// ======================= DOM Helpers =======================
const $ = (id) => document.getElementById(id);
function safeOn(el, evt, fn, opts){
  if(!el) return;
  el.addEventListener(evt, fn, opts);
}
function safeStyle(el, key, val){
  if(el) el.style[key] = val;
}

// ======================= DOM =======================
const subtitle = $("subtitle");

// setup page
const pageSetup = $("page-setup");
const fileQuestions = $("fileQuestions");
const fileCategoryMap = $("fileCategoryMap");
const btnGoQuiz = $("btnGoQuiz");
const btnResetLocal = $("btnResetLocal");

const inpCount = $("inpCount");
const selPoolMode = $("selPoolMode");
const selStudyMode = $("selStudyMode");
const selCategory = $("selCategory");
const btnStart = $("btnStart");
const statsBox = $("statsBox");
const btnExportSession = $("btnExportSession");
const btnExportAll = $("btnExportAll");

// quiz page
const pageQuiz = $("page-quiz");
const metaLine = $("metaLine");
const progressLine = $("progressLine");
const timerText = $("timerText");

const btnBackSetup = $("btnBackSetup");
const btnMark = $("btnMark");              // ✅ 标记按钮
const btnDrawMode = $("btnDrawMode");      // （如果 HTML 没有也没关系：safeOn 会跳过）
const btnClearDraw = $("btnClearDraw");
const btnPen = $("btnPen");

const inkOverlay = $("inkOverlay");
const inkCanvas = $("inkCanvas");
const btnInkClose = $("btnInkClose");

const summaryBox = $("summaryBox");
const questionWrapper = $("questionWrapper");
const stemText = $("stemText");
const optionsBox = $("optionsBox");
const explanationBox = $("explanationBox");
const btnPrev = $("btnPrev");
const btnNext = $("btnNext");
const btnFinish = $("btnFinish");
const btnToggleAnswer = $("btnToggleAnswer");

const noteArea = $("noteArea");
const noteInput = $("noteInput");
const btnSaveNote = $("btnSaveNote");
const btnToggleNote = $("btnToggleNote");

const drawCanvas = $("drawCanvas");
const btnTheme = $("btnTheme");

// ======================= State =======================
let bank = [];
let catMap = {};
let notes = {};

let session = null;
let playlist = [];
let idx = 0;

// ✅ 总计时（整场）timer
let totalTimer = null;
let totalElapsed = 0;     // 秒
let totalStartMs = null;  // Date.now() 基准
let qEnterElapsed = 0;    // 进入当前题时的 totalElapsed（用于算题目耗时）

// ✅ 提交后进入复盘
let submitted = false;

// ✅ 题内画笔模式
let drawMode = false;

// canvas draw
let drawing = false;
let lastX = 0, lastY = 0;

// fullscreen ink overlay
let inkVisible = false;
let inkDrawing = false;
let inkLastX = 0, inkLastY = 0;

// ======================= Utilities =======================
function loadLS(key, fallback){
  try{
    const v = localStorage.getItem(key);
    if(v == null) return fallback;
    return JSON.parse(v);
  }catch(e){
    return fallback;
  }
}
function saveLS(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch(e){
    console.warn("saveLS failed", key, e);
  }
}
function toast(msg){
  if(subtitle){
    subtitle.textContent = msg;
    setTimeout(() => { subtitle.textContent = "（本地离线）"; }, 1200);
  }
}
function escapeHTML(s){
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function stripHtmlToText(html){
  const s = (html ?? "").toString();
  return s
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function downloadText(filename, content){
  const blob = new Blob([content], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function indexToLetter(ai){
  const n = Number(ai);
  if(Number.isFinite(n) && n >= 0 && n < 26) return String.fromCharCode(65 + n);
  return "";
}
function formatMMSS(sec){
  const s = Math.max(0, Number(sec) || 0);
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(Math.floor(s%60)).padStart(2,"0");
  return `${mm}:${ss}`;
}

// ======================= Theme =======================
function applyTheme(){
  const theme = localStorage.getItem(LS_THEME) || "light";
  if(theme === "dark"){
    document.body.classList.add("dark");
    if(btnTheme) btnTheme.textContent = "☀️";
  }else{
    document.body.classList.remove("dark");
    if(btnTheme) btnTheme.textContent = "🌙";
  }
}
applyTheme();
safeOn(btnTheme, "click", () => {
  const cur = localStorage.getItem(LS_THEME) || "light";
  const next = cur === "dark" ? "light" : "dark";
  localStorage.setItem(LS_THEME, next);
  applyTheme();
});

// ======================= Load persisted data =======================
bank = loadLS(LS_BANK, []);
catMap = loadLS(LS_CAT, {});
notes = loadLS(LS_NOTES, {});
let lastSession = loadLS(LS_LAST_SESSION, null);

// ======================= Setup Page =======================
function refreshSetupStats(){
  const n = bank.length;
  const catSet = new Set();
  bank.forEach(q => {
    const c = catMap[q.id] || q.category || "";
    if(c) catSet.add(c);
  });
  const cats = Array.from(catSet).sort();

  if(statsBox){
    statsBox.innerHTML = `
      <div>题库：<b>${n}</b> 题</div>
      <div>分类：<b>${cats.length}</b> 类</div>
    `;
  }

  if(selCategory){
    selCategory.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "（全部）";
    selCategory.appendChild(optAll);

    cats.forEach(c => {
      const op = document.createElement("option");
      op.value = c;
      op.textContent = c;
      selCategory.appendChild(op);
    });
  }
}
refreshSetupStats();

safeOn(btnResetLocal, "click", () => {
  if(!confirm("确定清空本地数据吗？（题库/分类/笔记/全部记录）")) return;
  localStorage.removeItem(LS_BANK);
  localStorage.removeItem(LS_CAT);
  localStorage.removeItem(LS_NOTES);
  localStorage.removeItem(LS_ALL_SESS);
  localStorage.removeItem(LS_LAST_SESSION);
  toast("已清空本地数据");
  bank = [];
  catMap = {};
  notes = {};
  session = null;
  playlist = [];
  idx = 0;
  refreshSetupStats();
});

// ========= 导入题库（兼容 fenbi）=========
safeOn(fileQuestions, "change", async (e) => {
  try{
    const f = e.target.files?.[0];
    if(!f) return;
    const text = await f.text();

    let data = null;
    try{
      data = JSON.parse(text);
    }catch(err){
      const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      const arr = [];
      for(const line of lines){
        try{ arr.push(JSON.parse(line)); }catch(_){}
      }
      data = arr;
    }

    if(!Array.isArray(data)){
      alert("题库文件格式不对：需要 JSON 数组");
      return;
    }

    const norm = data.map((q, i) => {
      const id = q.qid ?? q.id ?? q._id ?? String(i+1);

      const stem =
        q.stem_text ??
        (q.stem_html ? stripHtmlToText(q.stem_html) : null) ??
        q.stem ?? q.question ?? q.text ?? "";

      const options = Array.isArray(q.options) ? q.options
                    : Array.isArray(q.choices) ? q.choices
                    : [];

      let answer = "";
      if(q.answer_index != null){
        answer = indexToLetter(q.answer_index);
      }else{
        answer = String(q.answer ?? q.correct ?? q.key ?? "").trim();
      }

      const explanation = q.explanation ?? q.analysis ?? q.explain ?? "";

      return {
        id: String(id),
        stem: String(stem ?? ""),
        options,
        answer: String(answer ?? ""),
        explanation: String(explanation ?? ""),
        category: String(q.category ?? q.type ?? ""),
      };
    });

    bank = norm;
    saveLS(LS_BANK, bank);
    toast(`已导入题库：${bank.length}题`);
    refreshSetupStats();
  }catch(err){
    console.error(err);
    alert("导入题库失败：请看控制台 Console 报错");
  }
});

safeOn(fileCategoryMap, "change", async (e) => {
  try{
    const f = e.target.files?.[0];
    if(!f) return;
    const text = await f.text();

    let map = {};
    try{
      const j = JSON.parse(text);
      if(Array.isArray(j)){
        j.forEach(row => {
          const id = row.id ?? row.qid;
          const c = row.category ?? row.cat;
          if(id != null && c != null) map[String(id)] = String(c);
        });
      }else if(j && typeof j === "object"){
        Object.keys(j).forEach(k => { map[String(k)] = String(j[k]); });
      }
    }catch(err){
      const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      for(const line of lines){
        const parts = line.split(/,|\t/).map(x => x.trim());
        if(parts.length >= 2) map[String(parts[0])] = String(parts[1]);
      }
    }

    catMap = map;
    saveLS(LS_CAT, catMap);
    toast(`已导入分类映射：${Object.keys(catMap).length}条`);
    refreshSetupStats();
  }catch(err){
    console.error(err);
    alert("导入分类映射失败：请看控制台 Console 报错");
  }
});

safeOn(btnExportSession, "click", () => {
  if(!session){
    alert("当前没有会话。先开始做题。");
    return;
  }
  downloadText(`session_${session.startedAt}.json`, JSON.stringify(session, null, 2));
});
safeOn(btnExportAll, "click", () => {
  const all = loadLS(LS_ALL_SESS, []);
  downloadText(`all_sessions.json`, JSON.stringify(all, null, 2));
});

// ======================= Navigation =======================
function gotoSetup(){
  // 返回设置时：不强制停表，你也可以改成 stopTotalTimer()
  hideInk();
  setDrawMode(false);

  safeStyle(pageQuiz, "display", "none");
  safeStyle(pageSetup, "display", "block");
  refreshSetupStats();
}
function gotoQuiz(){
  safeStyle(pageSetup, "display", "none");
  safeStyle(pageQuiz, "display", "block");

  // 最终兜底：只要题库非空，就保证能出题（避免 0/0 空白）
  if ((!playlist || playlist.length === 0) && bank && bank.length > 0) {
    const fallbackCount = Math.max(1, parseInt(inpCount?.value || "20", 10));
    playlist = bank.map(q => String(q.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(fallbackCount, bank.length));
    idx = 0;
    submitted = false;
    if (summaryBox) summaryBox.style.display = "none";
    toast("题单为空：已自动改为随机出题");
  }

  // ✅ 进入刷题页：计时模式且未提交 => 启动总计时
  if(session?.mode?.studyMode === "timed" && !submitted){
    startTotalTimer();
  }else{
    stopTotalTimer();
    if(timerText) timerText.textContent = "--:--";
  }

  renderQuestion();
}
safeOn(btnBackSetup, "click", () => gotoSetup());

// ======================= ✅ Total Timer（整场总计时） =======================
function startTotalTimer(){
  if(totalTimer) return; // 已在跑
  // 让 totalElapsed 从当前值继续跑
  totalStartMs = Date.now() - totalElapsed * 1000;
  if(timerText) timerText.textContent = formatMMSS(totalElapsed);

  totalTimer = setInterval(() => {
    totalElapsed = Math.floor((Date.now() - totalStartMs) / 1000);
    if(timerText) timerText.textContent = formatMMSS(totalElapsed);
  }, 250);
}
function stopTotalTimer(){
  if(totalTimer){
    clearInterval(totalTimer);
    totalTimer = null;
  }
}

// ======================= Notes =======================
function loadNoteFor(qid){
  const v = notes[String(qid)] || "";
  if(noteInput) noteInput.value = v;
}
function saveNoteFor(qid){
  if(!noteInput) return;
  notes[String(qid)] = (noteInput.value || "").trim();
  saveLS(LS_NOTES, notes);
  toast("已保存笔记");
}
safeOn(btnSaveNote, "click", () => {
  const qid = playlist[idx];
  if(!qid) return;
  saveNoteFor(qid);
});

// ✅ 修复：不要把 noteArea 整块隐藏（否则按钮也没了，无法再打开）
function setNoteVisible(on){
  const v = !!on;
  if(noteInput) noteInput.style.display = v ? "block" : "none";
  if(btnSaveNote) btnSaveNote.style.display = v ? "inline-flex" : "none";
  if(btnToggleNote) btnToggleNote.textContent = v ? "隐藏笔记" : "显示笔记";
}
function isNoteVisible(){
  const d = noteInput?.style?.display;
  if(d === "none") return false;
  return true;
}
safeOn(btnToggleNote, "click", () => {
  setNoteVisible(!isNoteVisible());
});

// ======================= Session logging =======================
function upsertSessionItem(qid, fields){
  if(!session) return;

  const id = String(qid);
  let it = session.items.find(x => String(x.qid) === id);
  if(!it){
    it = {qid: id, answeredAt: null, isCorrect: null, chosen: null, seconds: 0, marked: false};
    session.items.push(it);
  }else{
    if(typeof it.marked !== "boolean") it.marked = false;
  }

  Object.assign(it, fields);
  saveLS(LS_LAST_SESSION, session);

  const all = loadLS(LS_ALL_SESS, []);
  const idxS = all.findIndex(s => String(s.id) === String(session.id));
  if(idxS >= 0) all[idxS] = session;
  else all.push(session);
  saveLS(LS_ALL_SESS, all);
}
function getSessionItem(qid){
  if(!session) return null;
  const it = session.items.find(x => String(x.qid) === String(qid)) || null;
  if(it && typeof it.marked !== "boolean") it.marked = false;
  return it;
}

// ======================= Helpers =======================
function getQuestionById(qid){
  return bank.find(q => String(q.id) === String(qid));
}
function renderProgress(){
  const total = playlist.length || 0;
  const cur = total ? (idx+1) : 0;
  if(progressLine) progressLine.textContent = `进度：${cur}/${total}`;
}

// ======================= ✅ 标记功能 =======================
function renderMarkState(){
  if(!btnMark || !session || !playlist.length) return;
  const qid = playlist[idx];
  const it = getSessionItem(qid);
  const on = !!it?.marked;
  btnMark.textContent = on ? "⭐ 标记：开" : "⭐ 标记：关";
  btnMark.classList.toggle("marked", on);
}
function toggleMark(){
  if(!session || !playlist.length) return;
  const qid = playlist[idx];
  let it = getSessionItem(qid);
  if(!it){
    upsertSessionItem(qid, {});
    it = getSessionItem(qid);
  }
  it.marked = !it.marked;
  saveLS(LS_LAST_SESSION, session);
  renderMarkState();
  if(submitted) buildSummaryCircles();
}
safeOn(btnMark, "click", toggleMark);

// ======================= ✅ 题内画笔开关 =======================
function setDrawMode(on){
  drawMode = !!on;

  if(questionWrapper){
    if(drawMode) questionWrapper.classList.add("draw-on");
    else questionWrapper.classList.remove("draw-on");
  }

  if(btnDrawMode){
    btnDrawMode.textContent = drawMode ? "🖊 题内画笔：开" : "🖊 题内画笔：关";
    btnDrawMode.classList.toggle("primary", drawMode);
  }

  if(drawCanvas){
    drawCanvas.style.pointerEvents = drawMode ? "auto" : "none";
  }

  if(!drawMode){
    drawing = false;
  }
}
function toggleDrawMode(){
  setDrawMode(!drawMode);
}
safeOn(btnDrawMode, "click", () => toggleDrawMode());
safeOn(btnClearDraw, "click", () => clearCanvas());

// ======================= Summary circles =======================
function buildSummaryCircles(){
  if(!session) return;

  const total = playlist.length;
  let done = 0, correct = 0, wrong = 0;

  const wrap = document.createElement("div");
  wrap.className = "qcircles";

  for(let i=0;i<total;i++){
    const qid = playlist[i];
    const it = getSessionItem(qid);

    const b = document.createElement("button");
    b.className = "qc";
    b.type = "button";
    b.textContent = String(i+1);

    if(i === idx) b.classList.add("cur");
    if(it?.marked) b.classList.add("mark");

    if(it && it.answeredAt){
      done += 1;
      if(it.isCorrect === true){ correct += 1; b.classList.add("ok"); }
      else if(it.isCorrect === false){ wrong += 1; b.classList.add("bad"); }
    }else{
      b.classList.add("na");
    }

    b.addEventListener("click", () => {
      idx = i;
      renderQuestion();
      buildSummaryCircles();
    });

    wrap.appendChild(b);
  }

  if(summaryBox){
    summaryBox.innerHTML = `
      <div class="sumline">已做 ${done}/${total}　正确 ${correct}　错误 ${wrong}</div>
      <div class="sumhint">点击圈圈回到对应题目（提交后显示正确/你的选项/解析）</div>
    `;
    summaryBox.appendChild(wrap);
    summaryBox.style.display = "block";
  }
}

// ======================= Render question =======================
function renderQuestion() {
  try {
    setDrawMode(false);
    resizeCanvasToWrapper();

    if (!playlist || !playlist.length) {
      if(progressLine) progressLine.textContent = "进度：0/0";
      if(metaLine) metaLine.textContent = "题号：—";
      if(stemText) stemText.innerHTML = "<i>当前没有可出题目</i>";
      if(optionsBox) optionsBox.innerHTML = "";
      if(explanationBox){
        explanationBox.innerHTML = "";
        explanationBox.style.display = "none";
      }
      renderMarkState();
      return;
    }

    const qid = playlist[idx];
    const q = getQuestionById(qid);
    if(!q){
      if(metaLine) metaLine.textContent = `题号：${qid}`;
      if(stemText) stemText.innerHTML = "<i>题目不存在</i>";
      if(optionsBox) optionsBox.innerHTML = "";
      if(explanationBox){
        explanationBox.innerHTML = "";
        explanationBox.style.display = "none";
      }
      renderMarkState();
      return;
    }

    // ✅ 记录进入本题的时刻（用于 seconds=本题耗时）
    qEnterElapsed = totalElapsed;

    const cat = catMap[q.id] || q.category || "";
    if(metaLine) metaLine.textContent = `题号：${qid}${cat ? "｜分类：" + cat : ""}`;

    renderProgress();

    const stem = (q.stem || "").trim();
    const prefix = `${idx+1}. `;
    if(stemText) stemText.innerHTML = escapeHTML(prefix + stem).replaceAll("\n","<br>");

    const it = getSessionItem(qid);
    const chosen = it?.chosen ? String(it.chosen).toUpperCase() : null;
    const correctLetter = String(q.answer || "").trim().toUpperCase();

    if(optionsBox) optionsBox.innerHTML = "";
    const opts = Array.isArray(q.options) ? q.options : [];
    opts.forEach((opt, i) => {
      const letter = String.fromCharCode(65+i);
      const btn = document.createElement("button");
      btn.className = "opt";
      btn.dataset.choice = letter;
      btn.innerHTML = `<b>${letter}.</b> ${escapeHTML(opt)}`;

      const alreadyAnswered = !!(it && it.answeredAt);
      const lockChoices = submitted || (session?.mode?.studyMode === "review");
      btn.disabled = lockChoices && alreadyAnswered;

      // timed 未提交：只显示“我选了哪项”
      if(alreadyAnswered && (!submitted) && session?.mode?.studyMode === "timed"){
        if(chosen === letter) btn.classList.add("selected");
      }

      // 提交后 / review：显示对错
      const shouldReveal = submitted || (session?.mode?.studyMode === "review");
      if(alreadyAnswered && shouldReveal){
        if(letter === correctLetter) btn.classList.add("correct");
        if(chosen === letter && chosen !== correctLetter) btn.classList.add("wrong");
        if(chosen === letter) btn.classList.add("selected");
      }

      btn.addEventListener("click", () => chooseAnswer(letter));
      if(optionsBox) optionsBox.appendChild(btn);
    });

    if(explanationBox){
      explanationBox.style.display = "none";
      explanationBox.innerHTML = `
        <div style="margin-top:10px;">
          <div><b>正确答案：</b>${escapeHTML(correctLetter)}</div>
          <div style="margin-top:6px; line-height:1.6;">
            ${escapeHTML(String(q.explanation ?? "")).replaceAll("\n","<br>")}
          </div>
        </div>
      `;

      if(submitted || session?.mode?.studyMode === "review"){
        explanationBox.style.display = "block";
      }
    }

    loadNoteFor(qid);
    setNoteVisible(isNoteVisible());

    if(btnPrev) btnPrev.disabled = idx <= 0;
    if(btnNext) btnNext.disabled = idx >= playlist.length-1;

    if(submitted){
      buildSummaryCircles();
    }

    renderMarkState();
  } catch (e) {
    console.error("renderQuestion error:", e);
    if(progressLine) progressLine.textContent = `进度：${(playlist?.length ? (idx+1) : 0)}/${playlist?.length || 0}`;
    if(metaLine) metaLine.textContent = "题号：—";
    if(stemText) stemText.innerHTML = `<i>渲染出错：${escapeHTML(String(e?.message || e))}</i>`;
    if(optionsBox) optionsBox.innerHTML = "";
    if(explanationBox){
      explanationBox.innerHTML = "";
      explanationBox.style.display = "none";
    }
    setDrawMode(false);
    renderMarkState();
  }
}

// ======================= Answer / Review =======================
function chooseAnswer(choice){
  const qid = playlist[idx];
  const q = getQuestionById(qid);
  if(!q) return;

  if(submitted) return;

  const it = getSessionItem(qid);

  if (session?.mode?.studyMode === "review") {
    if (it && it.answeredAt) return;
  }

  const correctLetter = String(q.answer || "").trim().toUpperCase();
  const chosen = String(choice).trim().toUpperCase();

  const shouldJudgeNow = submitted || session?.mode?.studyMode === "review";

  // ✅ 本题耗时：进入题目时刻到作答时刻的差值（秒）
  const spent = Math.max(0, totalElapsed - qEnterElapsed);

  upsertSessionItem(qid, {
    answeredAt: new Date().toISOString(),
    chosen,
    isCorrect: shouldJudgeNow ? (chosen === correctLetter) : null,
    seconds: spent
  });

  renderQuestion();
}

safeOn(btnPrev, "click", () => {
  if (idx <= 0) return;
  idx -= 1;
  renderQuestion();
});
safeOn(btnNext, "click", () => {
  if (idx >= playlist.length - 1) return;
  idx += 1;
  renderQuestion();
});
safeOn(btnToggleAnswer, "click", () => {
  if (session?.mode?.studyMode === "timed" && !submitted) {
    toast("计时刷题：提交后统一显示解析");
    return;
  }
  if(!explanationBox) return;
  explanationBox.style.display = (explanationBox.style.display === "none") ? "block" : "none";
});

safeOn(btnFinish, "click", () => {
  if (!session || submitted) return;

  submitted = true;
  stopTotalTimer();

  // ✅ 提交时统一判卷
  session.items.forEach(it => {
    if (!it.chosen) return;
    const q = getQuestionById(it.qid);
    if (!q) return;
    const correct = String(q.answer || "").trim().toUpperCase();
    it.isCorrect = (String(it.chosen).toUpperCase() === correct);
  });

  saveLS(LS_LAST_SESSION, session);

  toast("已提交：进入复盘");
  buildSummaryCircles();
  renderQuestion();
});

// ======================= Canvas draw (题内画笔) =======================
function resizeCanvasToWrapper() {
  if (!questionWrapper || !drawCanvas) return;
  const rect = questionWrapper.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  drawCanvas.width = Math.floor(rect.width * dpr);
  drawCanvas.height = Math.floor(rect.height * dpr);
  drawCanvas.style.width = rect.width + "px";
  drawCanvas.style.height = rect.height + "px";

  const ctx = drawCanvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.2;
}
function clearCanvas() {
  if(!drawCanvas) return;
  const ctx = drawCanvas.getContext("2d");
  if(!ctx) return;
  ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}
safeOn(window, "resize", () => resizeCanvasToWrapper());

function drawLineTo(x, y){
  if(!drawCanvas) return;
  const ctx = drawCanvas.getContext("2d");
  if(!ctx) return;
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.strokeStyle = "#ef4444";
  ctx.stroke();
  lastX = x; lastY = y;
}

safeOn(drawCanvas, "pointerdown", (e) => {
  if(!drawMode) return;
  e.preventDefault();
  drawing = true;
  const rect = drawCanvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
  try { drawCanvas.setPointerCapture(e.pointerId); } catch(_){}
});
safeOn(drawCanvas, "pointermove", (e) => {
  if(!drawMode) return;
  if(!drawing) return;
  e.preventDefault();
  const rect = drawCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  drawLineTo(x, y);
});
function stopDrawing(e){
  drawing = false;
  if (e && e.pointerId != null && drawCanvas) {
    try { drawCanvas.releasePointerCapture(e.pointerId); } catch(_){}
  }
}
safeOn(drawCanvas, "pointerup", stopDrawing);
safeOn(drawCanvas, "pointercancel", stopDrawing);
safeOn(drawCanvas, "pointerleave", stopDrawing);

// Touch fallback
safeOn(drawCanvas, "touchstart", (e) => {
  if(!drawMode) return;
  e.preventDefault();
  drawing = true;
  const t = e.touches[0];
  const rect = drawCanvas.getBoundingClientRect();
  lastX = t.clientX - rect.left;
  lastY = t.clientY - rect.top;
}, { passive: false });
safeOn(drawCanvas, "touchmove", (e) => {
  if(!drawMode) return;
  if(!drawing) return;
  e.preventDefault();
  const t = e.touches[0];
  const rect = drawCanvas.getBoundingClientRect();
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;
  drawLineTo(x, y);
}, { passive: false });
safeOn(drawCanvas, "touchend", () => { drawing = false; }, { passive: false });
safeOn(drawCanvas, "touchcancel", () => { drawing = false; }, { passive: false });

// ======================= Fullscreen Ink =======================
function resizeInkCanvas() {
  if (!inkCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  inkCanvas.width = Math.floor(w * dpr);
  inkCanvas.height = Math.floor(h * dpr);
  inkCanvas.style.width = w + "px";
  inkCanvas.style.height = h + "px";
  const ctx = inkCanvas.getContext("2d");
  if(!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.4;
}
function showInk() {
  if (!inkOverlay) return;
  inkVisible = true;
  inkOverlay.style.display = "block";
  resizeInkCanvas();
}
function hideInk() {
  if (!inkOverlay) return;
  inkVisible = false;
  inkOverlay.style.display = "none";
  inkDrawing = false;
}
function toggleInk() { inkVisible ? hideInk() : showInk(); }
safeOn(btnPen, "click", () => toggleInk());

safeOn(btnInkClose, "pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  hideInk();
});

if(inkCanvas){
  safeOn(inkCanvas, "pointerdown", (e) => {
    inkDrawing = true;
    const rect = inkCanvas.getBoundingClientRect();
    inkLastX = e.clientX - rect.left;
    inkLastY = e.clientY - rect.top;
    try{ inkCanvas.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  });

  safeOn(inkCanvas, "pointermove", (e) => {
    if (!inkDrawing) return;
    const rect = inkCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = inkCanvas.getContext("2d");
    if(!ctx) return;
    ctx.beginPath();
    ctx.moveTo(inkLastX, inkLastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#ef4444";
    ctx.stroke();
    inkLastX = x;
    inkLastY = y;
    e.preventDefault();
  });

  const stopInk = (e) => {
    inkDrawing = false;
    if (e && e.pointerId != null) {
      try { inkCanvas.releasePointerCapture(e.pointerId); } catch(_){}
    }
  };
  safeOn(inkCanvas, "pointerup", stopInk);
  safeOn(inkCanvas, "pointercancel", stopInk);
  safeOn(inkCanvas, "pointerleave", stopInk);
}

// ======================= Start / Resume =======================
safeOn(btnStart, "click", () => {
  if(!bank.length){
    alert("请先导入题库 JSON。");
    return;
  }

  let count = parseInt(String(inpCount?.value ?? "").trim(), 10);
  if(!Number.isFinite(count) || count <= 0) count = 20;

  const poolMode = selPoolMode?.value || "all";
  const studyMode = selStudyMode?.value || "timed";
  const category = selCategory?.value || "";

  submitted = false;
  if(summaryBox) summaryBox.style.display = "none";

  const allSessions = loadLS(LS_ALL_SESS, []);
  const seen = new Set();
  const wrong = new Set();
  allSessions.forEach(s => {
    (s.items || []).forEach(it => {
      seen.add(String(it.qid));
      if(it.isCorrect === false) wrong.add(String(it.qid));
    });
  });

  let pool = bank.slice();
  if(category){
    pool = pool.filter(q => (catMap[q.id] || q.category || "") === category);
  }
  if(poolMode === "wrong"){
    pool = pool.filter(q => wrong.has(String(q.id)));
  }else if(poolMode === "unseen"){
    pool = pool.filter(q => !seen.has(String(q.id)));
  }

  if(pool.length === 0){
    toast("筛选后无题：已退回全题库随机");
    pool = bank.slice();
  }

  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));
  const qids = picked.map(q => String(q.id));

  session = {
    id: String(Date.now()),
    startedAt: new Date().toISOString().replace(/[:.]/g, "-"),
    mode: {poolMode, studyMode, category},
    items: []
  };

  playlist = qids;
  idx = 0;
  saveLS(LS_LAST_SESSION, session);
  lastSession = session;

  // ✅ 新会话：总计时从 0 开始
  totalElapsed = 0;
  stopTotalTimer();

  gotoQuiz();
});

safeOn(btnGoQuiz, "click", () => {
  lastSession = loadLS(LS_LAST_SESSION, null);
  if(lastSession){
    session = lastSession;
    (session.items || []).forEach(it => {
      if(typeof it.marked !== "boolean") it.marked = false;
    });

    playlist = (session.items || []).map(it => String(it.qid));
    if(!playlist.length){
      playlist = bank.map(q => String(q.id));
    }
    idx = 0;
    submitted = false;
    if(summaryBox) summaryBox.style.display = "none";

    // ✅ 继续上次：这里默认从 0 重新计（如果你想“记住上次总时长”，我也能再改）
    totalElapsed = 0;
    stopTotalTimer();

    gotoQuiz();
  }else{
    alert("没有上一次会话记录，请先开始一组练习。");
  }
});

// ======================= Global error guard =======================
window.addEventListener("error", (e) => {
  console.error("Global error:", e?.error || e);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled rejection:", e?.reason || e);
});

// 初始：确保画布不挡交互
setDrawMode(false);
// 初始：笔记默认显示
setNoteVisible(true);
