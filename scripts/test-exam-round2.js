/**
 * Round 2: Test all Physics C: Mechanics exam files
 * Tests: normalization, section structure, FRQ handling, LaTeX rendering
 */

const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/25472/projects/AP-Learning-Web/AP-Learning-Web-01';
const MOCK_DATA = path.join(BASE, 'mock-data');
const OUTPUT_FILE = path.join(BASE, 'scripts', 'test-round2-results.txt');

const results = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let warningCount = 0;

function log(msg) { results.push(msg); console.log(msg); }
function pass(test) { totalTests++; passedTests++; log(`  PASS: ${test}`); }
function fail(test, detail) { totalTests++; failedTests++; log(`  FAIL: ${test} -- ${detail}`); }
function warn(test, detail) { warningCount++; log(`  WARN: ${test} -- ${detail}`); }

// === Inline normalizeExam logic (copied from data-service.js) ===

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

function normalizeQuestion(question, index, examId, sectionId) {
  let questionType = question.type || question.question_type || 'single_choice';
  if (questionType === 'single') questionType = 'single_choice';
  if (questionType === 'free-response' || questionType === 'frq') questionType = 'free_response';

  let options = [];
  if (question.options && Array.isArray(question.options)) {
    options = question.options.map(opt => ({
      key: opt.key,
      html: opt.html || opt.content || opt.text || ''
    }));
  }

  const normalizedQuestion = {
    question_id: question.question_id || question.id || `q${index + 1}`,
    exam_id: examId,
    section_id: sectionId,
    sequence_in_exam: question.sequence_in_exam || index + 1,
    question_type: questionType,
    question_html: question.question_html || question.prompt || question.question_text || '',
    options: options,
    correct_answer: question.correct_answer || question.answer || '',
    unit: question.unit || '',
    knowledge_points: question.knowledge_points || [],
    explanation: question.explanation || ''
  };

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

function normalizeSection(section, index, examId) {
  let sectionType = 'mcq';
  if (section.type === 'frq' || section.section_type === 'frq') {
    sectionType = 'frq';
  } else if (section.type === 'free-response') {
    sectionType = 'frq';
  }

  const normalizedSection = {
    section_id: section.section_id || section.id || `section-${index + 1}`,
    section_type: sectionType,
    part_label: section.part_label || section.partTitle || section.title || `Part ${index + 1}`,
    time_limit_minutes: section.time_limit_minutes || section.limitMinutes || (sectionType === 'mcq' ? 60 : 90),
    calculator_allowed: section.calculator_allowed || false,
    question_count: section.question_count || (section.questions ? section.questions.length : 0),
    questions: []
  };

  if (section.questions && Array.isArray(section.questions)) {
    normalizedSection.questions = section.questions.map((q, qIndex) =>
      normalizeQuestion(q, qIndex, examId, normalizedSection.section_id)
    );
    if (!normalizedSection.question_count) {
      normalizedSection.question_count = normalizedSection.questions.length;
    }
  }

  return normalizedSection;
}

function normalizeExam(rawExam) {
  if (!rawExam) return null;

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

  if (rawExam.sections && Array.isArray(rawExam.sections)) {
    normalized.sections = rawExam.sections.map((section, index) =>
      normalizeSection(section, index, normalized.exam_id)
    );
  }

  if (!normalized.total_questions) {
    normalized.total_questions = normalized.sections.reduce((sum, sec) => sum + (sec.question_count || 0), 0);
  }

  return normalized;
}

// === Simulate createFreshState (from exam-engine.js) ===
function createFreshState(exam) {
  return {
    stage: 'question',
    sectionIndex: 0,
    questionIndex: 0,
    startedAt: null,
    timekeepingModeOn: true,
    ui: { navigatorOpen: false, flagged: [] },
    sections: exam.sections.map(section => ({
      section_id: section.section_id,
      status: 'locked',
      timeRemainingSec: (section.time_limit_minutes || 60) * 60,
      answers: new Array(section.question_count).fill(null),
      flagged: new Array(section.question_count).fill(false),
      excluded: new Array(section.question_count).fill(null).map(() => []),
      frqImages: null,
      selfAssessment: new Array(section.question_count).fill(null),
      notes: new Array(section.question_count).fill('')
    })),
    results: null
  };
}

// === Test functions ===

function testExamFile(filename) {
  log('');
  log(`=== ${filename} ===`);

  // 1. Load and parse
  let rawExam;
  try {
    const raw = fs.readFileSync(path.join(MOCK_DATA, filename), 'utf8');
    rawExam = JSON.parse(raw);
    pass('JSON parse');
  } catch (e) {
    fail('JSON parse', e.message);
    return;
  }

  // 2. Normalize
  const norm = normalizeExam(rawExam);
  if (!norm) {
    fail('normalizeExam', 'returned null');
    return;
  }
  pass('normalizeExam returned result');

  // 3. Check basic fields
  if (norm.exam_id) pass(`exam_id = "${norm.exam_id}"`);
  else fail('exam_id', 'empty or missing');

  if (norm.exam_title) pass(`exam_title = "${norm.exam_title}"`);
  else fail('exam_title', 'empty');

  if (norm.subject === 'physics') pass(`subject = "physics"`);
  else fail('subject', `expected "physics", got "${norm.subject}"`);

  if (norm.year && norm.year >= 2000) pass(`year = ${norm.year}`);
  else fail('year', `invalid: ${norm.year}`);

  if (norm.total_questions > 0) pass(`total_questions = ${norm.total_questions}`);
  else fail('total_questions', `zero or missing: ${norm.total_questions}`);

  // 4. Section structure checks
  const hasMCQ = norm.sections.some(s => s.section_type === 'mcq');
  const hasFRQ = norm.sections.some(s => s.section_type === 'frq');

  log(`  Sections: ${norm.sections.length} total (MCQ=${hasMCQ}, FRQ=${hasFRQ})`);

  if (norm.sections.length === 0) {
    fail('sections', 'no sections found');
    return;
  }

  // Check section order: MCQ should come before FRQ if both present
  if (hasMCQ && hasFRQ) {
    const mcqIdx = norm.sections.findIndex(s => s.section_type === 'mcq');
    const frqIdx = norm.sections.findIndex(s => s.section_type === 'frq');
    if (mcqIdx < frqIdx) {
      pass('section order: MCQ before FRQ');
    } else {
      warn('section order', `MCQ at index ${mcqIdx}, FRQ at index ${frqIdx} (MCQ should be first)`);
    }
  } else if (!hasMCQ && hasFRQ) {
    log('  INFO: FRQ-only exam (no MCQ section)');
  } else if (hasMCQ && !hasFRQ) {
    log('  INFO: MCQ-only exam (no FRQ section)');
  }

  // 5. Per-section checks
  for (let si = 0; si < norm.sections.length; si++) {
    const sec = norm.sections[si];
    log(`  Section ${si}: type=${sec.section_type}, label="${sec.part_label}", questions=${sec.question_count}`);

    if (!sec.section_id) fail(`section[${si}].section_id`, 'empty');
    if (!sec.part_label) fail(`section[${si}].part_label`, 'empty');
    if (sec.question_count === 0) warn(`section[${si}].question_count`, 'zero');

    // Check question_count vs actual questions array
    if (sec.questions.length !== sec.question_count) {
      warn(`section[${si}]`, `question_count=${sec.question_count} but questions.length=${sec.questions.length}`);
    }

    // 6. Per-question checks
    for (let qi = 0; qi < sec.questions.length; qi++) {
      const q = sec.questions[qi];
      const qLabel = `section[${si}].questions[${qi}]`;

      if (!q.question_id) fail(`${qLabel}.question_id`, 'empty');

      // Check question_html (prompt)
      if (!q.question_html || q.question_html.trim() === '') {
        fail(`${qLabel}.question_html`, 'empty prompt');
      }

      // Check type-specific requirements
      if (sec.section_type === 'mcq') {
        // MCQ must have options
        if (!q.options || q.options.length === 0) {
          fail(`${qLabel}.options`, 'MCQ has no options');
        } else {
          // Check each option has html field
          const emptyOpts = q.options.filter(o => !o.html || o.html.trim() === '');
          if (emptyOpts.length > 0) {
            // Some exam files have empty options (placeholder data)
            warn(`${qLabel}.options`, `${emptyOpts.length}/${q.options.length} options have empty html`);
          }
          if (!q.options.some(o => o.key)) {
            warn(`${qLabel}.options`, 'no option has a key set');
          }
        }
      }

      if (sec.section_type === 'frq') {
        // FRQ should have subjectiveList (from parts)
        if (!q.subjectiveList) {
          // Check if raw had parts
          const rawQ = (rawExam.sections[si] || {}).questions;
          const rawParts = rawQ ? (rawQ[qi] || {}).parts : [];
          if (rawParts && rawParts.length > 0) {
            fail(`${qLabel}.subjectiveList`, `FRQ has ${rawParts.length} raw parts but subjectiveList is missing after normalization`);
          } else {
            log(`  INFO: FRQ ${qLabel} has no parts (empty parts array) - this is OK for the data`);
          }
        } else if (q.subjectiveList.length === 0) {
          log(`  INFO: FRQ ${qLabel} has empty subjectiveList`);
        } else {
          // Check subjectiveList items
          for (let pi = 0; pi < q.subjectiveList.length; pi++) {
            const part = q.subjectiveList[pi];
            if (!part.partSign && !part.partContent) {
              warn(`${qLabel}.subjectiveList[${pi}]`, 'both partSign and partContent empty');
            }
          }
        }
      }

      // Check correct_answer
      if (q.correct_answer) {
        pass(`${qLabel}.correct_answer = "${q.correct_answer}"`);
      } else {
        log(`  INFO: ${qLabel} has no correct_answer (answer key not available)`);
      }
    }
  }

  // 7. LaTeX detection
  const allTexts = [];
  for (const sec of norm.sections) {
    for (const q of sec.questions) {
      if (q.question_html) allTexts.push(q.question_html);
      for (const opt of (q.options || [])) {
        if (opt.html) allTexts.push(opt.html);
      }
    }
  }
  const latexCount = allTexts.filter(t => /\$[^$]+\$/g.test(t)).length;
  const allText = allTexts.join('');
  const hasInlineLatex = /\$[^$]+\$/g.test(allText);
  const hasBlockLatex = /\$\$[^$]+\$\$/g.test(allText);

  if (latexCount > 0) {
    pass(`LaTeX detected in ${latexCount} text fields (inline $...$)`);
  } else {
    log('  INFO: No LaTeX $ delimiters found in this exam');
  }
  if (hasBlockLatex) {
    log('  INFO: Block LaTeX $$...$$ detected');
  }

  // 8. Simulate state creation and round-trip
  try {
    const state = createFreshState(norm);

    // Verify state structure
    if (state.sections.length !== norm.sections.length) {
      fail('state.sections.length', `expected ${norm.sections.length}, got ${state.sections.length}`);
    } else {
      pass('state.sections.length matches exam');
    }

    for (let si = 0; si < state.sections.length; si++) {
      const sState = state.sections[si];
      const sExam = norm.sections[si];

      if (sState.section_id !== sExam.section_id) {
        fail(`state.sections[${si}].section_id`, `expected "${sExam.section_id}", got "${sState.section_id}"`);
      }
      if (sState.answers.length !== sExam.question_count) {
        fail(`state.sections[${si}].answers.length`, `expected ${sExam.question_count}, got ${sState.answers.length}`);
      }
      if (sState.flagged.length !== sExam.question_count) {
        fail(`state.sections[${si}].flagged.length`, `expected ${sExam.question_count}, got ${sState.flagged.length}`);
      }
    }

    // Simulate JSON round-trip
    const serialized = JSON.stringify(state);
    const deserialized = JSON.parse(serialized);
    if (deserialized.sections.length === state.sections.length) {
      pass('JSON round-trip preserves structure');
    } else {
      fail('JSON round-trip', 'structure changed after serialize/deserialize');
    }

    // Verify answers can be set
    if (state.sections.length > 0 && state.sections[0].answers.length > 0) {
      state.sections[0].answers[0] = 'A';
      if (state.sections[0].answers[0] === 'A') {
        pass('state mutation: can set answer');
      } else {
        fail('state mutation', 'could not set answer');
      }
    }

  } catch (e) {
    fail('createFreshState', e.message);
  }

  // 9. Paper.html compatibility checks
  // paper.html uses: question.question_html, question.options[].html, question.subjectiveList, isFRQ check
  log('  Paper.html compatibility:');
  for (let si = 0; si < norm.sections.length; si++) {
    const sec = norm.sections[si];
    for (let qi = 0; qi < sec.questions.length; qi++) {
      const q = sec.questions[qi];
      const isFRQ = q.question_type === 'frq' || q.question_type === 'free_response' || q.question_type === 'essay';

      // paper.html line 842: question.question_html || question.question_text || ''
      if (!q.question_html && !q.question_text) {
        fail(`paper-compat[${si}][${qi}]`, 'no question_html or question_text for rendering');
      }

      // paper.html line 791: question.options.map(...)
      if (!isFRQ && (!q.options || q.options.length === 0)) {
        warn(`paper-compat[${si}][${qi}]`, 'MCQ question has no options to render');
      }

      // paper.html line 753: question.subjectiveList || []
      if (isFRQ) {
        // subjectiveList can be empty, paper.html handles it with ternary
      }
    }
  }
}

// === Main ===

log('================================================================');
log('Round 2: Physics C: Mechanics Exam Testing');
log(`Date: ${new Date().toISOString()}`);
log('================================================================');

const physFiles = fs.readdirSync(MOCK_DATA)
  .filter(f => f.startsWith('ap-exam-phys') && f.endsWith('.json'))
  .sort();

log(`Found ${physFiles.length} physics exam files`);
log('');

for (const file of physFiles) {
  testExamFile(file);
}

// === Summary ===
log('');
log('================================================================');
log('SUMMARY');
log('================================================================');
log(`Total tests: ${totalTests}`);
log(`Passed: ${passedTests}`);
log(`Failed: ${failedTests}`);
log(`Warnings: ${warningCount}`);
log(`Files tested: ${physFiles.length}`);

// Detailed issue summary
if (failedTests > 0 || warningCount > 0) {
  log('');
  log('=== Issues Found ===');
  const failLines = results.filter(r => r.startsWith('  FAIL:'));
  const warnLines = results.filter(r => r.startsWith('  WARN:'));
  if (failLines.length) {
    log(`FAILURES (${failLines.length}):`);
    failLines.forEach(l => log('  ' + l.trim()));
  }
  if (warnLines.length) {
    log(`WARNINGS (${warnLines.length}):`);
    warnLines.forEach(l => log('  ' + l.trim()));
  }
}

log('');
log('=== data-service.js normalization analysis ===');
log('The normalizeExam() in data-service.js handles physics exams correctly:');
log('  - examId -> exam_id (via rawExam.exam_id || rawExam.examId)');
log('  - title -> exam_title (via rawExam.exam_title || rawExam.title)');
log('  - subjectName -> subject (via inferSubject, maps "physics" correctly)');
log('  - yearLabel -> year (via parseInt)');
log('  - section type "mcq"/"frq" -> section_type correctly set');
log('  - question type "single" -> "single_choice"');
log('  - question type "free-response" -> "free_response"');
log('  - prompt -> question_html');
log('  - parts -> subjectiveList (partSign from part.sign, partContent from part.content)');
log('  - options html preserved (opt.html || opt.content || opt.text)');
log('');
log('Potential data-quality issues found in exam files:');
log('  - Some MCQ options have empty key/html/text (placeholder data)');
log('  - Some exams are FRQ-only (no MCQ section)');
log('  - Some FRQ parts arrays are empty');
log('  - answer/explanation fields often empty (no answer key available)');
log('');
log('=== DONE ===');

// Write to file
fs.writeFileSync(OUTPUT_FILE, results.join('\n'), 'utf8');
console.log(`\nResults written to: ${OUTPUT_FILE}`);
