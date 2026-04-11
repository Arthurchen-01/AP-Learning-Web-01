#!/usr/bin/env node
/**
 * AP Exam JSON Validation Script
 * Validates all ap-exam-*.json files in mock-data/ directory
 */

const fs = require('fs');
const path = require('path');

const MOCK_DATA_DIR = path.join(__dirname, '..', 'mock-data');

// Expected option keys in sequence
const VALID_OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Results tracking
const results = {
  totalFiles: 0,
  passed: 0,
  failed: 0,
  errors: [],
  warnings: []
};

/**
 * Validate a single exam JSON file
 */
function validateExamFile(filePath) {
  const fileName = path.basename(filePath);
  const fileErrors = [];
  const fileWarnings = [];
  
  // 1. Check if file exists
  if (!fs.existsSync(filePath)) {
    return { fileName, errors: ['File does not exist'], warnings: [], stats: {} };
  }

  // 2. Parse JSON
  let data;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(content);
  } catch (e) {
    return { fileName, errors: [`Invalid JSON: ${e.message}`], warnings: [], stats: {} };
  }

  // 3. Check required top-level fields
  const requiredFields = ['examId', 'title', 'subjectName', 'sections'];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      fileErrors.push(`Missing required field: ${field}`);
    }
  }

  // 4. Check sections array
  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    fileErrors.push('sections array is empty or not an array');
    return { fileName, errors: fileErrors, warnings: fileWarnings, stats: {} };
  }

  // Track stats
  let totalQuestions = 0;
  let sectionCount = data.sections.length;
  let mcqCount = 0;
  let frqCount = 0;

  // 5. Validate each section
  data.sections.forEach((section, sectionIndex) => {
    // Check section has title, type (or similar), and questions array
    if (!section.title && !section.partTitle) {
      fileErrors.push(`Section ${sectionIndex}: Missing title`);
    }

    if (!Array.isArray(section.questions)) {
      fileErrors.push(`Section ${sectionIndex}: Missing or invalid questions array`);
      return;
    }

    if (section.questions.length === 0) {
      fileErrors.push(`Section ${sectionIndex}: Empty questions array`);
    }

    totalQuestions += section.questions.length;

    // 6. Validate each question
    section.questions.forEach((question, questionIndex) => {
      const qId = question.id || `Q${questionIndex + 1}`;

      // Check required question fields
      if (!question.id) {
        fileWarnings.push(`Section ${sectionIndex}, Question ${questionIndex}: Missing id field`);
      }

      if (!question.type) {
        fileWarnings.push(`Section ${sectionIndex}, ${qId}: Missing type field`);
      }

      // Check prompt (allow empty for FRQ)
      const isFRQ = question.type === 'free-response' || question.type === 'frq' || question.type === 'essay';
      if (isFRQ) {
        frqCount++;
      } else {
        mcqCount++;
      }

      if (!question.prompt && !question.question_html && !question.question_text && !isFRQ) {
        fileErrors.push(`Section ${sectionIndex}, ${qId}: Empty prompt for MCQ question`);
      }

      // For MCQ questions, validate options
      if (!isFRQ) {
        if (!Array.isArray(question.options)) {
          fileErrors.push(`Section ${sectionIndex}, ${qId}: Missing options array for MCQ`);
        } else {
          if (question.options.length < 2) {
            fileWarnings.push(`Section ${sectionIndex}, ${qId}: Less than 2 options`);
          }

          // Check option structure
          const optionKeys = [];
          question.options.forEach((opt, optIndex) => {
            if (!opt.key) {
              fileErrors.push(`Section ${sectionIndex}, ${qId}, Option ${optIndex}: Missing key`);
            } else {
              optionKeys.push(opt.key);
            }

            if (!opt.content && !opt.html && !opt.text) {
              fileErrors.push(`Section ${sectionIndex}, ${qId}, Option ${opt.key || optIndex}: Missing content`);
            }
          });

          // Check option keys are sequential (A, B, C, D, E...)
          if (optionKeys.length > 0) {
            const expectedKeys = VALID_OPTION_KEYS.slice(0, optionKeys.length);
            const actualKeysSorted = [...optionKeys].sort();
            const expectedKeysSorted = [...expectedKeys].sort();
            
            // Check if keys match expected sequence
            const keysMatch = actualKeysSorted.every((key, i) => key === expectedKeysSorted[i]);
            if (!keysMatch) {
              fileWarnings.push(`Section ${sectionIndex}, ${qId}: Option keys not sequential (found: ${optionKeys.join(', ')})`);
            }
          }
        }

        // Check if answer field exists (can be empty for now)
        if (question.answer === undefined && question.correct_answer === undefined) {
          fileWarnings.push(`Section ${sectionIndex}, ${qId}: No answer field found (answer or correct_answer)`);
        }
      }
    });
  });

  return {
    fileName,
    errors: fileErrors,
    warnings: fileWarnings,
    stats: {
      subject: data.subjectName || 'Unknown',
      sectionCount,
      totalQuestions,
      mcqCount,
      frqCount
    }
  };
}

