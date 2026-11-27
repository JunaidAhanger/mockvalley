export type OptionKey = "A" | "B" | "C" | "D";
export type DifficultyLevel = "easy" | "moderate" | "hard";
export type DifficultyFilter = "all" | DifficultyLevel;

export interface TopicSummary {
  id: string;
  name: string;
  order: number;
  easy_count: number;
  moderate_count: number;
  hard_count: number;
  total_count: number;
  free_used_count: number;
  free_quota_limit: number;
}

export interface PracticeQuestion {
  id: string;
  question: string;
  options: Record<OptionKey, string>;
  difficulty: DifficultyLevel;
}

export interface AnswerReview {
  selected: OptionKey;
  is_correct: boolean;
  correct: OptionKey;
  explanation: string;
  option_notes: Partial<Record<OptionKey, string>>;
}

export class QuotaReachedError extends Error {
  readonly code = "QUOTA_REACHED";

  constructor(message = "You have used all 10 free questions for this topic.") {
    super(message);
    this.name = "QuotaReachedError";
  }
}
export interface PlanItem {
  id: string;
  name: string;
  description: string;
  amount_paise: number;
  duration_days: number;
  display_order: number;
}

export interface ActivePassSummary {
  id: string;
  plan_id: string;
  starts_at: string;
  expires_at: string;
  status: string;
  razorpay_payment_id: string;
}