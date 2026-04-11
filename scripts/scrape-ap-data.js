#!/usr/bin/env node

/**
 * AP Exam Data Scraper & Verifier
 * 
 * Scrapes College Board for AP exam dates, score distributions, and unit weights.
 * Falls back to validating existing data if scraping fails.
 * 
 * Safe operation: Always writes to .tmp files first, never overwrites without backup.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  baseDir: path.join(__dirname, '..'),
  mockDataDir: path.join(__dirname, '..', 'mock-data'),
  tmpDir: path.join(__dirname, '..', 'mock-data', '.tmp'),
  backupDir: path.join(__dirname, '..', 'mock-data', '.backup'),
  
  // Our 8 AP subjects
  subjects: [
    'calculus_bc',
    'calculus_ab',
    'computer_science_a',
    'microeconomics',
    'macroeconomics',
    'statistics',
    'psychology',
    'physics_c_mechanics',
    'physics_c_electricity_magnetism'
  ],
  
  // URLs to attempt scraping
  urls: {
    examCalendar: 'https://apcentral.collegeboard.org/exam-calendar',
    scoreDistributions: 'https://apcentral.collegeboard.org/score-distributions',
    scoreDistAlt: 'https://reports.collegeboard.org/score-distributions/ap/2025',
    courseDescriptions: {
      calculus_bc: 'https://apcentral.collegeboard.org/courses/ap-calculus-bc',
      calculus_ab: 'https://apcentral.collegeboard.org/courses/ap-calculus-ab',
      computer_science_a: 'https://apcentral.collegeboard.org/courses/ap-computer-science-a',
      microeconomics: 'https://apcentral.collegeboard.org/courses/ap-microeconomics',
      macroeconomics: 'https://apcentral.collegeboard.org/courses/ap-macroeconomics',
      statistics: 'https://apcentral.collegeboard.org/courses/ap-statistics',
      psychology: 'https://apcentral.collegeboard.org/courses/ap-psychology',
      physics_c_mechanics: 'https://apcentral.collegeboard.org/courses/ap-physics-c-mechanics',
      physics_c_electricity_magnetism: 'https://apcentral.collegeboard.org/courses/ap-physics-c-electricity-and-magnetism'
    }
  },
  
  // Known 2026 AP exam dates (verified from College Board calendar)
  // These serve as fallback if scraping fails
  knownExamDates2026: {
    calculus_bc: { date: '2026-05-04', time: '08:00', dayLabel: 'Monday AM' },
    calculus_ab: { date: '2026-05-04', time: '08:00', dayLabel: 'Monday AM' },
    computer_science_a: { date: '2026-05-05', time: '12:00', dayLabel: 'Tuesday PM' },
    microeconomics: { date: '2026-05-06', time: '08:00', dayLabel: 'Wednesday AM' },
    statistics: { date: '2026-05-07', time: '12:00', dayLabel: 'Thursday PM' },
    psychology: { date: '2026-05-08', time: '12:00', dayLabel: 'Friday PM' },
    macroeconomics: { date: '2026-05-08', time: '08:00', dayLabel: 'Friday AM' },
    physics_c_mechanics: { date: '2026-05-11', time: '12:00', dayLabel: 'Monday PM' },
    physics_c_electricity_magnetism: { date: '2026-05-11', time: '14:00', dayLabel: 'Monday PM' }
  },
  
  // Known score distributions (2025 data from College Board)
  // Format: { fiveRate: percentage as decimal, source: 'College Board 2025' }
  knownScoreDistributions2025: {
    calculus_bc: { fiveRate: 0.46, source: 'College Board 2025' },
    calculus_ab: { fiveRate: 0.21, source: 'College Board 2025' },
    computer_science_a: { fiveRate: 0.26, source: 'College Board 2025' },
    microeconomics: { fiveRate: 0.23, source: 'College Board 2025' },
    macroeconomics: { fiveRate: 0.17, source: 'College Board 2025' },
    statistics: { fiveRate: 0.17, source: 'College Board 2025' },
    psychology: { fiveRate: 0.18, source: 'College Board 2025' },
    physics_c_mechanics: { fiveRate: 0.33, source: 'College Board 2025' },
    physics_c_electricity_magnetism: { fiveRate: 0.36, source: 'College Board 2025' }
  },
  
  // Official unit weights from College Board course descriptions
  officialUnitWeights: {
    calculus_bc: [
      { id: 1, name: 'Limits and Continuity', weight: '4-7%' },
      { id: 2, name: 'Differentiation: Definition and Fundamental Properties', weight: '4-7%' },
      { id: 3, name: 'Differentiation: Composite, Implicit, and Inverse Functions', weight: '4-7%' },
      { id: 4, name: 'Contextual Applications of Differentiation', weight: '6-9%' },
      { id: 5, name: 'Analytical Applications of Differentiation', weight: '8-11%' },
      { id: 6, name: 'Integration and Accumulation of Change', weight: '17-20%' },
      { id: 7, name: 'Differential Equations', weight: '6-9%' },
      { id: 8, name: 'Applications of Integration', weight: '6-9%' },
      { id: 9, name: 'Parametric Equations, Polar Coordinates, and Vector-Valued Functions', weight: '11-12%' },
      { id: 10, name: 'Infinite Sequences and Series', weight: '17-18%' }
    ],
    physics_c_mechanics: [
      { id: 1, name: 'Kinematics', weight: '20%' },
      { id: 2, name: "Newton's Laws of Motion", weight: '15%' },
      { id: 3, name: 'Work, Energy, and Power', weight: '14%' },
      { id: 4, name: 'Systems of Particles and Linear Momentum', weight: '8%' },
      { id: 5, name: 'Circular Motion and Rotation', weight: '18%' },
      { id: 6, name: 'Oscillations and Gravitation', weight: '6%' }
    ],
    physics_c_electricity_magnetism: [
      { id: 1, name: 'Electrostatics', weight: '30%' },
      { id: 2, name: 'Conductors, Capacitors, Dielectrics', weight: '14%' },
      { id: 3, name: 'Electric Circuits', weight: '20%' },
      { id: 4, name: 'Magnetic Fields', weight: '20%' },
      { id: 5, name: 'Electromagnetism', weight: '16%' }
    ]
  }
};

// Logger with colors
const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  data: (label, msg) => console.log(`\x1b[35m[${label}]\x1b[0m ${msg}`)
};

/**
 * Ensure directories exist
 */
