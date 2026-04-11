const fallbackSubjectMap = {
  "宏观经济": "AP Macro",
  "微观经济": "AP Micro",
  "微积分BC": "AP Calculus BC",
  "微积分AB": "AP Calculus AB",
  "统计学": "AP Statistics",
  "心理学": "AP Psychology",
  "物理C力学": "AP Physics C: Mechanics",
  "物理C电磁": "AP Physics C: E&M",
  "计算机科学A": "AP CSA",
  "CSA": "AP CSA"
};

const state = {
  catalog: null,
  mockData: window.MOKAO_MOCK_DATA || {}
};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    renderFailure(error);
  });
});

async function init() {
  const page = document.body.dataset.page;
  hydrateAvatarEntry();

  if (!page || page === "home") {
    return;
  }

  state.catalog = await loadCatalog();

  if (page === "mock") {
    renderMockPage(document.getElementById("mock-root"));
    return;
  }

  if (page === "training") {
    renderTrainingPage(document.getElementById("training-root"));
    return;
  }

  if (page === "dashboard-home") {
    renderDashboardHome(document.getElementById("dashboard-root"));
    return;
  }

  if (page === "dashboard-subject") {
    renderDashboardSubject(document.getElementById("dashboard-subject-root"));
    return;
  }

  if (page === "dashboard-unit") {
    renderDashboardUnit(document.getElementById("dashboard-unit-root"));
    return;
  }

  if (page === "profile") {
    renderProfilePage(document.getElementById("profile-root"));
  }
}

function hydrateAvatarEntry() {
  const user = state.mockData.user || window.MOKAO_MOCK_DATA?.user || {};
  document.querySelectorAll(".avatar-entry").forEach((entry) => {
    const avatar = entry.querySelector(".avatar");
    const strong = entry.querySelector("strong");
    const sub = entry.querySelector(".avatar-meta span");
    if (avatar && user.avatarText) {
      avatar.textContent = user.avatarText;
    }
    if (strong && user.name) {
      strong.textContent = user.name;
    }
    if (sub) {
      sub.textContent = "Profile";
    }
  });
}

async function loadCatalog() {
  try {
    const response = await fetch(window.sitePath("/mock-data/exam-catalog.json"));
    if (!response.ok) {
      return { items: [] };
    }
    return await response.json();
  } catch (error) {
    console.warn("Failed to load catalog", error);
    return { items: [] };
  }
}

async function loadUnits() {
  try {
    const response = await fetch(window.sitePath("/mock-data/units.json"));
    if (!response.ok) return {};
    const data = await response.json();
    return data.subjects || {};
  } catch (error) {
    console.warn("Failed to load units", error);
    return {};
  }
}

// Read all ap-learning-exam:* keys from localStorage and compute per-subject stats
async function getUserStats() {
  const stats = {};
  const examCache = {};
  const catalogItems = state.catalog?.items || [];
  const catalogMap = {};
  for (const item of catalogItems) {
    catalogMap[item.examId] = item;
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith("ap-learning-exam:")) continue;
    const examId = key.slice("ap-learning-exam:".length);
    try {
      const data = JSON.parse(localStorage.getItem(key));
      // Fetch exam JSON for question counts (use cache)
      if (!examCache[examId]) {
        try {
          const resp = await fetch(window.sitePath(`/mock-data/ap-exam-${examId}.json`));
          if (resp.ok) examCache[examId] = await resp.json();
          else examCache[examId] = null;
        } catch { examCache[examId] = null; }
      }
      const examJson = examCache[examId];
      if (!examJson) continue;

      // Determine subject
      const subjectZh = examJson.subjectName || catalogMap[examId]?.subject || "";
      if (!subjectZh) continue;

      // Initialize stats for this subject
      if (!stats[subjectZh]) {
        stats[subjectZh] = { totalAnswered: 0, totalQuestions: 0, examsStarted: 0, examsCompleted: 0 };
      }
      const s = stats[subjectZh];

      // Count answered questions
      let examAnswered = 0;
      for (let si = 0; si < (data.sections || []).length; si++) {
        const secState = data.sections[si];
        if (!secState || !secState.answers) continue;
        for (const a of secState.answers) {
          if (a !== null && a !== undefined && a !== "") {
            examAnswered++;
          }
        }
        // Use exam JSON section for total questions
        const examSec = examJson.sections?.[si];
        if (examSec) {
          s.totalQuestions += (examSec.questions || []).length;
        }
      }
      s.totalAnswered += examAnswered;
      s.examsStarted++;
      if (data.results) s.examsCompleted++;
    } catch (e) {
      // skip malformed entries
    }
  }
  return stats;
}

