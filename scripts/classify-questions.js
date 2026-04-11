#!/usr/bin/env node

/**
 * Automated question-to-unit tagging system.
 * Generates question-unit-tags.json mapping every question to its AP curriculum unit.
 * Also updates exam-catalog.json with subjectId field.
 */

const fs = require('fs');
const path = require('path');

const MOCK_DATA_DIR = path.join(__dirname, '..', 'mock-data');
const UNITS_FILE = path.join(MOCK_DATA_DIR, 'units.json');
const EXAM_CATALOG_FILE = path.join(MOCK_DATA_DIR, 'exam-catalog.json');
const OUTPUT_TAGS_FILE = path.join(MOCK_DATA_DIR, 'question-unit-tags.json');

// Load units data
const unitsData = JSON.parse(fs.readFileSync(UNITS_FILE, 'utf8'));
const subjects = unitsData.subjects;

// Build mapping from subject Chinese name to id
const subjectNameToId = {};
for (const [cnName, subject] of Object.entries(subjects)) {
    subjectNameToId[cnName] = subject.id;
}

// Build keyword lists for each subject and unit
const subjectKeywords = {};

for (const [cnName, subject] of Object.entries(subjects)) {
    const subjectId = subject.id;
    const units = subject.units;
    const unitKeywords = {};
    
    for (const unit of units) {
        // Extract keywords from topics (lowercase)
        const keywords = new Set();
        for (const topic of unit.topics) {
            // Split topic into words and add each word > 3 chars
            // Also keep multi-word phrases
            const words = topic.split(/[\s,]+/).filter(w => w.length > 3);
            words.forEach(w => keywords.add(w.toLowerCase()));
            // Also add the whole topic as a keyword if it's not too long
            if (topic.length < 50) {
                keywords.add(topic.toLowerCase());
            }
        }
        // Add extra keywords based on unit name
        const unitNameWords = unit.name.split(/\s+/).filter(w => w.length > 3);
        unitNameWords.forEach(w => keywords.add(w.toLowerCase()));
        
        unitKeywords[unit.id] = {
            unitId: unit.id,
            unitName: unit.name,
            keywords: Array.from(keywords)
        };
    }
    subjectKeywords[subjectId] = unitKeywords;
}

