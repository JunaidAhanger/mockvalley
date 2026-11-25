import { supabase } from "./supabase";
import type {
  AnswerReview,
  DifficultyFilter,
  OptionKey,
  PracticeQuestion,
  TopicSummary,
} from "./types";

// Temporary Task 4 auth: signs in anonymously if no session exists yet.
// Anonymous users have no active pass in `passes`, so is_paid() evaluates to false.
export async function ensureAuthSession(): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Check your .env variables.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (session?.user?.id) {
    return session.user.id;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      error?.message ||
        "Could not start a guest session. Make sure Anonymous Sign-Ins is enabled in Supabase Auth."
    );
  }

  return data.user.id;
}

export async function checkIsPaid(): Promise<boolean> {
  if (!supabase) return false;
  await ensureAuthSession();

  const { data, error } = await supabase.rpc("is_paid");
  if (error) {
    throw new Error(`Could not check pass status: ${error.message}`);
  }
  return Boolean(data);
}

export async function fetchTopics(): Promise<TopicSummary[]> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  await ensureAuthSession();

  const { data, error } = await supabase.rpc("get_topics");
  if (error) {
    throw new Error(`Could not load topics: ${error.message}`);
  }
  return (data ?? []) as TopicSummary[];
}

export async function fetchQuestionIds(
  topicId: string,
  difficulty: DifficultyFilter
): Promise<string[]> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  await ensureAuthSession();

  const { data, error } = await supabase.rpc("get_question_list", {
    p_topic_id: topicId,
    p_difficulty: difficulty,
  });

  if (error) {
    throw new Error(`Could not load question list: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ question_id: string; total_count: number }>;
  return rows.map((row) => row.question_id);
}

export async function fetchQuestionById(questionId: string): Promise<PracticeQuestion> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  await ensureAuthSession();

  const { data, error } = await supabase.rpc("get_question", {
    p_question_id: questionId,
  });

  if (error) {
    throw new Error(`Could not load question: ${error.message}`);
  }

  const rows = (data ?? []) as PracticeQuestion[];
  if (rows.length === 0) {
    throw new Error("This question is unavailable or requires a paid pass.");
  }

  return rows[0];
}

export async function submitPracticeAnswer(
  questionId: string,
  selected: OptionKey
): Promise<AnswerReview> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  await ensureAuthSession();

  const { data, error } = await supabase.rpc("submit_answer", {
    p_question_id: questionId,
    p_selected: selected,
  });

  if (error) {
    throw new Error(`Could not submit answer: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    is_correct: boolean;
    correct: OptionKey;
    explanation: string;
    option_notes: Partial<Record<OptionKey, string>>;
  }>;

  if (rows.length === 0) {
    throw new Error("No answer details returned from server.");
  }

  return {
    selected,
    ...rows[0],
  };
}