function renderMockPage(root) {
  const items = state.catalog?.items || [];
  if (!items.length) {
    root.innerHTML = '<div class="empty-state">当前没有可展示的本地试卷。</div>';
    return;
  }

  renderSubjectExamBrowser(root, items, "mock");
}

async function renderTrainingPage(root) {
  const catalogItems = state.catalog?.items || [];
  if (!catalogItems.length) {
    root.innerHTML = '<div class="empty-state">暂无可用试卷数据。</div>';
    return;
  }

  // Group catalog items by subject
  const grouped = {};
  for (const item of catalogItems) {
    const label = getSubjectLabel(item);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(item);
  }
  const subjectLabels = Object.keys(grouped).sort();

  // Determine selected subject from query
  const querySubject = getQueryValue("subject");
  const selectedSubject = querySubject && grouped[querySubject] ? querySubject : subjectLabels[0];
  const exams = (grouped[selectedSubject] || []).sort(compareExamItems);

  // Determine selected exam from query
  const queryExamId = getQueryValue("exam");
  const selectedExam = exams.find(e => e.examId === queryExamId) || exams[0];

  root.innerHTML = `
    <section class="overview-card">
      <div class="overview-head">
        <div>
          <span class="eyebrow">Training Center</span>
          <h2>${escapeHtml(selectedSubject)}</h2>
          <p>共 ${exams.length} 套试卷可用，点击开始练习</p>
        </div>
        <span class="summary-badge">${exams.length} 套</span>
      </div>
      <p class="overview-note">选择下方试卷开始练习，系统会自动记录你的做题进度。</p>
    </section>
    <div class="subject-tabs" role="tablist" aria-label="专项训练学科切换">
      ${subjectLabels.map((label) => `
        <button
          class="subject-tab${label === selectedSubject ? " is-active" : ""}"
          type="button"
          data-subject="${escapeHtml(label)}"
        >
          ${escapeHtml(label)}
        </button>
      `).join("")}
    </div>
    <section class="page-section-grid">
      <article class="page-section-card">
        <div class="section-card-head">
          <div>
            <span class="eyebrow">Available Exams</span>
            <h3>${escapeHtml(selectedSubject)} 试卷列表</h3>
          </div>
          <span class="summary-badge">${exams.length} 套</span>
        </div>
        ${selectedExam ? `
        <article class="launch-card">
          <span class="eyebrow">Selected</span>
          <h3>${escapeHtml(cleanTitle(selectedExam.title, selectedSubject))}</h3>
          <p>${escapeHtml(normalizeYear(selectedExam.year, selectedExam.title))} · ${escapeHtml(selectedSubject)} · ${escapeHtml(normalizePaperType(selectedExam.paperType, selectedExam.title))}</p>
          <div class="card-meta">
            <span class="chip">题量 ${Number(selectedExam.questionCount) || 0}</span>
            <span class="chip">Sections ${Number(selectedExam.sectionCount) || 0}</span>
          </div>
          <div class="training-footer">
            <span class="progress-copy">准备就绪</span>
            <a class="card-link" href="${window.sitePath('/ap/start/?examId='+encodeURIComponent(selectedExam.examId))}">开始</a>
          </div>
        </article>
        ` : ""}
        <div class="training-list">
          ${exams.map((item) => {
            const year = normalizeYear(item.year, item.title);
            const paperType = normalizePaperType(item.paperType, item.title);
            const isActive = selectedExam && item.examId === selectedExam.examId;
            return `
            <article class="training-item${isActive ? " is-active" : ""}">
              <div>
                <h3>${escapeHtml(cleanTitle(item.title, selectedSubject))}</h3>
                <p>${escapeHtml(year)} · ${escapeHtml(paperType)} · ${Number(item.questionCount) || 0} 题</p>
              </div>
              <div class="card-meta">
                <span class="chip">${Number(item.sectionCount) || 0} Sections</span>
              </div>
              <div class="training-footer">
                <a class="card-link" href="${window.sitePath('/ap/start/?examId='+encodeURIComponent(item.examId))}">开始</a>
              </div>
            </article>
            `;
          }).join("")}
        </div>
      </article>
      <aside class="page-section-card">
        <div class="section-card-head">
          <div>
            <span class="eyebrow">Info</span>
            <h3>训练说明</h3>
          </div>
        </div>
        <div class="insight-list">
          <article class="insight-item">
            <strong>当前学科</strong>
            <p>${escapeHtml(selectedSubject)}</p>
          </article>
          <article class="insight-item">
            <strong>可用试卷</strong>
            <p>共 ${exams.length} 套，涵盖多年真题和样题</p>
          </article>
          <article class="insight-item">
            <strong>练习建议</strong>
            <p>建议从最新年份的试卷开始，逐步回溯历年真题</p>
          </article>
        </div>
      </aside>
    </section>
  `;

  root.querySelectorAll(".subject-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("subject", button.dataset.subject || "");
      url.searchParams.delete("exam");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
      renderTrainingPage(root);
    });
  });
}