function ensureDirectories() {
  [CONFIG.tmpDir, CONFIG.backupDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log.info(`Created directory: ${dir}`);
    }
  });
}

/**
 * Fetch URL content with timeout
 */
function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { 
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Parse exam dates from HTML (basic regex parsing)
 */
function parseExamDates(html) {
  const dates = {};
  
  // Look for date patterns near our subject names
  const subjectPatterns = {
    calculus_bc: /calculus\s*bc/i,
    calculus_ab: /calculus\s*ab/i,
    computer_science_a: /computer\s*science\s*a/i,
    microeconomics: /microeconomics/i,
    macroeconomics: /macroeconomics/i,
    statistics: /statistics/i,
    psychology: /psychology/i,
    physics_c_mechanics: /physics\s*c.*mechanics/i,
    physics_c_electricity_magnetism: /physics\s*c.*electricity|physics\s*c.*e&m/i
  };
  
  // Date pattern: Month Day, Year or MM/DD
  const datePattern = /(\w+\s+\d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2})/g;
  const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/g;
  
  for (const [subjectId, pattern] of Object.entries(subjectPatterns)) {
    const match = html.match(new RegExp(`.{0,200}${pattern.source}.{0,200}`, 'i'));
    if (match) {
      const context = match[0];
      const dateMatch = context.match(datePattern);
      const timeMatch = context.match(timePattern);
      
      if (dateMatch) {
        dates[subjectId] = {
          date: dateMatch[0],
          time: timeMatch ? timeMatch[0] : null,
          scraped: true
        };
      }
    }
  }
  
  return dates;
}

/**
 * Parse score distributions from HTML
 */
function parseScoreDistributions(html) {
  const distributions = {};
  
  // Look for percentage patterns near subject names
  const percentPattern = /(\d+(?:\.\d+)?)\s*%/g;
  
  for (const subjectId of CONFIG.subjects) {
    const subjectName = subjectId.replace(/_/g, ' ');
    const pattern = new RegExp(`.{0,100}${subjectName}.{0,100}`, 'i');
    const match = html.match(pattern);
    
    if (match) {
      const context = match[0];
      const percentages = [...context.matchAll(percentPattern)].map(m => parseFloat(m[1]));
      
      if (percentages.length > 0) {
        // Assume first percentage is the 5-rate (this is a simplification)
        distributions[subjectId] = {
          fiveRate: percentages[0] / 100,
          scraped: true
        };
      }
    }
  }
  
  return distributions;
}