// Add extra domain-specific keywords per subject (manually curated)
const extraKeywords = {
    'physics_c_mechanics': {
        1: ['position', 'velocity', 'acceleration', 'displacement', 'projectile', 'free fall', 'kinematic', 'v=v0+at', 'x=x0+v0t+½at²', 'derivative', 'integral'],
        2: ['force', 'net force', 'F=ma', 'free body diagram', 'friction', 'normal force', 'tension', 'weight', 'newton', 'inertia', 'action-reaction'],
        3: ['work', 'kinetic energy', 'potential energy', 'conservation of energy', 'power', 'W=Fd', 'KE=½mv²', 'work-energy theorem', 'spring', 'elastic'],
        4: ['momentum', 'impulse', 'conservation of momentum', 'elastic', 'inelastic', 'collision', 'p=mv', 'center of mass'],
        5: ['torque', 'angular velocity', 'angular acceleration', 'moment of inertia', 'rotational kinetic energy', 'angular momentum', 'I=∫r²dm', 'rolling', 'centripetal'],
        6: ['simple harmonic motion', 'period', 'frequency', 'pendulum', 'spring', 'SHM', 'T=2π√(m/k)', 'oscillation', 'gravitational', 'orbit']
    },
    'physics_c_electricity_magnetism': {
        1: ['electric charge', 'coulomb', 'electric field', 'electric flux', 'gauss', 'electric potential', 'capacitor', 'dielectric'],
        2: ['conductor', 'capacitance', 'parallel plate', 'cylindrical', 'spherical', 'energy stored', 'polarization'],
        3: ['current', 'resistance', 'ohm', 'dc circuit', 'resistor', 'kirchhoff', 'rc circuit', 'power'],
        4: ['magnetic field', 'lorentz force', 'current-carrying wire', 'biot-savart', 'ampere', 'magnetic flux'],
        5: ['faraday', 'induction', 'lenz', 'inductance', 'rl circuit', 'lc circuit', 'maxwell']
    },
    'calculus_bc': {
        1: ['limit', 'continuity', 'discontinuity', 'squeeze theorem', 'infinity'],
        2: ['derivative', 'rate of change', 'instantaneous', 'average', 'differentiability', 'power rule', 'product rule', 'quotient rule', 'chain rule', 'trigonometric'],
        3: ['implicit differentiation', 'inverse function', 'inverse trigonometric', 'higher-order derivative'],
        4: ['straight-line motion', 'related rates', 'local linearity', 'l\'hopital'],
        5: ['mean value theorem', 'extreme value theorem', 'extrema', 'concavity', 'inflection point', 'optimization'],
        6: ['accumulation function', 'riemann sum', 'definite integral', 'fundamental theorem of calculus', 'antiderivative', 'indefinite integral', 'substitution', 'integration by parts', 'partial fractions', 'improper integral'],
        7: ['differential equation', 'slope field', 'separable', 'euler\'s method'],
        8: ['average value', 'area between curves', 'volume', 'solid of revolution', 'cross section'],
        9: ['parametric equation', 'polar coordinates', 'vector-valued function', 'arc length', 'polar curve'],
        10: ['sequence', 'series', 'convergent', 'divergent', 'geometric series', 'telescoping', 'harmonic series', 'integral test', 'comparison test', 'limit comparison', 'alternating series', 'ratio test', 'absolute convergence', 'conditional convergence', 'taylor polynomial', 'taylor series', 'maclaurin series', 'radius of convergence', 'interval of convergence', 'power series']
    },
    'macroeconomics': {
        1: ['scarcity', 'opportunity cost', 'production possibilities curve', 'comparative advantage', 'trade', 'economic system'],
        2: ['gdp', 'gross domestic product', 'unemployment', 'inflation', 'price index', 'cpi', 'business cycle', 'national income accounting'],
        3: ['aggregate demand', 'aggregate supply', 'equilibrium', 'fiscal policy', 'government spending', 'taxation', 'multiplier effect', 'crowding out'],
        4: ['money', 'banking', 'money supply', 'money demand', 'money multiplier', 'monetary policy', 'interest rate', 'loanable funds', 'quantity theory of money'],
        5: ['phillips curve', 'inflation-unemployment trade-off', 'policy lag', 'supply-side', 'demand-side'],
        6: ['balance of payments', 'current account', 'capital account', 'exchange rate', 'foreign exchange', 'net exports', 'capital flows']
    },
    'microeconomics': {
        1: ['scarcity', 'choice', 'opportunity cost', 'production possibilities curve', 'comparative advantage', 'trade'],
        2: ['demand', 'law of demand', 'supply', 'law of supply', 'market equilibrium', 'elasticity', 'consumer surplus', 'producer surplus', 'price floor', 'price ceiling', 'tax'],
        3: ['production function', 'marginal product', 'short-run cost', 'long-run cost', 'economies of scale', 'diseconomies of scale', 'profit maximization', 'perfect competition'],
        4: ['monopoly', 'price discrimination', 'monopolistic competition', 'oligopoly', 'game theory', 'barriers to entry'],
        5: ['derived demand', 'marginal revenue product', 'monopsony', 'wage determination'],
        6: ['externality', 'public goods', 'free rider', 'information asymmetry', 'government intervention']
    },
    'psychology': {
        1: ['structuralism', 'functionalism', 'behaviorism', 'research method', 'experimental', 'correlational', 'observational', 'ethical guidelines', 'descriptive statistics', 'inferential statistics'],
        2: ['neuron', 'neural communication', 'brain structure', 'nervous system', 'heredity', 'genetics', 'endocrine system'],
        3: ['sensation', 'absolute threshold', 'difference threshold', 'vision', 'hearing', 'perceptual organization'],
        4: ['classical conditioning', 'pavlov', 'operant conditioning', 'skinner', 'observational learning', 'bandura', 'biological constraints'],
        5: ['memory', 'encoding', 'storage', 'retrieval', 'forgetting', 'memory errors', 'language', 'thought', 'problem solving', 'decision making', 'intelligence'],
        6: ['lifespan development', 'physical development', 'cognitive development', 'social development', 'emotional development', 'erikson', 'piaget', 'kohlberg', 'aging'],
        7: ['motivation', 'maslow', 'drive reduction', 'emotion theory', 'stress', 'health', 'personality', 'psychoanalytic', 'humanistic', 'trait', 'social-cognitive'],
        8: ['anxiety disorder', 'mood disorder', 'schizophrenia', 'personality disorder', 'dsm', 'psychotherapy', 'biological treatment', 'cognitive-behavioral'],
        9: ['attribution', 'social cognition', 'attitudes', 'attitude change', 'social influence', 'conformity', 'obedience', 'compliance', 'group dynamics', 'prejudice', 'discrimination']
    },
    'statistics': {
        1: ['categorical variable', 'quantitative variable', 'dotplot', 'histogram', 'stemplot', 'distribution', 'shape', 'center', 'spread', 'mean', 'median', 'mode', 'range', 'iqr', 'standard deviation', 'normal distribution', 'z-score'],
        2: ['scatterplot', 'correlation', 'least-squares regression', 'residual', 'outlier', 'influential point'],
        3: ['sampling method', 'simple random', 'stratified', 'cluster', 'systematic', 'observational study', 'experiment', 'random assignment', 'bias'],
        4: ['probability', 'addition rule', 'multiplication rule', 'complement', 'conditional probability', 'independence', 'random variable', 'binomial distribution', 'geometric distribution'],
        5: ['sampling distribution', 'sample proportion', 'sample mean', 'central limit theorem', 'biased estimator', 'unbiased estimator'],
        6: ['confidence interval', 'hypothesis test', 'type i error', 'type ii error', 'significance level', 'p-value'],
        7: ['t-distribution', 'confidence interval for means', 'hypothesis test for means', 'matched pairs'],
        8: ['chi-square', 'goodness-of-fit', 'test for homogeneity', 'test for independence'],
        9: ['confidence interval for slope', 'hypothesis test for slope']
    },
    'computer_science_a': {
        1: ['variable', 'data type', 'int', 'double', 'boolean', 'string', 'operator', 'expression', 'casting', 'compiling'],
        2: ['object', 'class', 'constructor', 'method', 'string method', 'math class', 'object reference', 'wrapper class', 'integer', 'double'],
        3: ['boolean expression', 'logical operator', 'if', 'else if', 'else', 'nested conditional', 'de morgan'],
        4: ['while loop', 'for loop', 'nested loop', 'traversing', 'accumulating', 'searching', 'loop error'],
        5: ['instance variable', 'method', 'constructor', 'access modifier', 'public', 'private', 'this', 'static', 'accessor', 'mutator'],
        6: ['array', 'array creation', 'array initialization', 'traversing array', 'find max', 'find min', 'sum', 'average', 'two-dimensional array'],
        7: ['arraylist', 'arraylist class', 'adding element', 'removing element', 'accessing element', 'traversing arraylist', 'autoboxing'],
        8: ['2d array', 'row-major', 'column-major', 'nested loop with 2d array'],
        9: ['inheritance', 'superclass', 'subclass', 'extends', 'method overriding', 'super', 'polymorphism', 'object class'],
        10: ['recursion', 'recursive method', 'base case', 'recursive case', 'recursive vs iterative', 'recursive algorithm']
    }
};