async function renderDashboardHome(root) {
  const user = state.mockData.user || {};
  const userSubjects = getUserDashboardSubjects();
  const userStats = await getUserStats();

  // Build subject list from real stats (subjects with exam activity)
  const realSubjectIds = Object.keys(userStats);
  const allSubjectMap = {};
  // Add mock subjects
  for (const s of userSubjects) {
    if (s) allSubjectMap[s.id] = s;
  }
  // Add real subjects not in mock
  for (const zhName of realSubjectIds) {
    const id = getSubjectIdFromZh(zhName);
    if (!allSubjectMap[id]) {
      const label = getSubjectEnLabel(zhName);
      allSubjectMap[id] = {
        id, label,
        examDate: "", examTime: "",
        masteryState: "one_third", fiveRate: 0, overallMastery: 0,
        mcqPrediction: "-", frqPrediction: "-", knowledgeCoverage: 0,
        layout: "", overviewMetrics: [], units: []
      };
    }
  }
  const subjects = Object.values(allSubjectMap);

  if (!subjects.length) {
    root.innerHTML = '<div class="empty-state">当前用户还没有配置报考科目，也没有考试记录。</div>';
    return;
  }

  root.innerHTML = `
    <section class="overview-card">
      <div class="overview-head">
        <div>
          <span class="eyebrow">Learning Center</span>
          <h2>${escapeHtml(user.name || "AP Learner")}</h2>
          <p>${escapeHtml(user.goal || "开始做题，实时数据将自动显示在这里。")}</p>
        </div>
        <span class="summary-badge">${subjects.length} 门科目</span>
      </div>
      <div class="card-meta">
        ${subjects.map((s) => `<span class="chip">${escapeHtml(s.label)}</span>`).join("")}
      </div>
    </section>
    <section class="dashboard-cards dashboard-cards-${subjects.length > 3 ? "dense" : "open"}">
      ${subjects.map((subject, index) => renderDashboardHomeCard(subject, index, userStats)).join("")}
    </section>
  `;
}

