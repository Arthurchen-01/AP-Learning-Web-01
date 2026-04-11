/**
 * Round 1 Test: Test all Calculus BC exam files through the data pipeline.
 * Verifies normalization, state management, and rendering compatibility.
 * 
 * Run: node scripts/test-exam-round1.js
 * Output: scripts/test-round1-results.txt
 */

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const MOCK_DATA = path.join(BASE, 'mock-data');
const OUTPUT_FILE = path.join(__dirname, 'test-round1-results.txt');

const lines = [];
function log(msg) {
  lines.push(msg);
  console.log(msg);
}

// ============================================================
// Inline normalizeExam logic (copied from data-service.js)
// ============================================================

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
    normalized.total_questions = normalized.sections.reduce(
      (sum, sec) => sum + (sec.question_count || 0), 0
    );
  }

  return normalized;
}

// ============================================================
// Inline createFreshState logic (from exam-engine.js)
// ============================================================

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

// ============================================================
// Test helpers
// ============================================================

function checkArrayUnique(arr) {
  return new Set(arr).size === arr.length;
}

// ============================================================
// Main test
// ============================================================

function main() {
  log('============================================================');
  log('ROUND 1 TEST: Calculus BC Exam Files - Data Pipeline');
  log('Date: ' + new Date().toISOString());
  log('============================================================');
  log('');

  // Find all ap-exam-20*.json files (NOT 1902622* files)
  const allFiles = fs.readdirSync(MOCK_DATA)
    .filter(f => /^ap-exam-20\d.*\.json$/.test(f))
    .sort();

  log(`Found ${allFiles.length} exam files to test:`);
  allFiles.forEach(f => log('  - ' + f));
  log('');

  const results = {
    total: allFiles.length,
    passed: 0,
    failed: 0,
    warnings: 0,
    files: {}
  };

  // Track rendering compatibility
  const renderChecks = {
    latexQuestions: 0,
    imageQuestions: 0,
    tableQuestions: 0,
    frqSections: 0,
    mcqSections: 0,
    emptySections: 0,
    optionStructureVariants: new Set()
  };

  for (const filename of allFiles) {
    const filePath = path.join(MOCK_DATA, filename);
    const fileErrors = [];
    const fileWarnings = [];

    log(`--- Testing: ${filename} ---`);

    try {
      // Step 1: Read and parse JSON
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      log(`  Parsed OK. Raw examId: ${raw.examId || raw.exam_id || 'MISSING'}`);

      // Step 2: Normalize
      let exam;
      try {
        exam = normalizeExam(raw);
      } catch (e) {
        fileErrors.push(`normalizeExam() threw: ${e.message}`);
        log(`  FAIL: normalizeExam() threw: ${e.message}`);
        results.failed++;
        results.files[filename] = { status: 'FAIL', errors: fileErrors, warnings: fileWarnings };
        continue;
      }

      if (!exam) {
        fileErrors.push('normalizeExam() returned null');
        log('  FAIL: normalizeExam() returned null');
        results.failed++;
        results.files[filename] = { status: 'FAIL', errors: fileErrors, warnings: fileWarnings };
        continue;
      }

      // Step 3: Check exam-level fields
      if (!exam.exam_id) fileErrors.push('Missing exam_id');
      if (!exam.exam_title) fileErrors.push('Missing exam_title');
      if (!exam.subject) fileErrors.push('Missing subject');
      if (exam.total_questions === 0) fileWarnings.push('total_questions is 0');

      log(`  exam_id: ${exam.exam_id}, subject: ${exam.subject}, total_questions: ${exam.total_questions}`);

      // Step 4: Check each section
      if (!exam.sections || exam.sections.length === 0) {
        fileErrors.push('No sections found');
      } else {
        for (let si = 0; si < exam.sections.length; si++) {
          const sec = exam.sections[si];

          // Required section fields
          if (!sec.section_id) fileErrors.push(`Section ${si}: missing section_id`);
          if (!sec.section_type) fileErrors.push(`Section ${si}: missing section_type`);
          if (!sec.part_label) fileErrors.push(`Section ${si}: missing part_label`);
          if (typeof sec.time_limit_minutes !== 'number' || sec.time_limit_minutes <= 0) {
            fileWarnings.push(`Section ${si}: time_limit_minutes=${sec.time_limit_minutes}`);
          }

          if (sec.section_type === 'frq') renderChecks.frqSections++;
          if (sec.section_type === 'mcq') renderChecks.mcqSections++;

          if (sec.question_count === 0) {
            renderChecks.emptySections++;
            fileWarnings.push(`Section ${si} (${sec.section_id}): empty (0 questions)`);
          }

          // Step 5: Check each question
          if (!sec.questions || sec.questions.length === 0) {
            fileWarnings.push(`Section ${si}: no questions array or empty`);
          } else {
            const questionIds = [];
            for (let qi = 0; qi < sec.questions.length; qi++) {
              const q = sec.questions[qi];

              // Required question fields
              if (!q.question_id) fileErrors.push(`S${si} Q${qi}: missing question_id`);
              if (!q.question_html) fileWarnings.push(`S${si} Q${qi}: empty question_html`);

              questionIds.push(q.question_id);

              // Check for rendering content types
              const html = q.question_html || '';
              if (/\$[^$]+\$/.test(html)) renderChecks.latexQuestions++;
              if (/<img\b/i.test(html)) renderChecks.imageQuestions++;
              if (/<table\b/i.test(html) || /\\begin\{tabular\}/i.test(html)) renderChecks.tableQuestions++;

              // MCQ-specific checks
              if (q.question_type === 'single_choice') {
                if (!q.options || q.options.length < 2) {
                  fileErrors.push(`S${si} Q${qi} (${q.question_id}): MCQ has < 2 options (has ${q.options ? q.options.length : 'none'})`);
                } else {
                  // Check option keys are unique
                  const keys = q.options.map(o => o.key);
                  if (!checkArrayUnique(keys)) {
                    fileErrors.push(`S${si} Q${qi}: duplicate option keys: ${keys.join(',')}`);
                  }
                  // Check options have html
                  for (const opt of q.options) {
                    if (!opt.html && opt.html !== '') {
                      fileWarnings.push(`S${si} Q${qi} opt ${opt.key}: missing html`);
                    }
                  }
                  // Track option structure variants
                  const optTypes = q.options.map(o => typeof o.html);
                  renderChecks.optionStructureVariants.add(optTypes.join(','));
                }
              }

              // FRQ-specific checks
              if (q.question_type === 'free_response') {
                // FRQ may have subjectiveList parts
                if (q.subjectiveList && q.subjectiveList.length > 0) {
                  // ok
                }
              }
            }

            // Check unique question IDs within section
            if (!checkArrayUnique(questionIds)) {
              fileErrors.push(`Section ${si}: duplicate question_ids detected`);
            }
          }
        }
      }

      // Step 6: Simulate createFreshState + JSON round-trip
      try {
        const state = createFreshState(exam);
        // Simulate loadState via JSON.stringify/parse
        const serialized = JSON.stringify(state);
        const deserialized = JSON.parse(serialized);

        // Verify state structure
        if (!deserialized.sections || deserialized.sections.length !== exam.sections.length) {
          fileErrors.push('State round-trip: section count mismatch');
        }
        for (let si = 0; si < exam.sections.length; si++) {
          const expectedCount = exam.sections[si].question_count;
          const stateSec = deserialized.sections[si];
          if (!stateSec) {
            fileErrors.push(`State: missing section ${si}`);
            continue;
          }
          if (stateSec.section_id !== exam.sections[si].section_id) {
            fileErrors.push(`State: section_id mismatch at ${si}`);
          }
          if (stateSec.answers.length !== expectedCount) {
            fileErrors.push(`State S${si}: answers length ${stateSec.answers.length} != question_count ${expectedCount}`);
          }
          if (stateSec.flagged.length !== expectedCount) {
            fileErrors.push(`State S${si}: flagged length mismatch`);
          }
          if (stateSec.notes.length !== expectedCount) {
            fileErrors.push(`State S${si}: notes length mismatch`);
          }
          if (!Array.isArray(stateSec.excluded)) {
            fileErrors.push(`State S${si}: excluded is not array`);
          }
          // timeRemainingSec should be > 0
          if (typeof stateSec.timeRemainingSec !== 'number' || stateSec.timeRemainingSec <= 0) {
            fileWarnings.push(`State S${si}: timeRemainingSec=${stateSec.timeRemainingSec}`);
          }
        }
      } catch (e) {
        fileErrors.push(`State simulation failed: ${e.message}`);
      }

      // Step 7: Simulate renderQuestion() compatibility check
      // Check if question_html can be safely inserted into innerHTML
      for (const sec of exam.sections) {
        for (const q of (sec.questions || [])) {
          const html = q.question_html || '';
          // Check for unclosed tags (basic check)
          const openTags = (html.match(/<[a-z]+[^>]*>/gi) || []).length;
          const closeTags = (html.match(/<\/[a-z]+>/gi) || []).length;
          const selfClose = (html.match(/<[^>]*\/>/gi) || []).length;
          // This is just a rough heuristic, only flag severe cases
          if (Math.abs(openTags - closeTags - selfClose) > 5) {
            fileWarnings.push(`Q ${q.question_id}: potentially malformed HTML (open=${openTags}, close=${closeTags})`);
          }
        }
      }

      // Report
      if (fileErrors.length > 0) {
        log(`  FAIL - ${fileErrors.length} error(s):`);
        fileErrors.forEach(e => log(`    ERROR: ${e}`));
        results.failed++;
      } else {
        if (fileWarnings.length > 0) {
          log(`  PASS (with ${fileWarnings.length} warning(s))`);
          fileWarnings.forEach(w => log(`    WARN: ${w}`));
          results.warnings += fileWarnings.length;
        } else {
          log('  PASS');
        }
        results.passed++;
      }

      results.files[filename] = {
        status: fileErrors.length > 0 ? 'FAIL' : 'PASS',
        errors: fileErrors,
        warnings: fileWarnings,
        exam_id: exam.exam_id,
        exam_title: exam.exam_title,
        section_count: exam.sections.length,
        total_questions: exam.total_questions
      };

    } catch (e) {
      log(`  FAIL - Exception: ${e.message}`);
      results.failed++;
      results.files[filename] = { status: 'FAIL', errors: [e.message], warnings: [] };
    }

    log('');
  }

  // ============================================================
  // Summary
  // ============================================================
  log('============================================================');
  log('SUMMARY');
  log('============================================================');
  log(`Total files tested: ${results.total}`);
  log(`Passed: ${results.passed}`);
  log(`Failed: ${results.failed}`);
  log(`Total warnings: ${results.warnings}`);
  log('');

  log('RENDERING COMPATIBILITY CHECKS:');
  log(`  Questions with LaTeX ($...$): ${renderChecks.latexQuestions}`);
  log(`  Questions with images (img tags): ${renderChecks.imageQuestions}`);
  log(`  Questions with tables: ${renderChecks.tableQuestions}`);
  log(`  MCQ sections: ${renderChecks.mcqSections}`);
  log(`  FRQ sections: ${renderChecks.frqSections}`);
  log(`  Empty sections: ${renderChecks.emptySections}`);
  log(`  Option structure variants: ${[...renderChecks.optionStructureVariants].join(' | ')}`);
  log('');

  if (results.failed > 0) {
    log('FAILED FILES:');
    for (const [fn, res] of Object.entries(results.files)) {
      if (res.status === 'FAIL') {
        log(`  ${fn}: ${res.errors.join('; ')}`);
      }
    }
    log('');
  }

  log('============================================================');
  log('PASS/FAIL per file:');
  log('============================================================');
  for (const [fn, res] of Object.entries(results.files)) {
    const examInfo = res.exam_id ? ` (${res.exam_id}, ${res.total_questions}q, ${res.section_count}s)` : '';
    log(`  [${res.status}] ${fn}${examInfo}`);
    if (res.errors.length > 0) {
      res.errors.forEach(e => log(`         ERROR: ${e}`));
    }
    if (res.warnings.length > 0) {
      res.warnings.slice(0, 5).forEach(w => log(`         WARN: ${w}`));
      if (res.warnings.length > 5) {
        log(`         ... and ${res.warnings.length - 5} more warnings`);
      }
    }
  }

  log('');
  log('Test complete.');

  // Write to file
  const output = lines.join('\n');
  fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
  console.log(`\nResults written to: ${OUTPUT_FILE}`);
}

main();
