import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const DATA_DIR = path.resolve(process.cwd(), "data");
const TOPICS_FILE = path.join(DATA_DIR, "topics.json");
const MONTHS_FILE = path.join(DATA_DIR, "months.json");
const QUESTIONS_DIR = path.join(DATA_DIR, "questions");

type OptionKey = "A" | "B" | "C" | "D";
type Difficulty = "easy" | "moderate" | "hard";

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];
const DIFFICULTIES: Difficulty[] = ["easy", "moderate", "hard"];

// Schemas for topics.json and months.json
const TopicSchema = z.object({
  id: z.string().min(1, "Topic id cannot be empty"),
  name: z.string().min(1, "Topic name cannot be empty"),
  order: z.number().int(),
  active: z.boolean(),
});

const MonthSchema = z.object({
  id: z.string().regex(/^\d{4}-\d{2}$/, "Month id must be YYYY-MM (e.g. 2026-06)"),
  label: z.string().min(1, "Month label cannot be empty"),
  order: z.number().int(),
  active: z.boolean(),
});

// Strict schema for each question object
const QuestionSchema = z
  .object({
    id: z.string().regex(/^Q-\d{6}$/, "id format wrong (expected Q-000123)"),
    status: z.enum(["active", "hidden"]),
    is_free: z.boolean(),
    topic_id: z.string().min(1, "topic_id is required"),
    month_id: z.string().nullable(),
    question: z.string().trim().min(1, "question text cannot be empty"),
    options: z.object({
      A: z.string().trim().min(1, "Option A cannot be empty"),
      B: z.string().trim().min(1, "Option B cannot be empty"),
      C: z.string().trim().min(1, "Option C cannot be empty"),
      D: z.string().trim().min(1, "Option D cannot be empty"),
    }),
    correct: z.enum(["A", "B", "C", "D"], {
      errorMap: () => ({ message: "missing or invalid correct answer (must be A, B, C, or D)" }),
    }),
    explanation: z.string().trim().min(1, "explanation cannot be empty"),
    option_notes: z.record(z.string()),
    source: z.string().trim().min(1, "source cannot be empty"),
    last_verified: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "last_verified must be YYYY-MM-DD"),
    difficulty: z.enum(["easy", "moderate", "hard"], {
      errorMap: () => ({ message: "missing or invalid difficulty (must be easy, moderate, or hard)" }),
    }),
    tags: z.array(z.string()),
  })
  .superRefine((q, ctx) => {
    // Check for duplicate option texts (case-insensitive)
    const normalizedOptions = OPTION_KEYS.map((k) => q.options[k].trim().toLowerCase());
    if (new Set(normalizedOptions).size < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "two or more options are identical",
      });
    }

    // Ensure every wrong option has a non-empty note
    for (const key of OPTION_KEYS) {
      if (key !== q.correct) {
        const note = q.option_notes?.[key];
        if (!note || note.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["option_notes", key],
            message: `option_notes missing or empty for wrong option ${key}`,
          });
        }
      }
    }
  });

type Question = z.infer<typeof QuestionSchema>;

function readJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function isOlderThan12Months(dateStr: string): boolean {
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return true;
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  return parsed < twelveMonthsAgo;
}

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Load & validate topics
  if (!fs.existsSync(TOPICS_FILE)) {
    console.error("FATAL: Missing data/topics.json");
    process.exit(1);
  }
  const topicsParsed = z.array(TopicSchema).safeParse(readJsonFile(TOPICS_FILE));
  if (!topicsParsed.success) {
    console.error("FATAL: Invalid data/topics.json:", topicsParsed.error.format());
    process.exit(1);
  }
  const topics = topicsParsed.data;
  const validTopicIds = new Set(topics.map((t) => t.id));

  // 2. Load & validate months
  if (!fs.existsSync(MONTHS_FILE)) {
    console.error("FATAL: Missing data/months.json");
    process.exit(1);
  }
  const monthsParsed = z.array(MonthSchema).safeParse(readJsonFile(MONTHS_FILE));
  if (!monthsParsed.success) {
    console.error("FATAL: Invalid data/months.json:", monthsParsed.error.format());
    process.exit(1);
  }
  const months = monthsParsed.data;
  const validMonthIds = new Set(months.map((m) => m.id));

  // 3. Find all question JSON files (ignoring files starting with "_")
  if (!fs.existsSync(QUESTIONS_DIR)) {
    console.error("FATAL: Missing data/questions/ directory");
    process.exit(1);
  }
  const questionFiles = fs
    .readdirSync(QUESTIONS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort();

  const seenQuestionIds = new Map<string, string>(); // id -> filename
  const validQuestions: Array<{ file: string; data: Question }> = [];

  for (const fileName of questionFiles) {
    const relFile = `data/questions/${fileName}`;
    const fullPath = path.join(QUESTIONS_DIR, fileName);

    let rawJson: unknown;
    try {
      rawJson = readJsonFile(fullPath);
    } catch (err) {
      errors.push(`[${relFile}] Invalid JSON syntax: ${(err as Error).message}`);
      continue;
    }

    if (!Array.isArray(rawJson)) {
      errors.push(`[${relFile}] File must contain a JSON array of questions`);
      continue;
    }

    rawJson.forEach((item, index) => {
      const rawId =
        typeof item === "object" && item !== null && "id" in item && typeof item.id === "string"
          ? item.id
          : `index #${index}`;

      // Check duplicate IDs even before full schema validation
      if (typeof rawId === "string" && rawId !== `index #${index}`) {
        if (seenQuestionIds.has(rawId)) {
          errors.push(
            `[${relFile}] (${rawId}): duplicate question id (first seen in ${seenQuestionIds.get(rawId)})`
          );
        } else {
          seenQuestionIds.set(rawId, relFile);
        }
      }

      const result = QuestionSchema.safeParse(item);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path.length > 0 ? issue.path.join(".") : "object";
          errors.push(`[${relFile}] (${rawId}) [${field}]: ${issue.message}`);
        }
        return;
      }

      const q = result.data;

      // Cross-file checks: topic_id and month_id
      if (!validTopicIds.has(q.topic_id)) {
        errors.push(`[${relFile}] (${q.id}): unknown topic_id "${q.topic_id}"`);
      }
      if (q.month_id !== null && !validMonthIds.has(q.month_id)) {
        errors.push(`[${relFile}] (${q.id}): unknown month_id "${q.month_id}"`);
      }

      // Warning: last_verified older than 12 months
      if (isOlderThan12Months(q.last_verified)) {
        warnings.push(
          `[${relFile}] (${q.id}): last_verified (${q.last_verified}) is older than 12 months`
        );
      }

      validQuestions.push({ file: relFile, data: q });
    });
  }

  // 4. Coverage warnings & summary counts (active questions only)
  const activeQuestions = validQuestions.map((v) => v.data).filter((q) => q.status === "active");

  const topicSummary = topics.map((topic) => {
    const tQuestions = activeQuestions.filter((q) => q.topic_id === topic.id);
    const tFree = tQuestions.filter((q) => q.is_free);

    if (topic.active) {
      if (tFree.length < 10) {
        warnings.push(
          `Topic "${topic.id}" has only ${tFree.length} active is_free questions (target: at least 10)`
        );
      }
      for (const diff of DIFFICULTIES) {
        const freeAtDiff = tFree.filter((q) => q.difficulty === diff).length;
        if (freeAtDiff === 0) {
          warnings.push(
            `Topic "${topic.id}" has 0 active is_free questions at difficulty "${diff}"`
          );
        }
      }
      if (tQuestions.length < 30) {
        warnings.push(
          `Topic "${topic.id}" has only ${tQuestions.length} active questions (target: at least 30)`
        );
      }
    }

    return {
      Topic: topic.id,
      Easy: tQuestions.filter((q) => q.difficulty === "easy").length,
      Moderate: tQuestions.filter((q) => q.difficulty === "moderate").length,
      Hard: tQuestions.filter((q) => q.difficulty === "hard").length,
      Total: tQuestions.length,
      Free: tFree.length,
    };
  });

  const monthSummary = months.map((month) => {
    const mQuestions = activeQuestions.filter((q) => q.month_id === month.id);

    if (month.active && mQuestions.length < 20) {
      warnings.push(
        `Month "${month.id}" (${month.label}) has only ${mQuestions.length} active questions (target: at least 20)`
      );
    }

    return {
      Month: `${month.id} (${month.label})`,
      Easy: mQuestions.filter((q) => q.difficulty === "easy").length,
      Moderate: mQuestions.filter((q) => q.difficulty === "moderate").length,
      Hard: mQuestions.filter((q) => q.difficulty === "hard").length,
      Total: mQuestions.length,
    };
  });

  // 5. Print report
  console.log("\n=== MockValley Question Bank Validation ===\n");
  console.log(`Files scanned: ${questionFiles.length} | Valid questions parsed: ${validQuestions.length}`);

  console.log("\n--- Active Questions by Topic ---");
  console.table(topicSummary);

  console.log("--- Active Questions by Current Affairs Month ---");
  console.table(monthSummary);

  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  - ${w}`));
  } else {
    console.log("\n✅ No warnings.");
  }

  if (errors.length > 0) {
    console.error(`\n❌ ERRORS (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error("\nValidation FAILED. Fix the errors above before importing.\n");
    process.exit(1);
  }

  console.log("\n✅ Validation PASSED with 0 errors.\n");
}

main();