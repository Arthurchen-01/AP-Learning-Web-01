# AP Data Scraper Scripts

## scrape-ap-data.js

Scrapes and verifies AP exam data from College Board.

### Features

1. **Exam Dates**: Scrapes AP exam calendar for 2026 dates
2. **Score Distributions**: Gets actual 5-rate percentages for each subject
3. **Unit Weights**: Cross-checks against official course descriptions

### Safety

- Always writes to `.tmp` files first
- Creates timestamped backups before any changes
- Never overwrites data without backup
- Generates detailed diff reports

### Usage

```bash
# Run scraper
node scripts/scrape-ap-data.js

# Or use npm
npm run scrape

# Generate report only (no file changes)
npm run verify
```

### Output

- Updated `mock-data/ap-schedule.json` with verified data
- Backup files in `mock-data/.backup/`
- Temp files in `mock-data/.tmp/`
- Verification report at `mock-data/.tmp/verification-report.txt`

### Data Sources

- **Exam Dates**: College Board 2026 Calendar
- **Score Distributions**: College Board 2025 data
- **Unit Weights**: Official AP course descriptions

### Fallback Data

If scraping fails (due to JS-rendered pages or network issues), the script uses:
- Known 2026 exam dates from College Board calendar
- 2025 score distribution data
- Official unit weights from course descriptions

### Subjects Covered

1. AP Calculus BC
2. AP Calculus AB
3. AP Computer Science A
4. AP Microeconomics
5. AP Macroeconomics
6. AP Statistics
7. AP Psychology
8. AP Physics C: Mechanics
9. AP Physics C: Electricity and Magnetism