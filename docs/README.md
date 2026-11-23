#### `README.md`
```markdown
# MockValley

Mobile-first Progressive Web App (PWA) for JKSSB aspirants to practice English MCQs on J&K General Knowledge and Current Affairs.

## Project Structure

- `data/topics.json` — Syllabus topics
- `data/months.json` — Current Affairs months (starting June 2026)
- `data/questions/` — Question bank JSON files + `_template.json`
- `scripts/validate-data.ts` — Zod-based JSON validator and coverage reporter
- `docs/DATA_FORMAT.md` — Plain-English guide to writing and validating question JSONs

## Quick Commands

1. Install dependencies:
   ```bash
   npm install