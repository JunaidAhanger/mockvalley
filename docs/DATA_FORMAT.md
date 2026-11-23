# MockValley Question & Data Format Guide

All content in MockValley is stored as simple JSON files inside the `data/` folder.

---

## Folder Layout

- `data/topics.json` — The master list of syllabus topics.
- `data/months.json` — The list of Current Affairs months (starting June 2026).
- `data/questions/*.json` — Any number of `.json` files containing arrays of questions (e.g., `jk-history-01.json`, `ca-2026-06.json`).
  - *Tip:* Any file starting with an underscore (`_template.json`) is ignored by the validator.

---

## 1. Topics (`data/topics.json`)

Each topic controls a category shown on the app's home screen.

```json
{
  "id": "jk-history",
  "name": "J&K UT: History",
  "order": 9,
  "active": true
}