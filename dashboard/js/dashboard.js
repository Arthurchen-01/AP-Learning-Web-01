/* Dashboard - Core Logic */

// ========== State ==========
let dashboardData = null;
let expandedSubject = null;

// ========== Init ==========
document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
  renderDashboard();
  bindEvents();
});

async function loadDashboardData() {
  try {
    // 从 localStorage 获取用户进度
    const progress = JSON.parse(localStorage.getItem('AP_USER_PROGRESS') || '{}');
    const subjects = progress.subjects || {};

    // 构造 dashboard 数据
    dashboardData = {
      user: {
        name: 'Olivia Chen',
        avatar: 'OC',
        goal: 'AP 2026 - 8门5分',
        bio: '自学 AP 考生'
      },
      exams: Object.entries(subjects).map(([subjectId, subject]) => {
        const units = Object.entries(subject.units || {}).map(([unitId, unit]) => ({
          id: unitId,
          name: unitId.replace(/-/g, ' '),
          mastery: unit.mastery || 0,
          crown: unit.crown || false
        }));

        // 计算预测分数和五分概率
        const avgMastery = units.length > 0
          ? units.reduce((sum, u) => sum + u.mastery, 0) / units.length
          : 0;
        const predictedScore = Math.round(avgMastery / 20); // 0-5
        const fiveProbability = Math.round(avgMastery);

        // 计算 MCQ/FRQ 分数
        const mcqScore = subject.mcqCorrect || 0;
        const mcqTotal = subject.mcqTotal || 0;
        const frqScore = subject.frqCorrect || 0;
        const frqTotal = subject.frqTotal || 0;

        // 考试日期（假设有配置）
        const examDate = subject.examDate || '2026-05-01';

        return {
          id: subjectId,
          name: subjectId.toUpperCase(),
          examDate,
          predictedScore,
          fiveProbability,
          mcqScore,
          mcqTotal,
          frqScore,
          frqTotal,
          units
        };
      })
    };

    // 如果没有数据，使用 fallback
    if (dashboardData.exams.length === 0) {
      dashboardData = getBuiltinDashboardFallback();
    }
  } catch (e) {
    console.error('Failed to load:', e);
    dashboardData = getBuiltinDashboardFallback();
  }
}

