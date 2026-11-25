# MockValley

MockValley is a mobile-first Progressive Web App (PWA) built for JKSSB aspirants to practice English multiple-choice questions on Jammu & Kashmir General Knowledge (static GK and current affairs).

## Folder Map

- `data/topics.json` — Syllabus topics (data-driven; can be added or hidden)
- `data/months.json` — Current Affairs months starting June 2026
- `data/questions/*.json` — Question bank JSON files (`_template.json` is ignored by the validator)
- `docs/DATA_FORMAT.md` — Plain-English guide to JSON structure and difficulty rules
- `scripts/validate-data.ts` — Zod validator and coverage summary script
- `scripts/import.ts` — Validates JSON and upserts topics, months, and questions into Supabase
- `supabase/migrations/` — Database schema, Row Level Security policies, `is_paid()`, and practice RPC functions
- `public/` — PWA icons and `offline.html` fallback page
- `src/components/` — Reusable UI components (`BottomNav.tsx`, `QuestionPaletteSheet.tsx`)
- `src/pages/` — App screens (`HomePage.tsx`, `PracticePage.tsx`, and upcoming screens)
- `src/lib/` — Supabase client setup (`supabase.ts`), types (`types.ts`), and RPC helpers (`practiceApi.ts`)
- `src/vite-env.d.ts` — Vite client type declarations for `import.meta.env`

## Run Locally

1. Install dependencies:
   ```bash
   npm install