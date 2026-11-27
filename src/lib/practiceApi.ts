import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  QuotaReachedError,
  type AnswerReview,
  type DifficultyFilter,
  type OptionKey,
  type PracticeQuestion,
  type TopicSummary,
} from "./types";

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  return data.session;
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  if (!supabase) return () => {};
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Check your .env variables.");
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function ensureUserProfile(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("ensure_profile");
  if (error) {
    throw new Error(`Could not initialize user profile: ${error.message}`);
  }
}

export async function checkIsPaid(): Promise<boolean> {
  if (!supabase) return false;

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

  const { data, error } = await supabase.rpc("submit_answer", {
    p_question_id: questionId,
    p_selected: selected,
  });

  if (error) {
    if (error.message.includes("QUOTA_REACHED")) {
      throw new QuotaReachedError(
        "You have reached the free limit of 10 distinct questions for this topic. You can still retry questions you already attempted, or upgrade for full access."
      );
    }
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