function getBuiltinDashboardFallback() {
  return {
    user: {
      name: 'Olivia Chen',
      avatar: 'OC',
      goal: 'AP 2026 - 8门5分',
      bio: '自学 AP 考生'
    },
    exams: [
      {
        id: 'calculus-bc',
        name: 'CALCULUS BC',
        examDate: '2026-05-04',
        predictedScore: 4,
        fiveProbability: 67,
        mcqScore: 35,
        mcqTotal: 45,
        frqScore: 42,
        frqTotal: 54,
        units: [
          { id: 'unit-1', name: 'Limits and Continuity', mastery: 85, crown: true },
          { id: 'unit-2', name: 'Differentiation', mastery: 72, crown: false },
          { id: 'unit-3', name: 'Integration', mastery: 65, crown: false },
          { id: 'unit-4', name: 'Applications', mastery: 58, crown: false },
          { id: 'unit-5', name: 'Series', mastery: 45, crown: false }
        ]
      },
      {
        id: 'physics-c-mechanics',
        name: 'PHYSICS C: MECHANICS',
        examDate: '2026-05-11',
        predictedScore: 5,
        fiveProbability: 82,
        mcqScore: 28,
        mcqTotal: 35,
        frqScore: 18,
        frqTotal: 22,
        units: [
          { id: 'unit-1', name: 'Kinematics', mastery: 90, crown: true },
          { id: 'unit-2', name: 'Newton\'s Laws', mastery: 85, crown: true },
          { id: 'unit-3', name: 'Work and Energy', mastery: 78, crown: false },
          { id: 'unit-4', name: 'Momentum', mastery: 82, crown: true },
          { id: 'unit-5', name: 'Rotation', mastery: 75, crown: false }
        ]
      },
      {
        id: 'macroeconomics',
        name: 'MACROECONOMICS',
        examDate: '2026-05-06',
        predictedScore: 4,
        fiveProbability: 71,
        mcqScore: 42,
        mcqTotal: 60,
        frqScore: 25,
        frqTotal: 30,
        units: [
          { id: 'unit-1', name: 'Basic Economic Concepts', mastery: 92, crown: true },
          { id: 'unit-2', name: 'Economic Indicators', mastery: 75, crown: false },
          { id: 'unit-3', name: 'National Income', mastery: 68, crown: false },
          { id: 'unit-4', name: 'Financial Sector', mastery: 62, crown: false },
          { id: 'unit-5', name: 'Stabilization Policies', mastery: 58, crown: false }
        ]
      },
      {
        id: 'microeconomics',
        name: 'MICROECONOMICS',
        examDate: '2026-05-06',
        predictedScore: 3,
        fiveProbability: 45,
        mcqScore: 38,
        mcqTotal: 60,
        frqScore: 20,
        frqTotal: 30,
        units: [
          { id: 'unit-1', name: 'Basic Economic Concepts', mastery: 88, crown: true },
          { id: 'unit-2', name: 'Supply and Demand', mastery: 72, crown: false },
          { id: 'unit-3', name: 'Production and Costs', mastery: 55, crown: false },
          { id: 'unit-4', name: 'Market Structures', mastery: 42, crown: false },
          { id: 'unit-5', name: 'Factor Markets', mastery: 35, crown: false }
        ]
      },
      {
        id: 'statistics',
        name: 'STATISTICS',
        examDate: '2026-05-07',
        predictedScore: 4,
        fiveProbability: 68,
        mcqScore: 32,
        mcqTotal: 40,
        frqScore: 35,
        frqTotal: 50,
        units: [
          { id: 'unit-1', name: 'Exploring Data', mastery: 82, crown: true },
          { id: 'unit-2', name: 'Sampling and Experimentation', mastery: 75, crown: false },
          { id: 'unit-3', name: 'Probability', mastery: 65, crown: false },
          { id: 'unit-4', name: 'Statistical Inference', mastery: 58, crown: false },
          { id: 'unit-5', name: 'Regression', mastery: 52, crown: false }
        ]
      },
      {
        id: 'psychology',
        name: 'PSYCHOLOGY',
        examDate: '2026-05-08',
        predictedScore: 5,
        fiveProbability: 85,
        mcqScore: 95,
        mcqTotal: 100,
        frqScore: 6,
        frqTotal: 7,
        units: [
          { id: 'unit-1', name: 'Scientific Foundations', mastery: 92, crown: true },
          { id: 'unit-2', name: 'Biological Bases', mastery: 88, crown: true },
          { id: 'unit-3', name: 'Sensation and Perception', mastery: 85, crown: true },
          { id: 'unit-4', name: 'Learning', mastery: 82, crown: false },
          { id: 'unit-5', name: 'Cognitive Psychology', mastery: 80, crown: false }
        ]
      },
      {
        id: 'csa',
        name: 'COMPUTER SCIENCE A',
        examDate: '2026-05-05',
        predictedScore: 5,
        fiveProbability: 92,
        mcqScore: 38,
        mcqTotal: 40,
        frqScore: 8,
        frqTotal: 8,
        units: [
          { id: 'unit-1', name: 'Primitive Types', mastery: 98, crown: true },
          { id: 'unit-2', name: 'Objects', mastery: 95, crown: true },
          { id: 'unit-3', name: 'Arrays', mastery: 92, crown: true },
          { id: 'unit-4', name: 'Iteration', mastery: 90, crown: true },
          { id: 'unit-5', name: 'Recursion', mastery: 85, crown: false }
        ]
      },
      {
        id: 'physics-c-em',
        name: 'PHYSICS C: E&M',
        examDate: '2026-05-11',
        predictedScore: 4,
        fiveProbability: 62,
        mcqScore: 25,
        mcqTotal: 35,
        frqScore: 15,
        frqTotal: 22,
        units: [
          { id: 'unit-1', name: 'Electrostatics', mastery: 75, crown: false },
          { id: 'unit-2', name: 'Conductors and Capacitors', mastery: 68, crown: false },
          { id: 'unit-3', name: 'Electric Circuits', mastery: 62, crown: false },
          { id: 'unit-4', name: 'Magnetic Fields', mastery: 55, crown: false },
          { id: 'unit-5', name: 'Electromagnetism', mastery: 48, crown: false }
        ]
      }
    ]
  };
}

// ========== Render ==========
function renderDashboard() {
  if (!dashboardData) return;

  // Profile
  renderProfile();

  // Subject cards
  renderSubjectCards();
}

