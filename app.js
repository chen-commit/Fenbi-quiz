// ======================= LocalStorage Keys =======================
const LS_BANK = "bank_questions_v3";
const LS_CAT  = "bank_category_map_v3";
const LS_NOTES = "notes_v3";
const LS_ALL_SESS = "all_sessions_v3";
const LS_LAST_SESSION = "last_session_v3";
const LS_THEME = "theme_v3";

// ======================= DOM =======================
const subtitle = document.getElementById("subtitle");

// setup page
const pageSetup = document.getElementById("page-setup");
const fileQuestions = document.getElementById("fileQuestions");
const fileCategoryMap = document.getElementById("fileCategoryMap");
const btnGoQuiz = document.getElementById("btnGoQuiz");
const btnResetLocal = document.getElementById("btnResetLocal");

const inpCount = document.getElementById("inpCount");
const selPoolMode = document.getElementById("selPoolMode");
const selStudyMode = document.getElementById("selStudyMode");
const selCategory = document.getElementById("selCategory");
const btnStart = document.getElementById("btnStart");
const statsBox = document.getElementById("statsBox");
const btnExportSession = document.getElementById("btnExportSession");
const btnExportAll = document.getElementById("btnExportAll");

// quiz page
const pageQuiz = document.getElementById("page-quiz");
const metaLine = document.getElementById("metaLine");
const progressLine = document.getElementById("progressLine");
const timerText = document.getElementById("timerText");

const btnBackSetup = document.getElementById("btnBackSetup");
const btnDrawMode = document.getElementById("btnDrawMode");
const btnClearDraw = document.getElementById("btnClearDraw");
const btnPen = document.getElementById("btnPen");

const inkOverlay = document.getElementById("inkOverlay");
const inkCanvas = document.getElementById("inkCanvas");
const btnInkClose = document.getElementById("btnInkClose");

const summaryBox = document.getElementById("summaryBox");
const questionWrapper = document.getElementById("questionWrapper");
const stemText = document.getElementById("stemText");
const optionsBox = document.getElementById("optionsBox");
const explanationBox = document.getElementById("explanationBox");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnFinish = document.getElementById("btnFinish");
const btnToggleAnswer = document.getElementById("btnToggleAnswer");

const noteArea = document.getElementById("noteArea");
const noteInput = document.getElementById("noteInput");
const btnSaveNote = document.getElementById("btnSaveNote");
const btnToggleNote = document.getElementById("btnToggleNote");

const drawCanvas = document.getElementById("drawCanvas");
const btnTheme = document.getElementById("btnTheme");

// ======================= State =======================
let bank = [];
let catMap = {};
let notes = {};

let session = null;
let playlist = [];
let idx = 0;

// timer
let timer = null;
let elapsed = 0;

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
  localStorage.setItem(key, JSON.stringify(value));
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
if(btnTheme){
  btnTheme.addEventListener("click", () => {
    const cur = localStorage.getItem(LS_THEME) || "light";
    const next = cur === "dark" ? "light" : "dark";
    localStorage.setItem(LS_THEME, next);
    applyTheme();
  });
}

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

  statsBox.innerHTML = `
    <div>题库：<b>${n}</b> 题</div>
    <div>分类：<b>${cats.length}</b> 类</div>
  `;

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
refreshSetupStats();