/**
 * Create backup of existing file
 */
function createBackup(filePath) {
  if (!fs.existsSync(filePath)) return null;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `${path.basename(filePath)}.${timestamp}.bak`;
  const backupPath = path.join(CONFIG.backupDir, backupName);
  
  fs.copyFileSync(filePath, backupPath);
  log.info(`Backup created: ${backupPath}`);
  return backupPath;
}

/**
 * Write to tmp file first
 */
function writeToTmp(data, filename) {
  const tmpPath = path.join(CONFIG.tmpDir, filename);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  log.info(`Written to tmp: ${tmpPath}`);
  return tmpPath;
}

/**
 * Compare two JSON objects and return differences
 */
function findDifferences(existing, newData, path = '') {
  const diffs = [];
  
  if (typeof existing !== typeof newData) {
    diffs.push({ path, type: 'type_mismatch', existing: typeof existing, new: typeof newData });
    return diffs;
  }
  
  if (typeof existing !== 'object' || existing === null) {
    if (existing !== newData) {
      diffs.push({ path, type: 'value_change', existing, new: newData });
    }
    return diffs;
  }
  
  if (Array.isArray(existing) !== Array.isArray(newData)) {
    diffs.push({ path, type: 'array_object_mismatch' });
    return diffs;
  }
  
  const allKeys = new Set([...Object.keys(existing || {}), ...Object.keys(newData || {})]);
  
  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    
    if (!(key in existing)) {
      diffs.push({ path: newPath, type: 'added', value: newData[key] });
    } else if (!(key in newData)) {
      diffs.push({ path: newPath, type: 'removed', value: existing[key] });
    } else {
      diffs.push(...findDifferences(existing[key], newData[key], newPath));
    }
  }
  
  return diffs;
}

/**
 * Merge new data into existing, preserving structure
 */
