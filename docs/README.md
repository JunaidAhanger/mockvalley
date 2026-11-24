# MockValley

MockValley is a mobile-first Progressive Web App (PWA) built for JKSSB aspirants to practice English multiple-choice questions on Jammu & Kashmir General Knowledge (static GK and current affairs).

## Folder Map

- `data/topics.json` — Syllabus topics (data-driven; can be added or hidden)
- `data/months.json` — Current Affairs months starting June 2026
- `data/questions/*.json` — Question bank JSON files (`_template.json` is ignored by the validator)
- `docs/DATA_FORMAT.md` — Plain-English guide to JSON structure and difficulty rules
- `scripts/validate-data.ts` — Zod validator and coverage summary script
- `public/` — PWA icons and `offline.html` fallback page
- `src/components/` — Reusable UI components (such as the bottom navigation bar)
- `src/pages/` — App screens (`HomePage.tsx` and upcoming practice/exam screens)
- `src/lib/` — Supabase client setup (`supabase.ts`)[cite: 5]
- `src/vite-env.d.ts` — Vite client type declarations for `import.meta.env`
- `supabase/` — Database SQL and Edge Functions (added in upcoming tasks)[cite: 5]

## Run Locally

1. Install dependencies:
   ```bash
   npm install