// Merge extra keywords into subjectKeywords
for (const [subjectId, unitExtras] of Object.entries(extraKeywords)) {
    if (!subjectKeywords[subjectId]) continue;
    for (const [unitId, extraWords] of Object.entries(unitExtras)) {
        const unitIdNum = parseInt(unitId);
        if (!subjectKeywords[subjectId][unitIdNum]) continue;
        const existing = subjectKeywords[subjectId][unitIdNum].keywords;
        const newWords = extraWords.map(w => w.toLowerCase());
        subjectKeywords[subjectId][unitIdNum].keywords = [...new Set([...existing, ...newWords])];
    }
}

console.log('Loaded keyword mappings for', Object.keys(subjectKeywords).length, 'subjects');

// Helper: strip HTML tags and decode entities
function stripHtml(html) {
    if (!html) return '';
    // Remove HTML tags
    let text = html.replace(/<[^>]+>/g, ' ');
    // Decode common entities
    text = text.replace(/&nbsp;/g, ' ')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");
    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

// Classify a question text for a given subjectId
function classifyQuestion(questionText, subjectId) {
    const text = questionText.toLowerCase();
    const unitKeywords = subjectKeywords[subjectId];
    if (!unitKeywords) return null;
    
    let bestUnit = null;
    let bestScore = 0;
    let matchedKeywords = [];
    
    for (const [unitId, unitData] of Object.entries(unitKeywords)) {
        const keywords = unitData.keywords;
        let score = 0;
        let matched = [];
        for (const kw of keywords) {
            if (text.includes(kw)) {
                // Longer keywords get higher weight
                const weight = kw.length > 10 ? 3 : (kw.length > 5 ? 2 : 1);
                score += weight;
                matched.push(kw);
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestUnit = unitData;
            matchedKeywords = matched;
        }
    }
    
    if (bestScore === 0) {
        // No keywords matched, return null (unknown unit)
        return null;
    }
    
    // Determine confidence based on score and keyword matches
    let confidence = 'low';
    if (bestScore >= 10 && matchedKeywords.length >= 3) confidence = 'high';
    else if (bestScore >= 5 && matchedKeywords.length >= 2) confidence = 'medium';
    
    return {
        unitId: bestUnit.unitId,
        unitName: bestUnit.unitName,
        confidence: confidence,
        matchedKeywords: matchedKeywords
    };
}

// Process exam files
async function processExams() {
    // Load exam catalog
    const catalog = JSON.parse(fs.readFileSync(EXAM_CATALOG_FILE, 'utf8'));
    const examCatalogItems = catalog.items;
    
    // Map examId to subject for quick lookup
    const examIdToSubject = {};
    for (const item of examCatalogItems) {
        examIdToSubject[item.examId] = item.subject;
    }
    
    // Get list of exam files in mock-data
    const files = fs.readdirSync(MOCK_DATA_DIR);
    const examFiles = files.filter(f => 
        f.startsWith('ap-exam-') && 
        f.endsWith('.json') && 
        !f.startsWith('ap-exam-190262') // skip imported exams
    );
    
    console.log(`Found ${examFiles.length} exam files to process`);
    
    const mappings = {};
    let totalQuestions = 0;
    let taggedQuestions = 0;
    
    for (const examFile of examFiles) {
        const examPath = path.join(MOCK_DATA_DIR, examFile);
        const examData = JSON.parse(fs.readFileSync(examPath, 'utf8'));
        const examId = examData.examId;
        
        // Determine subject
        const subjectCn = examIdToSubject[examId];
        if (!subjectCn) {
            console.warn(`Exam ${examId} not found in catalog, skipping`);
            continue;
        }
        const subjectId = subjectNameToId[subjectCn];
        if (!subjectId) {
            console.warn(`Subject ${subjectCn} not mapped to id, skipping`);
            continue;
        }
        
        console.log(`Processing exam ${examId} (${subjectCn} -> ${subjectId})`);
        
        mappings[examId] = {};
        
        // Iterate through sections and questions
        if (examData.sections) {
            for (const section of examData.sections) {
                if (section.questions) {
                    for (const question of section.questions) {
                        totalQuestions++;
                        const questionId = question.id;
                        const promptHtml = question.prompt || '';
                        const promptText = stripHtml(promptHtml);
                        
                        const classification = classifyQuestion(promptText, subjectId);
                        if (classification) {
                            taggedQuestions++;
                            mappings[examId][questionId] = classification;
                        } else {
                            // No match, assign unknown unit (unit 0) or leave empty? We'll assign a default.
                            mappings[examId][questionId] = {
                                unitId: 0,
                                unitName: 'Unclassified',
                                confidence: 'none',
                                matchedKeywords: []
                            };
                        }
                    }
                }
            }
        }
    }
    
    // Generate output
    const output = {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        mappings: mappings
    };
    
    fs.writeFileSync(OUTPUT_TAGS_FILE, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Wrote question-unit-tags.json with ${Object.keys(mappings).length} exams`);
    console.log(`Tagged ${taggedQuestions}/${totalQuestions} questions (${(taggedQuestions/totalQuestions*100).toFixed(1)}%)`);
    
    // Update exam-catalog.json with subjectId field
    for (const item of catalog.items) {
        const subjectId = subjectNameToId[item.subject];
        if (subjectId) {
            item.subjectId = subjectId;
        }
    }
    fs.writeFileSync(EXAM_CATALOG_FILE, JSON.stringify(catalog, null, 2), 'utf8');
    console.log('Updated exam-catalog.json with subjectId field');
}

// Run
processExams().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});