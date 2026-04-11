#!/usr/bin/env node
/**
 * AP Exam Test - Round 3
 * Tests E&M exams + all other subjects (Macro, Micro, Psych, Stats, CSA)
 * Also tests the 1902622* broken files handling
 */
const fs = require('fs');
const path = require('path');

const MOCK_DATA = path.resolve(__dirname, '..', 'mock-data');
const OUTPUT_FILE = path.resolve(__dirname, 'test-round3-results.txt');
const FINAL_SUMMARY_FILE = path.resolve(__dirname, 'test-final-summary.txt');

// ============ INLINE NORMALIZE FUNCTIONS ============

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
  if (name.includes('statistics') || name.includes('统计')) return 'statistics';
  if (name.includes('psychology') || name.includes('心理')) return 'psychology';
  if (name.includes('macro')) return 'economics_macro';
  if (name.includes('micro')) return 'economics_micro';
  if (name.includes('electricity') || name.includes('electromagnetism') || name.includes('电磁')) return 'physics_em';
  return 'unknown';
}

function normalizeSection(section, index, examId) {
  let sectionType = 'mcq';
  if (section.type === 'frq' || section.section_type === 'frq' || section.type === 'free-response') {
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

// ============ VALIDATION ============

function validateExam(examId, rawData, normalized) {
  const result = {
    exam_id: examId,
    status: 'fully_working',
    total_questions: 0,
    valid_questions: 0,
    broken_questions: 0,
    broken_reasons: [],
    sections_info: [],
    warnings: []
  };

  // Check if data parsed at all
  if (!rawData) {
    result.status = 'broken';
    result.broken_reasons.push('Could not parse JSON');
    return result;
  }

  if (!normalized) {
    result.status = 'broken';
    result.broken_reasons.push('Normalization failed');
    return result;
  }

  // Check required top-level fields
  if (!normalized.exam_id) result.warnings.push('Missing exam_id');
  if (!normalized.exam_title) result.warnings.push('Missing exam_title');

  // Check sections
  if (!normalized.sections || normalized.sections.length === 0) {
    result.status = 'broken';
    result.broken_reasons.push('No sections found');
    return result;
  }

  for (const section of normalized.sections) {
    const secInfo = {
      section_id: section.section_id,
      section_type: section.section_type,
      question_count: section.questions.length,
      valid: 0,
      broken: 0
    };

    for (const q of section.questions) {
      result.total_questions++;
      const qIssues = [];

      // Check prompt
      if (!q.question_html || !q.question_html.trim()) {
        qIssues.push('empty prompt');
      }

      // Check options for MCQ (not FRQ)
      if (section.section_type === 'mcq' || section.section_type !== 'frq') {
        if (!q.options || q.options.length < 2) {
          qIssues.push(`only ${q.options ? q.options.length : 0} options`);
        }
      }

      // Check FRQ subjectiveList
      if (section.section_type === 'frq') {
        if (!q.subjectiveList || q.subjectiveList.length === 0) {
          // FRQ without scoring points is a warning, not broken
          result.warnings.push(`Question ${q.question_id}: FRQ without scoring points`);
        }
      }

      if (qIssues.length > 0) {
        result.broken_questions++;
        secInfo.broken++;
        result.broken_reasons.push(`Q${q.question_id}: ${qIssues.join(', ')}`);
      } else {
        result.valid_questions++;
        secInfo.valid++;
      }
    }

    result.sections_info.push(secInfo);
  }

  // Determine status
  if (result.broken_questions === 0) {
    result.status = 'fully_working';
  } else if (result.valid_questions > 0) {
    result.status = 'partially_working';
  } else {
    result.status = 'broken';
  }

  return result;
}

function validateFRQPrompts(normalized) {
  const issues = [];
  for (const section of normalized.sections) {
    if (section.section_type === 'frq') {
      for (const q of section.questions) {
        if (!q.question_html || !q.question_html.trim()) {
          issues.push(`FRQ Q${q.question_id}: empty prompt`);
        }
      }
    }
  }
  return issues;
}

// ============ MAIN ============

function main() {
  const lines = [];
  const log = (msg) => {
    lines.push(msg);
    console.log(msg);
  };

  log('='.repeat(70));
  log('AP EXAM TEST - ROUND 3');
  log('Testing E&M + Other Subjects + 1902622* broken file handling');
  log('='.repeat(70));
  log('');

  // Define all exams to test
  const emFiles = [];
  const otherFiles = {
    macro: ['1902622425591156736', '1902622426509709312', '1902622426048335872', '1902622426966888448'],
    micro: ['1902622410416164864', '1902622410881732608'],
    psych: ['1902622414081986560', '1902622414539165696', '1902622417764585472', '1902622418221764608'],
    stats: ['1902622413180211200', '1902622413633196032', '1902622416850227200', '1902622417307406336'],
    csa: ['1902622412253270016', '1902622412714643456', '1902622419140317184', '1902622420520243200']
  };

  // Find all E&M files
  const allFiles = fs.readdirSync(MOCK_DATA);
  for (const f of allFiles) {
    if (f.startsWith('ap-exam-em') && f.endsWith('.json')) {
      emFiles.push(f.replace('ap-exam-', '').replace('.json', ''));
    }
  }
  emFiles.sort();

  log(`Found ${emFiles.length} E&M exam files`);
  log(`Found ${otherFiles.macro.length} Macro, ${otherFiles.micro.length} Micro, ${otherFiles.psych.length} Psych, ${otherFiles.stats.length} Stats, ${otherFiles.csa.length} CSA files`);
  log('');

  // Collect all 1902622* file IDs
  const all1902622 = new Set();
  for (const ids of Object.values(otherFiles)) {
    for (const id of ids) all1902622.add(id);
  }

  // Track results for final summary
  const allResults = [];
  const emResults = [];
  const brokenFileResults = [];

  // ============ TEST E&M EXAMS ============
  log('-'.repeat(70));
  log('SECTION 1: Physics C: E&M Exams');
  log('-'.repeat(70));
  log('');

  for (const examId of emFiles) {
    const filePath = path.join(MOCK_DATA, `ap-exam-${examId}.json`);
    log(`Testing: ${examId}`);

    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const normalized = normalizeExam(raw);
      const validation = validateExam(examId, raw, normalized);

      log(`  Subject: ${normalized.subject_display || normalized.subject}`);
      log(`  Title: ${normalized.exam_title}`);
      log(`  Sections: ${normalized.sections.length}`);
      log(`  Status: ${validation.status}`);
      log(`  Questions: ${validation.total_questions} total, ${validation.valid_questions} valid, ${validation.broken_questions} broken`);

      // Check FRQ prompts specifically
      if (normalized) {
        const frqIssues = validateFRQPrompts(normalized);
        if (frqIssues.length > 0) {
          log(`  FRQ Issues: ${frqIssues.length}`);
          for (const issue of frqIssues) {
            log(`    - ${issue}`);
          }
          validation.broken_reasons.push(...frqIssues);
        }
      }

      if (validation.broken_reasons.length > 0 && validation.broken_reasons.length <= 5) {
        for (const reason of validation.broken_reasons) {
          log(`  Issue: ${reason}`);
        }
      } else if (validation.broken_reasons.length > 5) {
        for (const reason of validation.broken_reasons.slice(0, 5)) {
          log(`  Issue: ${reason}`);
        }
        log(`  ... and ${validation.broken_reasons.length - 5} more issues`);
      }

      log('');
      allResults.push(validation);
      emResults.push(validation);
    } catch (e) {
      log(`  ERROR: ${e.message}`);
      log('');
      const errResult = { exam_id: examId, status: 'broken', total_questions: 0, valid_questions: 0, broken_questions: 0, broken_reasons: [e.message] };
      allResults.push(errResult);
      emResults.push(errResult);
    }
  }

  // ============ TEST OTHER SUBJECTS ============
  log('-'.repeat(70));
  log('SECTION 2: Other Subjects (Macro, Micro, Psych, Stats, CSA)');
  log('-'.repeat(70));
  log('');

  for (const [subject, examIds] of Object.entries(otherFiles)) {
    log(`--- ${subject.toUpperCase()} ---`);
    for (const examId of examIds) {
      const filePath = path.join(MOCK_DATA, `ap-exam-${examId}.json`);
      log(`Testing: ${examId}`);

      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const normalized = normalizeExam(raw);
        const validation = validateExam(examId, raw, normalized);

        log(`  Subject: ${normalized.subject_display || normalized.subject}`);
        log(`  Title: ${normalized.exam_title}`);
        log(`  Sections: ${normalized.sections.length}`);
        log(`  Status: ${validation.status}`);
        log(`  Questions: ${validation.total_questions} total, ${validation.valid_questions} valid, ${validation.broken_questions} broken`);

        // Count renderable questions for 1902622* files
        let renderable = 0;
        for (const sec of normalized.sections) {
          for (const q of sec.questions) {
            if (q.question_html && q.question_html.trim() && q.options && q.options.length >= 2) {
              renderable++;
            }
          }
        }
        if (validation.broken_questions > 0) {
          log(`  Renderable: ${renderable}/${validation.total_questions}`);
        }

        if (validation.broken_reasons.length > 0 && validation.broken_reasons.length <= 3) {
          for (const reason of validation.broken_reasons) {
            log(`  Issue: ${reason}`);
          }
        } else if (validation.broken_reasons.length > 3) {
          for (const reason of validation.broken_reasons.slice(0, 3)) {
            log(`  Issue: ${reason}`);
          }
          log(`  ... and ${validation.broken_reasons.length - 3} more issues`);
        }

        log('');
        allResults.push(validation);
        brokenFileResults.push(validation);
      } catch (e) {
        log(`  ERROR: ${e.message}`);
        log('');
        const errResult = { exam_id: examId, status: 'broken', total_questions: 0, valid_questions: 0, broken_questions: 0, broken_reasons: [e.message] };
        allResults.push(errResult);
        brokenFileResults.push(errResult);
      }
    }
  }

  // ============ SECTION 3: 1902622* BROKEN FILE HANDLING TEST ============
  log('-'.repeat(70));
  log('SECTION 3: Broken File Handling Verification');
  log('-'.repeat(70));
  log('');
  log('Testing normalizeQuestion() with edge cases:');
  log('');

  // Test case 1: Empty prompt
  const emptyPromptQ = { id: 'test1', type: 'single', prompt: '', options: [{ key: 'A', content: 'opt1' }, { key: 'B', content: 'opt2' }] };
  const normEmpty = normalizeQuestion(emptyPromptQ, 0, 'test', 'sec1');
  log(`  Empty prompt: question_html="${normEmpty.question_html}" => ${normEmpty.question_html ? 'HAS CONTENT' : 'EMPTY (should be skipped)'}`);

  // Test case 2: No options
  const noOptsQ = { id: 'test2', type: 'single', prompt: 'Some question', options: [] };
  const normNoOpts = normalizeQuestion(noOptsQ, 0, 'test', 'sec1');
  log(`  No options: options.length=${normNoOpts.options.length} => ${normNoOpts.options.length < 2 ? 'INSUFFICIENT (should show placeholder)' : 'OK'}`);

  // Test case 3: One option only
  const oneOptQ = { id: 'test3', type: 'single', prompt: 'Another question', options: [{ key: 'A', content: 'only option' }] };
  const normOneOpt = normalizeQuestion(oneOptQ, 0, 'test', 'sec1');
  log(`  One option: options.length=${normOneOpt.options.length} => ${normOneOpt.options.length < 2 ? 'INSUFFICIENT (should show placeholder)' : 'OK'}`);

  // Test case 4: Null prompt
  const nullPromptQ = { id: 'test4', type: 'single', prompt: null, options: [{ key: 'A', content: 'a' }, { key: 'B', content: 'b' }] };
  const normNull = normalizeQuestion(nullPromptQ, 0, 'test', 'sec1');
  log(`  Null prompt: question_html="${normNull.question_html}" => ${normNull.question_html ? 'HAS CONTENT' : 'EMPTY (should be skipped)'}`);

  // Test case 5: Missing options key entirely
  const noKeyQ = { id: 'test5', type: 'single', prompt: 'Question without options key' };
  const normNoKey = normalizeQuestion(noKeyQ, 0, 'test', 'sec1');
  log(`  Missing options key: options.length=${normNoKey.options.length} => ${normNoKey.options.length < 2 ? 'INSUFFICIENT' : 'OK'}`);

  log('');

  // ============ SUMMARY ============
  log('='.repeat(70));
  log('ROUND 3 SUMMARY');
  log('='.repeat(70));
  log('');

  const fullyWorking = allResults.filter(r => r.status === 'fully_working');
  const partiallyWorking = allResults.filter(r => r.status === 'partially_working');
  const broken = allResults.filter(r => r.status === 'broken');

  log(`Total exams tested: ${allResults.length}`);
  log(`  Fully working: ${fullyWorking.length}`);
  log(`  Partially working: ${partiallyWorking.length}`);
  log(`  Broken: ${broken.length}`);
  log('');

  // E&M sub-summary
  const emFull = emResults.filter(r => r.status === 'fully_working');
  const emPartial = emResults.filter(r => r.status === 'partially_working');
  const emBroken = emResults.filter(r => r.status === 'broken');
  log(`E&M Results: ${emFull.length} full, ${emPartial.length} partial, ${emBroken.length} broken`);

  // 1902622* sub-summary
  const brokenFull = brokenFileResults.filter(r => r.status === 'fully_working');
  const brokenPartial = brokenFileResults.filter(r => r.status === 'partially_working');
  const brokenBroken = brokenFileResults.filter(r => r.status === 'broken');
  log(`1902622* Results: ${brokenFull.length} full, ${brokenPartial.length} partial, ${brokenBroken.length} broken`);

  // Write results file
  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8');
  log('');
  log(`Results written to: ${OUTPUT_FILE}`);

  // ============ FINAL SUMMARY (all 104 exams) ============
  // We need to also count previous rounds' results
  // Load any existing summary to combine, or build from scratch
  const finalLines = [];
  const flog = (msg) => finalLines.push(msg);

  flog('='.repeat(70));
  flog('FINAL SUMMARY - ALL 104 AP EXAMS');
  flog('Generated: ' + new Date().toISOString());
  flog('='.repeat(70));
  flog('');

  // Count all exam files
  const allExamFiles = allFiles.filter(f => f.startsWith('ap-exam-') && f.endsWith('.json') && f !== 'ap-schedule.json');
  flog(`Total exam JSON files in mock-data: ${allExamFiles.length}`);
  flog('');

  // Now test ALL files for the complete summary
  const allExamResults = [];
  const subjects = {};

  for (const fileName of allExamFiles.sort()) {
    const examId = fileName.replace('ap-exam-', '').replace('.json', '');
    const filePath = path.join(MOCK_DATA, fileName);

    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const normalized = normalizeExam(raw);
      const validation = validateExam(examId, raw, normalized);

      const subj = normalized.subject || 'unknown';
      if (!subjects[subj]) subjects[subj] = { total: 0, full: 0, partial: 0, broken: 0 };
      subjects[subj].total++;
      if (validation.status === 'fully_working') subjects[subj].full++;
      else if (validation.status === 'partially_working') subjects[subj].partial++;
      else subjects[subj].broken++;

      allExamResults.push(validation);
    } catch (e) {
      allExamResults.push({
        exam_id: examId,
        status: 'broken',
        total_questions: 0,
        valid_questions: 0,
        broken_questions: 0,
        broken_reasons: ['JSON parse error: ' + e.message]
      });
      if (!subjects['unknown']) subjects['unknown'] = { total: 0, full: 0, partial: 0, broken: 0 };
      subjects['unknown'].total++;
      subjects['unknown'].broken++;
    }
  }

  const allFull = allExamResults.filter(r => r.status === 'fully_working');
  const allPartial = allExamResults.filter(r => r.status === 'partially_working');
  const allBroken = allExamResults.filter(r => r.status === 'broken');

  flog('OVERALL RESULTS:');
  flog(`  Total exams: ${allExamResults.length}`);
  flog(`  Fully working: ${allFull.length}`);
  flog(`  Partially working (some questions broken): ${allPartial.length}`);
  flog(`  Broken: ${allBroken.length}`);
  flog('');

  flog('BY SUBJECT:');
  flog(`  ${'Subject'.padEnd(25)} Total  Full  Partial  Broken`);
  flog(`  ${'-'.repeat(55)}`);
  for (const [subj, counts] of Object.entries(subjects).sort()) {
    flog(`  ${subj.padEnd(25)} ${String(counts.total).padStart(5)}  ${String(counts.full).padStart(4)}  ${String(counts.partial).padStart(7)}  ${String(counts.broken).padStart(6)}`);
  }
  flog('');

  // List fully working exams
  flog('FULLY WORKING EXAM IDs:');
  flog('-'.repeat(50));
  for (const r of allFull.sort((a, b) => a.exam_id.localeCompare(b.exam_id))) {
    flog(`  ${r.exam_id}`);
  }
  flog('');

  // List partially working exams with details
  if (allPartial.length > 0) {
    flog('PARTIALLY WORKING EXAM IDs (with issue count):');
    flog('-'.repeat(50));
    for (const r of allPartial.sort((a, b) => a.exam_id.localeCompare(b.exam_id))) {
      flog(`  ${r.exam_id}: ${r.valid_questions}/${r.total_questions} valid, ${r.broken_questions} broken`);
    }
    flog('');
  }

  // List broken exams
  if (allBroken.length > 0) {
    flog('BROKEN EXAM IDs:');
    flog('-'.repeat(50));
    for (const r of allBroken.sort((a, b) => a.exam_id.localeCompare(b.exam_id))) {
      flog(`  ${r.exam_id}: ${r.broken_reasons.join('; ')}`);
    }
    flog('');
  }

  flog('='.repeat(70));
  flog('END OF FINAL SUMMARY');
  flog('='.repeat(70));

  fs.writeFileSync(FINAL_SUMMARY_FILE, finalLines.join('\n'), 'utf-8');
  log(`Final summary written to: ${FINAL_SUMMARY_FILE}`);
  log('');
  log('Done.');
}

main();
