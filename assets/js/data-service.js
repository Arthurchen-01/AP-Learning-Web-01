/**
 * AP Learning v2 - Data Service
 * 统一数据服务：加载考试数据、题目JSON、用户进度
 */

const DATA_BASE = (window.sitePath || (p => p))('/v2/data/');
const MOCK_DATA_BASE = (window.sitePath || (p => p))('/mock-data/');
const SUBJECT_FOLDERS = [
  'computer_science_a', 'calculus_bc', 'physics_c_mechanics', 'physics_c_em',
  'microeconomics', 'macroeconomics', 'statistics', 'psychology', 'chinese'
];

// 在 mock-data 根目录和科目子文件夹中查找考试文件
async function fetchExamJson(examId) {
  // 1. 直接路径: mock-data/ap-exam-{id}.json
  try {
    const res = await fetch(`${MOCK_DATA_BASE}ap-exam-${examId}.json`);
    if (res.ok) return await res.json();
  } catch (e) {}

  // 2. 科目子文件夹: mock-data/{subject}/ap-exam-{id}.json
  for (const folder of SUBJECT_FOLDERS) {
    try {
      const res = await fetch(`${MOCK_DATA_BASE}${folder}/ap-exam-${examId}.json`);
      if (res.ok) return await res.json();
    } catch (e) {}
  }

  // 3. v2/data 旧格式
  try {
    const res = await fetch(`${DATA_BASE}${examId}/exam_packet.json`);
    if (res.ok) return await res.json();
  } catch (e) {}

  return null;
}

// 加载单个考试包
export async function loadExam(examId) {
  const raw = await fetchExamJson(examId);
  return raw ? normalizeExam(raw) : null;
}

// 加载考试的所有题目
export async function loadExamQuestions(examId) {
  // mock-data 格式：题目内嵌在 exam JSON 里
  const examData = await fetchExamJson(examId);
  if (!examData) return null;

  // 检查是否是内嵌题目格式（有 sections）
  if (examData.sections && Array.isArray(examData.sections)) {
    const allQuestions = [];
    examData.sections.forEach((section, sIdx) => {
      const sectionId = section.section_id || section.id || `section-${sIdx + 1}`;
      if (section.questions && Array.isArray(section.questions)) {
        section.questions.forEach(q => {
          allQuestions.push({ ...q, section_id: sectionId });
        });
      }
    });
    return normalizeQuestions(allQuestions, examId);
  }

  return null;
}

// 加载考试索引
export async function loadExamIndex() {
  try {
    const res = await fetch(MOCK_DATA_BASE + 'exam-catalog.json');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Failed to load exam index:', e);
  }
  return getDefaultExams();
}

// 默认考试列表
function getDefaultExams() {
  return [
    {
      exam_id: 'calc-bc-2018-intl',
      exam_title: 'AP Calculus BC 2018 国际卷',
      subject: 'calculus_bc',
      subject_display: '微积分BC',
      year: 2018,
      form: 'international',
      total_questions: 45,
      sections: [
        { section_id: 'mcq-1', part_label: 'Part A', calculator_allowed: false, question_count: 30 },
        { section_id: 'mcq-2', part_label: 'Part B', calculator_allowed: true, question_count: 15 }
      ]
    },
    {
      exam_id: '2013Intl',
      exam_title: 'AP Calculus BC 2013 国际卷',
      subject: 'calculus_bc',
      subject_display: '微积分BC',
      year: 2013,
      form: 'international',
      total_questions: 50,
      sections: [
        { section_id: 'mcq-1', part_label: 'Part A', calculator_allowed: false, question_count: 28 },
        { section_id: 'mcq-2', part_label: 'Part B', calculator_allowed: true, question_count: 16 }
      ]
    },
    {
      exam_id: '2014Intl',
      exam_title: 'AP Calculus BC 2014 国际卷',
      subject: 'calculus_bc',
      subject_display: '微积分BC',
      year: 2014,
      form: 'international',
      total_questions: 51,
      sections: [
        { section_id: 'mcq-1', part_label: 'Part A', calculator_allowed: false, question_count: 28 },
        { section_id: 'mcq-2', part_label: 'Part B', calculator_allowed: true, question_count: 17 }
      ]
    }
  ];
}

