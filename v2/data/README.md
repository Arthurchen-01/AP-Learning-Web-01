# AP Learning - Exam Data

## Directory Structure

```
v2/data/
├── TEMPLATE-exam_packet.json   # Exam metadata template
├── TEMPLATE-questions.json    # Questions template
├── exams/
│   └── index.json            # Exam catalog (auto-generated)
└── calc-bc-2018-intl/
    ├── exam_packet.json       # Exam metadata
    └── questions.json         # Question bank (45 MCQ + FRQ)
```

## Adding a New Exam

### Step 1: Create exam directory
```
v2/data/<exam-id>/
├── exam_packet.json
└── questions.json
```

### Step 2: Fill exam_packet.json
Copy `TEMPLATE-exam_packet.json` and fill in:
- `exam_id`: unique ID like `calc-bc-2019-intl`
- `exam_title`: display name
- `subject`: subject code (e.g., `calculus_bc`, `statistics`)
- `subject_display`: Chinese display name
- `year`: exam year
- `form`: `international` or `standard`
- `total_questions`: total MCQ count
- `sections`: each section with `section_id`, `time_limit_minutes`, `calculator_allowed`

### Step 3: Fill questions.json
Copy `TEMPLATE-questions.json`. Each question needs:
- `question_id`: unique ID per exam (e.g., `q1`, `q2`)
- `section_id`: must match a section_id in exam_packet.json
- `sequence_in_exam`: position in exam (1-based)
- `question_type`: `single_choice` (MCQ) or `free_response` (FRQ)
- `question_html`: question text with LaTeX math (`$...$` for inline, `$$...$$` for display)
- `options[]`: array of `{key, html}` for MCQ; omit for FRQ
- `correct_answer`: the correct option key (A/B/C/D)
- `unit`: AP Curriculum Unit number (1-10 for Calculus BC)
- `knowledge_points[]`: array of topic tags for filtering

### Knowledge Point Tags
Use from these standard tags:
- `Limits`
- `Derivatives`
- `Integrals`
- `Series`
- `Differential Equations`
- `Polar Functions`
- `Parametric & Vectors`
- `Motion`
- `Calculus` (fallback)

### Step 4: Register in data-service.js
Add the exam to the default list in `v2/js/data-service.js`:
```javascript
{
  exam_id: 'your-exam-id',
  exam_title: 'Your Exam Title',
  subject: 'subject_code',
  subject_display: 'Display Name',
  year: 2024,
  form: 'international',
  total_questions: 45,
  sections: [...]
}
```

## LaTeX Math Syntax

Inline math: `$x^2 + y^2 = r^2$`
Display math: `$$\int_0^1 x^2 dx$$`

Common symbols:
- Fractions: `\frac{numerator}{denominator}`
- Exponents: `x^{2}` or `e^{x}`
- Square root: `\sqrt{x}` or `\sqrt[3]{x}`
- Greek: `\alpha`, `\beta`, `\pi`, `\theta`, etc.
- Limits: `\lim_{x \to a} f(x)`
- Integrals: `\int_a^b f(x) dx`
- Summation: `\sum_{n=0}^{\infty}`

## Question Text Guidelines

For AP Calculus BC, tag questions by the primary skill tested:
- **Limits**: limit evaluation, continuity, L'Hôpital's Rule
- **Derivatives**: differentiation rules, implicit differentiation, related rates
- **Integrals**: antiderivatives, definite/indefinite integrals, u-substitution
- **Series**: convergence tests, Taylor/Maclaurin series, interval of convergence
- **Differential Equations**: separable equations, slope fields, Euler's Method