btnResetLocal.addEventListener("click", () => {
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
fileQuestions.addEventListener("change", async (e) => {
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
      try{ arr.push(JSON.parse(line)); }catch(e){}
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
});

fileCategoryMap.addEventListener("change", async (e) => {
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
});

btnExportSession.addEventListener("click", () => {
  if(!session){
    alert("当前没有会话。先开始做题。");
    return;
  }
  downloadText(`session_${session.startedAt}.json`, JSON.stringify(session, null, 2));
});
btnExportAll.addEventListener("click", () => {
  const all = loadLS(LS_ALL_SESS, []);
  downloadText(`all_sessions.json`, JSON.stringify(all, null, 2));
});

btnStart.addEventListener("click", () => {
  if(!bank.length){
    alert("请先导入题库 JSON。");
    return;
  }

  const count = Math.max(1, parseInt(inpCount.value || "20", 10));
  const poolMode = selPoolMode.value;   // "all" | "wrong" | "unseen"
  const studyMode = selStudyMode.value; // "timed" | "review"
  const category = selCategory.value || "";

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

  gotoQuiz();
});

btnGoQuiz.addEventListener("click", () => {
  lastSession = loadLS(LS_LAST_SESSION, null);
  if(lastSession){
    session = lastSession;
    playlist = (session.items || []).map(it => String(it.qid));
    if(!playlist.length){
      playlist = bank.map(q => String(q.id));
    }
    idx = 0;
    submitted = false;
    if(summaryBox) summaryBox.style.display = "none";
    gotoQuiz();
  }else{
    alert("没有上一次会话记录，请先开始一组练习。");
  }
});

// ======================= Navigation =======================
function gotoSetup(){
  pageQuiz.style.display = "none";
  pageSetup.style.display = "block";
  refreshSetupStats();
}
function gotoQuiz(){
  pageSetup.style.display = "none";
  pageQuiz.style.display = "block";
  renderQuestion();
}
btnBackSetup.addEventListener("click", () => gotoSetup());

// ======================= Timer =======================
function startTimer(){
  stopTimer();
  elapsed = 0;
  timerText.textContent = "00:00";
  timer = setInterval(() => {
    elapsed += 1;
    const mm = String(Math.floor(elapsed/60)).padStart(2,"0");
    const ss = String(elapsed%60).padStart(2,"0");
    timerText.textContent = `${mm}:${ss}`;
  }, 1000);
}
function stopTimer(){
  if(timer){
    clearInterval(timer);
    timer = null;
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
if(btnSaveNote){
  btnSaveNote.addEventListener("click", () => {
    const qid = playlist[idx];
    if(!qid) return;
    saveNoteFor(qid);
  });
}
if(btnToggleNote){
  btnToggleNote.addEventListener("click", () => {
    if(!noteArea) return;
    noteArea.style.display = (noteArea.style.display === "none") ? "block" : "none";
  });
}

// ======================= Session logging =======================
function upsertSessionItem(qid, fields){
  const id = String(qid);
  let it = session.items.find(x => String(x.qid) === id);
  if(!it){
    it = {qid: id, answeredAt: null, isCorrect: null, chosen: null, seconds: 0};
    session.items.push(it);
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
  return session.items.find(x => String(x.qid) === String(qid)) || null;
}

// ======================= Helpers =======================
function getQuestionById(qid){
  return bank.find(q => String(q.id) === String(qid));
}
function renderProgress(){
  const total = playlist.length || 0;
  const cur = total ? (idx+1) : 0;
  progressLine.textContent = `进度：${cur}/${total}`;
}

// ======================= ✅ 题内画笔开关（核心融合） =======================
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

  if(!drawMode){
    drawing = false;
  }
}
function toggleDrawMode(){
  setDrawMode(!drawMode);
}
if(btnDrawMode){
  btnDrawMode.addEventListener("click", () => toggleDrawMode());
}

// ======================= Summary circles (提交后总览) =======================
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

  summaryBox.innerHTML = `
    <div class="sumline">已做 ${done}/${total}　正确 ${correct}　错误 ${wrong}</div>
    <div class="sumhint">点击圈圈回到对应题目（提交后显示正确/你的选项/解析）</div>
  `;
  summaryBox.appendChild(wrap);
  summaryBox.style.display = "block";
}

// ======================= Render question =======================
function renderQuestion() {
  if (!playlist.length) return;

  // ✅ 切题默认退出题内画笔（保证选项一定可点）
  setDrawMode(false);

  stopTimer();

  resizeCanvasToWrapper();

  const qid = playlist[idx];
  const q = getQuestionById(qid);
  if(!q){
    stemText.innerHTML = "<i>题目不存在</i>";
    optionsBox.innerHTML = "";
    explanationBox.innerHTML = "";
    explanationBox.style.display = "none";
    return;
  }

  const cat = catMap[q.id] || q.category || "";
  metaLine.textContent = `题号：${qid}${cat ? "｜分类：" + cat : ""}`;

  renderProgress();

  // ✅ 题干序号
  const stem = (q.stem || "").trim();
  const prefix = `${idx+1}. `;
  stemText.innerHTML = escapeHTML(prefix + stem).replaceAll("\n","<br>");

  const it = getSessionItem(qid);
  const chosen = it?.chosen ? String(it.chosen).toUpperCase() : null;
  const correctLetter = String(q.answer || "").trim().toUpperCase();

  // options
  optionsBox.innerHTML = "";
  const opts = Array.isArray(q.options) ? q.options : [];
  opts.forEach((opt, i) => {
    const letter = String.fromCharCode(65+i);
    const btn = document.createElement("button");
    btn.className = "opt";
    btn.dataset.choice = letter;
    btn.innerHTML = `<b>${letter}.</b> ${escapeHTML(opt)}`;

    const alreadyAnswered = !!(it && it.answeredAt);

    // ✅ 计时模式未提交：允许修改，不禁用
    const lockChoices = submitted || (session?.mode?.studyMode === "review");
    btn.disabled = lockChoices && alreadyAnswered;


    // ✅ timed 未提交：只显示“我选了哪项”
    if(alreadyAnswered && (!submitted) && session?.mode?.studyMode === "timed"){
      if(chosen === letter) btn.classList.add("selected");
    }

    // ✅ 提交后 / review：显示对错
    const shouldReveal = submitted || (session?.mode?.studyMode === "review");
    if(alreadyAnswered && shouldReveal){
      if(letter === correctLetter) btn.classList.add("correct");
      if(chosen === letter && chosen !== correctLetter) btn.classList.add("wrong");
      if(chosen === letter) btn.classList.add("selected");
    }

    btn.addEventListener("click", () => chooseAnswer(letter));
    optionsBox.appendChild(btn);
  });

  // explanation
  explanationBox.style.display = "none";
  explanationBox.innerHTML = `
    <div style="margin-top:10px;">
      <div><b>正确答案：</b>${escapeHTML(correctLetter)}</div>
      <div style="margin-top:6px; line-height:1.6;">
        ${escapeHTML(String(q.explanation ?? "")).replaceAll("\n","<br>")}
      </div>
    </div>
  `;

  // timed 未提交：隐藏解析；提交后/复盘模式：默认显示
  if(submitted || session?.mode?.studyMode === "review"){
    explanationBox.style.display = "block";
  }

  loadNoteFor(qid);

  if(session?.mode?.studyMode === "timed" && !submitted){
    startTimer();
  }else{
    timerText.textContent = "--:--";
  }

  btnPrev.disabled = idx <= 0;
  btnNext.disabled = idx >= playlist.length-1;

  if(submitted){
    buildSummaryCircles();
  }
}

function chooseAnswer(choice){
  const qid = playlist[idx];
  const q = getQuestionById(qid);
  if(!q) return;

  // 已提交后不能再改
  if(submitted) return;

  const it = getSessionItem(qid);

  // review 模式：第一次作答后锁定
  if (session?.mode?.studyMode === "review") {
    if (it && it.answeredAt) return;
  }

  stopTimer();

  const correctLetter = String(q.answer || "").trim().toUpperCase();
  const chosen = String(choice).trim().toUpperCase();

  // 是否现在就判对错
  const shouldJudgeNow =
    submitted || session?.mode?.studyMode === "review";

  upsertSessionItem(qid, {
    answeredAt: new Date().toISOString(),
    chosen,
    isCorrect: shouldJudgeNow ? (chosen === correctLetter) : null,
    seconds: elapsed
  });

  // 重新渲染本题（用于更新“选中态 / 对错态”）
  renderQuestion();
}

if (btnPrev) {
  btnPrev.addEventListener("click", () => {
    if (idx <= 0) return;
    idx -= 1;
    renderQuestion();
  });
}

if (btnNext) {
  btnNext.addEventListener("click", () => {
    if (idx >= playlist.length - 1) return;
    idx += 1;
    renderQuestion();
  });
}

if (btnToggleAnswer) {
  btnToggleAnswer.addEventListener("click", () => {
    if (session?.mode?.studyMode === "timed" && !submitted) {
      toast("计时刷题：提交后统一显示解析");
      return;
    }
    explanationBox.style.display =
      (explanationBox.style.display === "none") ? "block" : "none";
  });
}


btnFinish.addEventListener("click", () => {
  if (!session || submitted) return;

  submitted = true;
  stopTimer();

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


// ======================= Canvas draw (题内画笔：仅在 drawMode=开 时才画) =======================
function resizeCanvasToWrapper() {
  const rect = questionWrapper.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  drawCanvas.width = Math.floor(rect.width * dpr);
  drawCanvas.height = Math.floor(rect.height * dpr);
  drawCanvas.style.width = rect.width + "px";
  drawCanvas.style.height = rect.height + "px";

  const ctx = drawCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.2;
}
function clearCanvas() {
  const ctx = drawCanvas.getContext("2d");
  ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}
window.addEventListener("resize", () => resizeCanvasToWrapper());

drawCanvas.addEventListener("pointerdown", (e) => {
  if(!drawMode) return; // ✅ 没开画笔就不画
  drawing = true;
  const rect = drawCanvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
  drawCanvas.setPointerCapture(e.pointerId);
});
drawCanvas.addEventListener("pointermove", (e) => {
  if(!drawMode) return;
  if (!drawing) return;
  const rect = drawCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const ctx = drawCanvas.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.strokeStyle = "#ef4444";
  ctx.stroke();
  lastX = x; lastY = y;
});
function stopDrawing(e){
  drawing = false;
  if (e && e.pointerId != null) {
    try { drawCanvas.releasePointerCapture(e.pointerId); } catch {}
  }
}
drawCanvas.addEventListener("pointerup", stopDrawing);
drawCanvas.addEventListener("pointercancel", stopDrawing);
drawCanvas.addEventListener("pointerleave", stopDrawing);

// ======================= Fullscreen Ink (保留最简可关) =======================
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.4;
}
function clearInkCanvas() {
  if (!inkCanvas) return;
  const ctx = inkCanvas.getContext("2d");
  ctx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
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

if (btnPen) btnPen.addEventListener("click", () => toggleInk());
if (btnInkClose) {
  btnInkClose.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    hideInk();
  });
}

if (inkCanvas) {
  inkCanvas.addEventListener("pointerdown", (e) => {
    inkDrawing = true;
    const rect = inkCanvas.getBoundingClientRect();
    inkLastX = e.clientX - rect.left;
    inkLastY = e.clientY - rect.top;
    inkCanvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  inkCanvas.addEventListener("pointermove", (e) => {
    if (!inkDrawing) return;
    const rect = inkCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = inkCanvas.getContext("2d");
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
      try { inkCanvas.releasePointerCapture(e.pointerId); } catch {}
    }
  };
  inkCanvas.addEventListener("pointerup", stopInk);
  inkCanvas.addEventListener("pointercancel", stopInk);
  inkCanvas.addEventListener("pointerleave", stopInk);
}

btnClearDraw.addEventListener("click", () => {
  clearCanvas();
  clearInkCanvas();
});

// ======================= Boot =======================
gotoSetup();