// 规范化考试数据到统一格式
function normalizeExam(rawExam) {
  if (!rawExam) return null;
  
  // 检测格式并规范化
  const normalized = {
    exam_id: rawExam.exam_id || rawExam.examId || '',
    exam_title: rawExam.exam_title || rawExam.title || '',
    subject: rawExam.subject || inferSubject(rawExam.subjectName),
    subject_display: rawExam.subject_display || rawExam.subjectName || '',
    year: rawExam.year || parseInt(rawExam.yearLabel) || new Date().getFullYear(),
    form: rawExam.form || 'standard',
    total_questions: rawExam.total_questions || 0,
    sections: [],
    metadata: rawExam.metadata || {}
  };
  
  // 规范化 sections
  if (rawExam.sections && Array.isArray(rawExam.sections)) {
    normalized.sections = rawExam.sections.map((section, index) => normalizeSection(section, index, normalized.exam_id));
  }
  
  // 计算 total_questions（如果缺失）
  if (!normalized.total_questions) {
    normalized.total_questions = normalized.sections.reduce((sum, sec) => sum + (sec.question_count || 0), 0);
  }
  
  return normalized;
}

// 推断 subject code
function inferSubject(subjectName) {
  if (!subjectName) return 'unknown';
  const name = subjectName.toLowerCase();
  if (name.includes('calculus') || name.includes('微积分')) return 'calculus_bc';
  if (name.includes('physics') || name.includes('物理')) return 'physics';
  if (name.includes('economics') || name.includes('经济')) return 'economics';
  if (name.includes('chemistry') || name.includes('化学')) return 'chemistry';
  if (name.includes('biology') || name.includes('生物')) return 'biology';
  if (name.includes('history') || name.includes('历史')) return 'history';
  if (name.includes('english') || name.includes('英语')) return 'english';
  if (name.includes('computer') || name.includes('计算机')) return 'computer_science';
  return 'unknown';
}

// 规范化 section 到统一格式
function normalizeSection(section, index, examId) {
  // 检测 section 类型
  let sectionType = 'mcq';
  if (section.type === 'frq' || section.section_type === 'frq') {
    sectionType = 'frq';
  } else if (section.type === 'free-response') {
    sectionType = 'frq';
  }
  
  // 规范化字段
  const normalizedSection = {
    section_id: section.section_id || section.id || `section-${index + 1}`,
    section_type: sectionType,
    part_label: section.part_label || section.partTitle || section.title || `Part ${index + 1}`,
    time_limit_minutes: section.time_limit_minutes || section.limitMinutes || (sectionType === 'mcq' ? 60 : 90),
    calculator_allowed: section.calculator_allowed || false,
    question_count: section.question_count || (section.questions ? section.questions.length : 0),
    questions: []
  };
  
  // 规范化 questions
  if (section.questions && Array.isArray(section.questions)) {
    normalizedSection.questions = section.questions
      .map((q, qIndex) => normalizeQuestion(q, qIndex, examId, normalizedSection.section_id))
      .filter(q => q !== null); // Skip broken questions (empty prompts)
    
    // 更新 question_count
    if (!normalizedSection.question_count) {
      normalizedSection.question_count = normalizedSection.questions.length;
    }
  }
  
  return normalizedSection;
}

// 规范化 question 到统一格式
// Returns null for questions that should be skipped (empty prompt)
function normalizeQuestion(question, index, examId, sectionId) {
  // 检测 question type
  let questionType = question.type || question.question_type || 'single_choice';
  if (questionType === 'single') questionType = 'single_choice';
  if (questionType === 'free-response' || questionType === 'frq') questionType = 'free_response';
  
  // 规范化 options
  let options = [];
  if (question.options && Array.isArray(question.options)) {
    options = question.options.map(opt => ({
      key: opt.key,
      html: opt.html || opt.content || opt.text || ''
    }));
  }
  
  // 规范化 prompt
  const promptHtml = question.question_html || question.prompt || question.question_text || '';
  
  // Skip questions with empty prompts (broken data from import)
  if (!promptHtml.trim()) {
    console.warn(`Skipping question ${question.id || question.question_id || index + 1} in exam ${examId}: empty prompt`);
    return null;
  }
  
  // 规范化字段
  const normalizedQuestion = {
    question_id: question.question_id || question.id || `q${index + 1}`,
    exam_id: examId,
    section_id: sectionId,
    sequence_in_exam: question.sequence_in_exam || index + 1,
    question_type: questionType,
    question_html: promptHtml,
    options: options,
    correct_answer: question.correct_answer || question.answer || '',
    unit: question.unit || '',
    knowledge_points: question.knowledge_points || [],
    explanation: question.explanation || ''
  };
  
  // 对于 FRQ 类型，规范化 parts
  if (questionType === 'free_response' && question.parts) {
    normalizedQuestion.subjectiveList = question.parts.map(part => ({
      partSign: part.partSign || part.sign || '',
      partContent: part.partContent || part.content || ''
    }));
  } else if (question.subjectiveList) {
    normalizedQuestion.subjectiveList = question.subjectiveList;
  }
  
  return normalizedQuestion;
}