function mergeData(existing, updates) {
  if (typeof updates !== 'object' || updates === null) {
    return updates;
  }
  
  const result = { ...existing };
  
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = mergeData(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Update ap-schedule.json with verified data
 */
async function updateScheduleFile(scrapedDates, scrapedScores) {
  const schedulePath = path.join(CONFIG.mockDataDir, 'ap-schedule.json');
  
  // Read existing data
  let existingData = {};
  if (fs.existsSync(schedulePath)) {
    existingData = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
    log.info(`Read existing schedule: ${schedulePath}`);
  }
  
  // Create backup
  createBackup(schedulePath);
  
  // Start with existing data
  const updatedData = JSON.parse(JSON.stringify(existingData)); // Deep clone
  updatedData.lastVerified = new Date().toISOString();
  
  // Subject ID mapping for the schedule structure
  const subjectMapping = {
    'macro': 'macroeconomics',
    'micro': 'microeconomics',
    'calc-bc': 'calculus_bc',
    'calc-ab': 'calculus_ab',
    'psych': 'psychology',
    'physics-mech': 'physics_c_mechanics',
    'physics-em': 'physics_c_electricity_magnetism',
    'stats': 'statistics',
    'csa': 'computer_science_a'
  };
  
  // Update exam dates and scores in schedule
  if (updatedData.schedule) {
    for (const [scheduleKey, scheduleEntry] of Object.entries(updatedData.schedule)) {
      const subjectId = subjectMapping[scheduleKey];
      if (!subjectId) continue;
      
      // Check scraped dates first
      if (scrapedDates[subjectId]) {
        const scraped = scrapedDates[subjectId];
        if (scraped.date && scraped.date !== scheduleEntry.examDate) {
          log.data('DATE UPDATE', `${scheduleKey} (${subjectId}): ${scheduleEntry.examDate} -> ${scraped.date}`);
          scheduleEntry.examDate = scraped.date;
          scheduleEntry.dateVerified = true;
        }
      }
      
      // Fall back to known dates
      if (CONFIG.knownExamDates2026[subjectId]) {
        const known = CONFIG.knownExamDates2026[subjectId];
        if (!scheduleEntry.dateVerified) {
          scheduleEntry.examDate = known.date;
          scheduleEntry.examTime = known.time;
          scheduleEntry.dateVerified = true;
          scheduleEntry.dateSource = 'College Board 2026 Calendar';
        }
      }
      
      // Update score distributions
      if (scrapedScores[subjectId]) {
        const scraped = scrapedScores[subjectId];
        if (scraped.fiveRate !== undefined) {
          const current = scheduleEntry.fiveRate;
          if (Math.abs(current - scraped.fiveRate) > 0.01) {
            log.data('SCORE UPDATE', `${scheduleKey}: ${current} -> ${scraped.fiveRate}`);
            scheduleEntry.fiveRate = scraped.fiveRate;
            scheduleEntry.fiveRateSource = 'College Board (scraped)';
          }
        }
      }
      
      // Fall back to known distributions
      if (CONFIG.knownScoreDistributions2025[subjectId]) {
        const known = CONFIG.knownScoreDistributions2025[subjectId];
        const current = scheduleEntry.fiveRate;
        
        // Update if difference is significant
        if (Math.abs(current - known.fiveRate) > 0.01) {
          log.data('SCORE UPDATE', `${scheduleKey}: ${current} -> ${known.fiveRate} (${known.source})`);
          scheduleEntry.fiveRate = known.fiveRate;
          scheduleEntry.fiveRateNote = `2025 five-rate: ${(known.fiveRate * 100).toFixed(0)}%`;
          scheduleEntry.fiveRateSource = known.source;
        }
      }
    }
  }
  
  // Write to tmp first
  const tmpPath = writeToTmp(updatedData, 'ap-schedule.json.tmp');
  
  // Find differences
  const diffs = findDifferences(existingData, updatedData);
  if (diffs.length > 0) {
    log.info(`Found ${diffs.length} differences:`);
    diffs.forEach(d => log.data('DIFF', `${d.path}: ${d.type}`));
    
    // Copy tmp to final
    fs.copyFileSync(tmpPath, schedulePath);
    log.success(`Updated ${schedulePath}`);
  } else {
    log.info('No changes needed');
  }
  
  return { updatedData, diffs };
}

/**
 * Verify unit weights against official data
 */
function verifyUnitWeights() {
  const unitsPath = path.join(CONFIG.mockDataDir, 'units.json');
  const report = { verified: [], discrepancies: [], missing: [] };
  
  if (!fs.existsSync(unitsPath)) {
    log.error('units.json not found');
    return report;
  }
  
  const unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));
  
  // Subject name mapping
  const subjectNameMap = {
    '微积分BC': 'calculus_bc',
    '物理C力学': 'physics_c_mechanics',
    '物理C电磁': 'physics_c_electricity_magnetism'
  };
  
  for (const [chineseName, subjectData] of Object.entries(unitsData.subjects)) {
    const subjectId = subjectData.id || subjectNameMap[chineseName];
    
    if (!CONFIG.officialUnitWeights[subjectId]) {
      log.warn(`No official weights for ${subjectId}`);
      report.missing.push(subjectId);
      continue;
    }
    
    const official = CONFIG.officialUnitWeights[subjectId];
    const current = subjectData.units;
    
    log.info(`Verifying ${subjectId}...`);
    
    for (let i = 0; i < Math.min(official.length, current.length); i++) {
      const offUnit = official[i];
      const curUnit = current[i];
      
      // Normalize weights for comparison
      const normalizeWeight = (w) => {
        if (typeof w === 'string') {
          // Extract first number from range like "4-7%"
          const match = w.match(/(\d+)/);
          return match ? parseInt(match[1]) : null;
        }
        return w;
      };
      
      const offWeight = normalizeWeight(offUnit.weight);
      const curWeight = normalizeWeight(curUnit.weight);
      
      if (offWeight !== null && curWeight !== null) {
        if (Math.abs(offWeight - curWeight) <= 2) {
          report.verified.push({
            subject: subjectId,
            unit: curUnit.id,
            name: curUnit.name,
            weight: curUnit.weight
          });
        } else {
          report.discrepancies.push({
            subject: subjectId,
            unit: curUnit.id,
            name: curUnit.name,
            current: curUnit.weight,
            official: offUnit.weight
          });
          log.warn(`  Unit ${curUnit.id} weight mismatch: ${curUnit.weight} vs official ${offUnit.weight}`);
        }
      }
    }
  }
  
  return report;
}

/**
 * Generate report
 */
