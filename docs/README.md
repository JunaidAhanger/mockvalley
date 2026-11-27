# MockValley

MockValley is a mobile-first Progressive Web App (PWA) built for JKSSB aspirants to practice English multiple-choice questions on Jammu & Kashmir General Knowledge (static GK and current affairs). Free users can practice `is_free` questions (up to 10 distinct questions per topic, with unlimited retries on already-attempted questions), while a time-limited pass (1-month or 3-month pass configured in the database) unlocks all topics, all difficulty levels, Current Affairs (starting June 2026), and Timed Exam Mode.

## Stack & Architecture

- **Frontend:** React + Vite + TypeScript, installable PWA with offline fallback (`public/offline.html`)
- **Backend & Database:** Supabase (Auth with Google OAuth, Postgres, Row Level Security, RPC functions, and Edge Functions)
- **Payments:** Razorpay (Test Mode first, with server-side order creation and webhook-only pass activation)
- **Hosting:** Cloudflare Pages
- **Source Control:** GitHub

## Folder Map

- `data/topics.json` — Syllabus topics (data-driven; can be added or hidden)
- `data/months.json` — Current Affairs months starting June 2026
- `data/questions/*.json` — Question bank JSON files (`_template.json` is ignored by the validator)[cite: 1]
- `docs/DATA_FORMAT.md` — Plain-English guide to JSON structure and difficulty rules[cite: 1]
- `scripts/validate-data.ts` — Zod validator and coverage summary script[cite: 1]
- `scripts/import.ts` — Validates JSON and upserts topics, months, and questions into Supabase[cite: 1]
- `supabase/migrations/` — Database schema, Row Level Security policies, `is_paid()`, practice RPCs, free-quota enforcement, and `plans` + pass webhook helper[cite: 1]
- `supabase/functions/` — Edge Functions (`create_order` and `razorpay_webhook`)[cite: 1]
- `public/` — PWA icons and `offline.html` fallback page[cite: 1]
- `src/components/` — Reusable UI components (`BottomNav.tsx`, `QuestionPaletteSheet.tsx`)[cite: 1]
- `src/pages/` — App screens (`HomePage.tsx`, `LoginPage.tsx`, `PracticePage.tsx`, `UpgradePage.tsx`, `ProfilePage.tsx`, `MyPlanPage.tsx`)[cite: 1]
- `src/lib/` — Supabase client setup (`supabase.ts`), types (`types.ts`), RPC helpers (`practiceApi.ts`), and payment helpers (`paymentsApi.ts`)[cite: 1]
- `src/vite-env.d.ts` — Vite client type declarations for `import.meta.env`[cite: 1]

## Run Locally

1. Install dependencies:
   ```bash
   npm install