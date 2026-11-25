import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
// import { createClient } from "@supabase/supabase-js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");
const TOPICS_FILE = path.join(DATA_DIR, "topics.json");
const MONTHS_FILE = path.join(DATA_DIR, "months.json");
const QUESTIONS_DIR = path.join(DATA_DIR, "questions");

interface TopicRow {
  id: string;
  name: string;
  order: number;
  active: boolean;
}

interface MonthRow {
  id: string;
  label: string;
  order: number;
  active: boolean;
}

interface QuestionRow {
  id: string;
  status: "active" | "hidden";
  is_free: boolean;
  topic_id: string;
  month_id: string | null;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  explanation: string;
  option_notes: Record<string, string>;
  source: string;
  last_verified: string;
  difficulty: "easy" | "moderate" | "hard";
  tags: string[];
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function readAllQuestions(): QuestionRow[] {
  const files = fs
    .readdirSync(QUESTIONS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort();

  const all: QuestionRow[] = [];
  for (const file of files) {
    const rows = loadJson<QuestionRow[]>(path.join(QUESTIONS_DIR, file));
    all.push(...rows);
  }
  return all;
}

function runValidatorFirst(): void {
  console.log("Running data validator before import...\n");
  const result = spawnSync("npm", ["run", "validate"], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error("\nImport aborted: fix all validation errors first.");
    process.exit(result.status ?? 1);
  }
}

// Counts how many incoming rows are new vs. already existing in Supabase so dry-run and summary are accurate.
async function splitNewVsExisting(
  supabase: SupabaseClient,
  table: "topics" | "months" | "questions",
  ids: string[]
): Promise<{ toAdd: number; toUpdate: number }> {
  if (ids.length === 0) {
    return { toAdd: 0, toUpdate: 0 };
  }

  const { data, error } = await supabase.from(table).select("id").in("id", ids);
  if (error) {
    throw new Error(`Failed checking existing rows in ${table}: ${error.message}`);
  }

  const existingSet = new Set((data ?? []).map((row: { id: string }) => row.id));
  let toAdd = 0;
  let toUpdate = 0;

  for (const id of ids) {
    if (existingSet.has(id)) {
      toUpdate += 1;
    } else {
      toAdd += 1;
    }
  }

  return { toAdd, toUpdate };
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  // 1. Always validate JSON files first; refuse to import if errors exist.
  runValidatorFirst();

  // 2. Read credentials strictly from environment variables.
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "\nMissing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
    console.error("Set them in your shell before running npm run import (never hardcode keys).");
    process.exit(1);
  }

  const topics = loadJson<TopicRow[]>(TOPICS_FILE);
  const months = loadJson<MonthRow[]>(MONTHS_FILE);
  const questions = readAllQuestions();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const topicCounts = await splitNewVsExisting(
    supabase,
    "topics",
    topics.map((t) => t.id)
  );
  const monthCounts = await splitNewVsExisting(
    supabase,
    "months",
    months.map((m) => m.id)
  );
  const questionCounts = await splitNewVsExisting(
    supabase,
    "questions",
    questions.map((q) => q.id)
  );

  if (isDryRun) {
    console.log("\n=== DRY RUN SUMMARY (No changes written to Supabase) ===");
    console.log(`Topics    -> would add: ${topicCounts.toAdd}, would update: ${topicCounts.toUpdate}`);
    console.log(`Months    -> would add: ${monthCounts.toAdd}, would update: ${monthCounts.toUpdate}`);
    console.log(
      `Questions -> would add: ${questionCounts.toAdd}, would update: ${questionCounts.toUpdate}`
    );
    console.log("Rows in database not present in JSON files are left untouched.\n");
    return;
  }

  // 3. Upsert by id without deleting anything missing from the JSON files.
  if (topics.length > 0) {
    const { error } = await supabase.from("topics").upsert(topics, { onConflict: "id" });
    if (error) throw new Error(`Failed upserting topics: ${error.message}`);
  }

  if (months.length > 0) {
    const { error } = await supabase.from("months").upsert(months, { onConflict: "id" });
    if (error) throw new Error(`Failed upserting months: ${error.message}`);
  }

  if (questions.length > 0) {
    const { error } = await supabase.from("questions").upsert(questions, { onConflict: "id" });
    if (error) throw new Error(`Failed upserting questions: ${error.message}`);
  }

  console.log("\n=== IMPORT SUMMARY ===");
  console.log(`Topics    -> added: ${topicCounts.toAdd}, updated: ${topicCounts.toUpdate}`);
  console.log(`Months    -> added: ${monthCounts.toAdd}, updated: ${monthCounts.toUpdate}`);
  console.log(`Questions -> added: ${questionCounts.toAdd}, updated: ${questionCounts.toUpdate}`);
  console.log("Existing rows not listed in JSON files were left untouched.\n");
}

main().catch((err) => {
  console.error("\nImport failed:", (err as Error).message);
  process.exit(1);
});