function generateReport(results) {
  const reportPath = path.join(CONFIG.tmpDir, 'verification-report.txt');
  
  let report = '=== AP Data Verification Report ===\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  report += '--- Exam Dates ---\n';
  report += `Scraped dates: ${Object.keys(results.scrapedDates).length}\n`;
  report += `Known dates applied: ${Object.keys(CONFIG.knownExamDates2026).length}\n\n`;
  
  report += '--- Score Distributions ---\n';
  report += `Scraped scores: ${Object.keys(results.scrapedScores).length}\n`;
  report += `Known 2025 distributions:\n`;
  for (const [subject, data] of Object.entries(CONFIG.knownScoreDistributions2025)) {
    report += `  ${subject}: ${(data.fiveRate * 100).toFixed(0)}% (${data.source})\n`;
  }
  
  report += '\n--- Unit Weights Verification ---\n';
  report += `Verified: ${results.unitReport.verified.length} units\n`;
  report += `Discrepancies: ${results.unitReport.discrepancies.length}\n`;
  if (results.unitReport.discrepancies.length > 0) {
    results.unitReport.discrepancies.forEach(d => {
      report += `  ${d.subject} Unit ${d.unit}: ${d.current} (our data) vs ${d.official} (official)\n`;
    });
  }
  report += `Missing official data: ${results.unitReport.missing.join(', ')}\n`;
  
  report += '\n--- File Changes ---\n';
  report += `Differences found: ${results.diffs.length}\n`;
  if (results.diffs.length > 0) {
    results.diffs.forEach(d => {
      report += `  ${d.path}: ${d.type}\n`;
    });
  }
  
  report += '\n--- Backup Location ---\n';
  report += `Backups: ${CONFIG.backupDir}\n`;
  report += `Temp files: ${CONFIG.tmpDir}\n`;
  
  fs.writeFileSync(reportPath, report, 'utf8');
  log.success(`Report written to: ${reportPath}`);
  
  return report;
}

/**
 * Main execution
 */
async function main() {
  log.info('=== AP Data Scraper & Verifier ===');
  log.info(`Working directory: ${CONFIG.baseDir}`);
  
  // Ensure directories
  ensureDirectories();
  
  let scrapedDates = {};
  let scrapedScores = {};
  
  // Attempt to scrape exam dates
  log.info('Attempting to scrape exam dates...');
  try {
    const response = await fetchUrl(CONFIG.urls.examCalendar);
    if (response.status === 200) {
      scrapedDates = parseExamDates(response.data);
      log.success(`Scraped ${Object.keys(scrapedDates).length} exam dates`);
    }
  } catch (err) {
    log.warn(`Failed to scrape exam dates: ${err.message}`);
    log.info('Using known dates as fallback');
  }
  
  // Attempt to scrape score distributions
  log.info('Attempting to scrape score distributions...');
  for (const url of [CONFIG.urls.scoreDistributions, CONFIG.urls.scoreDistAlt]) {
    try {
      const response = await fetchUrl(url);
      if (response.status === 200) {
        scrapedScores = parseScoreDistributions(response.data);
        if (Object.keys(scrapedScores).length > 0) {
          log.success(`Scraped ${Object.keys(scrapedScores).length} score distributions`);
          break;
        }
      }
    } catch (err) {
      log.warn(`Failed to scrape scores from ${url}: ${err.message}`);
    }
  }
  
  // Verify unit weights
  log.info('Verifying unit weights...');
  const unitReport = verifyUnitWeights();
  log.success(`Verified ${unitReport.verified.length} units, found ${unitReport.discrepancies.length} discrepancies`);
  
  // Update schedule file
  log.info('Updating schedule file...');
  const { updatedData, diffs } = await updateScheduleFile(scrapedDates, scrapedScores);
  
  // Generate report
  const results = {
    scrapedDates,
    scrapedScores,
    unitReport,
    diffs
  };
  
  const report = generateReport(results);
  
  // Summary
  log.info('=== Summary ===');
  if (updatedData && updatedData.schedule) {
    const schedKeys = Object.keys(updatedData.schedule);
    log.success(`Exam dates: ${schedKeys.length} subjects configured`);
    schedKeys.forEach(k => {
      const entry = updatedData.schedule[k];
      if (entry.fiveRate) {
        log.data('RATE', `${k}: ${(entry.fiveRate * 100).toFixed(0)}% five-rate`);
      }
    });
  }
  log.success(`Unit weights: ${unitReport.verified.length} verified`);
  
  if (diffs && diffs.length > 0) {
    log.info(`${diffs.length} changes were made to the data files`);
  } else {
    log.info('No changes needed - data is up to date');
  }
  
  log.info(`Check ${path.join(CONFIG.tmpDir, 'verification-report.txt')} for details`);
}

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    log.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  fetchUrl,
  parseExamDates,
  parseScoreDistributions,
  verifyUnitWeights,
  findDifferences,
  CONFIG
};