function renderProfile() {
  const user = dashboardData.user;
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-bio').textContent = user.bio;
  document.getElementById('user-goal').textContent = user.goal;
  document.getElementById('exam-count').textContent = dashboardData.exams.length;

  // Average probability
  const probs = dashboardData.exams.map(e => e.fiveProbability);
  const avg = Math.round(probs.reduce((a, b) => a + b, 0) / probs.length);
  document.getElementById('avg-prob').textContent = avg + '%';

  // Days to nearest exam
  const today = new Date();
  const dates = dashboardData.exams.map(e => new Date(e.examDate));
  const nearest = Math.min(...dates.map(d => Math.ceil((d - today) / (1000 * 60 * 60 * 24))));
  document.getElementById('days-left').textContent = Math.max(0, nearest);
}

function renderSubjectCards() {
  const grid = document.getElementById('subjects-grid');
  grid.innerHTML = '';

  dashboardData.exams.forEach(exam => {
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.dataset.id = exam.id;

    // Days to exam
    const today = new Date();
    const examDate = new Date(exam.examDate);
    const daysLeft = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));

    // Progress percentage
    const avgMastery = exam.units.length > 0
      ? Math.round(exam.units.reduce((sum, u) => sum + u.mastery, 0) / exam.units.length)
      : 0;

    card.innerHTML = `
      <div class="subject-card-header">
        <div class="subject-icon">${getSubjectIcon(exam.id)}</div>
        <div>
          <div class="subject-card-title">${exam.name}</div>
          <div class="subject-card-subtitle">${daysLeft > 0 ? `${daysLeft} 天后考试` : '已考'}</div>
        </div>
      </div>
      <div class="subject-card-stats">
        <div class="subject-stat">
          <div class="subject-stat-value">${exam.predictedScore}</div>
          <div class="subject-stat-label">预测分数</div>
        </div>
        <div class="subject-stat">
          <div class="subject-stat-value">${exam.fiveProbability}%</div>
          <div class="subject-stat-label">五分概率</div>
        </div>
        <div class="subject-stat">
          <div class="subject-stat-value">${avgMastery}%</div>
          <div class="subject-stat-label">掌握度</div>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${avgMastery}%"></div>
      </div>
    `;

    card.addEventListener('click', () => toggleUnitDetail(exam.id));
    grid.appendChild(card);
  });
}

function getSubjectIcon(subjectId) {
  const icons = {
    'calculus-bc': '∫',
    'physics-c-mechanics': '⚡',
    'physics-c-em': '⚡',
    'macroeconomics': '📊',
    'microeconomics': '📈',
    'statistics': '📉',
    'psychology': '🧠',
    'csa': '💻'
  };
  return icons[subjectId] || '📚';
}

// ========== Unit Detail (Expand) ==========
function toggleUnitDetail(examId) {
  const exam = dashboardData.exams.find(e => e.id === examId);
  if (!exam) return;

  const detail = document.getElementById('unit-detail');

  if (expandedSubject === examId) {
    // Collapse
    detail.style.display = 'none';
    expandedSubject = null;
    document.querySelectorAll('.subject-card').forEach(c => c.classList.remove('expanded'));
  } else {
    // Expand
    document.getElementById('unit-detail-title').textContent = exam.name;
    renderUnitsGrid(exam.units);
    detail.style.display = 'block';
    expandedSubject = examId;

    // Scroll to detail
    setTimeout(() => {
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
}

function renderUnitsGrid(units) {
  const grid = document.getElementById('units-grid');
  grid.innerHTML = '';

  units.forEach(unit => {
    const card = document.createElement('div');
    card.className = 'unit-card';

    // Mastery level color
    let barColor = '#ef4444';
    if (unit.mastery >= 80) barColor = '#22c55e';
    else if (unit.mastery >= 60) barColor = '#3b82f6';
    else if (unit.mastery >= 40) barColor = '#f59e0b';

    card.innerHTML = `
      <div class="unit-card-title">${unit.crown ? '👑 ' : ''}${unit.name}</div>
      <div class="unit-card-progress">掌握度: ${unit.mastery}%</div>
      <div class="unit-progress-bar">
        <div class="unit-progress-fill" style="width: ${unit.mastery}%; background: ${barColor}"></div>
      </div>
    `;

    grid.appendChild(card);
  });
}

// ========== Events ==========
function bindEvents() {
  document.getElementById('close-unit-btn').addEventListener('click', () => {
    document.getElementById('unit-detail').style.display = 'none';
    expandedSubject = null;
    document.querySelectorAll('.subject-card').forEach(c => c.classList.remove('expanded'));
  });
}