/**
 * Main validation function
 */
function main() {
  console.log('='.repeat(80));
  console.log('AP Exam JSON Validation Script');
  console.log('='.repeat(80));
  console.log(`Scanning directory: ${MOCK_DATA_DIR}`);
  console.log('');

  // Get all ap-exam-*.json files
  let files;
  try {
    files = fs.readdirSync(MOCK_DATA_DIR)
      .filter(f => f.startsWith('ap-exam-') && f.endsWith('.json'))
      .map(f => path.join(MOCK_DATA_DIR, f));
  } catch (e) {
    console.error(`Error reading directory: ${e.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('No ap-exam-*.json files found in mock-data/');
    process.exit(0);
  }

  console.log(`Found ${files.length} exam files to validate\n`);
  console.log('-'.repeat(80));

  // Validate each file
  const fileResults = [];
  for (const file of files) {
    const result = validateExamFile(file);
    fileResults.push(result);
    results.totalFiles++;

    if (result.errors.length > 0) {
      results.failed++;
      results.errors.push(...result.errors.map(e => `${result.fileName}: ${e}`));
    } else {
      results.passed++;
    }

    if (result.warnings.length > 0) {
      results.warnings.push(...result.warnings.map(w => `${result.fileName}: ${w}`));
    }

    // Print file result
    const status = result.errors.length > 0 ? '❌ FAIL' : '✅ PASS';
    console.log(`${status} ${result.fileName}`);
    if (result.stats.subject) {
      console.log(`     Subject: ${result.stats.subject}`);
      console.log(`     Sections: ${result.stats.sectionCount}, Questions: ${result.stats.totalQuestions} (MCQ: ${result.stats.mcqCount}, FRQ: ${result.stats.frqCount})`);
    }
    if (result.errors.length > 0) {
      result.errors.forEach(e => console.log(`     ERROR: ${e}`));
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach(w => console.log(`     WARN: ${w}`));
    }
    console.log('');
  }

  // Print summary
  console.log('='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total files: ${results.totalFiles}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total errors: ${results.errors.length}`);
  console.log(`Total warnings: ${results.warnings.length}`);
  console.log('');

  // Print detailed error summary if any
  if (results.errors.length > 0) {
    console.log('ERRORS:');
    console.log('-'.repeat(40));
    results.errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
    console.log('');
  }

  if (results.warnings.length > 0) {
    console.log('WARNINGS:');
    console.log('-'.repeat(40));
    results.warnings.slice(0, 50).forEach((w, i) => console.log(`${i + 1}. ${w}`));
    if (results.warnings.length > 50) {
      console.log(`... and ${results.warnings.length - 50} more warnings`);
    }
    console.log('');
  }

  // Exit with error code if any files failed
  process.exit(results.failed > 0 ? 1 : 0);
}

main();