// 规范化 questions.json 数据
function normalizeQuestions(questions, examId) {
  if (!questions || !Array.isArray(questions)) return [];
  
  return questions
    .map((q, index) => {
      // 检测 question type
      let questionType = q.type || q.question_type || 'single_choice';
      if (questionType === 'single') questionType = 'single_choice';
      if (questionType === 'free-response' || questionType === 'frq') questionType = 'free_response';
      
      // 规范化 options
      let options = [];
      if (q.options && Array.isArray(q.options)) {
        options = q.options.map(opt => ({
          key: opt.key,
          html: opt.html || opt.content || opt.text || ''
        }));
      }
      
      // 规范化 prompt
      const promptHtml = q.question_html || q.prompt || q.question_text || '';
      
      // Skip questions with empty prompts
      if (!promptHtml.trim()) {
        console.warn(`Skipping question ${q.id || q.question_id || index + 1} in exam ${examId}: empty prompt`);
        return null;
      }
      
      return {
        question_id: q.question_id || q.id || `q${index + 1}`,
        exam_id: q.exam_id || examId,
        section_id: q.section_id || '',
        sequence_in_exam: q.sequence_in_exam || index + 1,
        question_type: questionType,
        question_html: promptHtml,
        options: options,
        correct_answer: q.correct_answer || q.answer || '',
        unit: q.unit || '',
        knowledge_points: q.knowledge_points || [],
        explanation: q.explanation || '',
        subjectiveList: q.subjectiveList || q.parts || []
      };
    })
    .filter(q => q !== null); // Skip broken questions
}

// 加载单个题目
export async function loadQuestion(examId, questionId) {
  try {
    const res = await fetch(`${DATA_BASE}${examId}/questions/${questionId}.json`);
    if (res.ok) {
      const raw = await res.json();
      // 规范化单个题目
      return normalizeQuestion(raw, 0, examId, raw.section_id || '');
    }
  } catch (e) {
    console.warn('Failed to load question:', e);
  }
  return null;
}

// 加载做题记录
export function loadSession(examId) {
  try {
    const raw = localStorage.getItem(`ap-learning-session:${examId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// 保存做题记录
export function saveSession(examId, session) {
  localStorage.setItem(`ap-learning-session:${examId}`, JSON.stringify(session));
}

// 清除做题记录
export function clearSession(examId) {
  localStorage.removeItem(`ap-learning-session:${examId}`);
}

// 加载用户进度
export function loadProgress() {
  try {
    const raw = localStorage.getItem('ap-learning-progress');
    return raw ? JSON.parse(raw) : {
      exams: 0,
      questions: 0,
      correct: 0,
      accuracy: 0,
      subjects: {}
    };
  } catch (e) {
    return { exams: 0, questions: 0, correct: 0, accuracy: 0, subjects: {} };
  }
}

// 保存用户进度
export function saveProgress(progress) {
  localStorage.setItem('ap-learning-progress', JSON.stringify(progress));
}

// 更新进度
export function updateProgress(examId, subject, score, totalQuestions, correctCount) {
  const progress = loadProgress();

  progress.exams = (progress.exams || 0) + 1;
  progress.questions = (progress.questions || 0) + totalQuestions;
  progress.correct = (progress.correct || 0) + correctCount;
  progress.accuracy = Math.round((progress.correct / progress.questions) * 100);

  if (!progress.subjects) progress.subjects = {};
  if (!progress.subjects[subject]) {
    progress.subjects[subject] = { exams: 0, questions: 0, correct: 0 };
  }
  progress.subjects[subject].exams++;
  progress.subjects[subject].questions += totalQuestions;
  progress.subjects[subject].correct += correctCount;

  saveProgress(progress);
}

// 获取本地存储的答案
export function getStoredAnswer(examId, sectionId, questionIndex) {
  const session = loadSession(examId);
  if (session && session.sections) {
    const section = session.sections.find(s => s.section_id === sectionId);
    if (section && section.answers) {
      return section.answers[questionIndex];
    }
  }
  return null;
}
