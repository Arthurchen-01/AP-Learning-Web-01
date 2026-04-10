/**
 * AP Learning v2 - Exam Engine
 * 考试核心逻辑：计时、答题、状态管理
 */

// 加载 KaTeX
export function loadKatex() {
  return new Promise((resolve) => {
    if (window.katex) return resolve();
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

// 渲染数学公式
export function renderMath(element) {
  if (!window.katex) return;
  element.querySelectorAll('.math-inline').forEach(el => {
    try {
      window.katex.render(el.textContent, el, { throwOnError: false, displayMode: false });
    } catch (e) {}
  });
}

// 存储 key
function storageKey(examId) {
  return `ap-learning-exam:${examId}`;
}

// 创建初始状态
export function createFreshState(exam) {
  return {
    stage: 'question', // question | review | results
    sectionIndex: 0,
    questionIndex: 0,
    startedAt: null,
    timekeepingModeOn: true,
    ui: {
      navigatorOpen: false,
      flagged: []
    },
    sections: exam.sections.map(section => ({
      section_id: section.section_id,
      status: 'locked',
      timeRemainingSec: (section.time_limit_minutes || 60) * 60,
      answers: new Array(section.question_count).fill(null),
      flagged: new Array(section.question_count).fill(false),
      excluded: new Array(section.question_count).fill(false),
      frqImages: null,
      selfAssessment: new Array(section.question_count).fill(null),
      notes: new Array(section.question_count).fill('')
    })),
    results: null
  };
}

// 加载状态
export function loadState(examId) {
  try {
    const raw = localStorage.getItem(storageKey(examId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// 保存状态
export function saveState(examId, state) {
  localStorage.setItem(storageKey(examId), JSON.stringify(state));
}

// 清除状态
export function clearState(examId) {
  localStorage.removeItem(storageKey(examId));
}

// 格式化时间
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// === 错题本 ===
const WRONG_KEY = 'ap-learning-wrong-questions';

export function loadWrongQuestions() {
  try {
    const raw = localStorage.getItem(WRONG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveWrongQuestion(q) {
  const list = loadWrongQuestions();
  // Avoid duplicates by question_id
  const exists = list.some(wq => wq.question_id === q.question_id);
  if (!exists) {
    list.push(q);
    localStorage.setItem(WRONG_KEY, JSON.stringify(list));
  }
  return list;
}

export function clearWrongQuestions() {
  localStorage.removeItem(WRONG_KEY);
}

export function removeWrongQuestion(questionId) {
  const list = loadWrongQuestions().filter(wq => wq.question_id !== questionId);
  localStorage.setItem(WRONG_KEY, JSON.stringify(list));
  return list;
}

// 计算成绩
export function calculateResults(exam, state) {
  const results = {
    sections: [],
    totalCorrect: 0,
    totalQuestions: 0,
    accuracy: 0,
    wrongQuestions: []
  };

  exam.sections.forEach((section, sIdx) => {
    const secState = state.sections[sIdx];
    let correct = 0;
    let answered = 0;

    section.questions.forEach((q, qIdx) => {
      const answer = secState.answers[qIdx];
      if (answer !== null && answer !== undefined && answer !== '') {
        answered++;
        if (answer === q.correct_answer) {
          correct++;
        } else {
          results.wrongQuestions.push({
            question_id: q.question_id,
            exam_id: exam.exam_id,
            section_id: section.section_id,
            sectionIndex: sIdx,
            questionIndex: qIdx,
            userAnswer: answer,
            correctAnswer: q.correct_answer,
            question_text: q.question_text || q.question_html || '',
            options: q.options || [],
            explanation: q.explanation || '',
            unit: q.unit || '',
            knowledge_points: q.knowledge_points || [],
            timestamp: Date.now()
          });
        }
      }
    });

    results.sections.push({
      section_id: section.section_id,
      correct,
      answered,
      total: section.question_count
    });

    results.totalCorrect += correct;
    results.totalQuestions += section.question_count;
  });

  results.accuracy = results.totalQuestions > 0
    ? Math.round((results.totalCorrect / results.totalQuestions) * 100)
    : 0;

  return results;
}

// === AP_USER_PROGRESS — structured per-unit progress ===
const PROGRESS_KEY = 'AP_USER_PROGRESS';

// Load current progress
export function loadUserProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Save updated progress after exam submission
export function updateUserProgress(exam, state, results) {
  const progress = loadUserProgress() || {
    updatedAt: null,
    subjects: {},
    examHistory: []
  };

  const subject = exam.subject;
  const now = new Date().toISOString();
  progress.updatedAt = now;

  // Init subject if needed
  if (!progress.subjects[subject]) {
    progress.subjects[subject] = {
      displayName: exam.subject_display || exam.subject,
      totalAnswered: 0,
      totalCorrect: 0,
      accuracy: 0,
      units: {},
      weakPoints: []
    };
  }
  const sub = progress.subjects[subject];

  // Per-unit breakdown for this exam
  const unitBreakdown = {};
  const wrongByKP = {};

  exam.sections.forEach((section, sIdx) => {
    const secState = state.sections[sIdx];
    section.questions.forEach((q, qIdx) => {
      const answer = secState.answers[qIdx];
      if (answer === null || answer === undefined || answer === '') return;

      const isCorrect = answer === q.correct_answer;
      const unitLabel = q.unit || 'Unknown';

      // Init unit if needed
      if (!sub.units[unitLabel]) {
        sub.units[unitLabel] = {
          answered: 0,
          correct: 0,
          questions: [],
          masteryScore: 0,
          lastPracticed: null
        };
      }
      const unit = sub.units[unitLabel];

      // Avoid double-counting same question (in case of re-submission)
      if (!unit.questions.includes(q.question_id)) {
        unit.answered++;
        if (isCorrect) unit.correct++;
        unit.questions.push(q.question_id);
        unit.lastPracticed = now;
      }

      // Track wrong knowledge points
      if (!isCorrect && q.knowledge_points) {
        q.knowledge_points.forEach(kp => {
          wrongByKP[kp] = (wrongByKP[kp] || 0) + 1;
        });
      }
    });
  });

  // Recalculate subject totals
  let totalA = 0, totalC = 0;
  Object.values(sub.units).forEach(u => {
    totalA += u.answered;
    totalC += u.correct;
  });
  sub.totalAnswered = totalA;
  sub.totalCorrect = totalC;
  sub.accuracy = totalA > 0 ? Math.round((totalC / totalA) * 100) : 0;

  // Update mastery scores per unit (Bayesian-ish: starts at 2.5, shifts ±0.5 per result)
  Object.values(sub.units).forEach(unit => {
    if (unit.answered >= 3) {
      const rate = unit.correct / unit.answered;
      // masteryScore: 0–5 scale, weighted toward experience
      const weight = Math.min(unit.answered / 20, 1);
      const score = 1 + rate * 4; // 1.0 to 5.0
      unit.masteryScore = Math.round((unit.masteryScore * (1 - weight) + score * weight) * 10) / 10;
    }
  });

  // Weak points: knowledge points with ≥2 wrong answers
  const wp = Object.entries(wrongByKP)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([kp]) => kp);
  sub.weakPoints = wp.slice(0, 5);

  // Exam history entry
  const historyEntry = {
    examId: exam.exam_id,
    examTitle: exam.exam_title,
    subject,
    completedAt: now,
    totalQuestions: results.totalQuestions,
    correct: results.totalCorrect,
    accuracy: results.accuracy,
    unitBreakdown
  };
  progress.examHistory.unshift(historyEntry);
  progress.examHistory = progress.examHistory.slice(0, 50); // keep last 50

  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  return progress;
}

// Get mastery probability (0–5 scale) for a unit
export function getUnitMasteryScore(subject, unitLabel) {
  const progress = loadUserProgress();
  if (!progress || !progress.subjects[subject]) return null;
  const unit = progress.subjects[subject].units[unitLabel];
  return unit ? unit.masteryScore : null;
}

// 答题验证
export function checkAnswer(exam, sectionIndex, questionIndex, userAnswer) {
  const section = exam.sections[sectionIndex];
  if (!section || !section.questions[questionIndex]) return false;
  return userAnswer === section.questions[questionIndex].correct_answer;
}

// 计时器管理
export class ExamTimer {
  constructor(onTick, onExpire) {
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.interval = null;
    this.remaining = 0;
  }

  start(seconds) {
    this.remaining = seconds;
    this.stop();
    this.interval = setInterval(() => {
      this.remaining--;
      this.onTick(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        this.onExpire();
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  pause() { this.stop(); }
  resume() { this.start(this.remaining); }
}