async function renderDashboardSubject(root) {
  const subject = getCurrentDashboardSubject();
  const userStats = await getUserStats();
  const unitsData = await loadUnits();

  if (!subject) {
    root.innerHTML = '<div class="empty-state">没有找到该学科的 Dashboard 数据。</div>';
    return;
  }

  // Find real stats for this subject
  let realStats = null;
  for (const [zhName, s] of Object.entries(userStats)) {
    if (getSubjectIdFromZh(zhName) === subject.id) {
      realStats = s;
      break;
    }
  }

  const answered = realStats ? realStats.totalAnswered : 0;
  const totalQ = realStats ? realStats.totalQuestions : 0;
  const started = realStats ? realStats.examsStarted : 0;
  const completed = realStats ? realStats.examsCompleted : 0;

  // Build real overview metrics
  const metrics = [
    { label: "已答题数", value: String(answered) },
    { label: "总题数", value: String(totalQ) },
    { label: "开考次数", value: String(started) },
    { label: "完成次数", value: String(completed) }
  ];

  // Find matching units data
  let subjectUnits = subject.units || [];
  // Try to match from units.json by finding the Chinese subject name
  const zhSubjectName = Object.keys(unitsData).find(zh => getSubjectIdFromZh(zh) === subject.id);
  if (zhSubjectName && unitsData[zhSubjectName]?.units) {
    const jsonUnits = unitsData[zhSubjectName].units;
    subjectUnits = jsonUnits.map((u) => {
      // Try to find existing mock unit data for mastery info
      const existingUnit = (subject.units || []).find(mu => String(mu.id) === String(u.id));
      return {
        id: String(u.id),
        title: u.nameZh || u.name,
        weight: u.weight || "",
        masteryState: existingUnit?.masteryState || "one_third",
        masteryText: existingUnit?.masteryText || `${u.nameZh || u.name} - 尚未开始练习`,
        skills: existingUnit?.skills || (u.topics || []).map(t => ({
          title: t,
          masteryState: "one_third",
          action: "待练习"
        }))
      };
    });
  }

  root.innerHTML = `
    <section class="overview-card">
      <div class="overview-head">
        <div>
          <span class="eyebrow">Subject Overview</span>
          <h2>${escapeHtml(subject.label)}</h2>
          <p>${escapeHtml(subject.examDate || "未设定考试时间")} ${subject.examTime ? "· " + escapeHtml(subject.examTime) : ""} · 真实做题数据</p>
        </div>
        ${renderMasteryPill(subject.masteryState)}
      </div>
      <div class="summary-grid summary-grid-four">
        ${metrics.map((metric) => `
          <article class="summary-card compact">
            <span class="eyebrow">${escapeHtml(metric.label)}</span>
            <h3>${escapeHtml(metric.value)}</h3>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="page-section-card">
      <div class="section-card-head">
        <div>
          <span class="eyebrow">Unit Map</span>
          <h3>单元掌握地图</h3>
        </div>
      </div>
      <div class="unit-map-grid">
        ${subjectUnits.map((unit) => renderUnitOverviewCard(subject, unit)).join("")}
      </div>
    </section>
  `;
}

function renderDashboardUnit(root) {
  const subject = getCurrentDashboardSubject();
  const unit = getCurrentUnit(subject);
  if (!subject || !unit) {
    root.innerHTML = '<div class="empty-state">没有找到该单元的掌握数据。</div>';
    return;
  }

  root.innerHTML = `
    <section class="overview-card">
      <div class="overview-head">
        <div>
          <span class="eyebrow">Unit Detail</span>
          <h2>${escapeHtml(unit.title)}</h2>
          <p>${escapeHtml(subject.label)} · 考试权重 ${escapeHtml(unit.weight)}</p>
        </div>
        ${renderMasteryPill(unit.masteryState)}
      </div>
      <p class="overview-note">${escapeHtml(unit.masteryText)}</p>
      <div class="card-footer is-start">
        <a class="card-link" href="${window.sitePath('/dashboard/subject/?subject='+encodeURIComponent(subject.id))}">返回学科 Dashboard</a>
      </div>
    </section>
    <section class="page-section-card">
      <div class="section-card-head">
        <div>
          <span class="eyebrow">Skill Map</span>
          <h3>知识点层级掌握情况</h3>
        </div>
      </div>
      <div class="skill-map-grid">
        ${unit.skills.map((skill) => renderSkillMapCard(skill)).join("")}
      </div>
    </section>
  `;
}

function renderProfilePage(root) {
  const user = state.mockData.user || {};
  const subjects = getUserDashboardSubjects();

  root.innerHTML = `
    <section class="profile-shell">
      <aside class="profile-card">
        <div class="profile-avatar">${escapeHtml(user.avatarText || "AP")}</div>
        <h2>${escapeHtml(user.name || "AP Learner")}</h2>
        <p>${escapeHtml(user.bio || "")}</p>
      </aside>
      <section class="profile-content">
        <article class="page-section-card">
          <div class="section-card-head">
            <div>
              <span class="eyebrow">Goal</span>
              <h3>个人目标</h3>
            </div>
          </div>
          <p>${escapeHtml(user.goal || "")}</p>
        </article>
        <article class="page-section-card">
          <div class="section-card-head">
            <div>
              <span class="eyebrow">AP Subjects</span>
              <h3>报考科目</h3>
            </div>
          </div>
          <div class="card-meta">
            ${subjects.map((subject) => `<span class="chip">${escapeHtml(subject.label)}</span>`).join("")}
          </div>
        </article>
        <article class="page-section-card">
          <div class="section-card-head">
            <div>
              <span class="eyebrow">Settings</span>
              <h3>个人设置</h3>
            </div>
          </div>
          <div class="insight-list">
            ${(user.settings || []).map((item) => `<article class="insight-item"><p>${escapeHtml(item)}</p></article>`).join("")}
          </div>
        </article>
      </section>
    </section>
  `;
}

function renderSubjectExamBrowser(root, items, mode) {
  const grouped = groupBySubject(items);
  const subjects = Object.keys(grouped);
  const selectedSubject = getQueryValue("subject") || subjects[0];
  const safeSubject = grouped[selectedSubject] ? selectedSubject : subjects[0];
  const exams = [...grouped[safeSubject]].sort(compareExamItems);

  root.innerHTML = `
    <div class="subject-tabs" role="tablist" aria-label="套题模考学科切换">
      ${subjects.map((subject) => `
        <button class="subject-tab${subject === safeSubject ? " is-active" : ""}" type="button" data-subject="${escapeHtml(subject)}">
          ${escapeHtml(subject)}
        </button>
      `).join("")}
    </div>
    <section class="subject-shell">
      <div class="subject-grid">
        ${exams.map((item) => renderExamCard(item)).join("")}
      </div>
    </section>
  `;

  root.querySelectorAll(".subject-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("subject", button.dataset.subject || "");
      history.replaceState({}, "", `${url.pathname}${url.search}`);
      renderSubjectExamBrowser(root, items, mode);
    });
  });
}

function renderDashboardHomeCard(subject, index, userStats) {
  const stateMeta = getMasteryStateMeta(subject.masteryState);
  const layoutClass = subject.layout === "wide" && index === 0 ? "is-wide" : "";

  // Find real stats for this subject by matching zh name
  let realStats = null;
  for (const [zhName, s] of Object.entries(userStats || {})) {
    if (getSubjectIdFromZh(zhName) === subject.id) {
      realStats = s;
      break;
    }
  }
  const answered = realStats ? realStats.totalAnswered : 0;
  const totalQ = realStats ? realStats.totalQuestions : 0;
  const started = realStats ? realStats.examsStarted : 0;
  const completed = realStats ? realStats.examsCompleted : 0;
  const accuracyPct = realStats && realStats.totalAnswered > 0
    ? Math.round((realStats.totalAnswered / Math.max(realStats.totalQuestions, 1)) * 100) : 0;

  return `
    <a class="dashboard-home-card ${layoutClass}" href="${window.sitePath('/dashboard/subject/?subject='+encodeURIComponent(subject.id))}">
      <div class="dashboard-home-top">
        <div>
          <span class="eyebrow">Exam</span>
          <h3>${escapeHtml(subject.label)}</h3>
          <p>${escapeHtml(subject.examDate || "未设定考试时间")} ${subject.examTime ? "· " + escapeHtml(subject.examTime) : ""}</p>
        </div>
        <span class="mastery-chip ${escapeHtml(stateMeta.tone)}">${escapeHtml(stateMeta.label)}</span>
      </div>
      <div class="dashboard-home-metrics">
        <div class="metric-block">
          <span>已答题数</span>
          <strong>${answered}</strong>
        </div>
        <div class="metric-block">
          <span>做题进度</span>
          <strong>${accuracyPct}%</strong>
        </div>
        <div class="metric-block">
          <span>已开考</span>
          <strong>${started} 次</strong>
        </div>
        <div class="metric-block">
          <span>已完成</span>
          <strong>${completed} 次</strong>
        </div>
      </div>
      <div class="mastery-progress">
        <span>做题进度</span>
        <div class="progress-track">
          <span class="progress-fill ${escapeHtml(stateMeta.fill)}"></span>
        </div>
        <strong>${answered}/${totalQ}</strong>
      </div>
    </a>
  `;
}

function renderUnitOverviewCard(subject, unit) {
  const meta = getMasteryStateMeta(unit.masteryState);
  return `
    <a class="unit-overview-card" href="${window.sitePath('/dashboard/unit/?subject='+encodeURIComponent(subject.id)+'&unit='+encodeURIComponent(unit.id))}">
      <div class="section-card-head">
        <div>
          <h4>${escapeHtml(unit.title)}</h4>
          <p>考试权重 ${escapeHtml(unit.weight)}</p>
        </div>
        <span class="mastery-chip ${escapeHtml(meta.tone)}">${escapeHtml(meta.label)}</span>
      </div>
      <p>${escapeHtml(unit.masteryText)}</p>
      <div class="progress-track">
        <span class="progress-fill ${escapeHtml(meta.fill)}"></span>
      </div>
      <div class="card-meta">
        <span class="chip">${unit.skills.length} 个知识点</span>
      </div>
    </a>
  `;
}

function renderSkillMapCard(skill) {
  const meta = getMasteryStateMeta(skill.masteryState);
  return `
    <article class="skill-map-card ${escapeHtml(meta.tone)}">
      <div class="skill-map-top">
        <span class="skill-block ${escapeHtml(meta.fill)}"></span>
        <span class="skill-level-text">${escapeHtml(meta.label)}</span>
      </div>
      <strong>${escapeHtml(skill.title)}</strong>
      <p>${escapeHtml(skill.action)}</p>
    </article>
  `;
}

function renderTrainingItem(item) {
  return `
    <article class="training-item">
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.unit)} · ${escapeHtml(item.source)} · ${escapeHtml(item.difficulty)}</p>
      </div>
      <div class="card-meta">
        ${(item.tags || []).map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <p>${escapeHtml(item.reason)}</p>
      <div class="training-footer">
        <span class="progress-copy">${escapeHtml(item.progress)}</span>
        <button class="card-link training-start" type="button" data-item="${escapeHtml(slugify(item.title))}">开始</button>
      </div>
    </article>
  `;
}

function renderExamCard(item) {
  const progress = getProgressState(item.examId);
  const subject = getSubjectLabel(item);
  const title = cleanTitle(item.title, subject);
  const year = normalizeYear(item.year, item.title);
  const paperType = normalizePaperType(item.paperType, item.title);

  return `
    <article class="exam-card">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(year)} · ${escapeHtml(subject)} · ${escapeHtml(paperType)}</p>
      </div>
      <div class="card-meta">
        <span class="chip">题量 ${Number(item.questionCount) || 0}</span>
        <span class="chip">Sections ${Number(item.sectionCount) || 0}</span>
        ${progress.hasProgress ? '<span class="chip">本地有进度</span>' : ""}
      </div>
      <div class="card-footer">
        <a class="card-link" href="${window.sitePath('/ap/start/?examId='+encodeURIComponent(item.examId))}">开始</a>
      </div>
    </article>
  `;
}

function pickTrainingSubject(subjects) {
  const subjectId = getQueryValue("subject");
  return subjects.find((item) => item.id === subjectId) || subjects[0];
}

function pickTrainingPath(subject) {
  const pathId = getQueryValue("path");
  return subject.paths.find((item) => item.id === pathId) || subject.paths[0];
}

function pickTrainingItem(items) {
  const itemId = getQueryValue("item");
  return items.find((item) => slugify(item.title) === itemId) || items[0];
}

function getUserDashboardSubjects() {
  const user = state.mockData.user || {};
  return (user.examSubjects || [])
    .map((subjectId) => getDashboardSubjectById(subjectId))
    .filter(Boolean);
}

function getDashboardSubjectById(subjectId) {
  return (state.mockData.dashboard?.subjects || []).find((item) => item.id === subjectId) || null;
}

function getCurrentDashboardSubject() {
  const userSubjects = getUserDashboardSubjects();
  const subjectId = getQueryValue("subject");
  const fromMock = userSubjects.find((item) => item.id === subjectId) || userSubjects[0] || null;
  if (fromMock) return fromMock;
  // If subjectId is provided but not in mock, create a placeholder
  if (subjectId) {
    return {
      id: subjectId,
      label: subjectId,
      examDate: "", examTime: "",
      masteryState: "one_third", fiveRate: 0, overallMastery: 0,
      mcqPrediction: "-", frqPrediction: "-", knowledgeCoverage: 0,
      layout: "", overviewMetrics: [], units: []
    };
  }
  return null;
}

function getCurrentUnit(subject) {
  if (!subject) {
    return null;
  }
  const unitId = getQueryValue("unit");
  return subject.units.find((item) => item.id === unitId) || subject.units[0] || null;
}

function getMasteryStateMeta(stateKey) {
  return state.mockData.masteryStates?.[stateKey] || state.mockData.masteryStates?.one_third || {
    label: stateKey,
    tone: "tone-muted",
    fill: "fill-one-third"
  };
}

function renderMasteryPill(stateKey) {
  const meta = getMasteryStateMeta(stateKey);
  return `<span class="mastery-chip ${escapeHtml(meta.tone)}">${escapeHtml(meta.label)}</span>`;
}

function getQueryValue(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function groupBySubject(items) {
  return items.reduce((groups, item) => {
    const key = getSubjectLabel(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
}

function getSubjectLabel(item) {
  const raw = [item.subject, item.category, item.discipline, item.course, item.examType]
    .find((value) => String(value || "").trim());
  return normalizeSubject(raw);
}

function normalizeSubject(subject) {
  const value = String(subject || "").trim();
  if (fallbackSubjectMap[value]) {
    return fallbackSubjectMap[value];
  }
  if (!value || value.includes("\uFFFD") || value.includes("?")) {
    return "AP Subject";
  }
  return value;
}

// Map Chinese subject name to a stable subject id used in dashboard links
function getSubjectIdFromZh(zhName) {
  const map = {
    "宏观经济": "macro",
    "微积分BC": "calc-bc",
    "微观经济": "micro",
    "心理学": "psych",
    "物理C力学": "physics-mech",
    "物理C电磁": "physics-em",
    "统计学": "stats",
    "计算机科学A": "csa"
  };
  return map[zhName] || zhName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// Map Chinese subject name to English label
function getSubjectEnLabel(zhName) {
  return fallbackSubjectMap[zhName] || zhName;
}

function normalizePaperType(paperType, title) {
  const value = String(paperType || "").trim();
  const titleValue = String(title || "").trim();

  if (titleValue.includes("国际卷")) return "国际卷";
  if (titleValue.includes("样题")) return "样题";
  if (titleValue.includes("真题拼题")) return "练习卷";
  if (!value || value.includes("\uFFFD") || value.includes("?")) return "练习卷";
  return value;
}

function normalizeYear(year, title) {
  const value = String(year || "").trim();
  if (/^\d{4}$/.test(value)) return value;
  const matched = String(title || "").match(/(20\d{2})/);
  return matched ? matched[1] : "未标年份";
}

function cleanTitle(title, subject) {
  const value = String(title || "").trim();
  if (!value || value.includes("\uFFFD") || value.includes("?")) {
    return `${subject} 试卷`;
  }
  return value.replaceAll("__", " ").trim();
}

function getProgressState(examId) {
  const storageKey = `ap-learning-exam:${examId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { hasProgress: false, inProgress: false, updatedAt: 0 };
    const parsed = JSON.parse(raw);
    // Support both old format (sectionStates) and new format (sections)
    const sectionsList = parsed.sections || parsed.sectionStates || [];
    const answers = sectionsList.flatMap((section) => section.answers || []);
    const hasAnswers = answers.some((answer) => Array.isArray(answer) ? answer.length > 0 : String(answer || "").trim().length > 0);
    const hasProgress = Boolean(parsed.startedAt || hasAnswers || parsed.results);
    const inProgress = hasProgress && !parsed.results;
    const updatedAt = Date.parse(parsed.updatedAt || parsed.startedAt || "") || 0;
    return { hasProgress, inProgress, updatedAt };
  } catch (error) {
    console.warn("Failed to parse local progress", examId, error);
    return { hasProgress: false, inProgress: false, updatedAt: 0 };
  }
}

function compareExamItems(a, b) {
  const yearDiff = Number(normalizeYear(b.year, b.title)) - Number(normalizeYear(a.year, a.title));
  if (!Number.isNaN(yearDiff) && yearDiff !== 0) return yearDiff;
  return cleanTitle(a.title, getSubjectLabel(a)).localeCompare(cleanTitle(b.title, getSubjectLabel(b)));
}

function renderFailure(error) {
  const root = document.querySelector("[data-page-root]");
  if (root) {
    root.innerHTML = `<div class="empty-state">加载失败：${escapeHtml(String(error.message || error))}</div>`;
  }
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
